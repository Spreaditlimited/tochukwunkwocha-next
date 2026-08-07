import crypto from "crypto"
import { Prisma } from "@prisma/client"

import { applyAdminSettingsToProcessEnv, getAdminSettingValues, upsertAdminSettings } from "@/lib/admin-settings"
import { sendBrevoTransactionalEmail } from "@/lib/brevo-transactional"
import {
  LearnerProgressSnapshot,
  listStartedLearnerProgressSnapshots
} from "@/lib/learning-progress-snapshots"
import { prisma } from "@/lib/prisma"
import { publicAbsoluteUrl } from "@/lib/public-site-url"
import { addColumnIfMissing } from "@/lib/schema-guards"

const DAY_MS = 24 * 60 * 60 * 1000
const RETRY_DELAY_MS = 60 * 60 * 1000
const MAX_DELIVERY_ATTEMPTS = 3

type FollowupConfig = {
  enabled: boolean
  dryRun: boolean
  inactivityDays: number
  campaignMonths: number
  maxReminders: number
  runLimit: number
  courseAllowlist: Set<string>
  webhookConfigured: boolean
}

type CampaignRow = {
  id: bigint
  campaignUuid: string
  accountId: bigint
  courseSlug: string
  batchKey: string
  learnerName: string | null
  recipientName: string | null
  recipientEmail: string
  campaignStartedAt: Date
  campaignEndsAt: Date
  lastActivityAt: Date | null
  lastReminderAt: Date | null
  nextReminderAt: Date
  reminderCount: number | bigint
  status: string
  stoppedReason: string | null
  lockedAt: Date | null
}

export type LearningFollowupAdminRow = {
  campaignUuid: string
  learnerName: string
  recipientEmail: string
  courseSlug: string
  batchLabel: string
  completedLessons: number
  totalLessons: number
  remainingLessons: number
  lastLessonTitle: string
  lastActivityAt: string | null
  nextReminderAt: string | null
  reminderCount: number
  status: string
  stoppedReason: string
}

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function escapeHtml(value: unknown) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function firstName(value: unknown) {
  return clean(value, 180).split(/\s+/)[0] || "there"
}

function booleanSetting(value: unknown, fallback: boolean) {
  const normalized = clean(value, 20).toLowerCase()
  if (!normalized) return fallback
  return ["1", "true", "yes", "on", "enabled"].includes(normalized)
}

export function boundedLearningFollowupNumber(value: unknown, fallback: number, min: number, max: number) {
  const raw = clean(value, 40)
  if (!raw) return fallback
  const numeric = Number(raw)
  return Math.max(min, Math.min(max, Number.isFinite(numeric) ? Math.round(numeric) : fallback))
}

export async function learningFollowupConfig(): Promise<FollowupConfig> {
  const values = await getAdminSettingValues([
    "LEARNING_FOLLOWUPS_ENABLED",
    "LEARNING_FOLLOWUPS_DRY_RUN",
    "LEARNING_FOLLOWUPS_INACTIVITY_DAYS",
    "LEARNING_FOLLOWUPS_CAMPAIGN_MONTHS",
    "LEARNING_FOLLOWUPS_MAX_REMINDERS",
    "LEARNING_FOLLOWUPS_RUN_LIMIT",
    "LEARNING_FOLLOWUPS_COURSE_ALLOWLIST",
    "BREVO_WEBHOOK_SECRET",
    "BREVO_LEARNING_FOLLOWUP_WEBHOOK_ID"
  ])
  return {
    enabled: booleanSetting(values.LEARNING_FOLLOWUPS_ENABLED, false),
    dryRun: booleanSetting(values.LEARNING_FOLLOWUPS_DRY_RUN, true),
    inactivityDays: boundedLearningFollowupNumber(values.LEARNING_FOLLOWUPS_INACTIVITY_DAYS, 7, 1, 30),
    campaignMonths: boundedLearningFollowupNumber(values.LEARNING_FOLLOWUPS_CAMPAIGN_MONTHS, 3, 1, 12),
    maxReminders: boundedLearningFollowupNumber(values.LEARNING_FOLLOWUPS_MAX_REMINDERS, 13, 1, 52),
    runLimit: boundedLearningFollowupNumber(values.LEARNING_FOLLOWUPS_RUN_LIMIT, 80, 1, 300),
    courseAllowlist: new Set(clean(values.LEARNING_FOLLOWUPS_COURSE_ALLOWLIST, 2000)
      .split(",")
      .map((value) => clean(value, 120).toLowerCase())
      .filter(Boolean)),
    webhookConfigured: Boolean(
      clean(values.BREVO_WEBHOOK_SECRET || process.env.BREVO_WEBHOOK_SECRET, 1000) &&
      clean(values.BREVO_LEARNING_FOLLOWUP_WEBHOOK_ID, 80)
    )
  }
}

export async function ensureLearningFollowupTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_learning_followup_campaigns (
      id BIGINT NOT NULL AUTO_INCREMENT, campaign_uuid VARCHAR(64) NOT NULL,
      account_id BIGINT NOT NULL, course_slug VARCHAR(120) NOT NULL, batch_key VARCHAR(64) NOT NULL,
      batch_label VARCHAR(120) NULL, learner_name VARCHAR(180) NULL, recipient_name VARCHAR(180) NULL,
      recipient_email VARCHAR(220) NOT NULL, enrollment_source VARCHAR(40) NOT NULL,
      enrolled_at DATETIME NULL, batch_start_at DATETIME NOT NULL, campaign_started_at DATETIME NOT NULL,
      campaign_ends_at DATETIME NOT NULL, last_activity_at DATETIME NULL, last_reminder_at DATETIME NULL,
      next_reminder_at DATETIME NOT NULL, reminder_count INT NOT NULL DEFAULT 0,
      status VARCHAR(32) NOT NULL DEFAULT 'active', stopped_reason VARCHAR(80) NULL,
      locked_at DATETIME NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
      PRIMARY KEY (id), UNIQUE KEY uniq_learning_followup_campaign_uuid (campaign_uuid),
      UNIQUE KEY uniq_learning_followup_learner_course_batch (account_id, course_slug, batch_key),
      KEY idx_learning_followup_due (status, next_reminder_at),
      KEY idx_learning_followup_recipient (recipient_email, last_reminder_at),
      KEY idx_learning_followup_lock (status, locked_at),
      KEY idx_learning_followup_course_batch (course_slug, batch_key, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_learning_followup_deliveries (
      id BIGINT NOT NULL AUTO_INCREMENT, delivery_uuid VARCHAR(64) NOT NULL,
      delivery_group_uuid VARCHAR(64) NOT NULL, campaign_id BIGINT NOT NULL,
      reminder_number INT NOT NULL, recipient_email VARCHAR(220) NOT NULL,
      subject VARCHAR(255) NULL, status VARCHAR(32) NOT NULL DEFAULT 'pending', attempts INT NOT NULL DEFAULT 0,
      provider_message_id VARCHAR(500) NULL, last_error VARCHAR(1000) NULL, snapshot_json LONGTEXT NULL,
      last_attempt_at DATETIME NULL, sent_at DATETIME NULL, delivered_at DATETIME NULL,
      opened_at DATETIME NULL, bounced_at DATETIME NULL, clicked_at DATETIME NULL,
      resumed_at DATETIME NULL, provider_event VARCHAR(40) NULL, provider_event_at DATETIME NULL,
      provider_event_detail VARCHAR(1000) NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
      PRIMARY KEY (id), UNIQUE KEY uniq_learning_followup_delivery_uuid (delivery_uuid),
      UNIQUE KEY uniq_learning_followup_campaign_cycle (campaign_id, reminder_number),
      KEY idx_learning_followup_delivery_group (delivery_group_uuid),
      KEY idx_learning_followup_delivery_status (status, last_attempt_at),
      KEY idx_learning_followup_delivery_recipient (recipient_email, sent_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_learning_followup_recipient_preferences (
      id BIGINT NOT NULL AUTO_INCREMENT, recipient_email VARCHAR(220) NOT NULL,
      course_slug VARCHAR(120) NOT NULL, status VARCHAR(24) NOT NULL DEFAULT 'active',
      paused_at DATETIME NULL, resumed_at DATETIME NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
      PRIMARY KEY (id), UNIQUE KEY uniq_learning_followup_preference (recipient_email, course_slug),
      KEY idx_learning_followup_preference_status (status, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await addColumnIfMissing("tochukwu_learning_followup_deliveries", "delivered_at", "DATETIME NULL AFTER sent_at")
  await addColumnIfMissing("tochukwu_learning_followup_deliveries", "opened_at", "DATETIME NULL AFTER delivered_at")
  await addColumnIfMissing("tochukwu_learning_followup_deliveries", "bounced_at", "DATETIME NULL AFTER opened_at")
  await addColumnIfMissing("tochukwu_learning_followup_deliveries", "provider_event", "VARCHAR(40) NULL AFTER resumed_at")
  await addColumnIfMissing("tochukwu_learning_followup_deliveries", "provider_event_at", "DATETIME NULL AFTER provider_event")
  await addColumnIfMissing("tochukwu_learning_followup_deliveries", "provider_event_detail", "VARCHAR(1000) NULL AFTER provider_event_at")
}

export function learningFollowupDecision(input: {
  now: Date
  batchStartAt: Date
  enrolledAt: Date | null
  lastActivityAt: Date | null
  lastReminderAt: Date | null
  totalLessons: number
  remainingLessons: number
  resumeLessonId: number | null
  certificateIssued: boolean
  recipientPaused: boolean
  adminPaused: boolean
  inactivityDays: number
  campaignMonths: number
}) {
  const batchMs = input.batchStartAt.getTime()
  const enrolledMs = input.enrolledAt?.getTime() || 0
  const startedAt = new Date(Math.max(batchMs, enrolledMs))
  const endsAt = new Date(startedAt)
  endsAt.setUTCMonth(endsAt.getUTCMonth() + input.campaignMonths)
  const complete = input.certificateIssued || (input.totalLessons > 0 && input.remainingLessons === 0)
  const expired = input.now.getTime() >= endsAt.getTime()
  const noLessons = input.totalLessons <= 0
  const waitingForRelease = input.remainingLessons > 0 && !input.resumeLessonId
  const status = complete ? "completed" : expired ? "expired" : noLessons ? "stopped"
    : waitingForRelease ? "waiting" : (input.recipientPaused || input.adminPaused) ? "paused" : "active"
  const stoppedReason = complete ? (input.certificateIssued ? "certificate_issued" : "lessons_completed")
    : expired ? "campaign_expired" : noLessons ? "no_course_lessons"
      : waitingForRelease ? "waiting_for_lesson_release" : input.adminPaused ? "admin_paused"
        : input.recipientPaused ? "recipient_paused" : null
  const anchor = new Date(Math.max(
    startedAt.getTime(),
    input.lastActivityAt?.getTime() || 0,
    input.lastReminderAt?.getTime() || 0
  ))
  return {
    startedAt,
    endsAt,
    status,
    stoppedReason,
    nextReminderAt: new Date(anchor.getTime() + input.inactivityDays * DAY_MS)
  }
}

export async function reconcileLearningFollowupCampaigns(now = new Date()) {
  await ensureLearningFollowupTables()
  const config = await learningFollowupConfig()
  const allSnapshots = await listStartedLearnerProgressSnapshots(now.getTime())
  const snapshots = config.courseAllowlist.size
    ? allSnapshots.filter((snapshot) => config.courseAllowlist.has(snapshot.courseSlug))
    : allSnapshots
  const existing = await prisma.$queryRaw<CampaignRow[]>(Prisma.sql`
    SELECT id, campaign_uuid AS campaignUuid, account_id AS accountId, course_slug AS courseSlug,
      batch_key AS batchKey, learner_name AS learnerName, recipient_name AS recipientName,
      recipient_email AS recipientEmail, campaign_started_at AS campaignStartedAt,
      campaign_ends_at AS campaignEndsAt, last_activity_at AS lastActivityAt,
      last_reminder_at AS lastReminderAt, next_reminder_at AS nextReminderAt,
      reminder_count AS reminderCount, status, stopped_reason AS stoppedReason, locked_at AS lockedAt
    FROM tochukwu_learning_followup_campaigns
  `)
  const existingByKey = new Map(existing.map((row) => [
    `${row.accountId.toString()}::${clean(row.courseSlug, 120).toLowerCase()}::${clean(row.batchKey, 64).toLowerCase()}`,
    row
  ]))
  const preferenceRows = await prisma.$queryRaw<Array<{ recipientEmail: string; courseSlug: string; status: string }>>(Prisma.sql`
    SELECT recipient_email AS recipientEmail, course_slug AS courseSlug, status
    FROM tochukwu_learning_followup_recipient_preferences
    WHERE status <> 'active'
  `)
  const recipientPreferences = new Map(preferenceRows.map((row) => [
    `${clean(row.recipientEmail, 220).toLowerCase()}::${clean(row.courseSlug, 120).toLowerCase()}`,
    clean(row.status, 24).toLowerCase()
  ]))
  const observed = new Set<string>()
  let completed = 0
  let expired = 0
  let active = 0
  let paused = 0
  const campaignUpserts: Prisma.Sql[] = []
  const resumedCampaigns: Array<{ id: bigint; resumedAt: Date }> = []

  for (const snapshot of snapshots) {
    const key = `${snapshot.accountId.toString()}::${snapshot.courseSlug}::${snapshot.batchKey}`
    observed.add(key)
    const current = existingByKey.get(key)
    const preference = recipientPreferences.get(`${snapshot.recipientEmail}::${snapshot.courseSlug}`)
    const isPaused = preference === "paused"
    const isSuppressed = preference === "suppressed"
    const adminPaused = current?.status === "paused" && current.stoppedReason === "admin_paused"
    const processing = current?.status === "processing" && Boolean(current.lockedAt && now.getTime() - current.lockedAt.getTime() < 15 * 60_000)
    const decision = learningFollowupDecision({
      now, batchStartAt: snapshot.batchStartAt, enrolledAt: snapshot.enrolledAt,
      lastActivityAt: snapshot.lastActivityAt, lastReminderAt: current?.lastReminderAt || null,
      totalLessons: snapshot.totalLessons, remainingLessons: snapshot.remainingLessons,
      resumeLessonId: snapshot.resumeLessonId, certificateIssued: snapshot.certificateIssued,
      recipientPaused: isPaused, adminPaused, inactivityDays: config.inactivityDays,
      campaignMonths: config.campaignMonths
    })
    const { startedAt, endsAt, status, stoppedReason, nextReminderAt } = decision
    const reachedMaximum = Number(current?.reminderCount || 0) >= config.maxReminders && !["completed", "expired"].includes(status)
    const persistedStatus = isSuppressed || reachedMaximum ? "stopped" : processing ? "processing" : status
    const persistedReason = isSuppressed ? "recipient_suppressed" : reachedMaximum ? "maximum_reminders_reached" : processing ? current?.stoppedReason || null : stoppedReason
    const persistedLock = processing ? current?.lockedAt || null : null
    if (persistedStatus === "completed") completed += 1
    else if (persistedStatus === "expired") expired += 1
    else if (persistedStatus === "paused") paused += 1
    else if (persistedStatus === "active") active += 1
    campaignUpserts.push(Prisma.sql`
      (${`lfc_${crypto.randomUUID().replace(/-/g, "")}`}, ${snapshot.accountId}, ${snapshot.courseSlug},
       ${snapshot.batchKey}, ${snapshot.batchLabel}, ${snapshot.learnerName}, ${snapshot.recipientName},
       ${snapshot.recipientEmail}, ${snapshot.enrollmentSource}, ${snapshot.enrolledAt},
       ${snapshot.batchStartAt}, ${startedAt}, ${endsAt}, ${snapshot.lastActivityAt}, ${nextReminderAt},
       0, ${persistedStatus}, ${persistedReason}, ${persistedLock}, ${now}, ${now})
    `)
    if (snapshot.lastActivityAt && current?.lastReminderAt && snapshot.lastActivityAt > current.lastReminderAt) {
      resumedCampaigns.push({ id: current.id, resumedAt: snapshot.lastActivityAt })
    }
  }

  for (let index = 0; index < campaignUpserts.length; index += 100) {
    const chunk = campaignUpserts.slice(index, index + 100)
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO tochukwu_learning_followup_campaigns
        (campaign_uuid, account_id, course_slug, batch_key, batch_label, learner_name,
         recipient_name, recipient_email, enrollment_source, enrolled_at, batch_start_at,
         campaign_started_at, campaign_ends_at, last_activity_at, next_reminder_at,
         reminder_count, status, stopped_reason, locked_at, created_at, updated_at)
      VALUES ${Prisma.join(chunk)}
      ON DUPLICATE KEY UPDATE
        batch_label = VALUES(batch_label), learner_name = VALUES(learner_name),
        recipient_name = VALUES(recipient_name), recipient_email = VALUES(recipient_email),
        enrollment_source = VALUES(enrollment_source), enrolled_at = VALUES(enrolled_at),
        batch_start_at = VALUES(batch_start_at), campaign_started_at = VALUES(campaign_started_at),
        campaign_ends_at = VALUES(campaign_ends_at), last_activity_at = VALUES(last_activity_at),
        next_reminder_at = VALUES(next_reminder_at), status = VALUES(status),
        stopped_reason = VALUES(stopped_reason), locked_at = VALUES(locked_at), updated_at = VALUES(updated_at)
    `)
  }
  for (const campaign of resumedCampaigns) {
    await prisma.$executeRaw`
      UPDATE tochukwu_learning_followup_deliveries
      SET resumed_at = COALESCE(resumed_at, ${campaign.resumedAt}), updated_at = ${now}
      WHERE campaign_id = ${campaign.id} AND status = 'sent' AND sent_at < ${campaign.resumedAt}
    `
  }

  for (const campaign of existing) {
    const key = `${campaign.accountId.toString()}::${clean(campaign.courseSlug, 120).toLowerCase()}::${clean(campaign.batchKey, 64).toLowerCase()}`
    if (observed.has(key) || !["active", "paused", "processing"].includes(clean(campaign.status, 32))) continue
    await prisma.$executeRaw`
      UPDATE tochukwu_learning_followup_campaigns
      SET status = 'stopped', stopped_reason = 'enrollment_inactive', locked_at = NULL, updated_at = ${now}
      WHERE id = ${campaign.id}
    `
  }
  return { snapshots, counts: { active, paused, completed, expired, total: snapshots.length } }
}

function signingSecret() {
  const value = clean(process.env.NOTIFICATION_OUTBOX_SECRET || process.env.AUTH_SECRET || process.env.ADMIN_SESSION_SECRET, 1000)
  if (!value) throw new Error("Learning follow-up signing is not configured.")
  return value
}

function signedPayload(payload: Record<string, unknown>) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const signature = crypto.createHmac("sha256", signingSecret()).update(encoded).digest("base64url")
  return `${encoded}.${signature}`
}

function verifiedPayload(token: unknown) {
  const [encoded, signature, extra] = clean(token, 5000).split(".")
  if (!encoded || !signature || extra) return null
  const expected = crypto.createHmac("sha256", signingSecret()).update(encoded).digest()
  let received: Buffer
  try { received = Buffer.from(signature, "base64url") } catch { return null }
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return null
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Record<string, unknown>
    if (Number(payload.exp || 0) < Date.now()) return null
    return payload
  } catch { return null }
}

export function learningFollowupPauseUrl(email: string, courseSlug: string) {
  const token = signedPayload({ action: "pause", email, courseSlug, exp: Date.now() + 180 * DAY_MS })
  return publicAbsoluteUrl(`/api/learning-follow-up/pause?token=${encodeURIComponent(token)}`)
}

export function learningFollowupClickUrl(deliveryGroupUuid: string, path: string) {
  const token = signedPayload({ action: "click", deliveryGroupUuid, path, exp: Date.now() + 120 * DAY_MS })
  return publicAbsoluteUrl(`/api/learning-follow-up/click?token=${encodeURIComponent(token)}`)
}

export async function pauseLearningFollowupsFromToken(token: unknown) {
  await ensureLearningFollowupTables()
  const payload = verifiedPayload(token)
  if (payload?.action !== "pause") return false
  const email = clean(payload.email, 220).toLowerCase()
  const courseSlug = clean(payload.courseSlug, 120).toLowerCase()
  if (!email || !courseSlug) return false
  const now = new Date()
  await prisma.$transaction([
    prisma.$executeRaw`
      INSERT INTO tochukwu_learning_followup_recipient_preferences
        (recipient_email, course_slug, status, paused_at, created_at, updated_at)
      VALUES (${email}, ${courseSlug}, 'paused', ${now}, ${now}, ${now})
      ON DUPLICATE KEY UPDATE status = 'paused', paused_at = VALUES(paused_at), updated_at = VALUES(updated_at)
    `,
    prisma.$executeRaw`
      UPDATE tochukwu_learning_followup_campaigns
      SET status = 'paused', stopped_reason = 'recipient_paused', locked_at = NULL, updated_at = ${now}
      WHERE recipient_email = ${email} AND course_slug = ${courseSlug} AND status IN ('active', 'processing')
    `
  ])
  return true
}

export async function recordLearningFollowupClick(token: unknown) {
  await ensureLearningFollowupTables()
  const payload = verifiedPayload(token)
  const path = clean(payload?.path, 1500)
  const deliveryGroupUuid = clean(payload?.deliveryGroupUuid, 64)
  if (payload?.action !== "click" || !deliveryGroupUuid || !path.startsWith("/dashboard/")) return null
  await prisma.$executeRaw`
    UPDATE tochukwu_learning_followup_deliveries
    SET clicked_at = COALESCE(clicked_at, ${new Date()}), updated_at = ${new Date()}
    WHERE delivery_group_uuid = ${deliveryGroupUuid}
  `
  return publicAbsoluteUrl(path)
}

export async function learningFollowupWebhookSecret() {
  const values = await getAdminSettingValues(["BREVO_WEBHOOK_SECRET"])
  return clean(values.BREVO_WEBHOOK_SECRET || process.env.BREVO_WEBHOOK_SECRET, 1000)
}

export async function configureBrevoLearningFollowupWebhook(actorEmail: string) {
  await applyAdminSettingsToProcessEnv().catch(() => null)
  const apiKey = clean(process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY, 1000)
  if (!apiKey) throw new Error("Brevo API access is not configured.")
  let secret = await learningFollowupWebhookSecret()
  if (!secret) {
    secret = crypto.randomBytes(32).toString("base64url")
    await upsertAdminSettings([{ key: "BREVO_WEBHOOK_SECRET", value: secret }], clean(actorEmail, 220))
  }
  const url = publicAbsoluteUrl("/api/webhooks/brevo/learning-followups")
  const apiHeaders = { "api-key": apiKey, accept: "application/json", "content-type": "application/json" }
  const saved = await getAdminSettingValues(["BREVO_LEARNING_FOLLOWUP_WEBHOOK_ID"])
  let existing: { id?: number | string } | undefined = clean(saved.BREVO_LEARNING_FOLLOWUP_WEBHOOK_ID, 80)
    ? { id: clean(saved.BREVO_LEARNING_FOLLOWUP_WEBHOOK_ID, 80) }
    : undefined
  if (!existing) {
    let listResponse = await fetch("https://api.brevo.com/v3/webhooks?type=transactional&sort=desc", {
      headers: apiHeaders,
      signal: AbortSignal.timeout(12_000)
    })
    let listBody = await listResponse.json().catch(() => null)
    if (listResponse.status === 404) {
      listResponse = await fetch("https://api.brevo.com/v3/webhooks?type=transactional", {
        headers: apiHeaders,
        signal: AbortSignal.timeout(12_000)
      })
      listBody = await listResponse.json().catch(() => null)
    }
    const noWebhookRecords = /webhook record does not exist/i.test(clean(listBody?.message, 500))
    if (!listResponse.ok && !noWebhookRecords) {
      throw new Error(clean(listBody?.message, 500) || `Brevo webhook lookup failed (${listResponse.status}).`)
    }
    existing = (Array.isArray(listBody?.webhooks) ? listBody.webhooks : []).find((item: { url?: unknown; type?: unknown }) => (
      clean(item?.url, 1000) === url && clean(item?.type, 40).toLowerCase() === "transactional"
    )) as { id?: number | string } | undefined
  }
  const webhookBody = {
    url,
    description: "Learning inactivity follow-up delivery and engagement events",
    events: ["sent", "delivered", "hardBounce", "softBounce", "blocked", "spam", "invalid", "deferred", "click", "opened", "uniqueOpened", "unsubscribed"],
    headers: [{ key: "x-learning-followup-secret", value: secret }],
    batched: false
  }
  let response = await fetch(existing
    ? `https://api.brevo.com/v3/webhooks/${encodeURIComponent(String(existing.id || ""))}`
    : "https://api.brevo.com/v3/webhooks", {
    method: existing ? "PUT" : "POST",
    headers: apiHeaders,
    body: JSON.stringify(existing ? webhookBody : { ...webhookBody, type: "transactional", channel: "email" }),
    signal: AbortSignal.timeout(12_000)
  })
  let body = await response.json().catch(() => null)
  let created = !existing
  if (existing && response.status === 404) {
    existing = undefined
    response = await fetch("https://api.brevo.com/v3/webhooks", {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify({ ...webhookBody, type: "transactional", channel: "email" }),
      signal: AbortSignal.timeout(12_000)
    })
    body = await response.json().catch(() => null)
    created = true
  }
  if (!response.ok) throw new Error(clean(body?.message, 500) || `Brevo webhook configuration failed (${response.status}).`)
  const webhookId = clean(existing?.id || body?.id, 80)
  if (!webhookId) throw new Error("Brevo did not return a webhook identifier.")
  await upsertAdminSettings([{ key: "BREVO_LEARNING_FOLLOWUP_WEBHOOK_ID", value: webhookId }], clean(actorEmail, 220))
  return { created, webhookId, url }
}

function brevoEventAt(payload: Record<string, unknown>) {
  const milliseconds = Number(payload.ts_epoch || 0)
  const seconds = Number(payload.ts_event || payload.ts || 0)
  const value = milliseconds > 10_000_000_000 ? milliseconds : seconds > 0 ? seconds * 1000 : Date.now()
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : new Date()
}

export async function recordLearningFollowupBrevoEvent(payload: Record<string, unknown>) {
  await ensureLearningFollowupTables()
  const event = clean(payload.event || payload.msg_status, 40).toLowerCase().replace(/-/g, "_")
  const recipientEmail = clean(payload.email, 220).toLowerCase()
  const messageId = clean(payload["message-id"] || payload.messageId, 500).replace(/^<|>$/g, "")
  if (!event || !recipientEmail || !messageId) return { matched: false, suppressed: false }
  const rows = await prisma.$queryRaw<Array<{ deliveryGroupUuid: string }>>(Prisma.sql`
    SELECT delivery_group_uuid AS deliveryGroupUuid
    FROM tochukwu_learning_followup_deliveries
    WHERE recipient_email = ${recipientEmail}
      AND REPLACE(REPLACE(provider_message_id, '<', ''), '>', '') = ${messageId}
    LIMIT 1
  `)
  if (!rows[0]) return { matched: false, suppressed: false }
  const eventAt = brevoEventAt(payload)
  const detail = clean(payload.reason || payload.description, 1000)
  const delivered = event === "delivered"
  const opened = ["opened", "unique_opened", "proxy_open", "unique_proxy_open"].includes(event)
  const clicked = event === "click" || event === "clicked"
  const hardFailure = ["hard_bounce", "hardbounce", "invalid", "spam", "unsubscribed", "blocked"].includes(event)
  await prisma.$executeRaw`
    UPDATE tochukwu_learning_followup_deliveries
    SET provider_event = ${event}, provider_event_at = ${eventAt},
      provider_event_detail = ${detail || null},
      delivered_at = IF(${delivered ? 1 : 0} = 1, COALESCE(delivered_at, ${eventAt}), delivered_at),
      opened_at = IF(${opened ? 1 : 0} = 1, COALESCE(opened_at, ${eventAt}), opened_at),
      clicked_at = IF(${clicked ? 1 : 0} = 1, COALESCE(clicked_at, ${eventAt}), clicked_at),
      bounced_at = IF(${hardFailure ? 1 : 0} = 1, COALESCE(bounced_at, ${eventAt}), bounced_at),
      updated_at = ${new Date()}
    WHERE delivery_group_uuid = ${rows[0].deliveryGroupUuid}
  `
  if (hardFailure) {
    const campaigns = await prisma.$queryRaw<Array<{ courseSlug: string }>>(Prisma.sql`
      SELECT DISTINCT course_slug AS courseSlug
      FROM tochukwu_learning_followup_campaigns
      WHERE recipient_email = ${recipientEmail}
    `)
    await prisma.$transaction(async (tx) => {
      for (const campaign of campaigns) {
        await tx.$executeRaw`
          INSERT INTO tochukwu_learning_followup_recipient_preferences
            (recipient_email, course_slug, status, paused_at, created_at, updated_at)
          VALUES (${recipientEmail}, ${campaign.courseSlug}, 'suppressed', ${eventAt}, ${eventAt}, ${eventAt})
          ON DUPLICATE KEY UPDATE status = 'suppressed', paused_at = VALUES(paused_at), updated_at = VALUES(updated_at)
        `
      }
      await tx.$executeRaw`
        UPDATE tochukwu_learning_followup_campaigns
        SET status = 'stopped', stopped_reason = 'recipient_suppressed', locked_at = NULL, updated_at = ${eventAt}
        WHERE recipient_email = ${recipientEmail} AND status IN ('active', 'paused', 'processing', 'waiting')
      `
    })
  }
  return { matched: true, suppressed: hardFailure }
}

function subjectFor(snapshots: LearnerProgressSnapshot[], reminderNumber: number) {
  if (snapshots.length > 1) return `A learning progress reminder for your enrolled learners`
  const snapshot = snapshots[0]
  if (!snapshot.lastActivityAt) return `${firstName(snapshot.learnerName)}, your first ${snapshot.courseName} lesson is waiting`
  if (snapshot.remainingLessons <= 2) return `${firstName(snapshot.learnerName)}, only ${snapshot.remainingLessons} lesson${snapshot.remainingLessons === 1 ? "" : "s"} to go`
  if (reminderNumber >= 5) return `Turn your ${snapshot.courseName} project into proof of your skills`
  return `Continue from ${snapshot.lastLessonTitle || snapshot.resumeLessonTitle} — ${snapshot.remainingLessons} lessons to go`
}

function learnerEmailSection(snapshot: LearnerProgressSnapshot, deliveryGroupUuid: string) {
  const resumePath = `/dashboard/courses/player?course=${encodeURIComponent(snapshot.courseSlug)}${snapshot.resumeLessonId ? `&lesson=${snapshot.resumeLessonId}` : ""}`
  const resumeUrl = learningFollowupClickUrl(deliveryGroupUuid, resumePath)
  const neverStarted = !snapshot.lastActivityAt
  const proofPending = ["submitted", "pending", "in_review", "approved"].includes(snapshot.proofStatus)
  return {
    html: [
      `<div style="margin:0 0 24px;padding:20px;border:1px solid #dbe7f3;border-radius:14px;background:#f8fbff;">`,
      `<p style="margin:0;font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#0d4f9a;">${escapeHtml(snapshot.courseName)} · ${escapeHtml(snapshot.batchLabel)}</p>`,
      `<h2 style="margin:8px 0 0;color:#06162d;font-size:20px;">${escapeHtml(snapshot.learnerName)}</h2>`,
      neverStarted
        ? `<p>Your course is ready, but no lesson activity has been recorded yet. Starting with one lesson today is enough to create momentum.</p>`
        : `<p>You have completed <strong>${snapshot.completedLessons} of ${snapshot.totalLessons} lessons</strong>. You last worked on <strong>${escapeHtml(snapshot.lastLessonTitle || "your course")}</strong>, with <strong>${snapshot.remainingLessons} lesson${snapshot.remainingLessons === 1 ? "" : "s"}</strong> remaining.</p>`,
      `<p>This is a practical skill: you are learning to use AI to build and publish working websites and digital tools you can demonstrate to clients, employers, schools, or collaborators.</p>`,
      proofPending
        ? `<p>Your project proof is already ${escapeHtml(snapshot.proofStatus.replace(/_/g, " "))}. Continue the remaining lessons so your learning record is complete.</p>`
        : `<p>After completing the lessons, publish your project and submit its live link from the Certificates area. Your certificate is backed by what you built—not only by course attendance. Approved projects may also be featured on our public Student Projects page.</p>`,
      `<p><strong>Continue with:</strong> ${escapeHtml(snapshot.resumeLessonTitle || "your next lesson")}</p>`,
      `<p style="margin-bottom:0;"><a href="${escapeHtml(resumeUrl)}" style="display:inline-block;background:#0d4f9a;color:#fff;text-decoration:none;font-weight:800;padding:12px 18px;border-radius:10px;">Continue Your Course</a></p>`,
      `</div>`
    ].join(""),
    text: [
      `${snapshot.learnerName} — ${snapshot.courseName} (${snapshot.batchLabel})`,
      neverStarted
        ? "No lesson activity has been recorded yet. Starting with one lesson today is enough to create momentum."
        : `Completed: ${snapshot.completedLessons} of ${snapshot.totalLessons}. Last lesson: ${snapshot.lastLessonTitle || "Not recorded"}. Remaining: ${snapshot.remainingLessons}.`,
      "You are learning a practical skill: how to use AI to build and publish working websites and digital tools you can demonstrate to clients, employers, schools, or collaborators.",
      proofPending
        ? `Your project proof is already ${snapshot.proofStatus.replace(/_/g, " ")}. Continue the remaining lessons so your learning record is complete.`
        : "After completing the lessons, publish your project and submit its live link from the Certificates area. Your certificate is backed by what you built, and approved projects may be featured on the public Student Projects page.",
      `Continue with: ${snapshot.resumeLessonTitle || "your next lesson"}`,
      `Continue your course: ${resumeUrl}`
    ].join("\n")
  }
}

export function renderLearningFollowupEmail(input: {
  snapshots: LearnerProgressSnapshot[]
  reminderNumber: number
  deliveryGroupUuid: string
}) {
  const recipientName = input.snapshots[0]?.recipientName || input.snapshots[0]?.learnerName || "Student"
  const subject = subjectFor(input.snapshots, input.reminderNumber)
  const sections = input.snapshots.map((snapshot) => learnerEmailSection(snapshot, input.deliveryGroupUuid))
  const pauseLinks = Array.from(new Map(input.snapshots.map((snapshot) => [
    snapshot.courseSlug,
    learningFollowupPauseUrl(snapshot.recipientEmail, snapshot.courseSlug)
  ])).entries())
  const html = [
    `<p>Hello ${escapeHtml(firstName(recipientName))},</p>`,
    input.snapshots.length > 1
      ? `<p>Here is this week’s progress reminder for the learners connected to your account.</p>`
      : `<p>You are closer to the finish line than you may think. Continue from where you stopped and complete one lesson today.</p>`,
    ...sections.map((section) => section.html),
    `<p>See what other learners have built on our <a href="${escapeHtml(publicAbsoluteUrl("/projects"))}">Student Projects page</a>.</p>`,
    `<p style="font-size:12px;color:#64748b;">${pauseLinks.map(([courseSlug, url]) => `<a href="${escapeHtml(url)}">Pause ${escapeHtml(courseSlug)} progress reminders</a>`).join(" · ")}</p>`,
    `<p>Tochukwu Tech and AI Academy</p>`
  ].join("")
  const text = [
    `Hello ${firstName(recipientName)},`,
    "",
    ...sections.flatMap((section) => [section.text, ""]),
    `Student Projects: ${publicAbsoluteUrl("/projects")}`,
    ...pauseLinks.map(([courseSlug, url]) => `Pause ${courseSlug} progress reminders: ${url}`),
    "",
    "Tochukwu Tech and AI Academy"
  ].join("\n")
  return { subject, html, text }
}

async function recipientRecentlyContacted(email: string, now: Date, inactivityDays: number) {
  const rows = await prisma.$queryRaw<Array<{ id: bigint }>>(Prisma.sql`
    SELECT id FROM tochukwu_learning_followup_deliveries
    WHERE recipient_email = ${email} AND status = 'sent'
      AND sent_at > ${new Date(now.getTime() - inactivityDays * DAY_MS)}
    LIMIT 1
  `)
  return Boolean(rows[0])
}

async function claimCampaignGroup(campaigns: CampaignRow[], snapshots: LearnerProgressSnapshot[], now: Date) {
  const deliveryGroupUuid = `lfg_${crypto.randomUUID().replace(/-/g, "")}`
  const claimed: CampaignRow[] = []
  await prisma.$transaction(async (tx) => {
    for (const campaign of campaigns) {
      const rows = await tx.$queryRaw<CampaignRow[]>(Prisma.sql`
        SELECT id, campaign_uuid AS campaignUuid, account_id AS accountId, course_slug AS courseSlug,
          batch_key AS batchKey, learner_name AS learnerName, recipient_name AS recipientName,
          recipient_email AS recipientEmail, campaign_started_at AS campaignStartedAt,
          campaign_ends_at AS campaignEndsAt, last_activity_at AS lastActivityAt,
          last_reminder_at AS lastReminderAt, next_reminder_at AS nextReminderAt,
          reminder_count AS reminderCount, status, stopped_reason AS stoppedReason, locked_at AS lockedAt
        FROM tochukwu_learning_followup_campaigns WHERE id = ${campaign.id} LIMIT 1 FOR UPDATE
      `)
      const current = rows[0]
      if (!current || current.status !== "active" || current.nextReminderAt > now) continue
      const reminderNumber = Number(current.reminderCount || 0) + 1
      const snapshot = snapshots.find((item) => item.accountId === current.accountId && item.courseSlug === current.courseSlug && item.batchKey === current.batchKey)
      if (!snapshot) continue
      await tx.$executeRaw`
        INSERT INTO tochukwu_learning_followup_deliveries
          (delivery_uuid, delivery_group_uuid, campaign_id, reminder_number, recipient_email,
           status, attempts, snapshot_json, last_attempt_at, created_at, updated_at)
        VALUES
          (${`lfd_${crypto.randomUUID().replace(/-/g, "")}`}, ${deliveryGroupUuid}, ${current.id},
           ${reminderNumber}, ${current.recipientEmail}, 'processing', 1,
           ${JSON.stringify(snapshot)}, ${now}, ${now}, ${now})
        ON DUPLICATE KEY UPDATE
          delivery_group_uuid = IF(status = 'sent', delivery_group_uuid, VALUES(delivery_group_uuid)),
          status = IF(status = 'sent', status, 'processing'),
          attempts = IF(status = 'sent', attempts, attempts + 1),
          snapshot_json = VALUES(snapshot_json), last_attempt_at = VALUES(last_attempt_at),
          last_error = NULL, updated_at = VALUES(updated_at)
      `
      const deliveries = await tx.$queryRaw<Array<{ status: string; attempts: number | bigint; deliveryGroupUuid: string }>>(Prisma.sql`
        SELECT status, attempts, delivery_group_uuid AS deliveryGroupUuid
        FROM tochukwu_learning_followup_deliveries
        WHERE campaign_id = ${current.id} AND reminder_number = ${reminderNumber} LIMIT 1
      `)
      const delivery = deliveries[0]
      if (delivery?.status === "sent") continue
      if (Number(delivery?.attempts || 0) > MAX_DELIVERY_ATTEMPTS) {
        await tx.$executeRaw`
          UPDATE tochukwu_learning_followup_deliveries
          SET status = 'failed_permanent', updated_at = ${now}
          WHERE campaign_id = ${current.id} AND reminder_number = ${reminderNumber}
        `
        await tx.$executeRaw`
          UPDATE tochukwu_learning_followup_campaigns
          SET status = 'stopped', stopped_reason = 'delivery_failed', locked_at = NULL, updated_at = ${now}
          WHERE id = ${current.id}
        `
        continue
      }
      await tx.$executeRaw`
        UPDATE tochukwu_learning_followup_campaigns
        SET status = 'processing', locked_at = ${now}, updated_at = ${now}
        WHERE id = ${current.id}
      `
      claimed.push(current)
    }
  }, { timeout: 15_000 })
  return { deliveryGroupUuid, claimed }
}

export async function processLearningInactivityFollowups(input?: { now?: Date; forceDryRun?: boolean }) {
  const now = input?.now || new Date()
  const config = await learningFollowupConfig()
  const reconciliation = await reconcileLearningFollowupCampaigns(now)
  const snapshotByKey = new Map(reconciliation.snapshots.map((snapshot) => [
    `${snapshot.accountId.toString()}::${snapshot.courseSlug}::${snapshot.batchKey}`,
    snapshot
  ]))
  const due = await prisma.$queryRaw<CampaignRow[]>(Prisma.sql`
    SELECT id, campaign_uuid AS campaignUuid, account_id AS accountId, course_slug AS courseSlug,
      batch_key AS batchKey, learner_name AS learnerName, recipient_name AS recipientName,
      recipient_email AS recipientEmail, campaign_started_at AS campaignStartedAt,
      campaign_ends_at AS campaignEndsAt, last_activity_at AS lastActivityAt,
      last_reminder_at AS lastReminderAt, next_reminder_at AS nextReminderAt,
      reminder_count AS reminderCount, status, stopped_reason AS stoppedReason, locked_at AS lockedAt
    FROM tochukwu_learning_followup_campaigns
    WHERE status = 'active' AND next_reminder_at <= ${now} AND campaign_ends_at > ${now}
      AND reminder_count < ${config.maxReminders}
      AND (locked_at IS NULL OR locked_at < ${new Date(now.getTime() - 15 * 60_000)})
    ORDER BY next_reminder_at, id
    LIMIT ${config.runLimit * 5}
  `)
  const grouped = new Map<string, CampaignRow[]>()
  for (const campaign of due) {
    const snapshot = snapshotByKey.get(`${campaign.accountId.toString()}::${campaign.courseSlug}::${campaign.batchKey}`)
    if (!snapshot || snapshot.remainingLessons <= 0 || snapshot.totalLessons <= 0) continue
    grouped.set(campaign.recipientEmail, [...(grouped.get(campaign.recipientEmail) || []), campaign])
  }
  const preview = Array.from(grouped.entries()).slice(0, config.runLimit).map(([recipientEmail, campaigns]) => ({
    recipientEmail,
    learners: campaigns.map((campaign) => campaign.learnerName || "Learner"),
    campaigns: campaigns.map((campaign) => campaign.campaignUuid)
  }))
  const dryRun = input?.forceDryRun === true || config.dryRun || !config.enabled
  if (dryRun) return { ok: true, enabled: config.enabled, dryRun: true, dueRecipients: preview.length, preview: input?.forceDryRun ? preview : [], sent: 0, failed: 0, deferred: 0 }

  let sent = 0
  let failed = 0
  let deferred = 0
  for (const [recipientEmail, campaigns] of Array.from(grouped.entries()).slice(0, config.runLimit)) {
    if (await recipientRecentlyContacted(recipientEmail, now, config.inactivityDays)) {
      deferred += 1
      continue
    }
    const snapshots = campaigns.map((campaign) => snapshotByKey.get(`${campaign.accountId.toString()}::${campaign.courseSlug}::${campaign.batchKey}`)).filter((value): value is LearnerProgressSnapshot => Boolean(value))
    const claim = await claimCampaignGroup(campaigns, snapshots, now)
    if (!claim.claimed.length) continue
    const claimedSnapshots = claim.claimed.map((campaign) => snapshotByKey.get(`${campaign.accountId.toString()}::${campaign.courseSlug}::${campaign.batchKey}`)).filter((value): value is LearnerProgressSnapshot => Boolean(value))
    const reminderNumber = Math.max(...claim.claimed.map((campaign) => Number(campaign.reminderCount || 0) + 1))
    const email = renderLearningFollowupEmail({ snapshots: claimedSnapshots, reminderNumber, deliveryGroupUuid: claim.deliveryGroupUuid })
    try {
      const result = await sendBrevoTransactionalEmail({
        to: recipientEmail,
        name: claimedSnapshots[0]?.recipientName,
        subject: email.subject,
        html: email.html,
        text: email.text,
        tags: ["learning-inactivity-followup"],
        headers: { "X-Tochukwu-Delivery-Group": claim.deliveryGroupUuid }
      })
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          UPDATE tochukwu_learning_followup_deliveries
          SET subject = ${email.subject}, status = 'sent', provider_message_id = ${result.messageId},
            sent_at = ${now}, updated_at = ${now}
          WHERE delivery_group_uuid = ${claim.deliveryGroupUuid} AND status = 'processing'
        `
        for (const campaign of claim.claimed) {
          await tx.$executeRaw`
            UPDATE tochukwu_learning_followup_campaigns
            SET status = 'active', reminder_count = reminder_count + 1,
              last_reminder_at = ${now}, next_reminder_at = ${new Date(now.getTime() + config.inactivityDays * DAY_MS)},
              locked_at = NULL, updated_at = ${now}
            WHERE id = ${campaign.id}
          `
        }
      })
      sent += 1
    } catch (error) {
      const message = clean(error instanceof Error ? error.message : error, 1000)
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          UPDATE tochukwu_learning_followup_deliveries
          SET subject = ${email.subject}, status = IF(attempts >= ${MAX_DELIVERY_ATTEMPTS}, 'failed_permanent', 'failed'),
            last_error = ${message}, updated_at = ${now}
          WHERE delivery_group_uuid = ${claim.deliveryGroupUuid} AND status = 'processing'
        `
        for (const campaign of claim.claimed) {
          await tx.$executeRaw`
            UPDATE tochukwu_learning_followup_campaigns c
            JOIN tochukwu_learning_followup_deliveries d
              ON d.campaign_id = c.id AND d.delivery_group_uuid = ${claim.deliveryGroupUuid}
            SET c.status = IF(d.status = 'failed_permanent', 'stopped', 'active'),
              c.stopped_reason = IF(d.status = 'failed_permanent', 'delivery_failed', NULL),
              c.next_reminder_at = ${new Date(now.getTime() + RETRY_DELAY_MS)},
              c.locked_at = NULL, c.updated_at = ${now}
            WHERE c.id = ${campaign.id}
          `
        }
      })
      failed += 1
    }
  }
  return { ok: failed === 0, enabled: true, dryRun: false, dueRecipients: preview.length, preview: [], sent, failed, deferred }
}

export async function listLearningFollowupAdminData(input?: {
  limit?: number
  status?: string
  courseSlug?: string
  search?: string
}) {
  await ensureLearningFollowupTables()
  const config = await learningFollowupConfig()
  const limit = Math.max(1, Math.min(input?.limit || 150, 300))
  const statusFilter = clean(input?.status, 32).toLowerCase()
  const courseFilter = clean(input?.courseSlug, 120).toLowerCase()
  const searchFilter = clean(input?.search, 220).toLowerCase()
  const conditions: Prisma.Sql[] = [Prisma.sql`1 = 1`]
  if (statusFilter && statusFilter !== "all") conditions.push(Prisma.sql`status = ${statusFilter}`)
  if (courseFilter && courseFilter !== "all") conditions.push(Prisma.sql`course_slug = ${courseFilter}`)
  if (searchFilter) {
    const pattern = `%${searchFilter}%`
    conditions.push(Prisma.sql`(LOWER(COALESCE(learner_name, '')) LIKE ${pattern} OR LOWER(recipient_email) LIKE ${pattern})`)
  }
  const rows = await prisma.$queryRaw<Array<{
    campaignUuid: string; accountId: bigint; batchKey: string; learnerName: string | null; recipientEmail: string; courseSlug: string;
    batchLabel: string | null; lastActivityAt: Date | null; nextReminderAt: Date | null;
    reminderCount: number | bigint; status: string; stoppedReason: string | null
  }>>(Prisma.sql`
    SELECT campaign_uuid AS campaignUuid, account_id AS accountId, batch_key AS batchKey,
      learner_name AS learnerName, recipient_email AS recipientEmail,
      course_slug AS courseSlug, batch_label AS batchLabel, last_activity_at AS lastActivityAt,
      next_reminder_at AS nextReminderAt, reminder_count AS reminderCount, status,
      stopped_reason AS stoppedReason
    FROM tochukwu_learning_followup_campaigns
    WHERE ${Prisma.join(conditions, " AND ")}
    ORDER BY updated_at DESC, id DESC LIMIT ${limit}
  `)
  const snapshots = await listStartedLearnerProgressSnapshots()
  const snapshotByKey = new Map(snapshots.map((snapshot) => [`${snapshot.accountId.toString()}::${snapshot.courseSlug}::${snapshot.batchKey}`, snapshot]))
  const campaigns: LearningFollowupAdminRow[] = rows.map((row) => {
    const snapshot = snapshotByKey.get(`${row.accountId.toString()}::${row.courseSlug}::${row.batchKey}`)
    return {
      campaignUuid: row.campaignUuid,
      learnerName: clean(row.learnerName, 180), recipientEmail: row.recipientEmail,
      courseSlug: row.courseSlug, batchLabel: clean(row.batchLabel, 120),
      completedLessons: snapshot?.completedLessons || 0, totalLessons: snapshot?.totalLessons || 0,
      remainingLessons: snapshot?.remainingLessons || 0, lastLessonTitle: snapshot?.lastLessonTitle || "",
      lastActivityAt: row.lastActivityAt?.toISOString() || null,
      nextReminderAt: row.nextReminderAt?.toISOString() || null,
      reminderCount: Number(row.reminderCount || 0), status: clean(row.status, 32),
      stoppedReason: clean(row.stoppedReason, 80)
    }
  })
  const deliveryStats = await prisma.$queryRaw<Array<{ status: string; total: bigint | number }>>(Prisma.sql`
    SELECT status, COUNT(*) AS total FROM tochukwu_learning_followup_deliveries GROUP BY status
  `)
  const globalCampaignStats = await prisma.$queryRaw<Array<{
    active: bigint | number; paused: bigint | number; completed: bigint | number;
    expired: bigint | number; due: bigint | number
  }>>(Prisma.sql`
    SELECT
      SUM(status = 'active') AS active,
      SUM(status = 'paused') AS paused,
      SUM(status = 'completed') AS completed,
      SUM(status = 'expired') AS expired,
      SUM(status = 'active' AND next_reminder_at <= NOW() AND campaign_ends_at > NOW()
        AND reminder_count < ${config.maxReminders}) AS due
    FROM tochukwu_learning_followup_campaigns
  `)
  const outcomes = await prisma.$queryRaw<Array<{
    sent: bigint | number; delivered: bigint | number; clicked: bigint | number;
    resumed: bigint | number; completedAfterReminder: bigint | number
  }>>(Prisma.sql`
    SELECT COUNT(DISTINCT CASE WHEN d.status = 'sent' THEN d.delivery_group_uuid END) AS sent,
      COUNT(DISTINCT CASE WHEN d.delivered_at IS NOT NULL THEN d.delivery_group_uuid END) AS delivered,
      COUNT(DISTINCT CASE WHEN d.clicked_at IS NOT NULL THEN d.delivery_group_uuid END) AS clicked,
      COUNT(DISTINCT CASE WHEN d.resumed_at IS NOT NULL THEN d.delivery_group_uuid END) AS resumed,
      COUNT(DISTINCT CASE WHEN c.status = 'completed' AND c.last_reminder_at IS NOT NULL THEN c.id END) AS completedAfterReminder
    FROM tochukwu_learning_followup_deliveries d
    JOIN tochukwu_learning_followup_campaigns c ON c.id = d.campaign_id
  `)
  const proofOutcomes = await prisma.$queryRaw<Array<{ projects: bigint | number; certificates: bigint | number }>>(Prisma.sql`
    SELECT
      COUNT(DISTINCT CASE WHEN a.id IS NOT NULL THEN c.id END) AS projects,
      COUNT(DISTINCT CASE WHEN cert.certificate_no IS NOT NULL THEN c.id END) AS certificates
    FROM tochukwu_learning_followup_campaigns c
    LEFT JOIN tochukwu_learning_assignments a
      ON a.account_id = c.account_id
      AND a.course_slug COLLATE utf8mb4_unicode_ci = c.course_slug COLLATE utf8mb4_unicode_ci
      AND a.created_at > c.last_reminder_at
      AND a.submission_kind = 'link' AND a.submission_text = '[CERTIFICATE_PROOF_WEBSITE]'
    LEFT JOIN student_certificates cert
      ON cert.account_id = c.account_id
      AND cert.course_slug COLLATE utf8mb4_unicode_ci = c.course_slug COLLATE utf8mb4_unicode_ci
      AND cert.status = 'issued' AND cert.issued_at > c.last_reminder_at
    WHERE c.last_reminder_at IS NOT NULL
  `).catch(() => [{ projects: 0, certificates: 0 }])
  const deliveries = await prisma.$queryRaw<Array<{
    deliveryUuid: string; recipientEmail: string; learnerName: string | null; subject: string | null;
    status: string; attempts: number | bigint; providerMessageId: string | null; lastError: string | null;
    sentAt: Date | null; deliveredAt: Date | null; openedAt: Date | null; bouncedAt: Date | null;
    clickedAt: Date | null; resumedAt: Date | null; providerEvent: string | null; providerEventDetail: string | null
  }>>(Prisma.sql`
    SELECT d.delivery_uuid AS deliveryUuid, d.recipient_email AS recipientEmail,
      c.learner_name AS learnerName, d.subject, d.status, d.attempts,
      d.provider_message_id AS providerMessageId, d.last_error AS lastError,
      d.sent_at AS sentAt, d.delivered_at AS deliveredAt, d.opened_at AS openedAt,
      d.bounced_at AS bouncedAt, d.clicked_at AS clickedAt, d.resumed_at AS resumedAt,
      d.provider_event AS providerEvent, d.provider_event_detail AS providerEventDetail
    FROM tochukwu_learning_followup_deliveries d
    JOIN tochukwu_learning_followup_campaigns c ON c.id = d.campaign_id
    ORDER BY d.created_at DESC, d.id DESC LIMIT 100
  `)
  const dueCampaigns = await prisma.$queryRaw<CampaignRow[]>(Prisma.sql`
    SELECT id, campaign_uuid AS campaignUuid, account_id AS accountId, course_slug AS courseSlug,
      batch_key AS batchKey, learner_name AS learnerName, recipient_name AS recipientName,
      recipient_email AS recipientEmail, campaign_started_at AS campaignStartedAt,
      campaign_ends_at AS campaignEndsAt, last_activity_at AS lastActivityAt,
      last_reminder_at AS lastReminderAt, next_reminder_at AS nextReminderAt,
      reminder_count AS reminderCount, status, stopped_reason AS stoppedReason, locked_at AS lockedAt
    FROM tochukwu_learning_followup_campaigns
    WHERE status = 'active' AND next_reminder_at <= NOW() AND campaign_ends_at > NOW()
      AND reminder_count < ${config.maxReminders}
    ORDER BY next_reminder_at, id LIMIT 50
  `)
  const previewRecipient = dueCampaigns[0]?.recipientEmail
  const previewSnapshots = previewRecipient
    ? dueCampaigns.filter((row) => row.recipientEmail === previewRecipient)
      .map((row) => snapshotByKey.get(`${row.accountId.toString()}::${row.courseSlug}::${row.batchKey}`))
      .filter((value): value is LearnerProgressSnapshot => Boolean(value))
    : []
  let emailPreview: { recipientEmail: string; subject: string; text: string } | null = null
  if (previewRecipient && previewSnapshots.length) {
    try {
      const email = renderLearningFollowupEmail({
        snapshots: previewSnapshots,
        reminderNumber: Math.max(...dueCampaigns.filter((row) => row.recipientEmail === previewRecipient).map((row) => Number(row.reminderCount || 0) + 1)),
        deliveryGroupUuid: "lfg_admin_preview"
      })
      emailPreview = { recipientEmail: previewRecipient, subject: email.subject, text: email.text }
    } catch {
      emailPreview = null
    }
  }
  const campaignStats = globalCampaignStats[0]
  return {
    config: { ...config, courseAllowlist: Array.from(config.courseAllowlist) },
    campaigns,
    emailPreview,
    deliveries: deliveries.map((row) => ({
      deliveryUuid: row.deliveryUuid, recipientEmail: row.recipientEmail,
      learnerName: clean(row.learnerName, 180), subject: clean(row.subject, 255),
      status: clean(row.status, 32), attempts: Number(row.attempts || 0),
      providerMessageId: clean(row.providerMessageId, 500), lastError: clean(row.lastError, 1000),
      sentAt: row.sentAt?.toISOString() || null, deliveredAt: row.deliveredAt?.toISOString() || null,
      openedAt: row.openedAt?.toISOString() || null, bouncedAt: row.bouncedAt?.toISOString() || null,
      clickedAt: row.clickedAt?.toISOString() || null, resumedAt: row.resumedAt?.toISOString() || null,
      providerEvent: clean(row.providerEvent, 40), providerEventDetail: clean(row.providerEventDetail, 1000)
    })),
    stats: {
      active: Number(campaignStats?.active || 0), paused: Number(campaignStats?.paused || 0),
      completed: Number(campaignStats?.completed || 0), expired: Number(campaignStats?.expired || 0),
      due: Number(campaignStats?.due || 0),
      failed: deliveryStats.filter((row) => row.status.startsWith("failed")).reduce((sum, row) => sum + Number(row.total || 0), 0),
      sent: Number(outcomes[0]?.sent || 0), delivered: Number(outcomes[0]?.delivered || 0),
      clicked: Number(outcomes[0]?.clicked || 0), resumed: Number(outcomes[0]?.resumed || 0),
      completedAfterReminder: Number(outcomes[0]?.completedAfterReminder || 0),
      projectsAfterReminder: Number(proofOutcomes[0]?.projects || 0),
      certificatesAfterReminder: Number(proofOutcomes[0]?.certificates || 0)
    }
  }
}

export async function setLearningFollowupCampaignPaused(campaignUuid: string, paused: boolean) {
  await ensureLearningFollowupTables()
  const uuid = clean(campaignUuid, 64)
  if (!uuid) throw new Error("Follow-up campaign is required.")
  const now = new Date()
  const rows = await prisma.$queryRaw<Array<{ recipientEmail: string; courseSlug: string }>>(Prisma.sql`
    SELECT recipient_email AS recipientEmail, course_slug AS courseSlug
    FROM tochukwu_learning_followup_campaigns WHERE campaign_uuid = ${uuid} LIMIT 1
  `)
  const row = rows[0]
  await prisma.$transaction(async (tx) => {
    if (!paused && row) {
      await tx.$executeRaw`
        INSERT INTO tochukwu_learning_followup_recipient_preferences
          (recipient_email, course_slug, status, resumed_at, created_at, updated_at)
        VALUES (${row.recipientEmail}, ${row.courseSlug}, 'active', ${now}, ${now}, ${now})
        ON DUPLICATE KEY UPDATE status = 'active', resumed_at = VALUES(resumed_at), updated_at = VALUES(updated_at)
      `
    }
    await tx.$executeRaw`
      UPDATE tochukwu_learning_followup_campaigns
      SET status = ${paused ? "paused" : "active"}, stopped_reason = ${paused ? "admin_paused" : null},
        locked_at = NULL, updated_at = ${now}
      WHERE campaign_uuid = ${uuid} AND status NOT IN ('completed', 'expired')
    `
  })
}

export async function retryLearningFollowupCampaign(campaignUuid: string) {
  await ensureLearningFollowupTables()
  const uuid = clean(campaignUuid, 64)
  if (!uuid) throw new Error("Follow-up campaign is required.")
  const now = new Date()
  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: bigint }>>(Prisma.sql`
      SELECT id FROM tochukwu_learning_followup_campaigns WHERE campaign_uuid = ${uuid} LIMIT 1 FOR UPDATE
    `)
    const id = rows[0]?.id
    if (!id) throw new Error("Follow-up campaign was not found.")
    await tx.$executeRaw`
      UPDATE tochukwu_learning_followup_deliveries
      SET status = 'failed', attempts = 0, last_error = NULL, last_attempt_at = NULL, updated_at = ${now}
      WHERE campaign_id = ${id} AND status = 'failed_permanent'
    `
    await tx.$executeRaw`
      UPDATE tochukwu_learning_followup_campaigns
      SET status = 'active', stopped_reason = NULL, next_reminder_at = ${now}, locked_at = NULL, updated_at = ${now}
      WHERE id = ${id}
    `
  })
}
