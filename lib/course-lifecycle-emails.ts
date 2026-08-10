import crypto from "crypto"
import { Prisma } from "@prisma/client"

import { getAdminSettingValues } from "@/lib/admin-settings"
import { brandedBrevoEmail, sendBrevoTransactionalEmail } from "@/lib/brevo-transactional"
import { prisma } from "@/lib/prisma"
import { publicAbsoluteUrl } from "@/lib/public-site-url"
import { formatDateTimeWAT, watWallDateTimeMs } from "@/lib/utils"

const HOUR_MS = 60 * 60 * 1000
const MAX_ATTEMPTS = 5

export type LifecycleStage = "welcome_48h" | "batch_switch_24h" | "lesson_release"
type RecipientRole = "learner" | "group_owner"

type BatchRow = {
  courseSlug: string
  courseName: string
  batchKey: string
  batchLabel: string
  batchStartAt: Date
}

type RecipientRow = {
  recipientKey: string
  role: RecipientRole
  accountId: bigint | null
  familyId: bigint | null
  recipientName: string
  recipientEmail: string
  learnerNames: string
  learnerCount: number | bigint
  enrolledAt: Date | null
}

type LifecycleEvent = {
  stage: LifecycleStage
  stageKey: string
  dueAt: Date
  expiresAt: Date
  dayNumber?: number
  moduleTitles?: string[]
  replayAvailable?: boolean
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

function validEmail(value: unknown) {
  const email = clean(value, 320).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return ""
  const domain = email.split("@")[1] || ""
  if (domain === "student-code.local" || domain === "localhost" || domain.endsWith(".local") || domain.endsWith(".localhost")) return ""
  return email
}

export function parseLifecycleRecipientEmails(value: unknown) {
  const entries = String(value || "")
    .split(/[\s,;]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
  if (entries.length > 300) throw new Error("Select no more than 300 recipient emails per send.")
  const invalid = entries.filter((entry) => !validEmail(entry))
  if (invalid.length) throw new Error(`Invalid recipient email${invalid.length === 1 ? "" : "s"}: ${invalid.slice(0, 3).join(", ")}`)
  return Array.from(new Set(entries))
}

function booleanSetting(value: unknown, fallback: boolean) {
  const normalized = clean(value, 20).toLowerCase()
  if (!normalized) return fallback
  return ["1", "true", "yes", "on", "enabled"].includes(normalized)
}

function numberSetting(value: unknown, fallback: number, min: number, max: number) {
  const raw = clean(value, 30)
  if (!raw) return fallback
  const numeric = Number(raw)
  return Math.max(min, Math.min(max, Number.isFinite(numeric) ? Math.round(numeric) : fallback))
}

function coursePlayerUrl(courseSlug: string) {
  return publicAbsoluteUrl(`/dashboard/courses/player?course=${encodeURIComponent(courseSlug)}`)
}

function dashboardUrl(role: RecipientRole) {
  return publicAbsoluteUrl(role === "group_owner" ? "/dashboard/family" : "/dashboard/courses")
}

function profileUrl() {
  return publicAbsoluteUrl("/dashboard/profile")
}

function formatBatchStart(value: Date) {
  return formatDateTimeWAT(value).replace(/^\w{3},?\s*/, "")
}

function weekday(value: Date) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long" }).format(value)
}

function parseCommunityUrls(raw: unknown) {
  try {
    const parsed = JSON.parse(clean(raw, 10000)) as Record<string, unknown>
    return new Map(Object.entries(parsed).map(([key, value]) => [clean(key, 120).toLowerCase(), clean(value, 1500)]))
  } catch {
    return new Map<string, string>()
  }
}

export async function courseLifecycleConfig() {
  const values = await getAdminSettingValues([
    "COURSE_LIFECYCLE_EMAILS_ENABLED",
    "COURSE_LIFECYCLE_EMAILS_DRY_RUN",
    "COURSE_LIFECYCLE_EMAILS_RUN_LIMIT",
    "COURSE_COMMUNITY_WHATSAPP_URLS_JSON"
  ])
  const communityUrls = parseCommunityUrls(values.COURSE_COMMUNITY_WHATSAPP_URLS_JSON)
  if (!communityUrls.has("prompt-to-profit-holiday")) {
    communityUrls.set("prompt-to-profit-holiday", "https://chat.whatsapp.com/LIBIFLIrs2d91Jzl5K3X4U?s=cl&p=i&ilr=0")
  }
  return {
    enabled: booleanSetting(values.COURSE_LIFECYCLE_EMAILS_ENABLED, true),
    dryRun: booleanSetting(values.COURSE_LIFECYCLE_EMAILS_DRY_RUN, false),
    runLimit: numberSetting(values.COURSE_LIFECYCLE_EMAILS_RUN_LIMIT, 100, 1, 300),
    communityUrls
  }
}

export async function ensureCourseLifecycleTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_course_lifecycle_deliveries (
      id BIGINT NOT NULL AUTO_INCREMENT,
      delivery_uuid VARCHAR(64) NOT NULL,
      course_slug VARCHAR(120) NOT NULL,
      batch_key VARCHAR(64) NOT NULL,
      stage VARCHAR(40) NOT NULL,
      stage_key VARCHAR(190) NOT NULL,
      recipient_key VARCHAR(190) NOT NULL,
      recipient_role VARCHAR(32) NOT NULL,
      recipient_email VARCHAR(320) NOT NULL,
      recipient_name VARCHAR(180) NULL,
      due_at DATETIME NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      attempts INT NOT NULL DEFAULT 0,
      subject VARCHAR(255) NULL,
      snapshot_json LONGTEXT NULL,
      provider_message_id VARCHAR(500) NULL,
      last_error VARCHAR(1000) NULL,
      last_attempt_at DATETIME NULL,
      sent_at DATETIME NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_course_lifecycle_delivery_uuid (delivery_uuid),
      UNIQUE KEY uniq_course_lifecycle_recipient_stage (course_slug, batch_key, stage_key, recipient_key),
      KEY idx_course_lifecycle_due (status, due_at),
      KEY idx_course_lifecycle_recipient (recipient_email, sent_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}

async function listRelevantBatches(now: Date) {
  const from = new Date(now.getTime() - 7 * 24 * HOUR_MS)
  const to = new Date(now.getTime() + 3 * 24 * HOUR_MS)
  return prisma.$queryRaw<BatchRow[]>(Prisma.sql`
    SELECT b.course_slug AS courseSlug,
      COALESCE(NULLIF(c.course_title, ''), b.course_slug) AS courseName,
      b.batch_key AS batchKey, COALESCE(NULLIF(b.batch_label, ''), b.batch_key) AS batchLabel,
      b.batch_start_at AS batchStartAt
    FROM course_batches b
    LEFT JOIN tochukwu_learning_courses c
      ON c.course_slug COLLATE utf8mb4_unicode_ci = b.course_slug COLLATE utf8mb4_unicode_ci
    WHERE b.batch_start_at IS NOT NULL
      AND b.batch_start_at BETWEEN ${from} AND ${to}
      AND b.status IN ('open', 'active', 'started')
    ORDER BY b.batch_start_at, b.id
  `)
}

async function listBatchRecipients(batch: BatchRow) {
  const rows = await prisma.$queryRaw<RecipientRow[]>(Prisma.sql`
    SELECT recipientKey, role, accountId, familyId, recipientName, recipientEmail,
      learnerNames, learnerCount, enrolledAt
    FROM (
      SELECT CONCAT('learner:', sa.id) COLLATE utf8mb4_unicode_ci AS recipientKey,
        'learner' COLLATE utf8mb4_unicode_ci AS role, sa.id AS accountId, NULL AS familyId,
        COALESCE(NULLIF(sa.full_name, ''), NULLIF(o.first_name, ''), 'Student') COLLATE utf8mb4_unicode_ci AS recipientName,
        LOWER(sa.email) COLLATE utf8mb4_unicode_ci AS recipientEmail,
        COALESCE(NULLIF(sa.full_name, ''), NULLIF(o.first_name, ''), 'Student') COLLATE utf8mb4_unicode_ci AS learnerNames,
        1 AS learnerCount, COALESCE(o.paid_at, o.updated_at, o.created_at) AS enrolledAt
      FROM course_orders o
      JOIN student_accounts sa ON LOWER(sa.email) COLLATE utf8mb4_unicode_ci = LOWER(o.email) COLLATE utf8mb4_unicode_ci
      WHERE o.course_slug COLLATE utf8mb4_unicode_ci = ${batch.courseSlug} COLLATE utf8mb4_unicode_ci
        AND o.batch_key COLLATE utf8mb4_unicode_ci = ${batch.batchKey} COLLATE utf8mb4_unicode_ci
        AND o.status = 'paid' AND COALESCE(o.buyer_type, 'student') <> 'family'

      UNION ALL

      SELECT CONCAT('learner:', sa.id) COLLATE utf8mb4_unicode_ci AS recipientKey,
        'learner' COLLATE utf8mb4_unicode_ci AS role, sa.id AS accountId, NULL AS familyId,
        COALESCE(NULLIF(sa.full_name, ''), NULLIF(m.first_name, ''), 'Student') COLLATE utf8mb4_unicode_ci AS recipientName,
        LOWER(sa.email) COLLATE utf8mb4_unicode_ci AS recipientEmail,
        COALESCE(NULLIF(sa.full_name, ''), NULLIF(m.first_name, ''), 'Student') COLLATE utf8mb4_unicode_ci AS learnerNames,
        1 AS learnerCount, COALESCE(m.reviewed_at, m.updated_at, m.created_at) AS enrolledAt
      FROM course_manual_payments m
      JOIN student_accounts sa ON LOWER(sa.email) COLLATE utf8mb4_unicode_ci = LOWER(m.email) COLLATE utf8mb4_unicode_ci
      WHERE m.course_slug COLLATE utf8mb4_unicode_ci = ${batch.courseSlug} COLLATE utf8mb4_unicode_ci
        AND m.batch_key COLLATE utf8mb4_unicode_ci = ${batch.batchKey} COLLATE utf8mb4_unicode_ci
        AND m.status = 'approved' AND COALESCE(m.buyer_type, 'student') <> 'family'

      UNION ALL

      SELECT CONCAT('family:', f.id) COLLATE utf8mb4_unicode_ci AS recipientKey,
        'group_owner' COLLATE utf8mb4_unicode_ci AS role, NULL AS accountId, f.id AS familyId,
        COALESCE(NULLIF(f.parent_name, ''), 'Parent') COLLATE utf8mb4_unicode_ci AS recipientName,
        LOWER(f.parent_email) COLLATE utf8mb4_unicode_ci AS recipientEmail,
        GROUP_CONCAT(DISTINCT c.full_name ORDER BY c.full_name SEPARATOR ', ') COLLATE utf8mb4_unicode_ci AS learnerNames,
        COUNT(DISTINCT c.id) AS learnerCount, MIN(COALESCE(e.paid_at, e.updated_at, e.created_at)) AS enrolledAt
      FROM family_child_enrollments e
      JOIN family_children c ON c.id = e.child_id AND c.family_id = e.family_id AND c.status = 'active'
      JOIN family_accounts f ON f.id = e.family_id AND f.status = 'active'
      WHERE e.course_slug COLLATE utf8mb4_unicode_ci = ${batch.courseSlug} COLLATE utf8mb4_unicode_ci
        AND e.batch_key COLLATE utf8mb4_unicode_ci = ${batch.batchKey} COLLATE utf8mb4_unicode_ci
        AND e.status = 'active'
      GROUP BY f.id, f.parent_name, f.parent_email
    ) recipients
    WHERE recipientEmail IS NOT NULL AND recipientEmail <> ''
    ORDER BY recipientKey
  `)
  const deduped = new Map<string, RecipientRow>()
  for (const row of rows) {
    const email = validEmail(row.recipientEmail)
    if (!email) continue
    const key = clean(row.recipientKey, 190)
    const current = deduped.get(key)
    if (!current || (row.enrolledAt?.getTime() || 0) > (current.enrolledAt?.getTime() || 0)) {
      deduped.set(key, { ...row, recipientEmail: email })
    }
  }
  return Array.from(deduped.values())
}

async function lessonReleaseEvents(batch: BatchRow) {
  const rows = await prisma.$queryRaw<Array<{
    moduleId: bigint
    moduleTitle: string
    sortOrder: number | bigint
    dripEnabled: number | bigint
    baseDripAt: Date | null
    dripOffsetSeconds: number | bigint | null
    accessMode: string | null
    batchDripAt: Date | null
  }>>(Prisma.sql`
    SELECT cm.module_id AS moduleId, COALESCE(NULLIF(m.module_title, ''), CONCAT('Module ', cm.sort_order)) AS moduleTitle,
      cm.sort_order AS sortOrder, cm.drip_enabled AS dripEnabled, cm.drip_at AS baseDripAt,
      cm.drip_offset_seconds AS dripOffsetSeconds, d.access_mode AS accessMode, d.drip_at AS batchDripAt
    FROM tochukwu_learning_course_modules cm
    JOIN tochukwu_learning_modules m ON m.id = cm.module_id AND m.is_active = 1
    LEFT JOIN tochukwu_learning_module_batch_drips d
      ON d.module_id = cm.module_id
     AND d.batch_key COLLATE utf8mb4_unicode_ci = ${batch.batchKey} COLLATE utf8mb4_unicode_ci
    WHERE cm.course_slug COLLATE utf8mb4_unicode_ci = ${batch.courseSlug} COLLATE utf8mb4_unicode_ci
      AND cm.is_active = 1
    ORDER BY cm.sort_order, cm.id
  `)
  const grouped = new Map<number, { dueAt: Date; dayNumber: number; moduleTitles: string[]; moduleIds: string[] }>()
  for (const row of rows) {
    if (Number(row.dripEnabled || 0) !== 1 && clean(row.accessMode, 24) !== "drip") continue
    const releaseWallDate = row.batchDripAt
      || (row.dripOffsetSeconds !== null && Number.isFinite(Number(row.dripOffsetSeconds))
        ? new Date(batch.batchStartAt.getTime() + Number(row.dripOffsetSeconds) * 1000)
        : row.baseDripAt)
    const releaseMs = row.batchDripAt
      ? watWallDateTimeMs(row.batchDripAt)
      : row.dripOffsetSeconds !== null && Number.isFinite(Number(row.dripOffsetSeconds))
        ? watWallDateTimeMs(batch.batchStartAt) + Number(row.dripOffsetSeconds) * 1000
        : row.baseDripAt
          ? watWallDateTimeMs(row.baseDripAt)
          : NaN
    if (!Number.isFinite(releaseMs)) continue
    const dayKey = Math.floor(releaseMs / (24 * HOUR_MS))
    const startCalendar = Date.UTC(batch.batchStartAt.getUTCFullYear(), batch.batchStartAt.getUTCMonth(), batch.batchStartAt.getUTCDate())
    const releaseCalendar = releaseWallDate
      ? Date.UTC(releaseWallDate.getUTCFullYear(), releaseWallDate.getUTCMonth(), releaseWallDate.getUTCDate())
      : startCalendar
    const dayNumber = Math.max(1, Math.round((releaseCalendar - startCalendar) / (24 * HOUR_MS)) + 1)
    const current = grouped.get(dayKey) || {
      dueAt: new Date(releaseMs),
      dayNumber,
      moduleTitles: [],
      moduleIds: []
    }
    current.moduleTitles.push(clean(row.moduleTitle, 220))
    current.moduleIds.push(row.moduleId.toString())
    if (releaseMs < current.dueAt.getTime()) current.dueAt = new Date(releaseMs)
    grouped.set(dayKey, current)
  }
  return Array.from(grouped.values()).map<LifecycleEvent>((group) => {
    const replayAvailable = rows.some((row) => {
      if (!/(?:day\s*1|live\s*class\s*1)/i.test(clean(row.moduleTitle, 220))) return false
      if (Number(row.dripEnabled || 0) !== 1) return true
      if (clean(row.accessMode, 24).toLowerCase() === "immediate") return true
      return Boolean(row.batchDripAt && watWallDateTimeMs(row.batchDripAt) <= group.dueAt.getTime())
    })
    return {
      stage: "lesson_release",
      stageKey: `lesson-release:${group.moduleIds.sort().join("-")}`,
      dueAt: group.dueAt,
      expiresAt: new Date(group.dueAt.getTime() + 12 * HOUR_MS),
      dayNumber: group.dayNumber,
      moduleTitles: group.moduleTitles,
      replayAvailable
    }
  })
}

async function lifecycleEvents(batch: BatchRow) {
  const startMs = watWallDateTimeMs(batch.batchStartAt)
  return [
    {
      stage: "welcome_48h" as const,
      stageKey: "welcome-48h",
      dueAt: new Date(startMs - 48 * HOUR_MS),
      expiresAt: new Date(startMs - 24 * HOUR_MS)
    },
    {
      stage: "batch_switch_24h" as const,
      stageKey: "batch-switch-24h",
      dueAt: new Date(startMs - 24 * HOUR_MS),
      expiresAt: new Date(startMs - HOUR_MS)
    },
    ...(await lessonReleaseEvents(batch))
  ]
}

export function renderCourseLifecycleEmail(input: {
  batch: BatchRow
  recipient: RecipientRow
  event: LifecycleEvent
  communityUrl?: string
}) {
  const { batch, recipient, event } = input
  const owner = recipient.role === "group_owner"
  const greeting = firstName(recipient.recipientName)
  const start = formatBatchStart(batch.batchStartAt)
  const startDay = weekday(batch.batchStartAt)
  const dashboard = dashboardUrl(recipient.role)
  const learners = clean(recipient.learnerNames, 2000)
  let subject = ""
  let paragraphs: string[] = []
  let buttonLabel = "Open Your Dashboard"
  let buttonUrl = dashboard

  if (event.stage === "welcome_48h") {
    subject = owner
      ? `Your enrolled learners start ${batch.courseName} on ${startDay}`
      : `${batch.courseName} starts ${startDay}, ${start}`
    paragraphs = owner ? [
      `Your ${Number(recipient.learnerCount || 0) === 1 ? "learner" : "learners"}, <strong>${escapeHtml(learners)}</strong>, are confirmed for <strong>${escapeHtml(batch.batchLabel)}</strong> of ${escapeHtml(batch.courseName)}. The course begins ${escapeHtml(start)}.`,
      "Day 1 is a live Zoom class. Each learner will find the Zoom button and course player inside their own learning dashboard.",
      "Before the course begins, open Group Enrollment, confirm every learner has a seat, and give each learner their individual access code. Ask them to sign in before class so they are familiar with the dashboard.",
      "Live sessions are recorded and added to the course player, but learners should attend live whenever possible."
    ] : [
      `Your place in <strong>${escapeHtml(batch.batchLabel)}</strong> of ${escapeHtml(batch.courseName)} is confirmed. The course begins ${escapeHtml(start)}.`,
      "Day 1 is a live Zoom class. Your Zoom access button will appear in your Courses dashboard 30 minutes before the class begins.",
      "The remaining lessons and live-session recordings will be available in the course player as they are released.",
      `Before class, confirm that you can see the course in your dashboard and <a href="${escapeHtml(profileUrl())}">complete your learner profile</a>.`
    ]
  } else if (event.stage === "batch_switch_24h") {
    subject = `${batch.courseName} starts tomorrow — switch batches now if necessary`
    paragraphs = owner ? [
      `<strong>${escapeHtml(learners)}</strong> ${Number(recipient.learnerCount || 0) === 1 ? "is" : "are"} currently enrolled in ${escapeHtml(batch.batchLabel)}, beginning ${escapeHtml(start)}.`,
      "If this date no longer works, open Group Enrollment and switch the affected learner before the current batch starts. Online switching closes once the batch begins.",
      "If a learner cannot attend a live class, the recording will be added to the course player."
    ] : [
      `You are currently enrolled in <strong>${escapeHtml(batch.batchLabel)}</strong>, beginning ${escapeHtml(start)}.`,
      "If this date no longer works, open Courses, select Switch Batch, choose another available date and confirm. Online switching closes once your current batch begins.",
      "If an emergency prevents you from attending live, the recording will be added to your course player."
    ]
    buttonLabel = owner ? "Review Learner Batches" : "Review Your Batch"
  } else {
    subject = `Day ${event.dayNumber || "today"} lessons for ${batch.courseName} are ready`
    buttonLabel = owner ? "Open Group Enrollment" : "Start Today’s Lessons"
    buttonUrl = owner ? dashboard : coursePlayerUrl(batch.courseSlug)
    paragraphs = owner ? [
      `New ${escapeHtml(batch.courseName)} lessons are now available for <strong>${escapeHtml(learners)}</strong>.`,
      "Each learner should sign in with their individual access code, open Courses and select Open Course Player.",
      event.moduleTitles?.length ? `<strong>Available now:</strong> ${escapeHtml(event.moduleTitles.join(", "))}.` : ""
    ] : [
      `Your Day ${event.dayNumber || ""} lessons for ${escapeHtml(batch.courseName)} are now available.`,
      "Sign in, open Courses and select Open Course Player to continue learning.",
      event.moduleTitles?.length ? `<strong>Available now:</strong> ${escapeHtml(event.moduleTitles.join(", "))}.` : ""
    ]
    if (event.dayNumber === 2 && input.communityUrl) {
      paragraphs.push(`You can also <a href="${escapeHtml(input.communityUrl)}">join the ${escapeHtml(batch.courseName)} WhatsApp community</a> to meet other builders, ask questions and receive help.`)
    }
    if (event.dayNumber === 2 && event.replayAvailable) {
      paragraphs.push("The Day 1 live-class recording is also available in the course player.")
    }
  }

  const html = [
    `<p>Hello ${escapeHtml(greeting)},</p>`,
    ...paragraphs.filter(Boolean).map((paragraph) => `<p>${paragraph}</p>`),
    `<p><a href="${escapeHtml(buttonUrl)}" style="display:inline-block;background:#0d4f9a;color:#fff;text-decoration:none;font-weight:800;padding:12px 18px;border-radius:10px;">${escapeHtml(buttonLabel)}</a></p>`,
    "<p>I look forward to seeing you in class.</p>",
    "<p><strong>Tochukwu Nkwocha</strong><br/>Founder &amp; Lead Instructor<br/>Tochukwu Tech and AI Academy</p>"
  ].join("")
  const text = html
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .trim() + `\n\n${buttonLabel}: ${buttonUrl}`
  if (/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|\.local(?:\/|:|$))/i.test(`${html}\n${text}`)) {
    throw new Error("Course lifecycle email contains a local URL and was blocked.")
  }
  return { subject, html, text }
}

async function claimDelivery(input: { batch: BatchRow; recipient: RecipientRow; event: LifecycleEvent; subject: string; snapshot: string }) {
  const now = new Date()
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO tochukwu_course_lifecycle_deliveries
        (delivery_uuid, course_slug, batch_key, stage, stage_key, recipient_key, recipient_role,
         recipient_email, recipient_name, due_at, status, attempts, subject, snapshot_json, created_at, updated_at)
      VALUES
        (${`cld_${crypto.randomUUID().replace(/-/g, "")}`}, ${input.batch.courseSlug}, ${input.batch.batchKey},
         ${input.event.stage}, ${input.event.stageKey}, ${input.recipient.recipientKey}, ${input.recipient.role},
         ${input.recipient.recipientEmail}, ${input.recipient.recipientName}, ${input.event.dueAt}, 'pending', 0,
         ${input.subject}, ${input.snapshot}, ${now}, ${now})
      ON DUPLICATE KEY UPDATE recipient_email = VALUES(recipient_email), recipient_name = VALUES(recipient_name),
        subject = VALUES(subject), snapshot_json = VALUES(snapshot_json), updated_at = VALUES(updated_at)
    `
    const rows = await tx.$queryRaw<Array<{ status: string; attempts: number | bigint; lastAttemptAt: Date | null }>>(Prisma.sql`
      SELECT status, attempts, last_attempt_at AS lastAttemptAt
      FROM tochukwu_course_lifecycle_deliveries
      WHERE course_slug = ${input.batch.courseSlug} AND batch_key = ${input.batch.batchKey}
        AND stage_key = ${input.event.stageKey} AND recipient_key = ${input.recipient.recipientKey}
      LIMIT 1 FOR UPDATE
    `)
    const row = rows[0]
    const attempts = Number(row?.attempts || 0)
    if (["sent", "skipped", "failed_permanent"].includes(clean(row?.status, 32))) return { claimed: false, attempts }
    if (row?.lastAttemptAt && now.getTime() - row.lastAttemptAt.getTime() < 10 * 60_000) return { claimed: false, attempts }
    const nextAttempts = attempts + 1
    await tx.$executeRaw`
      UPDATE tochukwu_course_lifecycle_deliveries
      SET status = 'processing', attempts = ${nextAttempts}, last_attempt_at = ${now}, last_error = NULL, updated_at = ${now}
      WHERE course_slug = ${input.batch.courseSlug} AND batch_key = ${input.batch.batchKey}
        AND stage_key = ${input.event.stageKey} AND recipient_key = ${input.recipient.recipientKey}
    `
    return { claimed: true, attempts: nextAttempts }
  })
}

async function finishDelivery(input: { batch: BatchRow; recipient: RecipientRow; event: LifecycleEvent; status: string; messageId?: string | null; error?: string }) {
  const now = new Date()
  await prisma.$executeRaw`
    UPDATE tochukwu_course_lifecycle_deliveries
    SET status = ${input.status}, provider_message_id = ${clean(input.messageId, 500) || null},
      last_error = ${clean(input.error, 1000) || null}, sent_at = ${input.status === "sent" ? now : null}, updated_at = ${now}
    WHERE course_slug = ${input.batch.courseSlug} AND batch_key = ${input.batch.batchKey}
      AND stage_key = ${input.event.stageKey} AND recipient_key = ${input.recipient.recipientKey}
  `
}

export type CourseLifecycleProcessInput = {
  now?: Date
  forceDryRun?: boolean
  forceLive?: boolean
  courseSlug?: string
  batchKey?: string
  stage?: LifecycleStage | "all"
  recipientEmail?: string
  limit?: number
  includeBodies?: boolean
}

export async function processCourseLifecycleEmails(input?: CourseLifecycleProcessInput) {
  const now = input?.now || new Date()
  await ensureCourseLifecycleTables()
  const config = await courseLifecycleConfig()
  const batches = await listRelevantBatches(now)
  const due: Array<{ batch: BatchRow; recipient: RecipientRow; event: LifecycleEvent }> = []
  for (const batch of batches) {
    const [recipients, events] = await Promise.all([listBatchRecipients(batch), lifecycleEvents(batch)])
    for (const event of events) {
      if (event.dueAt > now || event.expiresAt <= now) continue
      for (const recipient of recipients) {
        if (recipient.enrolledAt && recipient.enrolledAt > now) continue
        due.push({ batch, recipient, event })
      }
    }
  }
  const courseFilter = clean(input?.courseSlug, 120).toLowerCase()
  const batchFilter = clean(input?.batchKey, 64).toLowerCase()
  const stageFilter = clean(input?.stage, 40).toLowerCase()
  const recipientFilters = new Set(parseLifecycleRecipientEmails(input?.recipientEmail))
  const filteredDue = due.filter((item) => (
    (!courseFilter || item.batch.courseSlug === courseFilter)
    && (!batchFilter || item.batch.batchKey === batchFilter)
    && (!stageFilter || stageFilter === "all" || item.event.stage === stageFilter)
    && (!recipientFilters.size || recipientFilters.has(item.recipient.recipientEmail))
  ))
  const runLimit = Math.max(1, Math.min(input?.limit || config.runLimit, 300))
  const preview = filteredDue.slice(0, runLimit).map((item) => {
    const email = renderCourseLifecycleEmail({
      ...item,
      communityUrl: config.communityUrls.get(item.batch.courseSlug)
    })
    return {
      recipientEmail: item.recipient.recipientEmail,
      recipientRole: item.recipient.role,
      courseSlug: item.batch.courseSlug,
      batchKey: item.batch.batchKey,
      stage: item.event.stage,
      stageKey: item.event.stageKey,
      dueAt: item.event.dueAt,
      subject: email.subject,
      ...(input?.includeBodies ? { html: brandedBrevoEmail({ subject: email.subject, html: email.html }), text: email.text } : {}),
      replayAvailable: item.event.replayAvailable || false,
      containsLocalUrl: /(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|\.local(?:\/|:|$))/i.test(`${email.html}\n${email.text}`)
    }
  })
  const dryRun = input?.forceDryRun === true || (input?.forceLive !== true && (config.dryRun || !config.enabled))
  if (dryRun) return { ok: true, enabled: config.enabled, dryRun: true, due: filteredDue.length, preview, sent: 0, failed: 0 }

  let sent = 0
  let failed = 0
  for (const item of filteredDue) {
    if (sent + failed >= runLimit) break
    const email = renderCourseLifecycleEmail({
      ...item,
      communityUrl: config.communityUrls.get(item.batch.courseSlug)
    })
    const snapshot = JSON.stringify({
      recipientRole: item.recipient.role,
      learnerNames: item.recipient.learnerNames,
      learnerCount: Number(item.recipient.learnerCount || 0),
      batchStartAt: item.batch.batchStartAt,
      event: item.event
    })
    const claim = await claimDelivery({ ...item, subject: email.subject, snapshot })
    if (!claim.claimed) continue
    try {
      const result = await sendBrevoTransactionalEmail({
        to: item.recipient.recipientEmail,
        name: item.recipient.recipientName,
        subject: email.subject,
        html: email.html,
        text: email.text,
        tags: ["course-lifecycle", item.event.stage],
        headers: { "X-Tochukwu-Lifecycle-Stage": item.event.stageKey }
      })
      await finishDelivery({ ...item, status: "sent", messageId: result.messageId })
      sent += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await finishDelivery({ ...item, status: claim.attempts >= MAX_ATTEMPTS ? "failed_permanent" : "failed", error: message })
      failed += 1
    }
  }
  return { ok: failed === 0, enabled: config.enabled, dryRun: false, due: filteredDue.length, preview: [], sent, failed }
}

export async function previewCourseLifecycleEmails(input?: Omit<CourseLifecycleProcessInput, "forceDryRun" | "forceLive">) {
  return processCourseLifecycleEmails({ ...input, forceDryRun: true, includeBodies: true })
}

export async function listCourseLifecycleBatchOptions() {
  const now = new Date()
  const rows = await prisma.$queryRaw<Array<{ courseSlug: string; courseName: string; batchKey: string; batchLabel: string; batchStartAt: Date }>>(Prisma.sql`
    SELECT b.course_slug AS courseSlug, COALESCE(NULLIF(c.course_title, ''), b.course_slug) AS courseName,
      b.batch_key AS batchKey, COALESCE(NULLIF(b.batch_label, ''), b.batch_key) AS batchLabel,
      b.batch_start_at AS batchStartAt
    FROM course_batches b
    LEFT JOIN tochukwu_learning_courses c
      ON c.course_slug COLLATE utf8mb4_unicode_ci = b.course_slug COLLATE utf8mb4_unicode_ci
    WHERE b.batch_start_at BETWEEN ${new Date(now.getTime() - 7 * 24 * HOUR_MS)} AND ${new Date(now.getTime() + 90 * 24 * HOUR_MS)}
      AND b.status IN ('open', 'active', 'started')
    ORDER BY b.batch_start_at, b.id
  `)
  return rows.map((row) => ({
    courseSlug: clean(row.courseSlug, 120).toLowerCase(),
    courseName: clean(row.courseName, 220),
    batchKey: clean(row.batchKey, 64).toLowerCase(),
    batchLabel: clean(row.batchLabel, 120),
    batchStartAt: row.batchStartAt
  }))
}

export async function listCourseLifecycleDeliveryStats() {
  await ensureCourseLifecycleTables()
  const rows = await prisma.$queryRaw<Array<{ status: string; total: bigint; latestSentAt: Date | null }>>`
    SELECT status, COUNT(*) AS total, MAX(sent_at) AS latestSentAt
    FROM tochukwu_course_lifecycle_deliveries GROUP BY status ORDER BY status
  `
  return rows.map((row) => ({ status: clean(row.status, 32), total: Number(row.total || 0), latestSentAt: row.latestSentAt }))
}

export async function listCourseLifecycleDeliveries(limit = 150) {
  await ensureCourseLifecycleTables()
  const rows = await prisma.$queryRaw<Array<{
    deliveryUuid: string
    courseSlug: string
    batchKey: string
    stage: string
    recipientRole: string
    recipientEmail: string
    recipientName: string | null
    subject: string | null
    status: string
    attempts: number | bigint
    providerMessageId: string | null
    lastError: string | null
    dueAt: Date
    sentAt: Date | null
  }>>`
    SELECT delivery_uuid AS deliveryUuid, course_slug AS courseSlug, batch_key AS batchKey,
      stage, recipient_role AS recipientRole, recipient_email AS recipientEmail,
      recipient_name AS recipientName, subject, status, attempts,
      provider_message_id AS providerMessageId, last_error AS lastError,
      due_at AS dueAt, sent_at AS sentAt
    FROM tochukwu_course_lifecycle_deliveries
    ORDER BY id DESC
    LIMIT ${Math.max(1, Math.min(limit, 300))}
  `
  return rows.map((row) => ({
    ...row,
    deliveryUuid: clean(row.deliveryUuid, 64),
    courseSlug: clean(row.courseSlug, 120),
    batchKey: clean(row.batchKey, 64),
    stage: clean(row.stage, 40),
    recipientRole: clean(row.recipientRole, 32),
    recipientEmail: clean(row.recipientEmail, 320),
    recipientName: clean(row.recipientName, 180),
    subject: clean(row.subject, 255),
    status: clean(row.status, 32),
    attempts: Number(row.attempts || 0),
    providerMessageId: clean(row.providerMessageId, 500),
    lastError: clean(row.lastError, 1000)
  }))
}
