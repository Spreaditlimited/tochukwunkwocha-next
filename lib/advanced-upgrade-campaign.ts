import crypto from "crypto"
import { Prisma } from "@prisma/client"

import { advancedUpgradeCampaignContent, type AdvancedUpgradeEmailContent } from "@/lib/advanced-upgrade-campaign-content"
import {
  BASIC_ADVANCED_COUPON_CODE,
  BASIC_ADVANCED_TARGET_COURSE,
  BASIC_COURSE_SLUGS,
  emailHasAdvancedCourseHistory,
  emailHasBasicCourseAccess,
  validCampaignEmail
} from "@/lib/basic-advanced-offer"
import { brandedBrevoEmail, sendBrevoTransactionalEmail } from "@/lib/brevo-transactional"
import { prisma } from "@/lib/prisma"
import { publicAbsoluteUrl } from "@/lib/public-site-url"

const MAX_ATTEMPTS = 5
const SEND_HOUR_WAT = 10
const RUN_LIMIT = 75

type CampaignRecipient = {
  role: "learner" | "group_owner"
  recipientName: string
  recipientEmail: string
  learnerNames: string
  enrolledAt: Date | null
}

type AudienceRow = {
  role: string
  recipientName: string | null
  recipientEmail: string | null
  learnerNames: string | null
  enrolledAt: Date | null
}

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

function firstName(value: unknown) {
  return clean(value, 180).split(/\s+/)[0] || "there"
}

function booleanEnv(value: unknown, fallback: boolean) {
  const normalized = clean(value, 20).toLowerCase()
  if (!normalized) return fallback
  return ["1", "true", "yes", "on", "enabled"].includes(normalized)
}

function watParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(value)
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return {
    date: `${lookup.year}-${lookup.month}-${lookup.day}`,
    hour: Number(lookup.hour || 0),
    sql: `${lookup.year}-${lookup.month}-${lookup.day} ${lookup.hour}:${lookup.minute}:${lookup.second}`
  }
}

function campaignTiming(content: AdvancedUpgradeEmailContent) {
  const [year, month, day] = content.sendDateWat.split("-").map(Number)
  const dueAt = new Date(Date.UTC(year, month - 1, day, SEND_HOUR_WAT - 1, 0, 0))
  const isCohortDay = content.sendDateWat === "2026-10-05"
  const expiresAt = isCohortDay
    ? new Date(Date.UTC(year, month - 1, day, 18, 0, 0))
    : new Date(Date.UTC(year, month - 1, day, 22, 59, 59))
  return { dueAt, expiresAt }
}

function campaignContentDue(now: Date) {
  const wat = watParts(now)
  const content = advancedUpgradeCampaignContent.find((item) => item.sendDateWat === wat.date)
  if (!content) return null
  const timing = campaignTiming(content)
  if (now < timing.dueAt || now >= timing.expiresAt) return null
  return { content, ...timing }
}

function trackedUrl(path: string, emailKey: string, contentKey: string) {
  const url = new URL(path, publicAbsoluteUrl("/"))
  url.searchParams.set("utm_source", "brevo")
  url.searchParams.set("utm_medium", "email")
  url.searchParams.set("utm_campaign", "advanced_october_2026")
  url.searchParams.set("utm_content", contentKey)
  url.searchParams.set("utm_recipient", emailKey.slice(0, 16))
  if (url.pathname === "/checkout/prompt-to-production") url.searchParams.set("coupon", BASIC_ADVANCED_COUPON_CODE)
  return url.toString()
}

function installmentUrl() {
  const url = new URL("/dashboard/installments", publicAbsoluteUrl("/"))
  url.searchParams.set("course", BASIC_ADVANCED_TARGET_COURSE)
  url.searchParams.set("coupon", BASIC_ADVANCED_COUPON_CODE)
  url.hash = "start-installment-plan"
  return url.toString()
}

function emailKey(email: string) {
  return crypto.createHash("sha256").update(email).digest("hex")
}

function unsubscribeSecret() {
  const secret = clean(process.env.MARKETING_EMAIL_PREFERENCES_SECRET || process.env.CRON_SECRET || process.env.AUTH_SECRET, 1000)
  if (!secret) throw new Error("Missing secret for marketing email preference links.")
  return secret
}

export function advancedUpgradeUnsubscribeToken(emailValue: unknown, expiresAt = new Date("2026-11-05T23:00:00.000Z")) {
  const email = validCampaignEmail(emailValue)
  if (!email) throw new Error("A valid campaign email is required.")
  const payload = `${Buffer.from(email).toString("base64url")}.${Math.floor(expiresAt.getTime() / 1000)}`
  const signature = crypto.createHmac("sha256", unsubscribeSecret()).update(payload).digest("base64url")
  return `${payload}.${signature}`
}

export function verifyAdvancedUpgradeUnsubscribeToken(value: unknown) {
  const [encodedEmail, expiresRaw, signature] = clean(value, 2000).split(".")
  if (!encodedEmail || !expiresRaw || !signature) return ""
  const payload = `${encodedEmail}.${expiresRaw}`
  const expected = crypto.createHmac("sha256", unsubscribeSecret()).update(payload).digest("base64url")
  const left = Buffer.from(signature)
  const right = Buffer.from(expected)
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return ""
  if (Number(expiresRaw) * 1000 <= Date.now()) return ""
  try {
    return validCampaignEmail(Buffer.from(encodedEmail, "base64url").toString("utf8"))
  } catch {
    return ""
  }
}

export async function ensureAdvancedUpgradeCampaignTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_advanced_upgrade_deliveries (
      id BIGINT NOT NULL AUTO_INCREMENT,
      delivery_uuid VARCHAR(64) NOT NULL,
      campaign_key VARCHAR(80) NOT NULL,
      recipient_email VARCHAR(320) NOT NULL,
      recipient_key VARCHAR(64) NOT NULL,
      recipient_name VARCHAR(180) NULL,
      recipient_role VARCHAR(32) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      due_at DATETIME NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      attempts INT NOT NULL DEFAULT 0,
      provider_message_id VARCHAR(500) NULL,
      last_error VARCHAR(1000) NULL,
      last_attempt_at DATETIME NULL,
      sent_at DATETIME NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_advanced_upgrade_delivery_uuid (delivery_uuid),
      UNIQUE KEY uniq_advanced_upgrade_recipient_send (campaign_key, recipient_key),
      KEY idx_advanced_upgrade_status_due (status, due_at),
      KEY idx_advanced_upgrade_recipient (recipient_email, sent_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_advanced_upgrade_preferences (
      id BIGINT NOT NULL AUTO_INCREMENT,
      recipient_email VARCHAR(320) NOT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'active',
      reason VARCHAR(80) NULL,
      updated_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_advanced_upgrade_preference_email (recipient_email),
      KEY idx_advanced_upgrade_preference_status (status, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}

export async function suppressAdvancedUpgradeRecipient(emailValue: unknown, reason = "recipient_unsubscribed") {
  const email = validCampaignEmail(emailValue)
  if (!email) throw new Error("A valid email is required.")
  await ensureAdvancedUpgradeCampaignTables()
  const now = new Date()
  await prisma.$executeRaw`
    INSERT INTO tochukwu_advanced_upgrade_preferences (recipient_email, status, reason, updated_at, created_at)
    VALUES (${email}, 'suppressed', ${clean(reason, 80)}, ${now}, ${now})
    ON DUPLICATE KEY UPDATE status = 'suppressed', reason = VALUES(reason), updated_at = VALUES(updated_at)
  `
  return email
}

async function listCampaignRecipients(now: Date) {
  const nowWatSql = watParts(now).sql
  const rows = await prisma.$queryRaw<AudienceRow[]>(Prisma.sql`
    SELECT role, recipientName, recipientEmail, learnerNames, enrolledAt
    FROM (
      SELECT 'learner' COLLATE utf8mb4_unicode_ci AS role,
        COALESCE(NULLIF(sa.full_name, ''), NULLIF(o.first_name, ''), 'Student') COLLATE utf8mb4_unicode_ci AS recipientName,
        LOWER(sa.email) COLLATE utf8mb4_unicode_ci AS recipientEmail,
        COALESCE(NULLIF(sa.full_name, ''), NULLIF(o.first_name, ''), 'Student') COLLATE utf8mb4_unicode_ci AS learnerNames,
        COALESCE(o.paid_at, o.updated_at, o.created_at) AS enrolledAt
      FROM course_orders o
      JOIN student_accounts sa ON LOWER(sa.email) COLLATE utf8mb4_unicode_ci = LOWER(o.email) COLLATE utf8mb4_unicode_ci
      JOIN course_batches b ON b.course_slug COLLATE utf8mb4_unicode_ci = o.course_slug COLLATE utf8mb4_unicode_ci
        AND b.batch_key COLLATE utf8mb4_unicode_ci = o.batch_key COLLATE utf8mb4_unicode_ci
      WHERE o.course_slug IN (${Prisma.join(BASIC_COURSE_SLUGS)})
        AND o.status = 'paid'
        AND DATE_ADD(b.batch_start_at, INTERVAL 5 DAY) <= ${nowWatSql}

      UNION ALL

      SELECT 'learner' COLLATE utf8mb4_unicode_ci AS role,
        COALESCE(NULLIF(sa.full_name, ''), NULLIF(m.first_name, ''), 'Student') COLLATE utf8mb4_unicode_ci AS recipientName,
        LOWER(sa.email) COLLATE utf8mb4_unicode_ci AS recipientEmail,
        COALESCE(NULLIF(sa.full_name, ''), NULLIF(m.first_name, ''), 'Student') COLLATE utf8mb4_unicode_ci AS learnerNames,
        COALESCE(m.reviewed_at, m.updated_at, m.created_at) AS enrolledAt
      FROM course_manual_payments m
      JOIN student_accounts sa ON LOWER(sa.email) COLLATE utf8mb4_unicode_ci = LOWER(m.email) COLLATE utf8mb4_unicode_ci
      JOIN course_batches b ON b.course_slug COLLATE utf8mb4_unicode_ci = m.course_slug COLLATE utf8mb4_unicode_ci
        AND b.batch_key COLLATE utf8mb4_unicode_ci = m.batch_key COLLATE utf8mb4_unicode_ci
      WHERE m.course_slug IN (${Prisma.join(BASIC_COURSE_SLUGS)})
        AND m.status = 'approved'
        AND DATE_ADD(b.batch_start_at, INTERVAL 5 DAY) <= ${nowWatSql}

      UNION ALL

      SELECT 'group_owner' COLLATE utf8mb4_unicode_ci AS role,
        COALESCE(NULLIF(f.parent_name, ''), 'Parent') COLLATE utf8mb4_unicode_ci AS recipientName,
        LOWER(f.parent_email) COLLATE utf8mb4_unicode_ci AS recipientEmail,
        GROUP_CONCAT(DISTINCT c.full_name ORDER BY c.full_name SEPARATOR ', ') COLLATE utf8mb4_unicode_ci AS learnerNames,
        MIN(COALESCE(e.paid_at, e.updated_at, e.created_at)) AS enrolledAt
      FROM family_child_enrollments e
      JOIN family_children c ON c.id = e.child_id AND c.family_id = e.family_id AND c.status = 'active'
      JOIN family_accounts f ON f.id = e.family_id AND f.status = 'active'
      JOIN course_batches b ON b.course_slug COLLATE utf8mb4_unicode_ci = e.course_slug COLLATE utf8mb4_unicode_ci
        AND b.batch_key COLLATE utf8mb4_unicode_ci = e.batch_key COLLATE utf8mb4_unicode_ci
      WHERE e.course_slug IN (${Prisma.join(BASIC_COURSE_SLUGS)})
        AND e.status = 'active'
        AND DATE_ADD(b.batch_start_at, INTERVAL 5 DAY) <= ${nowWatSql}
      GROUP BY f.id, f.parent_name, f.parent_email
    ) audience
    WHERE recipientEmail IS NOT NULL AND recipientEmail <> ''
    ORDER BY enrolledAt DESC
  `)
  const deduped = new Map<string, CampaignRecipient>()
  for (const row of rows) {
    const email = validCampaignEmail(row.recipientEmail)
    if (!email) continue
    const candidate: CampaignRecipient = {
      role: row.role === "group_owner" ? "group_owner" : "learner",
      recipientName: clean(row.recipientName, 180) || "Student",
      recipientEmail: email,
      learnerNames: clean(row.learnerNames, 1000) || "your learner",
      enrolledAt: row.enrolledAt
    }
    const current = deduped.get(email)
    if (!current || (candidate.enrolledAt?.getTime() || 0) > (current.enrolledAt?.getTime() || 0)) deduped.set(email, candidate)
  }
  if (!deduped.size) return []
  const emails = Array.from(deduped.keys())
  const [advancedRows, suppressedRows] = await Promise.all([
    prisma.$queryRaw<Array<{ email: string }>>(Prisma.sql`
      SELECT DISTINCT LOWER(email) COLLATE utf8mb4_unicode_ci AS email FROM (
        SELECT o.email COLLATE utf8mb4_unicode_ci AS email FROM course_orders o
          WHERE o.course_slug COLLATE utf8mb4_unicode_ci = ${BASIC_ADVANCED_TARGET_COURSE} COLLATE utf8mb4_unicode_ci
            AND o.status IN ('paid', 'refunded')
        UNION ALL
        SELECT m.email COLLATE utf8mb4_unicode_ci AS email FROM course_manual_payments m
          WHERE m.course_slug COLLATE utf8mb4_unicode_ci = ${BASIC_ADVANCED_TARGET_COURSE} COLLATE utf8mb4_unicode_ci
            AND m.status IN ('approved', 'refunded')
        UNION ALL
        SELECT f.parent_email COLLATE utf8mb4_unicode_ci AS email FROM family_child_enrollments e
          JOIN family_accounts f ON f.id = e.family_id
          WHERE e.course_slug COLLATE utf8mb4_unicode_ci = ${BASIC_ADVANCED_TARGET_COURSE} COLLATE utf8mb4_unicode_ci
      ) advanced WHERE LOWER(email) IN (${Prisma.join(emails)})
    `),
    prisma.$queryRaw<Array<{ email: string }>>(Prisma.sql`
      SELECT LOWER(recipient_email) AS email FROM tochukwu_advanced_upgrade_preferences
      WHERE status = 'suppressed' AND LOWER(recipient_email) IN (${Prisma.join(emails)})
    `)
  ])
  const excluded = new Set([...advancedRows, ...suppressedRows].map((row) => clean(row.email, 320).toLowerCase()))
  return Array.from(deduped.values()).filter((recipient) => !excluded.has(recipient.recipientEmail))
}

export function renderAdvancedUpgradeEmail(input: {
  content: AdvancedUpgradeEmailContent
  recipient: CampaignRecipient
  preview?: boolean
}) {
  const { content, recipient } = input
  const key = emailKey(recipient.recipientEmail)
  const greeting = firstName(recipient.recipientName)
  const perspective = recipient.role === "group_owner"
    ? `Your ${recipient.learnerNames.includes(",") ? "learners" : "learner"}, <strong>${escapeHtml(recipient.learnerNames)}</strong>, completed a Prompt to Profit Basic cohort. This Advanced invitation is the next-stage opportunity available to your family.`
    : "You completed a Prompt to Profit Basic cohort, so this invitation is written for the foundation you have already built."
  const primaryUrl = trackedUrl(content.primaryPath, key, content.key)
  const checkoutUrl = trackedUrl("/checkout/prompt-to-production", key, `${content.key}-offer`)
  const installment = installmentUrl()
  const unsubscribe = publicAbsoluteUrl(`/email-preferences/advanced-upgrade?token=${encodeURIComponent(advancedUpgradeUnsubscribeToken(recipient.recipientEmail))}`)
  const paragraphs = content.paragraphs.map((paragraph) => `<p style="margin:0 0 16px;">${escapeHtml(paragraph)}</p>`).join("")
  const bullets = content.bullets?.length
    ? `<ul style="margin:4px 0 20px;padding-left:22px;">${content.bullets.map((item) => `<li style="margin:0 0 8px;">${escapeHtml(item)}</li>`).join("")}</ul>`
    : ""
  const projects = content.projectLinks?.length
    ? `<div style="margin:6px 0 20px;">${content.projectLinks.map((project) => `<p style="margin:0 0 10px;"><a href="${escapeHtml(project.url)}" style="color:#0d65b5;font-weight:800;">${escapeHtml(project.label)}</a> — ${escapeHtml(project.description)}</p>`).join("")}</div>`
    : ""
  const html = `
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(content.preheader)}</div>
    <p style="margin:0 0 16px;">Hello ${escapeHtml(greeting)},</p>
    <p style="margin:0 0 16px;">${perspective}</p>
    ${paragraphs}${bullets}${projects}
    <p style="margin:24px 0;"><a href="${escapeHtml(primaryUrl)}" style="display:inline-block;border-radius:8px;background:#0d65b5;color:#ffffff;padding:13px 20px;text-decoration:none;font-weight:800;">${escapeHtml(content.primaryLabel)}</a></p>
    <div style="margin:28px 0 22px;border:1px solid #b9ddf3;border-radius:14px;background:#f0f9ff;padding:20px;">
      <div style="font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#0d4f9a;">Exclusive Basic Student Offer</div>
      <p style="margin:10px 0 6px;font-size:19px;line-height:1.35;font-weight:800;color:#06162d;">Course fee: ₦100,000 instead of ₦150,000</p>
      <p style="margin:0 0 12px;">Use code <strong>${BASIC_ADVANCED_COUPON_CODE}</strong> to receive <strong>₦50,000 off</strong>. Apply it with the same email address used for the completed Basic cohort. VAT and payment-processing charges are calculated separately at checkout.</p>
      <p style="margin:0 0 16px;"><strong>Installment payment is also available.</strong> The same discount code applies when starting an installment plan.</p>
      <a href="${escapeHtml(checkoutUrl)}" style="display:inline-block;margin:0 8px 8px 0;border-radius:8px;background:#06162d;color:#ffffff;padding:11px 16px;text-decoration:none;font-weight:800;">Enroll with ${BASIC_ADVANCED_COUPON_CODE}</a>
      <a href="${escapeHtml(installment)}" style="display:inline-block;margin:0 0 8px;border:1px solid #0d65b5;border-radius:8px;color:#0d4f9a;padding:10px 15px;text-decoration:none;font-weight:800;">Pay in Installments</a>
    </div>
    <p style="margin:0;">Tochukwu</p>
    <p style="margin:28px 0 0;border-top:1px solid #e5edf6;padding-top:16px;font-size:12px;color:#64748b;">These Advanced-course invitations are sent because this email is connected to a completed Prompt to Profit Basic cohort. <a href="${escapeHtml(unsubscribe)}" style="color:#64748b;text-decoration:underline;">Stop receiving this campaign</a>.</p>
  `
  const text = [
    content.preheader,
    "",
    `Hello ${greeting},`,
    "",
    recipient.role === "group_owner"
      ? `Your learner or learners (${recipient.learnerNames}) completed a Prompt to Profit Basic cohort. This is their next-stage opportunity.`
      : "You completed a Prompt to Profit Basic cohort, so this invitation builds on that foundation.",
    "",
    ...content.paragraphs,
    ...(content.bullets || []).map((item) => `- ${item}`),
    ...(content.projectLinks || []).map((project) => `${project.label}: ${project.url} — ${project.description}`),
    "",
    `${content.primaryLabel}: ${primaryUrl}`,
    "",
    `EXCLUSIVE BASIC STUDENT OFFER: The course fee is ₦100,000 instead of ₦150,000. Use code ${BASIC_ADVANCED_COUPON_CODE} for ₦50,000 off with the same email used for the completed Basic cohort. VAT and payment-processing charges are calculated separately at checkout.`,
    `Installments are available and accept the same code: ${installment}`,
    `Enroll: ${checkoutUrl}`,
    "",
    "Tochukwu"
    ,"",
    `Stop receiving this campaign: ${unsubscribe}`
  ].join("\n")
  if (/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|\.local(?:\/|:|$))/i.test(`${html}\n${text}`)) {
    throw new Error("Advanced upgrade email contains a local URL and was blocked.")
  }
  return { subject: content.subject, html, text, primaryUrl, checkoutUrl, installmentUrl: installment }
}

async function claimDelivery(input: { content: AdvancedUpgradeEmailContent; recipient: CampaignRecipient; dueAt: Date }) {
  const now = new Date()
  const key = emailKey(input.recipient.recipientEmail)
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO tochukwu_advanced_upgrade_deliveries
        (delivery_uuid, campaign_key, recipient_email, recipient_key, recipient_name, recipient_role,
         subject, due_at, status, attempts, created_at, updated_at)
      VALUES (${`aud_${crypto.randomUUID().replace(/-/g, "")}`}, ${input.content.key}, ${input.recipient.recipientEmail}, ${key},
        ${input.recipient.recipientName}, ${input.recipient.role}, ${input.content.subject}, ${input.dueAt}, 'pending', 0, ${now}, ${now})
      ON DUPLICATE KEY UPDATE recipient_email = VALUES(recipient_email), recipient_name = VALUES(recipient_name),
        subject = VALUES(subject), updated_at = VALUES(updated_at)
    `
    const rows = await tx.$queryRaw<Array<{ status: string; attempts: number | bigint; lastAttemptAt: Date | null }>>(Prisma.sql`
      SELECT status, attempts, last_attempt_at AS lastAttemptAt
      FROM tochukwu_advanced_upgrade_deliveries
      WHERE campaign_key = ${input.content.key} AND recipient_key = ${key}
      LIMIT 1 FOR UPDATE
    `)
    const row = rows[0]
    const attempts = Number(row?.attempts || 0)
    if (["sent", "skipped", "failed_permanent"].includes(clean(row?.status, 32))) return { claimed: false, attempts, key }
    if (row?.lastAttemptAt && now.getTime() - row.lastAttemptAt.getTime() < 10 * 60_000) return { claimed: false, attempts, key }
    const nextAttempts = attempts + 1
    await tx.$executeRaw`
      UPDATE tochukwu_advanced_upgrade_deliveries
      SET status = 'processing', attempts = ${nextAttempts}, last_attempt_at = ${now}, last_error = NULL, updated_at = ${now}
      WHERE campaign_key = ${input.content.key} AND recipient_key = ${key}
    `
    return { claimed: true, attempts: nextAttempts, key }
  })
}

async function finishDelivery(input: { campaignKey: string; key: string; status: string; messageId?: string | null; error?: unknown }) {
  const now = new Date()
  const error = input.error instanceof Error ? input.error.message : clean(input.error, 1000)
  await prisma.$executeRaw`
    UPDATE tochukwu_advanced_upgrade_deliveries
    SET status = ${input.status}, provider_message_id = ${clean(input.messageId, 500) || null},
      last_error = ${clean(error, 1000) || null}, sent_at = ${input.status === "sent" ? now : null}, updated_at = ${now}
    WHERE campaign_key = ${input.campaignKey} AND recipient_key = ${input.key}
  `
}

export async function processAdvancedUpgradeCampaign(input?: { now?: Date; forceDryRun?: boolean; limit?: number; recipientEmail?: string }) {
  const now = input?.now || new Date()
  await ensureAdvancedUpgradeCampaignTables()
  const enabled = booleanEnv(process.env.ADVANCED_UPGRADE_CAMPAIGN_ENABLED, true)
  const due = campaignContentDue(now)
  if (!due) return { ok: true, enabled, dryRun: Boolean(input?.forceDryRun), campaignKey: null, audience: 0, due: 0, sent: 0, failed: 0, skipped: 0, preview: [] }
  const recipients = await listCampaignRecipients(now)
  const recipientFilter = validCampaignEmail(input?.recipientEmail)
  const eligible = recipientFilter ? recipients.filter((recipient) => recipient.recipientEmail === recipientFilter) : recipients
  const runLimit = Math.max(1, Math.min(Number(input?.limit || RUN_LIMIT), 300))
  const preview = eligible.slice(0, runLimit).map((recipient) => {
    const email = renderAdvancedUpgradeEmail({ content: due.content, recipient, preview: true })
    return {
      recipientEmail: recipient.recipientEmail,
      recipientRole: recipient.role,
      learnerNames: recipient.learnerNames,
      subject: email.subject,
      html: brandedBrevoEmail({ subject: email.subject, html: email.html }),
      text: email.text,
      containsLocalUrl: false
    }
  })
  const dryRun = input?.forceDryRun === true || !enabled
  if (dryRun) return { ok: true, enabled, dryRun: true, campaignKey: due.content.key, audience: eligible.length, due: eligible.length, sent: 0, failed: 0, skipped: 0, preview }

  let sent = 0
  let failed = 0
  let skipped = 0
  for (const recipient of eligible) {
    if (sent + failed + skipped >= runLimit) break
    const claim = await claimDelivery({ content: due.content, recipient, dueAt: due.dueAt })
    if (!claim.claimed) continue
    try {
      const [stillBasic, nowAdvanced] = await Promise.all([
        emailHasBasicCourseAccess(recipient.recipientEmail),
        emailHasAdvancedCourseHistory(recipient.recipientEmail)
      ])
      if (!stillBasic || nowAdvanced) {
        await finishDelivery({ campaignKey: due.content.key, key: claim.key, status: "skipped", error: nowAdvanced ? "advanced_enrollment_detected" : "basic_eligibility_missing" })
        skipped += 1
        continue
      }
      const email = renderAdvancedUpgradeEmail({ content: due.content, recipient })
      const result = await sendBrevoTransactionalEmail({
        to: recipient.recipientEmail,
        name: recipient.recipientName,
        subject: email.subject,
        html: email.html,
        text: email.text,
        tags: ["advanced-upgrade", "advanced-october-2026", due.content.key],
        headers: { "X-Tochukwu-Campaign": `advanced-october-2026:${due.content.key}` }
      })
      await finishDelivery({ campaignKey: due.content.key, key: claim.key, status: "sent", messageId: result.messageId })
      sent += 1
    } catch (error) {
      await finishDelivery({
        campaignKey: due.content.key,
        key: claim.key,
        status: claim.attempts >= MAX_ATTEMPTS ? "failed_permanent" : "failed",
        error
      })
      failed += 1
    }
  }
  return { ok: failed === 0, enabled, dryRun: false, campaignKey: due.content.key, audience: eligible.length, due: eligible.length, sent, failed, skipped, preview: [] }
}

export async function previewAdvancedUpgradeCampaign(input?: { now?: Date; limit?: number; recipientEmail?: string }) {
  return processAdvancedUpgradeCampaign({ ...input, forceDryRun: true })
}
