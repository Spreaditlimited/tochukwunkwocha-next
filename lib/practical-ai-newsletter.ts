import crypto from "crypto"
import { Prisma } from "@prisma/client"

import { applyAdminSettingsToProcessEnv } from "@/lib/admin-settings"
import { brandedBrevoEmail, sendBrevoTransactionalEmail } from "@/lib/brevo-transactional"
import { normalizeDeliverableEmail } from "@/lib/email-address"
import { practicalAiNewsletterContent, practicalAiNewsletterEmail, type PracticalAiNewsletterEmail } from "@/lib/practical-ai-newsletter-content"
import { prisma } from "@/lib/prisma"
import { publicAbsoluteUrl } from "@/lib/public-site-url"

const WEBSITE_LEADS_LIST_ID = 17
const MAX_ATTEMPTS = 5
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const DEFAULT_RUN_LIMIT = 80

type NewsletterContact = {
  email: string
  firstName: string
}

type NewsletterCampaign = {
  id: bigint
  campaignUuid: string
  recipientEmail: string
  recipientName: string | null
  startedAt: Date
  nextWeek: number
  nextSendAt: Date
  status: string
  attempts: number
  lastAttemptAt: Date | null
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
  return clean(value, 160).split(/\s+/)[0] || "there"
}

function booleanValue(value: unknown, fallback: boolean) {
  const normalized = clean(value, 20).toLowerCase()
  if (!normalized) return fallback
  return ["1", "true", "yes", "on", "enabled"].includes(normalized)
}

function newsletterEnabled() {
  return booleanValue(process.env.PRACTICAL_AI_NEWSLETTER_ENABLED, false)
}

function newsletterRunLimit(value?: number) {
  const configured = Number(process.env.PRACTICAL_AI_NEWSLETTER_RUN_LIMIT || DEFAULT_RUN_LIMIT)
  const requested = Number(value || configured)
  return Math.max(1, Math.min(Number.isFinite(requested) ? Math.round(requested) : DEFAULT_RUN_LIMIT, 300))
}

function emailKey(email: string) {
  return crypto.createHash("sha256").update(email).digest("hex")
}

function preferenceSecret() {
  const value = clean(process.env.MARKETING_EMAIL_PREFERENCES_SECRET || process.env.CRON_SECRET || process.env.AUTH_SECRET, 1000)
  if (!value) throw new Error("Missing secret for newsletter preference links.")
  return value
}

export function practicalAiNewsletterUnsubscribeToken(emailValue: unknown, expiresAt = new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000)) {
  const email = normalizeDeliverableEmail(emailValue, 320)
  if (!email) throw new Error("A valid newsletter email is required.")
  const payload = `${Buffer.from(email).toString("base64url")}.${Math.floor(expiresAt.getTime() / 1000)}`
  const signature = crypto.createHmac("sha256", preferenceSecret()).update(payload).digest("base64url")
  return `${payload}.${signature}`
}

export function verifyPracticalAiNewsletterUnsubscribeToken(value: unknown) {
  const [encodedEmail, expiresRaw, signature] = clean(value, 2000).split(".")
  if (!encodedEmail || !expiresRaw || !signature) return ""
  const payload = `${encodedEmail}.${expiresRaw}`
  const expected = crypto.createHmac("sha256", preferenceSecret()).update(payload).digest("base64url")
  const left = Buffer.from(signature)
  const right = Buffer.from(expected)
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return ""
  if (Number(expiresRaw) * 1000 <= Date.now()) return ""
  try {
    return normalizeDeliverableEmail(Buffer.from(encodedEmail, "base64url").toString("utf8"), 320)
  } catch {
    return ""
  }
}

export async function ensurePracticalAiNewsletterTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_practical_ai_newsletter_campaigns (
      id BIGINT NOT NULL AUTO_INCREMENT,
      campaign_uuid VARCHAR(64) NOT NULL,
      recipient_email VARCHAR(320) NOT NULL,
      recipient_key VARCHAR(64) NOT NULL,
      recipient_name VARCHAR(180) NULL,
      started_at DATETIME NOT NULL,
      next_week INT NOT NULL DEFAULT 1,
      next_send_at DATETIME NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      attempts INT NOT NULL DEFAULT 0,
      last_attempt_at DATETIME NULL,
      last_sent_at DATETIME NULL,
      last_error VARCHAR(1000) NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_practical_ai_newsletter_campaign_uuid (campaign_uuid),
      UNIQUE KEY uniq_practical_ai_newsletter_recipient (recipient_key),
      KEY idx_practical_ai_newsletter_due (status, next_send_at),
      KEY idx_practical_ai_newsletter_email (recipient_email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_practical_ai_newsletter_deliveries (
      id BIGINT NOT NULL AUTO_INCREMENT,
      delivery_uuid VARCHAR(64) NOT NULL,
      campaign_id BIGINT NOT NULL,
      recipient_email VARCHAR(320) NOT NULL,
      recipient_key VARCHAR(64) NOT NULL,
      week_number INT NOT NULL,
      content_key VARCHAR(120) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'processing',
      attempts INT NOT NULL DEFAULT 1,
      provider_message_id VARCHAR(500) NULL,
      last_error VARCHAR(1000) NULL,
      sent_at DATETIME NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_practical_ai_newsletter_delivery_uuid (delivery_uuid),
      UNIQUE KEY uniq_practical_ai_newsletter_week (campaign_id, week_number),
      KEY idx_practical_ai_newsletter_delivery_status (status, created_at),
      KEY idx_practical_ai_newsletter_delivery_email (recipient_email, sent_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_practical_ai_newsletter_preferences (
      id BIGINT NOT NULL AUTO_INCREMENT,
      recipient_email VARCHAR(320) NOT NULL,
      recipient_key VARCHAR(64) NOT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'active',
      reason VARCHAR(80) NULL,
      updated_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_practical_ai_newsletter_preference (recipient_key),
      KEY idx_practical_ai_newsletter_preference_status (status, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}

export async function suppressPracticalAiNewsletterRecipient(emailValue: unknown, reason = "recipient_unsubscribed") {
  const email = normalizeDeliverableEmail(emailValue, 320)
  if (!email) throw new Error("A valid email is required.")
  await ensurePracticalAiNewsletterTables()
  const now = new Date()
  const key = emailKey(email)
  await prisma.$transaction([
    prisma.$executeRaw`
      INSERT INTO tochukwu_practical_ai_newsletter_preferences
        (recipient_email, recipient_key, status, reason, updated_at, created_at)
      VALUES (${email}, ${key}, 'suppressed', ${clean(reason, 80)}, ${now}, ${now})
      ON DUPLICATE KEY UPDATE status = 'suppressed', reason = VALUES(reason), updated_at = VALUES(updated_at)
    `,
    prisma.$executeRaw`
      UPDATE tochukwu_practical_ai_newsletter_campaigns
      SET status = 'suppressed', last_error = ${clean(reason, 80)}, updated_at = ${now}
      WHERE recipient_key = ${key}
    `
  ])
  return email
}

function trackedPath(path: string, content: PracticalAiNewsletterEmail, recipientKey: string) {
  const url = new URL(path, publicAbsoluteUrl("/"))
  url.searchParams.set("utm_source", "brevo")
  url.searchParams.set("utm_medium", "email")
  url.searchParams.set("utm_campaign", "practical_ai_52_week_newsletter")
  url.searchParams.set("utm_content", `week_${String(content.week).padStart(2, "0")}_${content.key}`)
  url.searchParams.set("utm_recipient", recipientKey.slice(0, 16))
  return url.toString()
}

export function renderPracticalAiNewsletterEmail(input: {
  content: PracticalAiNewsletterEmail
  recipientName: string
  recipientEmail: string
  preview?: boolean
}) {
  const { content } = input
  const recipientKey = emailKey(input.recipientEmail)
  const primaryUrl = input.preview ? "#newsletter-primary-action" : trackedPath(content.primaryPath, content, recipientKey)
  const projectUrl = content.project
    ? input.preview ? "#newsletter-project" : trackedPath(content.project.path, content, recipientKey)
    : ""
  const unsubscribeUrl = input.preview
    ? "#newsletter-unsubscribe"
    : publicAbsoluteUrl(`/email-preferences/practical-ai-newsletter?token=${encodeURIComponent(practicalAiNewsletterUnsubscribeToken(input.recipientEmail))}`)
  const project = content.project ? `
    <div style="margin:24px 0;border:1px solid #b9ddf3;border-radius:14px;background:#f0f9ff;padding:20px;">
      <div style="font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#0d4f9a;">${content.project.youngLearner ? "Young Learner Project" : "Student Project"}</div>
      <p style="margin:8px 0 4px;font-size:19px;font-weight:800;color:#06162d;">${escapeHtml(content.project.title)}</p>
      <p style="margin:0 0 12px;">${escapeHtml(content.project.description)}</p>
      <a href="${escapeHtml(projectUrl)}" style="color:#0d65b5;font-weight:800;">View the project</a>
    </div>` : ""
  const html = `
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(content.preheader)}</div>
    <p style="margin:0 0 16px;">Hello ${escapeHtml(firstName(input.recipientName))},</p>
    ${content.paragraphs.map((paragraph) => `<p style="margin:0 0 16px;">${escapeHtml(paragraph)}</p>`).join("")}
    ${project}
    <p style="margin:24px 0;"><a href="${escapeHtml(primaryUrl)}" style="display:inline-block;border-radius:8px;background:#0d65b5;color:#ffffff;padding:13px 20px;text-decoration:none;font-weight:800;">${escapeHtml(content.primaryLabel)}</a></p>
    <p style="margin:0;">Tochukwu</p>
    <p style="margin:28px 0 0;border-top:1px solid #e5edf6;padding-top:16px;font-size:12px;color:#64748b;">You joined the practical AI newsletter on tochukwunkwocha.com. <a href="${escapeHtml(unsubscribeUrl)}" style="color:#64748b;text-decoration:underline;">Stop receiving these weekly notes</a>.</p>
  `
  const text = [
    content.preheader,
    "",
    `Hello ${firstName(input.recipientName)},`,
    "",
    ...content.paragraphs.flatMap((paragraph) => [paragraph, ""]),
    ...(content.project ? [`${content.project.youngLearner ? "Young Learner Project" : "Student Project"}: ${content.project.title}`, content.project.description, `View: ${projectUrl}`, ""] : []),
    `${content.primaryLabel}: ${primaryUrl}`,
    "",
    "Tochukwu",
    "",
    `Stop receiving these weekly notes: ${unsubscribeUrl}`
  ].join("\n")
  if (/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|\.local(?:\/|:|$))/i.test(`${html}\n${text}`)) {
    throw new Error("Practical AI newsletter contains a local URL and was blocked.")
  }
  return { subject: content.subject, html, text, primaryUrl, unsubscribeUrl }
}

async function brevoWebsiteLeadContacts(): Promise<Map<string, NewsletterContact>> {
  await applyAdminSettingsToProcessEnv().catch(() => null)
  const apiKey = clean(process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY, 1000)
  if (!apiKey) throw new Error("Missing Brevo API key.")
  const contacts = new Map<string, NewsletterContact>()
  let offset = 0
  while (true) {
    const url = new URL(`https://api.brevo.com/v3/contacts/lists/${WEBSITE_LEADS_LIST_ID}/contacts`)
    url.searchParams.set("limit", "500")
    url.searchParams.set("offset", String(offset))
    url.searchParams.set("sort", "desc")
    const response = await fetch(url, {
      headers: { "api-key": apiKey, accept: "application/json" },
      signal: AbortSignal.timeout(12_000)
    })
    const body = await response.json().catch(() => null)
    if (!response.ok) throw new Error(body?.message || `Could not load Brevo Website Leads (${response.status}).`)
    const batch = Array.isArray(body?.contacts) ? body.contacts : []
    for (const contact of batch) {
      const email = normalizeDeliverableEmail(contact?.email, 320)
      if (!email || contact?.emailBlacklisted) continue
      contacts.set(email, { email, firstName: firstName(contact?.attributes?.FIRSTNAME || contact?.attributes?.PRENOM) })
    }
    if (batch.length < 500) break
    offset += batch.length
  }
  return contacts
}

export async function reconcilePracticalAiNewsletterCampaigns(now = new Date()) {
  await ensurePracticalAiNewsletterTables()
  const contacts = await brevoWebsiteLeadContacts()
  const emails = Array.from(contacts.keys())
  if (!emails.length) {
    await prisma.$executeRaw`
      UPDATE tochukwu_practical_ai_newsletter_campaigns
      SET status = 'inactive_list', last_error = 'brevo_list_empty', updated_at = ${now}
      WHERE status IN ('active', 'processing')
    `
    return { audience: 0, created: 0, updated: 0 }
  }
  await prisma.$executeRaw(Prisma.sql`
    UPDATE tochukwu_practical_ai_newsletter_campaigns
    SET status = 'inactive_list', last_error = 'brevo_list_membership_missing', updated_at = ${now}
    WHERE status IN ('active', 'processing') AND LOWER(recipient_email) NOT IN (${Prisma.join(emails)})
  `)
  const leadRows = await prisma.$queryRaw<Array<{ email: string; firstName: string | null; startedAt: Date }>>(Prisma.sql`
    SELECT LOWER(email) AS email,
      SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(first_name, '') ORDER BY created_at DESC SEPARATOR '||'), '||', 1) AS firstName,
      MIN(created_at) AS startedAt
    FROM tochukwu_marketing_leads
    WHERE list_id = ${WEBSITE_LEADS_LIST_ID} AND LOWER(email) IN (${Prisma.join(emails)})
    GROUP BY LOWER(email)
  `)
  const suppressedRows = await prisma.$queryRaw<Array<{ recipientKey: string }>>(Prisma.sql`
    SELECT recipient_key AS recipientKey
    FROM tochukwu_practical_ai_newsletter_preferences
    WHERE status = 'suppressed'
  `)
  const suppressed = new Set(suppressedRows.map((row) => row.recipientKey))
  let created = 0
  let updated = 0
  for (const lead of leadRows) {
    const email = normalizeDeliverableEmail(lead.email, 320)
    if (!email) continue
    const key = emailKey(email)
    const contact = contacts.get(email)
    const recipientName = firstName(lead.firstName || contact?.firstName)
    const startedAt = lead.startedAt || now
    const campaignUuid = `pain_${crypto.randomUUID().replace(/-/g, "")}`
    const result = await prisma.$executeRaw`
      INSERT INTO tochukwu_practical_ai_newsletter_campaigns
        (campaign_uuid, recipient_email, recipient_key, recipient_name, started_at, next_week, next_send_at,
         status, attempts, created_at, updated_at)
      VALUES (${campaignUuid}, ${email}, ${key}, ${recipientName}, ${startedAt}, 1, ${startedAt},
        ${suppressed.has(key) ? "suppressed" : "active"}, 0, ${now}, ${now})
      ON DUPLICATE KEY UPDATE recipient_email = VALUES(recipient_email), recipient_name = VALUES(recipient_name),
        status = IF(status IN ('completed', 'suppressed'), status, VALUES(status)),
        last_error = IF(status IN ('completed', 'suppressed'), last_error, NULL), updated_at = VALUES(updated_at)
    `
    if (Number(result) === 1) created += 1
    else updated += 1
  }
  return { audience: leadRows.length, created, updated }
}

async function dueCampaigns(now: Date, limit: number, recipientEmail?: string) {
  const filter = normalizeDeliverableEmail(recipientEmail, 320)
  return prisma.$queryRaw<NewsletterCampaign[]>(Prisma.sql`
    SELECT id, campaign_uuid AS campaignUuid, recipient_email AS recipientEmail,
      recipient_name AS recipientName, started_at AS startedAt, next_week AS nextWeek,
      next_send_at AS nextSendAt, status, attempts, last_attempt_at AS lastAttemptAt
    FROM tochukwu_practical_ai_newsletter_campaigns
    WHERE status = 'active' AND next_send_at <= ${now} AND next_week BETWEEN 1 AND 52
      ${filter ? Prisma.sql`AND recipient_email = ${filter}` : Prisma.empty}
      AND (last_attempt_at IS NULL OR last_attempt_at < ${new Date(now.getTime() - 15 * 60_000)})
    ORDER BY next_send_at, id
    LIMIT ${limit}
  `)
}

async function claimCampaign(campaign: NewsletterCampaign, content: PracticalAiNewsletterEmail, now: Date) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ status: string; nextWeek: number; attempts: number; lastAttemptAt: Date | null }>>(Prisma.sql`
      SELECT status, next_week AS nextWeek, attempts, last_attempt_at AS lastAttemptAt
      FROM tochukwu_practical_ai_newsletter_campaigns
      WHERE id = ${campaign.id} LIMIT 1 FOR UPDATE
    `)
    const current = rows[0]
    if (!current || current.status !== "active" || current.nextWeek !== content.week) return { claimed: false, attempts: Number(current?.attempts || 0) }
    if (current.lastAttemptAt && now.getTime() - current.lastAttemptAt.getTime() < 15 * 60_000) return { claimed: false, attempts: Number(current.attempts || 0) }
    const attempts = Number(current.attempts || 0) + 1
    await tx.$executeRaw`
      INSERT INTO tochukwu_practical_ai_newsletter_deliveries
        (delivery_uuid, campaign_id, recipient_email, recipient_key, week_number, content_key,
         subject, status, attempts, created_at, updated_at)
      VALUES (${`paind_${crypto.randomUUID().replace(/-/g, "")}`}, ${campaign.id}, ${campaign.recipientEmail},
        ${emailKey(campaign.recipientEmail)}, ${content.week}, ${content.key}, ${content.subject}, 'processing', ${attempts}, ${now}, ${now})
      ON DUPLICATE KEY UPDATE status = IF(status = 'sent', status, 'processing'),
        attempts = IF(status = 'sent', attempts, attempts + 1), updated_at = VALUES(updated_at)
    `
    const delivery = await tx.$queryRaw<Array<{ status: string }>>(Prisma.sql`
      SELECT status FROM tochukwu_practical_ai_newsletter_deliveries
      WHERE campaign_id = ${campaign.id} AND week_number = ${content.week} LIMIT 1
    `)
    if (delivery[0]?.status === "sent") return { claimed: false, attempts }
    await tx.$executeRaw`
      UPDATE tochukwu_practical_ai_newsletter_campaigns
      SET status = 'processing', attempts = ${attempts}, last_attempt_at = ${now}, last_error = NULL, updated_at = ${now}
      WHERE id = ${campaign.id}
    `
    return { claimed: true, attempts }
  })
}

async function finishCampaign(input: {
  campaign: NewsletterCampaign
  content: PracticalAiNewsletterEmail
  status: "sent" | "failed" | "failed_permanent"
  messageId?: string | null
  error?: unknown
  now: Date
}) {
  const error = input.error instanceof Error ? input.error.message : clean(input.error, 1000)
  const nextWeek = input.content.week + 1
  const complete = nextWeek > practicalAiNewsletterContent.length
  await prisma.$transaction([
    prisma.$executeRaw`
      UPDATE tochukwu_practical_ai_newsletter_deliveries
      SET status = ${input.status}, provider_message_id = ${clean(input.messageId, 500) || null},
        last_error = ${clean(error, 1000) || null}, sent_at = ${input.status === "sent" ? input.now : null}, updated_at = ${input.now}
      WHERE campaign_id = ${input.campaign.id} AND week_number = ${input.content.week}
    `,
    prisma.$executeRaw`
      UPDATE tochukwu_practical_ai_newsletter_campaigns
      SET status = ${input.status === "sent" ? (complete ? "completed" : "active") : (input.status === "failed_permanent" ? "stopped" : "active")},
        next_week = ${input.status === "sent" ? nextWeek : input.content.week},
        next_send_at = ${input.status === "sent" ? new Date(input.now.getTime() + WEEK_MS) : new Date(input.now.getTime() + 60 * 60 * 1000)},
        attempts = ${input.status === "sent" ? 0 : input.campaign.attempts + 1},
        last_sent_at = ${input.status === "sent" ? input.now : null}, last_error = ${clean(error, 1000) || null}, updated_at = ${input.now}
      WHERE id = ${input.campaign.id}
    `
  ])
}

export async function processPracticalAiNewsletter(input?: {
  now?: Date
  forceDryRun?: boolean
  limit?: number
  recipientEmail?: string
  skipReconcile?: boolean
}) {
  const now = input?.now || new Date()
  await ensurePracticalAiNewsletterTables()
  const reconciliation = input?.skipReconcile ? null : await reconcilePracticalAiNewsletterCampaigns(now)
  const enabled = newsletterEnabled()
  const limit = newsletterRunLimit(input?.limit)
  const due = await dueCampaigns(now, limit, input?.recipientEmail)
  const preview = due.map((campaign) => {
    const content = practicalAiNewsletterEmail(Number(campaign.nextWeek))
    if (!content) return null
    const email = renderPracticalAiNewsletterEmail({
      content,
      recipientName: campaign.recipientName || "there",
      recipientEmail: campaign.recipientEmail,
      preview: true
    })
    return {
      recipientEmail: campaign.recipientEmail,
      week: content.week,
      contentKey: content.key,
      subject: content.subject,
      html: brandedBrevoEmail({ subject: content.subject, html: email.html, footerText: "You joined the practical AI newsletter on tochukwunkwocha.com." }),
      text: email.text
    }
  }).filter(Boolean)
  if (input?.forceDryRun || !enabled) {
    return { ok: true, enabled, dryRun: true, reconciliation, due: due.length, sent: 0, failed: 0, preview }
  }
  let sent = 0
  let failed = 0
  for (const campaign of due) {
    const content = practicalAiNewsletterEmail(Number(campaign.nextWeek))
    if (!content) continue
    const claim = await claimCampaign(campaign, content, now)
    if (!claim.claimed) continue
    try {
      const email = renderPracticalAiNewsletterEmail({
        content,
        recipientName: campaign.recipientName || "there",
        recipientEmail: campaign.recipientEmail
      })
      const result = await sendBrevoTransactionalEmail({
        to: campaign.recipientEmail,
        name: campaign.recipientName,
        subject: email.subject,
        html: email.html,
        text: email.text,
        footerText: "You joined the practical AI newsletter on tochukwunkwocha.com.",
        tags: ["practical-ai-newsletter", `week-${String(content.week).padStart(2, "0")}`, content.key],
        headers: { "X-Tochukwu-Campaign": `practical-ai-newsletter:${content.key}` }
      })
      await finishCampaign({ campaign, content, status: "sent", messageId: result.messageId, now })
      sent += 1
    } catch (error) {
      await finishCampaign({
        campaign,
        content,
        status: claim.attempts >= MAX_ATTEMPTS ? "failed_permanent" : "failed",
        error,
        now
      })
      failed += 1
    }
  }
  return { ok: failed === 0, enabled, dryRun: false, reconciliation, due: due.length, sent, failed, preview: [] }
}
