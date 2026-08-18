import { normalizeDeliverableEmail } from "@/lib/email-address"
import { sendEmail } from "@/lib/email"
import { prisma } from "@/lib/prisma"
import { publicAbsoluteUrl } from "@/lib/public-site-url"

type ReminderQueueRow = {
  id: bigint
  planId: bigint
  reminderCount: number | bigint
  attempts: number | bigint
}

type PlanSnapshot = {
  planUuid: string
  email: string | null
  fullName: string | null
  courseSlug: string | null
  courseTitle: string | null
  batchLabel: string | null
  buyerType: string | null
  seatCount: number | bigint | null
  provider: string | null
  currency: string | null
  targetAmountMinor: number | bigint | null
  totalPaidMinor: number | bigint | null
  status: string | null
  createdAt: Date
  lastPaymentAt: Date | null
}

export const MAX_INSTALLMENT_REMINDERS = 4

let tablePromise: Promise<void> | null = null

function clean(value: unknown, max = 1000) {
  return String(value || "").trim().slice(0, max)
}

function escapeHtml(value: unknown) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function courseName(slug: unknown, title: unknown) {
  const configured = clean(title, 220)
  if (configured) return configured
  const value = clean(slug, 120)
  const names: Record<string, string> = {
    "prompt-to-profit": "Prompt to Profit",
    "prompt-to-profit-holiday": "Prompt to Profit Holiday",
    "prompt-to-production": "Prompt to Profit Advanced",
    "ai-for-everyday-business-owners": "AI for Everyday Business Owners"
  }
  return names[value.toLowerCase()] || value || "your selected course"
}

function money(currencyInput: unknown, minorInput: unknown) {
  const currency = clean(currencyInput, 10).toUpperCase() || "NGN"
  const minor = Math.max(0, Math.round(Number(minorInput || 0)))
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minor / 100)
  } catch {
    return `${currency} ${(minor / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
}

export async function ensureInstallmentReminderTable() {
  if (!tablePromise) {
    tablePromise = prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS tochukwu_installment_reminders (
        id BIGINT NOT NULL AUTO_INCREMENT,
        plan_id BIGINT NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'pending',
        reminder_count INTEGER NOT NULL DEFAULT 0,
        next_reminder_at DATETIME NOT NULL,
        last_reminder_at DATETIME NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        locked_at DATETIME NULL,
        stopped_at DATETIME NULL,
        stopped_reason VARCHAR(80) NULL,
        last_error VARCHAR(1000) NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_tochukwu_installment_reminder_plan (plan_id),
        KEY idx_tochukwu_installment_reminder_due (status, next_reminder_at),
        KEY idx_tochukwu_installment_reminder_lock (status, locked_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).then(() => undefined).catch((error) => {
      tablePromise = null
      throw error
    })
  }
  return tablePromise
}

async function syncReminderQueue() {
  await prisma.$executeRaw`
    INSERT IGNORE INTO tochukwu_installment_reminders
      (plan_id, status, reminder_count, next_reminder_at, attempts, created_at, updated_at)
    SELECT pl.id, 'pending', 0,
      CASE
        WHEN MAX(ip.paid_at) IS NOT NULL THEN GREATEST(NOW(), DATE_ADD(MAX(ip.paid_at), INTERVAL 7 DAY))
        ELSE GREATEST(NOW(), DATE_ADD(pl.created_at, INTERVAL 2 DAY))
      END,
      0, NOW(), NOW()
    FROM student_installment_plans pl
    LEFT JOIN student_installment_payments ip ON ip.plan_id = pl.id AND ip.status = 'paid'
    WHERE pl.status = 'open'
      AND pl.target_amount_minor > pl.total_paid_minor
    GROUP BY pl.id, pl.created_at
  `

  await prisma.$executeRaw`
    UPDATE tochukwu_installment_reminders reminder
    JOIN student_installment_plans pl ON pl.id = reminder.plan_id
    SET reminder.status = 'stopped', reminder.stopped_at = NOW(),
        reminder.stopped_reason = CASE WHEN pl.status = 'open' THEN 'balance_completed' ELSE CONCAT('plan_', COALESCE(pl.status, 'closed')) END,
        reminder.locked_at = NULL, reminder.updated_at = NOW()
    WHERE reminder.status IN ('pending', 'retry', 'processing')
      AND (pl.status <> 'open' OR pl.total_paid_minor >= pl.target_amount_minor)
  `

  await prisma.$executeRaw`
    UPDATE tochukwu_installment_reminders
    SET status = 'retry', locked_at = NULL, next_reminder_at = NOW(), updated_at = NOW()
    WHERE status = 'processing' AND locked_at < DATE_SUB(NOW(), INTERVAL 20 MINUTE)
  `
}

async function loadSnapshot(planId: bigint) {
  const rows = await prisma.$queryRaw<PlanSnapshot[]>`
    SELECT pl.plan_uuid AS planUuid, sa.email, sa.full_name AS fullName,
      pl.course_slug AS courseSlug, lc.course_title AS courseTitle, pl.batch_label AS batchLabel,
      pl.buyer_type AS buyerType, pl.seat_count AS seatCount, pl.provider, pl.currency,
      pl.target_amount_minor AS targetAmountMinor, pl.total_paid_minor AS totalPaidMinor,
      pl.status, pl.created_at AS createdAt, MAX(ip.paid_at) AS lastPaymentAt
    FROM student_installment_plans pl
    JOIN student_accounts sa ON sa.id = pl.account_id
    LEFT JOIN tochukwu_learning_courses lc
      ON lc.course_slug COLLATE utf8mb4_unicode_ci = pl.course_slug COLLATE utf8mb4_unicode_ci
    LEFT JOIN student_installment_payments ip ON ip.plan_id = pl.id AND ip.status = 'paid'
    WHERE pl.id = ${planId}
    GROUP BY pl.id, pl.plan_uuid, sa.email, sa.full_name, pl.course_slug, lc.course_title,
      pl.batch_label, pl.buyer_type, pl.seat_count, pl.provider, pl.currency,
      pl.target_amount_minor, pl.total_paid_minor, pl.status, pl.created_at
    LIMIT 1
  `
  return rows[0] || null
}

export async function sendInstallmentBalanceReminderEmail(snapshot: PlanSnapshot, reminderNumber: number) {
  const email = normalizeDeliverableEmail(snapshot.email, 190)
  if (!email) return { ok: false, skipped: true, reason: "invalid_email" }
  const course = courseName(snapshot.courseSlug, snapshot.courseTitle)
  const target = Math.max(0, Number(snapshot.targetAmountMinor || 0))
  const paid = Math.max(0, Number(snapshot.totalPaidMinor || 0))
  const remaining = Math.max(0, target - paid)
  const dashboardUrl = publicAbsoluteUrl("/dashboard/installments")
  const batch = clean(snapshot.batchLabel, 120)
  const isGroup = clean(snapshot.buyerType, 40).toLowerCase() === "family"
  const seats = Math.max(1, Number(snapshot.seatCount || 1))
  const provider = clean(snapshot.provider, 40).toLowerCase() === "stripe" ? "Stripe" : "Paystack"
  const subject = `IMPORTANT: ${money(snapshot.currency, remaining)} remains on your ${course} plan`
  const paymentContext = paid > 0
    ? `We have recorded ${money(snapshot.currency, paid)} toward your plan. Your current balance is ${money(snapshot.currency, remaining)}.`
    : `No payment has been recorded on this plan yet. The current balance is ${money(snapshot.currency, remaining)}.`
  const summary = [
    `Course: ${course}`,
    batch ? `Batch: ${batch}` : "",
    isGroup ? `Group seats: ${seats}` : "",
    `Plan total: ${money(snapshot.currency, target)}`,
    `Paid: ${money(snapshot.currency, paid)}`,
    `Remaining: ${money(snapshot.currency, remaining)}`,
    `Payment provider: ${provider}`,
    `Plan reference: ${clean(snapshot.planUuid, 80)}`
  ].filter(Boolean)

  return sendEmail({
    to: email,
    subject,
    text: [
      `Hello ${clean(snapshot.fullName, 120) || "there"},`,
      "",
      `This is balance reminder ${Math.max(1, reminderNumber)} of ${MAX_INSTALLMENT_REMINDERS} for your installment plan.`,
      paymentContext,
      "",
      ...summary,
      "",
      `Review the plan, make a secure payment, and see every recorded top-up here: ${dashboardUrl}`,
      "Course access is not activated by creating the plan alone. Once the full amount is recorded, return to the installment dashboard to complete enrollment.",
      "If you have just paid, the dashboard is the authoritative record; please allow the payment provider a short time to confirm the transaction before trying again.",
      "",
      "Tochukwu Tech and AI Academy"
    ].join("\n"),
    html: `
      <p>Hello ${escapeHtml(clean(snapshot.fullName, 120) || "there")},</p>
      <p>This is balance reminder <strong>${Math.max(1, reminderNumber)} of ${MAX_INSTALLMENT_REMINDERS}</strong> for your installment plan.</p>
      <p>${escapeHtml(paymentContext)}</p>
      <div style="margin:20px 0;padding:16px;border:1px solid #dbe7f3;border-radius:10px;background:#f8fbff;">
        ${summary.map((line) => `<p style="margin:0 0 7px;">${escapeHtml(line)}</p>`).join("")}
      </div>
      <p><a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;background:#0d4f9a;color:#ffffff;text-decoration:none;font-weight:800;padding:12px 18px;border-radius:10px;">Review plan and continue payment</a></p>
      <p>Course access is not activated by creating the plan alone. Once the full amount is recorded, return to the installment dashboard to complete enrollment.</p>
      <p style="font-size:13px;color:#64748b;">If you have just paid, the dashboard is the authoritative record; please allow the payment provider a short time to confirm the transaction before trying again.</p>
      <p>Tochukwu Tech and AI Academy</p>
    `
  })
}

export async function processInstallmentReminders(input?: { limit?: number }) {
  await ensureInstallmentReminderTable()
  await syncReminderQueue()
  const limit = Math.max(1, Math.min(100, Math.round(Number(input?.limit || 50))))
  const rows = await prisma.$queryRaw<ReminderQueueRow[]>`
    SELECT id, plan_id AS planId, reminder_count AS reminderCount, attempts
    FROM tochukwu_installment_reminders
    WHERE status IN ('pending', 'retry')
      AND next_reminder_at <= NOW()
      AND reminder_count < ${MAX_INSTALLMENT_REMINDERS}
    ORDER BY next_reminder_at ASC, id ASC
    LIMIT ${limit}
  `

  let sent = 0
  let stopped = 0
  let failed = 0
  for (const row of rows) {
    const claimed = await prisma.$executeRaw`
      UPDATE tochukwu_installment_reminders
      SET status = 'processing', locked_at = NOW(), updated_at = NOW()
      WHERE id = ${row.id} AND status IN ('pending', 'retry')
    `
    if (!Number(claimed || 0)) continue
    try {
      const snapshot = await loadSnapshot(row.planId)
      const target = Number(snapshot?.targetAmountMinor || 0)
      const paid = Number(snapshot?.totalPaidMinor || 0)
      if (!snapshot || clean(snapshot.status, 24).toLowerCase() !== "open" || target <= paid) {
        await prisma.$executeRaw`
          UPDATE tochukwu_installment_reminders
          SET status = 'stopped', stopped_at = NOW(), stopped_reason = 'plan_closed', locked_at = NULL, updated_at = NOW()
          WHERE id = ${row.id}
        `
        stopped += 1
        continue
      }

      const activityAt = snapshot.lastPaymentAt || snapshot.createdAt
      const waitDays = snapshot.lastPaymentAt ? 7 : 2
      const eligibleAt = new Date(activityAt.getTime() + waitDays * 24 * 60 * 60_000)
      if (eligibleAt.getTime() > Date.now()) {
        await prisma.$executeRaw`
          UPDATE tochukwu_installment_reminders
          SET status = 'pending', next_reminder_at = ${eligibleAt}, locked_at = NULL, last_error = NULL, updated_at = NOW()
          WHERE id = ${row.id}
        `
        continue
      }

      const reminderNumber = Number(row.reminderCount || 0) + 1
      const delivery = await sendInstallmentBalanceReminderEmail(snapshot, reminderNumber)
      if (!delivery.ok) {
        if (delivery.skipped) {
          const skippedReason = "reason" in delivery ? delivery.reason : "delivery_skipped"
          await prisma.$executeRaw`
            UPDATE tochukwu_installment_reminders
            SET status = 'stopped', stopped_at = NOW(), stopped_reason = ${skippedReason},
                locked_at = NULL, last_error = NULL, updated_at = NOW()
            WHERE id = ${row.id}
          `
          stopped += 1
          continue
        }
        throw new Error("Installment reminder email was not sent.")
      }
      const completed = reminderNumber >= MAX_INSTALLMENT_REMINDERS
      await prisma.$executeRaw`
        UPDATE tochukwu_installment_reminders
        SET status = ${completed ? "completed" : "pending"}, reminder_count = ${reminderNumber},
            next_reminder_at = DATE_ADD(NOW(), INTERVAL 7 DAY), last_reminder_at = NOW(),
            attempts = 0, locked_at = NULL, last_error = NULL, updated_at = NOW()
        WHERE id = ${row.id}
      `
      sent += 1
    } catch (error) {
      const attempts = Number(row.attempts || 0) + 1
      const delayMinutes = Math.min(720, 15 * 2 ** Math.min(5, attempts))
      const retryAt = new Date(Date.now() + delayMinutes * 60_000)
      await prisma.$executeRaw`
        UPDATE tochukwu_installment_reminders
        SET status = 'retry', attempts = attempts + 1, locked_at = NULL,
            next_reminder_at = ${retryAt},
            last_error = ${clean(error instanceof Error ? error.message : error, 1000)}, updated_at = NOW()
        WHERE id = ${row.id}
      `
      failed += 1
    }
  }
  return { considered: rows.length, sent, stopped, failed }
}
