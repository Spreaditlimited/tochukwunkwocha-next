import crypto from "crypto"

import { normalizeDeliverableEmail } from "@/lib/email-address"
import { sendAbandonedEnrollmentReminderEmail } from "@/lib/enrollment-notifications"
import { prisma } from "@/lib/prisma"
import {
  isPermanentPaystackReconciliationError,
  reconcileCoursePaystackOrders
} from "@/lib/payments/paystack-reconciliation"
import { publicSiteUrl } from "@/lib/public-site-url"
import { sendEnrollmentPaymentReminderWhatsApp } from "@/lib/transactional-whatsapp"

type FollowupRow = {
  id: bigint
  orderUuid: string
  reminderCount: number | bigint
  emailCycleSent: number | bigint
  whatsappCycleSent: number | bigint
  whatsappOptedIn: number | bigint | boolean | null
}

type AttemptRow = {
  orderUuid: string
  status: string | null
  providerReference: string | null
  email: string | null
  firstName: string | null
  phone: string | null
  recipientEmail: string | null
  recipientName: string | null
  recipientPhone: string | null
  courseSlug: string | null
  batchKey: string | null
  batchLabel: string | null
  batchStatus: string | null
  batchStartAt: Date | null
  enrollmentMode: string | null
  enrollmentLocked: number | bigint | boolean | null
  courseStartAt: Date | null
}

export const MAX_ABANDONED_ENROLLMENT_REMINDERS = 3

let tablePromise: Promise<void> | null = null

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function siteBaseUrl() {
  return publicSiteUrl()
}

function signingSecret() {
  const secret = clean(
    process.env.NOTIFICATION_OUTBOX_SECRET || process.env.AUTH_SECRET || process.env.ADMIN_SESSION_SECRET,
    1000
  )
  if (!secret) throw new Error("Abandoned enrollment reminder signing is not configured.")
  return secret
}

function stopToken(orderUuid: string) {
  const uuid = clean(orderUuid, 64)
  const signature = crypto.createHmac("sha256", signingSecret()).update(uuid).digest("base64url")
  return `${uuid}.${signature}`
}

export function verifyAbandonedEnrollmentStopToken(value: unknown) {
  const [orderUuid, signature, extra] = clean(value, 200).split(".")
  if (!orderUuid || !signature || extra) return ""
  const expected = crypto.createHmac("sha256", signingSecret()).update(orderUuid).digest()
  let received: Buffer
  try {
    received = Buffer.from(signature, "base64url")
  } catch {
    return ""
  }
  return received.length === expected.length && crypto.timingSafeEqual(received, expected) ? clean(orderUuid, 64) : ""
}

export function ensureAbandonedEnrollmentFollowupTable() {
  if (!tablePromise) {
    tablePromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS tochukwu_whatsapp_contacts (
          id BIGINT NOT NULL AUTO_INCREMENT,
          student_account_id BIGINT NULL,
          email VARCHAR(190) NULL,
          full_name VARCHAR(180) NULL,
          phone_e164 VARCHAR(20) NOT NULL,
          course_slug VARCHAR(120) NULL,
          source VARCHAR(80) NULL,
          whatsapp_opted_in TINYINT(1) NOT NULL DEFAULT 0,
          whatsapp_opted_in_at DATETIME NULL,
          whatsapp_opted_out_at DATETIME NULL,
          opt_in_version VARCHAR(80) NULL,
          opt_in_source_url VARCHAR(500) NULL,
          created_at DATETIME NOT NULL,
          updated_at DATETIME NOT NULL,
          PRIMARY KEY (id),
          UNIQUE KEY uniq_tochukwu_whatsapp_phone (phone_e164),
          KEY idx_tochukwu_whatsapp_email (email),
          KEY idx_tochukwu_whatsapp_optin (whatsapp_opted_in, updated_at),
          KEY idx_tochukwu_whatsapp_course (course_slug)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `)
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS tochukwu_abandoned_enrollment_followups (
        id BIGINT NOT NULL AUTO_INCREMENT,
        order_uuid VARCHAR(64) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        whatsapp_opted_in TINYINT(1) NOT NULL DEFAULT 0,
        reminder_count INT NOT NULL DEFAULT 0,
        email_cycle_sent INT NOT NULL DEFAULT 0,
        whatsapp_cycle_sent INT NOT NULL DEFAULT 0,
        first_reminder_at DATETIME NOT NULL,
        next_reminder_at DATETIME NOT NULL,
        last_reminder_at DATETIME NULL,
        attempts INT NOT NULL DEFAULT 0,
        locked_at DATETIME NULL,
        stopped_at DATETIME NULL,
        stopped_reason VARCHAR(80) NULL,
        last_error VARCHAR(1000) NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_tochukwu_abandoned_order (order_uuid),
        KEY idx_tochukwu_abandoned_due (status, next_reminder_at),
        KEY idx_tochukwu_abandoned_lock (status, locked_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)
    })().catch((error) => {
      tablePromise = null
      throw error
    })
  }
  return tablePromise
}

export async function enqueueAbandonedEnrollmentFollowup(input: {
  orderUuid: string
  whatsappOptedIn: boolean
}) {
  await ensureAbandonedEnrollmentFollowupTable()
  const orderUuid = clean(input.orderUuid, 64)
  if (!orderUuid) throw new Error("Checkout order is required for abandoned enrollment follow-up.")
  const now = new Date()
  const firstReminderAt = new Date(now.getTime() + 20 * 60_000)
  await prisma.$executeRaw`
    INSERT INTO tochukwu_abandoned_enrollment_followups
      (order_uuid, status, whatsapp_opted_in, reminder_count, email_cycle_sent, whatsapp_cycle_sent,
       first_reminder_at, next_reminder_at, attempts, created_at, updated_at)
    VALUES
      (${orderUuid}, 'pending', ${input.whatsappOptedIn ? 1 : 0}, 0, 0, 0,
       ${firstReminderAt}, ${firstReminderAt}, 0, ${now}, ${now})
    ON DUPLICATE KEY UPDATE
      whatsapp_opted_in = VALUES(whatsapp_opted_in),
      updated_at = VALUES(updated_at)
  `
}

async function backfillExistingAttempts() {
  await prisma.$executeRaw`
    INSERT IGNORE INTO tochukwu_abandoned_enrollment_followups
      (order_uuid, status, whatsapp_opted_in, reminder_count, email_cycle_sent, whatsapp_cycle_sent,
       first_reminder_at, next_reminder_at, attempts, created_at, updated_at)
    SELECT co.order_uuid, 'pending',
           CASE WHEN EXISTS (
             SELECT 1 FROM tochukwu_whatsapp_contacts wc
             WHERE wc.whatsapp_opted_in = 1
               AND (
                 LOWER(wc.email) COLLATE utf8mb4_unicode_ci = LOWER(co.email) COLLATE utf8mb4_unicode_ci
                 OR wc.phone_e164 COLLATE utf8mb4_unicode_ci = co.phone COLLATE utf8mb4_unicode_ci
               )
           ) THEN 1 ELSE 0 END,
           0, 0, 0, NOW(), NOW(), 0, NOW(), NOW()
    FROM course_orders co
    WHERE LOWER(COALESCE(co.provider, '')) = 'paystack'
      AND co.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      AND COALESCE(co.order_uuid, '') <> ''
      AND LOWER(COALESCE(co.status, 'pending')) NOT IN (
        'paid', 'duplicate_payment_review', 'cancelled', 'canceled', 'abandoned', 'failed', 'reversed', 'expired'
      )
  `
}

export async function stopStaleUnsentAbandonedEnrollmentFollowups() {
  await ensureAbandonedEnrollmentFollowupTable()
  const stopped = await prisma.$executeRaw`
    UPDATE tochukwu_abandoned_enrollment_followups f
    JOIN course_orders co
      ON co.order_uuid COLLATE utf8mb4_unicode_ci = f.order_uuid COLLATE utf8mb4_unicode_ci
    SET f.status = 'stopped', f.stopped_at = NOW(), f.stopped_reason = 'historical_retry_suppressed',
        f.locked_at = NULL, f.last_error = NULL, f.updated_at = NOW()
    WHERE f.status IN ('pending', 'retry', 'processing')
      AND co.created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
      AND f.reminder_count = 0
      AND f.email_cycle_sent = 0
      AND f.whatsapp_cycle_sent = 0
      AND f.last_error = 'Paystack verification was unavailable; the reminder was deferred.'
  `
  return Number(stopped || 0)
}

async function loadAttempt(orderUuid: string) {
  const rows = await prisma.$queryRaw<AttemptRow[]>`
    SELECT co.order_uuid AS orderUuid, co.status, co.provider_reference AS providerReference,
           co.email, co.first_name AS firstName, co.phone,
           COALESCE(NULLIF(fa.parent_email, ''), co.email) AS recipientEmail,
           COALESCE(NULLIF(fa.parent_name, ''), co.first_name) AS recipientName,
           COALESCE(NULLIF(fa.parent_phone, ''), co.phone) AS recipientPhone,
           co.course_slug AS courseSlug,
           co.batch_key AS batchKey, co.batch_label AS batchLabel,
           cb.status AS batchStatus, cb.batch_start_at AS batchStartAt,
           lc.enrollment_mode AS enrollmentMode, lc.is_enrollment_locked AS enrollmentLocked,
           lc.release_at AS courseStartAt
    FROM course_orders co
    LEFT JOIN course_batches cb
      ON cb.course_slug COLLATE utf8mb4_unicode_ci = co.course_slug COLLATE utf8mb4_unicode_ci
     AND cb.batch_key COLLATE utf8mb4_unicode_ci = co.batch_key COLLATE utf8mb4_unicode_ci
    LEFT JOIN tochukwu_learning_courses lc
      ON lc.course_slug COLLATE utf8mb4_unicode_ci = co.course_slug COLLATE utf8mb4_unicode_ci
    LEFT JOIN family_children fc
      ON LOWER(fc.email) COLLATE utf8mb4_unicode_ci = LOWER(co.email) COLLATE utf8mb4_unicode_ci
     AND fc.status = 'active'
    LEFT JOIN family_accounts fa
      ON fa.id = fc.family_id AND fa.status = 'active'
    WHERE co.order_uuid = ${orderUuid}
    LIMIT 1
  `
  return rows[0] || null
}

async function stopFollowup(id: bigint, reason: string) {
  await prisma.$executeRaw`
    UPDATE tochukwu_abandoned_enrollment_followups
    SET status = 'stopped', stopped_at = NOW(), stopped_reason = ${clean(reason, 80)},
        locked_at = NULL, last_error = NULL, updated_at = NOW()
    WHERE id = ${id}
  `
}

async function matchingPaidOrderExists(attempt: AttemptRow) {
  const rows = await prisma.$queryRaw<Array<{ total: number | bigint }>>`
    SELECT COUNT(*) AS total
    FROM course_orders
    WHERE status = 'paid'
      AND LOWER(COALESCE(email, '')) = LOWER(${clean(attempt.email, 190)})
      AND course_slug = ${clean(attempt.courseSlug, 120)}
      AND COALESCE(batch_key, '') = ${clean(attempt.batchKey, 64)}
  `
  return Number(rows[0]?.total || 0) > 0
}

async function newerAttemptExists(attempt: AttemptRow) {
  const rows = await prisma.$queryRaw<Array<{ total: number | bigint }>>`
    SELECT COUNT(*) AS total
    FROM course_orders newer
    JOIN course_orders current
      ON current.order_uuid COLLATE utf8mb4_unicode_ci = CAST(${attempt.orderUuid} AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
    WHERE newer.created_at > current.created_at
      AND LOWER(COALESCE(newer.provider, '')) = 'paystack'
      AND LOWER(COALESCE(newer.status, 'pending')) NOT IN ('paid', 'duplicate_payment_review')
      AND LOWER(COALESCE(newer.email, '')) COLLATE utf8mb4_unicode_ci = LOWER(COALESCE(current.email, '')) COLLATE utf8mb4_unicode_ci
      AND newer.course_slug COLLATE utf8mb4_unicode_ci = current.course_slug COLLATE utf8mb4_unicode_ci
      AND COALESCE(newer.batch_key, '') COLLATE utf8mb4_unicode_ci = COALESCE(current.batch_key, '') COLLATE utf8mb4_unicode_ci
  `
  return Number(rows[0]?.total || 0) > 0
}

function cutoffPassed(attempt: AttemptRow) {
  if (Boolean(Number(attempt.enrollmentLocked || 0))) return true
  const batchMode = clean(attempt.enrollmentMode, 24).toLowerCase() !== "immediate"
  if (batchMode && attempt.batchStatus && clean(attempt.batchStatus, 32).toLowerCase() !== "open") return true
  const cutoff = batchMode ? attempt.batchStartAt : attempt.courseStartAt
  return cutoff ? cutoff.getTime() <= Date.now() : false
}

async function expireAndDeleteAttempt(row: FollowupRow) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE tochukwu_abandoned_enrollment_followups
      SET status = 'expired', stopped_at = NOW(), stopped_reason = 'enrollment_closed',
          locked_at = NULL, last_error = NULL, updated_at = NOW()
      WHERE id = ${row.id}
    `
    await tx.$executeRaw`
      DELETE FROM course_orders
      WHERE order_uuid = ${row.orderUuid}
        AND LOWER(COALESCE(status, 'pending')) NOT IN ('paid', 'duplicate_payment_review')
      LIMIT 1
    `
  })
}

export async function stopAbandonedEnrollmentFollowups(orderUuidInput: string, reason = "customer_opt_out") {
  await ensureAbandonedEnrollmentFollowupTable()
  const orderUuid = clean(orderUuidInput, 64)
  const attempt = orderUuid ? await loadAttempt(orderUuid) : null
  if (!attempt) return false
  await prisma.$executeRaw`
    UPDATE tochukwu_abandoned_enrollment_followups f
    JOIN course_orders co
      ON co.order_uuid COLLATE utf8mb4_unicode_ci = f.order_uuid COLLATE utf8mb4_unicode_ci
    SET f.status = 'stopped', f.stopped_at = NOW(), f.stopped_reason = ${clean(reason, 80)},
        f.locked_at = NULL, f.updated_at = NOW()
    WHERE LOWER(COALESCE(co.email, '')) = LOWER(${clean(attempt.email, 190)})
      AND co.course_slug = ${clean(attempt.courseSlug, 120)}
      AND COALESCE(co.batch_key, '') = ${clean(attempt.batchKey, 64)}
      AND f.status IN ('pending', 'retry', 'processing')
  `
  return true
}

export async function processAbandonedEnrollmentFollowups(input?: { limit?: number }) {
  await ensureAbandonedEnrollmentFollowupTable()
  await backfillExistingAttempts()
  await stopStaleUnsentAbandonedEnrollmentFollowups()
  const limit = Math.max(1, Math.min(50, Math.round(Number(input?.limit || 20))))
  await prisma.$executeRaw`
    UPDATE tochukwu_abandoned_enrollment_followups
    SET status = 'stopped', stopped_at = NOW(), stopped_reason = 'reminder_limit_reached',
        locked_at = NULL, last_error = NULL, updated_at = NOW()
    WHERE status IN ('pending', 'retry')
      AND reminder_count >= ${MAX_ABANDONED_ENROLLMENT_REMINDERS}
      AND email_cycle_sent >= ${MAX_ABANDONED_ENROLLMENT_REMINDERS}
      AND (whatsapp_opted_in = 0 OR whatsapp_cycle_sent >= ${MAX_ABANDONED_ENROLLMENT_REMINDERS})
  `
  await prisma.$executeRaw`
    UPDATE tochukwu_abandoned_enrollment_followups
    SET status = 'retry', locked_at = NULL, updated_at = NOW()
    WHERE status = 'processing' AND locked_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)
  `
  const rows = await prisma.$queryRaw<FollowupRow[]>`
    SELECT id, order_uuid AS orderUuid, reminder_count AS reminderCount,
           email_cycle_sent AS emailCycleSent, whatsapp_cycle_sent AS whatsappCycleSent,
           whatsapp_opted_in AS whatsappOptedIn
    FROM tochukwu_abandoned_enrollment_followups
    WHERE status IN ('pending', 'retry') AND next_reminder_at <= NOW()
    ORDER BY next_reminder_at ASC, id ASC
    LIMIT ${limit}
  `

  let sent = 0
  let stopped = 0
  let expired = 0
  let failed = 0
  let whatsappFailed = 0
  for (const row of rows) {
    const claimed = await prisma.$executeRaw`
      UPDATE tochukwu_abandoned_enrollment_followups
      SET status = 'processing', locked_at = NOW(), updated_at = NOW()
      WHERE id = ${row.id} AND status IN ('pending', 'retry')
    `
    if (!Number(claimed || 0)) continue

    try {
      let attempt = await loadAttempt(row.orderUuid)
      if (!attempt) {
        await stopFollowup(row.id, "order_missing")
        stopped += 1
        continue
      }
      if (attempt.providerReference) {
        const reconciliation = await reconcileCoursePaystackOrders({ orderUuid: row.orderUuid, limit: 1 })
        if (reconciliation.failed) {
          throw new Error("Paystack verification was unavailable; the reminder was deferred.")
        }
        if (reconciliation.mismatched || reconciliation.duplicateReview) {
          await stopFollowup(row.id, "payment_review_required")
          stopped += 1
          continue
        }
        attempt = await loadAttempt(row.orderUuid)
        if (!attempt) {
          await stopFollowup(row.id, "order_missing")
          stopped += 1
          continue
        }
      }
      const attemptStatus = clean(attempt.status, 40).toLowerCase()
      if (["cancelled", "canceled", "abandoned", "failed", "reversed", "expired"].includes(attemptStatus)) {
        await stopFollowup(row.id, "order_not_payable")
        stopped += 1
        continue
      }
      const recipientEmail = normalizeDeliverableEmail(attempt.recipientEmail, 190)
      if (!recipientEmail) {
        await stopFollowup(row.id, "undeliverable_recipient")
        stopped += 1
        continue
      }
      if (attemptStatus === "paid" || await matchingPaidOrderExists(attempt)) {
        await stopFollowup(row.id, "payment_confirmed")
        stopped += 1
        continue
      }
      if (cutoffPassed(attempt)) {
        await expireAndDeleteAttempt(row)
        expired += 1
        continue
      }
      if (await newerAttemptExists(attempt)) {
        await stopFollowup(row.id, "superseded")
        stopped += 1
        continue
      }

      const currentReminderCount = Math.min(
        MAX_ABANDONED_ENROLLMENT_REMINDERS,
        Number(row.reminderCount || 0)
      )
      const whatsappRequired = Boolean(Number(row.whatsappOptedIn || 0)) && Boolean(clean(attempt.recipientPhone, 80))
      const currentCycleIncomplete = currentReminderCount > 0 && (
        Number(row.emailCycleSent || 0) < currentReminderCount
        || (whatsappRequired && Number(row.whatsappCycleSent || 0) < currentReminderCount)
      )
      const reminderNumber = currentCycleIncomplete
        ? currentReminderCount
        : Math.min(MAX_ABANDONED_ENROLLMENT_REMINDERS, currentReminderCount + 1)
      const checkoutUrl = `${siteBaseUrl()}/checkout/${encodeURIComponent(clean(attempt.courseSlug, 120))}`
      const stopUrl = `${siteBaseUrl()}/api/checkout/follow-up/stop?token=${encodeURIComponent(stopToken(row.orderUuid))}`
      let emailCycleSent = Number(row.emailCycleSent || 0)
      if (emailCycleSent < reminderNumber) {
        await sendAbandonedEnrollmentReminderEmail({
          email: recipientEmail,
          fullName: attempt.recipientName,
          courseSlug: attempt.courseSlug,
          batchLabel: attempt.batchLabel,
          checkoutUrl,
          stopUrl,
          reminderNumber
        })
        await prisma.$executeRaw`
          UPDATE tochukwu_abandoned_enrollment_followups
          SET email_cycle_sent = ${reminderNumber}, updated_at = NOW()
          WHERE id = ${row.id}
        `
        emailCycleSent = reminderNumber
      }
      let whatsappError = ""
      let whatsappCycleSent = Number(row.whatsappCycleSent || 0)
      if (whatsappRequired && whatsappCycleSent < reminderNumber) {
        try {
          await sendEnrollmentPaymentReminderWhatsApp({
            phone: attempt.recipientPhone,
            fullName: attempt.recipientName,
            courseSlug: attempt.courseSlug,
            batchLabel: attempt.batchLabel,
            checkoutUrl,
            stopUrl
          })
          await prisma.$executeRaw`
            UPDATE tochukwu_abandoned_enrollment_followups
            SET whatsapp_cycle_sent = ${reminderNumber}, updated_at = NOW()
            WHERE id = ${row.id}
          `
          whatsappCycleSent = reminderNumber
        } catch (error) {
          whatsappError = clean(error instanceof Error ? error.message : error, 1000)
          whatsappFailed += 1
        }
      }
      const reminderLimitReached = reminderNumber >= MAX_ABANDONED_ENROLLMENT_REMINDERS
        && emailCycleSent >= MAX_ABANDONED_ENROLLMENT_REMINDERS
        && (!whatsappRequired || whatsappCycleSent >= MAX_ABANDONED_ENROLLMENT_REMINDERS)
      const nextReminderAt = new Date(Date.now() + (whatsappError ? 15 * 60_000 : 24 * 60 * 60_000))
      await prisma.$executeRaw`
        UPDATE tochukwu_abandoned_enrollment_followups
        SET status = ${reminderLimitReached ? "stopped" : whatsappError ? "retry" : "pending"},
            reminder_count = ${reminderNumber}, last_reminder_at = NOW(),
            next_reminder_at = ${nextReminderAt}, attempts = ${whatsappError ? 1 : 0}, locked_at = NULL,
            stopped_at = ${reminderLimitReached ? new Date() : null},
            stopped_reason = ${reminderLimitReached ? "reminder_limit_reached" : null},
            last_error = ${whatsappError || null}, updated_at = NOW()
        WHERE id = ${row.id}
      `
      sent += 1
    } catch (error) {
      if (isPermanentPaystackReconciliationError(error)) {
        await stopFollowup(row.id, "reconciliation_configuration_error")
        stopped += 1
        continue
      }
      const message = clean(error instanceof Error ? error.message : error, 1000)
      const nextAttemptAt = new Date(Date.now() + 15 * 60_000)
      await prisma.$executeRaw`
        UPDATE tochukwu_abandoned_enrollment_followups
        SET status = 'retry', attempts = attempts + 1, next_reminder_at = ${nextAttemptAt},
            locked_at = NULL, last_error = ${message}, updated_at = NOW()
        WHERE id = ${row.id}
      `
      failed += 1
    }
  }
  return { checked: rows.length, sent, stopped, expired, failed, whatsappFailed }
}
