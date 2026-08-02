import { randomUUID } from "crypto"
import { Prisma } from "@prisma/client"

import { sendBrevoTransactionalEmail } from "@/lib/brevo-transactional"
import { prisma } from "@/lib/prisma"
import { publicAbsoluteUrl } from "@/lib/public-site-url"
import { sendLiveClassReminderWhatsApp } from "@/lib/transactional-whatsapp"
import { formatDateTimeWAT, watWallDateTimeMs } from "@/lib/utils"
import { createNoFixedTimeZoomMeeting } from "@/lib/zoom"

function clean(value: unknown, max = 1000) {
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

function normalizeSlug(value: unknown) {
  return clean(value, 120).toLowerCase()
}

function normalizeBatchKey(value: unknown) {
  return clean(value, 64).toLowerCase()
}

function normalizeTime(value: unknown) {
  const raw = clean(value, 16)
  const match = raw.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return ""
  const hour = Math.max(0, Math.min(23, Number(match[1])))
  const minute = Math.max(0, Math.min(59, Number(match[2])))
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

function toInt(value: unknown, fallback = 0) {
  const numberValue = Number(String(value ?? "").trim())
  return Number.isFinite(numberValue) ? Math.trunc(numberValue) : fallback
}

function wallDate(value: unknown) {
  const raw = clean(value, 80)
  if (!raw) return null
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/)
  const date = match
    ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6] || "0")))
    : new Date(raw)
  return Number.isFinite(date.getTime()) ? date : null
}

function addMinutes(value: Date | null, minutes: number) {
  if (!value) return null
  return new Date(value.getTime() + minutes * 60 * 1000)
}

const LIVE_REMINDER_MAX_CHANNEL_ATTEMPTS = 5
const LIVE_REMINDER_RETRY_DELAY_MS = 10 * 60 * 1000
const LIVE_SESSION_ACCESS_MINUTES_BEFORE = 30

type LiveReminderStage = "day_before" | "access_open"
type LiveReminderChannel = "email" | "whatsapp"

function shouldSendWhatsAppReminder(stage: LiveReminderStage) {
  return stage === "day_before" || stage === "access_open"
}

function watCalendarDateParts(timestampMs: number) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(timestampMs))
  const value = (type: "year" | "month" | "day") => Number(parts.find((part) => part.type === type)?.value || 0)
  return { year: value("year"), month: value("month"), day: value("day") }
}

function reminderStageMatchesWatDate(session: CourseLiveSessionRow, stage: LiveReminderStage, timestampMs: number) {
  if (!session.startsAt) return false
  const expected = new Date(Date.UTC(
    session.startsAt.getUTCFullYear(),
    session.startsAt.getUTCMonth(),
    session.startsAt.getUTCDate() - (stage === "day_before" ? 1 : 0)
  ))
  const today = watCalendarDateParts(timestampMs)
  return expected.getUTCFullYear() === today.year
    && expected.getUTCMonth() + 1 === today.month
    && expected.getUTCDate() === today.day
}

function wallTimeLabel(value: Date | null) {
  if (!value) return ""
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(value).replace(/\bam\b/i, "a.m.").replace(/\bpm\b/i, "p.m.") + " WAT"
}

function liveSessionReminderTimes(session: CourseLiveSessionRow) {
  if (!session.startsAt) return { sessionTime: "", accessTime: "" }
  const wallStartMs = Date.UTC(
    session.startsAt.getUTCFullYear(),
    session.startsAt.getUTCMonth(),
    session.startsAt.getUTCDate(),
    session.startsAt.getUTCHours(),
    session.startsAt.getUTCMinutes(),
    session.startsAt.getUTCSeconds()
  )
  return {
    sessionTime: wallTimeLabel(new Date(wallStartMs)),
    accessTime: wallTimeLabel(new Date(wallStartMs - LIVE_SESSION_ACCESS_MINUTES_BEFORE * 60 * 1000))
  }
}

function resolveRelativeStart(batchStartAt: Date | null, dayOffset: number, timeOfDay: string) {
  if (!batchStartAt) return null
  const time = normalizeTime(timeOfDay)
  if (!time) return null
  const [hour, minute] = time.split(":").map(Number)
  return new Date(Date.UTC(
    batchStartAt.getUTCFullYear(),
    batchStartAt.getUTCMonth(),
    batchStartAt.getUTCDate() + Math.max(0, dayOffset),
    hour,
    minute,
    0
  ))
}

function courseName(slug: string) {
  const names: Record<string, string> = {
    "prompt-to-profit": "Prompt to Profit",
    "prompt-to-profit-holiday": "Prompt to Profit Holiday",
    "prompt-to-production": "Prompt to Profit Advanced",
    "ai-for-everyday-business-owners": "AI for Everyday Business Owners",
    "prompt-to-profit-schools": "Prompt to Profit for Schools"
  }
  return names[slug] || slug.split("-").filter(Boolean).map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ")
}

export type CourseLiveSessionRow = {
  id: bigint
  sessionUuid: string
  courseSlug: string
  batchKey: string
  batchLabel: string | null
  sessionTitle: string
  dayOffset: number | bigint | null
  timeOfDay: string | null
  startsAt: Date | null
  zoomMeetingId: string | null
  zoomJoinUrl: string | null
  zoomStartUrl: string | null
  isVisible: number | bigint | boolean | null
  reminderEnabled: number | bigint | boolean | null
  reminderMinutesBefore: number | bigint | null
  reminderSendAt: Date | null
  reminderSentAt: Date | null
  reminderLastError: string | null
}

export type StudentLiveSession = {
  sessionUuid: string
  title: string
  startsAt: Date | null
  startsAtLabel: string
  zoomJoinUrl: string
  reminderSentAt: Date | null
}

export async function ensureCourseLiveSessionTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_course_batch_live_sessions (
      id BIGINT NOT NULL AUTO_INCREMENT,
      session_uuid VARCHAR(64) NOT NULL,
      course_slug VARCHAR(120) NOT NULL,
      batch_key VARCHAR(64) NOT NULL,
      batch_label VARCHAR(120) NULL,
      session_title VARCHAR(220) NOT NULL,
      day_offset INT NULL,
      time_of_day VARCHAR(8) NULL,
      starts_at DATETIME NOT NULL,
      zoom_meeting_id VARCHAR(120) NULL,
      zoom_join_url VARCHAR(1200) NULL,
      zoom_start_url VARCHAR(1200) NULL,
      is_visible TINYINT(1) NOT NULL DEFAULT 1,
      reminder_enabled TINYINT(1) NOT NULL DEFAULT 1,
      reminder_minutes_before INT NOT NULL DEFAULT 30,
      reminder_send_at DATETIME NULL,
      reminder_sent_at DATETIME NULL,
      reminder_last_error VARCHAR(500) NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_course_live_session_uuid (session_uuid),
      KEY idx_tochukwu_course_live_session_batch (course_slug, batch_key, starts_at),
      KEY idx_tochukwu_course_live_session_reminder (reminder_enabled, reminder_sent_at, reminder_send_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_course_live_session_reminder_log (
      id BIGINT NOT NULL AUTO_INCREMENT,
      session_uuid VARCHAR(64) NOT NULL,
      reminder_stage VARCHAR(32) NOT NULL,
      due_at DATETIME NOT NULL,
      recipient_count INT NOT NULL DEFAULT 0,
      sent_count INT NOT NULL DEFAULT 0,
      last_error VARCHAR(500) NULL,
      created_at DATETIME NOT NULL,
      sent_at DATETIME NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_live_reminder_stage (session_uuid, reminder_stage),
      KEY idx_tochukwu_live_reminder_due (reminder_stage, due_at, sent_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_course_live_session_reminder_deliveries (
      id BIGINT NOT NULL AUTO_INCREMENT,
      session_uuid VARCHAR(64) NOT NULL,
      reminder_stage VARCHAR(32) NOT NULL,
      recipient_key VARCHAR(320) NOT NULL,
      channel VARCHAR(24) NOT NULL,
      destination VARCHAR(500) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      attempts INT NOT NULL DEFAULT 0,
      provider_message_id VARCHAR(500) NULL,
      last_error VARCHAR(500) NULL,
      last_attempt_at DATETIME NULL,
      sent_at DATETIME NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_live_reminder_delivery (session_uuid, reminder_stage, recipient_key, channel),
      KEY idx_tochukwu_live_reminder_delivery_status (status, last_attempt_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}

async function batchStart(courseSlug: string, batchKey: string) {
  const rows = await prisma.$queryRaw<Array<{ batchLabel: string | null; batchStartAt: Date | null }>>(Prisma.sql`
    SELECT batch_label AS batchLabel, batch_start_at AS batchStartAt
    FROM course_batches
    WHERE course_slug COLLATE utf8mb4_unicode_ci = ${courseSlug} COLLATE utf8mb4_unicode_ci
      AND batch_key COLLATE utf8mb4_unicode_ci = ${batchKey} COLLATE utf8mb4_unicode_ci
    LIMIT 1
  `)
  return rows[0] || null
}

async function batchSharedZoom(courseSlug: string, batchKey: string, excludeUuid?: string) {
  const exclude = clean(excludeUuid, 64)
  const rows = await prisma.$queryRaw<Array<{ zoomMeetingId: string | null; zoomJoinUrl: string | null; zoomStartUrl: string | null }>>(Prisma.sql`
    SELECT zoom_meeting_id AS zoomMeetingId, zoom_join_url AS zoomJoinUrl, zoom_start_url AS zoomStartUrl
    FROM tochukwu_course_batch_live_sessions
    WHERE course_slug COLLATE utf8mb4_unicode_ci = ${courseSlug} COLLATE utf8mb4_unicode_ci
      AND batch_key COLLATE utf8mb4_unicode_ci = ${batchKey} COLLATE utf8mb4_unicode_ci
      AND COALESCE(TRIM(zoom_join_url), '') <> ''
      ${exclude ? Prisma.sql`AND session_uuid <> ${exclude}` : Prisma.empty}
    ORDER BY starts_at ASC, id ASC
    LIMIT 1
  `).catch(() => [])
  return rows[0] || null
}

export async function listCourseLiveSessions(input: { courseSlug?: string | null; batchKey?: string | null }) {
  await ensureCourseLiveSessionTables()
  const courseSlug = normalizeSlug(input.courseSlug)
  const batchKey = normalizeBatchKey(input.batchKey)
  return prisma.$queryRaw<CourseLiveSessionRow[]>(Prisma.sql`
    SELECT id, session_uuid AS sessionUuid, course_slug AS courseSlug, batch_key AS batchKey, batch_label AS batchLabel,
      session_title AS sessionTitle, day_offset AS dayOffset, time_of_day AS timeOfDay, starts_at AS startsAt,
      zoom_meeting_id AS zoomMeetingId, zoom_join_url AS zoomJoinUrl, zoom_start_url AS zoomStartUrl,
      is_visible AS isVisible, reminder_enabled AS reminderEnabled, reminder_minutes_before AS reminderMinutesBefore,
      reminder_send_at AS reminderSendAt, reminder_sent_at AS reminderSentAt, reminder_last_error AS reminderLastError
    FROM tochukwu_course_batch_live_sessions
    WHERE (${courseSlug} = '' OR course_slug COLLATE utf8mb4_unicode_ci = ${courseSlug} COLLATE utf8mb4_unicode_ci)
      AND (${batchKey} = '' OR batch_key COLLATE utf8mb4_unicode_ci = ${batchKey} COLLATE utf8mb4_unicode_ci)
    ORDER BY course_slug ASC, batch_key ASC, starts_at ASC, id ASC
  `)
}

export async function saveCourseLiveSession(input: {
  sessionUuid?: string
  courseSlug: string
  batchKey: string
  sessionTitle: string
  dayOffset?: string
  timeOfDay?: string
  startsAt?: string
  zoomJoinUrl?: string
  reminderMinutesBefore?: string
  isVisible?: boolean
  reminderEnabled?: boolean
  useSharedZoom?: boolean
}) {
  await ensureCourseLiveSessionTables()
  const courseSlug = normalizeSlug(input.courseSlug)
  const batchKey = normalizeBatchKey(input.batchKey)
  const sessionTitle = clean(input.sessionTitle, 220)
  if (!courseSlug || !batchKey || !sessionTitle) throw new Error("Course, batch, and session title are required.")
  const batch = await batchStart(courseSlug, batchKey)
  if (!batch) throw new Error("Batch not found.")

  const dayOffset = Math.max(0, toInt(input.dayOffset, 0))
  const timeOfDay = normalizeTime(input.timeOfDay) || "19:00"
  const explicitStart = wallDate(input.startsAt)
  const startsAt = explicitStart || resolveRelativeStart(batch.batchStartAt, dayOffset, timeOfDay)
  if (!startsAt) throw new Error("A valid live session date/time is required.")
  const reminderMinutesBefore = LIVE_SESSION_ACCESS_MINUTES_BEFORE
  const reminderSendAt = addMinutes(startsAt, -reminderMinutesBefore)
  const sessionUuid = clean(input.sessionUuid, 64) || `live_${randomUUID().replace(/-/g, "")}`
  const now = new Date()
  const manualZoom = clean(input.zoomJoinUrl, 1200)
  let zoomMeetingId = ""
  let zoomJoinUrl = manualZoom
  let zoomStartUrl = ""

  if (!zoomJoinUrl && input.useSharedZoom !== false) {
    const shared = await batchSharedZoom(courseSlug, batchKey, sessionUuid)
    zoomMeetingId = clean(shared?.zoomMeetingId, 120)
    zoomJoinUrl = clean(shared?.zoomJoinUrl, 1200)
    zoomStartUrl = clean(shared?.zoomStartUrl, 1200)
  }
  if (!zoomJoinUrl) {
    const zoom = await createNoFixedTimeZoomMeeting({
      topic: `${courseName(courseSlug)} - ${batch.batchLabel || batchKey}`,
      agenda: `${sessionTitle} for ${courseName(courseSlug)} (${batch.batchLabel || batchKey})`
    })
    if (!zoom.ok || !zoom.data) throw new Error(zoom.error || "Could not create Zoom meeting.")
    zoomMeetingId = clean(zoom.data.id, 120)
    zoomJoinUrl = clean(zoom.data.join_url, 1200)
    zoomStartUrl = clean(zoom.data.start_url, 1200)
  }

  await prisma.$executeRaw`
    INSERT INTO tochukwu_course_batch_live_sessions
      (session_uuid, course_slug, batch_key, batch_label, session_title, day_offset, time_of_day, starts_at,
       zoom_meeting_id, zoom_join_url, zoom_start_url, is_visible, reminder_enabled, reminder_minutes_before,
       reminder_send_at, reminder_sent_at, reminder_last_error, created_at, updated_at)
    VALUES
      (${sessionUuid}, ${courseSlug}, ${batchKey}, ${batch.batchLabel || null}, ${sessionTitle}, ${dayOffset}, ${timeOfDay}, ${startsAt},
       ${zoomMeetingId || null}, ${zoomJoinUrl}, ${zoomStartUrl || null}, ${input.isVisible === false ? 0 : 1},
       ${input.reminderEnabled === false ? 0 : 1}, ${reminderMinutesBefore}, ${reminderSendAt}, NULL, NULL, ${now}, ${now})
    ON DUPLICATE KEY UPDATE
      course_slug = VALUES(course_slug),
      batch_key = VALUES(batch_key),
      batch_label = VALUES(batch_label),
      session_title = VALUES(session_title),
      day_offset = VALUES(day_offset),
      time_of_day = VALUES(time_of_day),
      starts_at = VALUES(starts_at),
      zoom_meeting_id = VALUES(zoom_meeting_id),
      zoom_join_url = VALUES(zoom_join_url),
      zoom_start_url = VALUES(zoom_start_url),
      is_visible = VALUES(is_visible),
      reminder_enabled = VALUES(reminder_enabled),
      reminder_minutes_before = VALUES(reminder_minutes_before),
      reminder_send_at = VALUES(reminder_send_at),
      reminder_sent_at = NULL,
      reminder_last_error = NULL,
      updated_at = VALUES(updated_at)
  `
}

export async function deleteCourseLiveSession(sessionUuid: string) {
  await ensureCourseLiveSessionTables()
  const uuid = clean(sessionUuid, 64)
  if (!uuid) throw new Error("Session is required.")
  await prisma.$executeRaw`DELETE FROM tochukwu_course_batch_live_sessions WHERE session_uuid = ${uuid} LIMIT 1`
}

export async function listStudentLiveSessionsForPairs(pairs: Array<{ courseSlug: string; batchKey: string | null }>) {
  await ensureCourseLiveSessionTables()
  const cleanPairs = pairs
    .map((pair) => ({ courseSlug: normalizeSlug(pair.courseSlug), batchKey: normalizeBatchKey(pair.batchKey) }))
    .filter((pair) => pair.courseSlug && pair.batchKey)
  if (!cleanPairs.length) return new Map<string, StudentLiveSession[]>()
  const clauses = cleanPairs.map((pair) => Prisma.sql`(course_slug COLLATE utf8mb4_unicode_ci = ${pair.courseSlug} COLLATE utf8mb4_unicode_ci AND batch_key COLLATE utf8mb4_unicode_ci = ${pair.batchKey} COLLATE utf8mb4_unicode_ci)`)
  const rows = await prisma.$queryRaw<CourseLiveSessionRow[]>(Prisma.sql`
    SELECT id, session_uuid AS sessionUuid, course_slug AS courseSlug, batch_key AS batchKey, batch_label AS batchLabel,
      session_title AS sessionTitle, day_offset AS dayOffset, time_of_day AS timeOfDay, starts_at AS startsAt,
      zoom_meeting_id AS zoomMeetingId, zoom_join_url AS zoomJoinUrl, zoom_start_url AS zoomStartUrl,
      is_visible AS isVisible, reminder_enabled AS reminderEnabled, reminder_minutes_before AS reminderMinutesBefore,
      reminder_send_at AS reminderSendAt, reminder_sent_at AS reminderSentAt, reminder_last_error AS reminderLastError
    FROM tochukwu_course_batch_live_sessions
    WHERE is_visible = 1
      AND COALESCE(TRIM(zoom_join_url), '') <> ''
      AND (${Prisma.join(clauses, " OR ")})
    ORDER BY starts_at ASC, id ASC
  `)
  const map = new Map<string, StudentLiveSession[]>()
  rows.forEach((row) => {
    const key = `${normalizeSlug(row.courseSlug)}::${normalizeBatchKey(row.batchKey)}`
    const existing = map.get(key) || []
    existing.push({
      sessionUuid: row.sessionUuid,
      title: row.sessionTitle,
      startsAt: row.startsAt,
      startsAtLabel: row.startsAt ? formatDateTimeWAT(row.startsAt) : "",
      zoomJoinUrl: clean(row.zoomJoinUrl, 1200),
      reminderSentAt: row.reminderSentAt
    })
    map.set(key, existing)
  })
  return map
}

async function listSessionRecipients(courseSlug: string, batchKey: string) {
  return prisma.$queryRaw<Array<{ email: string; fullName: string | null; phone: string | null }>>(Prisma.sql`
    SELECT DISTINCT email, fullName, phone FROM (
      SELECT LOWER(o.email) COLLATE utf8mb4_unicode_ci AS email,
             o.first_name COLLATE utf8mb4_unicode_ci AS fullName,
             o.phone COLLATE utf8mb4_unicode_ci AS phone
      FROM course_orders o
      WHERE o.course_slug COLLATE utf8mb4_unicode_ci = ${courseSlug} COLLATE utf8mb4_unicode_ci
        AND o.batch_key COLLATE utf8mb4_unicode_ci = ${batchKey} COLLATE utf8mb4_unicode_ci
        AND o.status = 'paid'
        AND COALESCE(o.buyer_type, 'student') <> 'family'

      UNION

      SELECT LOWER(m.email) COLLATE utf8mb4_unicode_ci AS email,
             m.first_name COLLATE utf8mb4_unicode_ci AS fullName,
             m.phone COLLATE utf8mb4_unicode_ci AS phone
      FROM course_manual_payments m
      WHERE m.course_slug COLLATE utf8mb4_unicode_ci = ${courseSlug} COLLATE utf8mb4_unicode_ci
        AND m.batch_key COLLATE utf8mb4_unicode_ci = ${batchKey} COLLATE utf8mb4_unicode_ci
        AND m.status = 'approved'
        AND COALESCE(m.buyer_type, 'student') <> 'family'

      UNION

      SELECT LOWER(f.parent_email) COLLATE utf8mb4_unicode_ci AS email,
             f.parent_name COLLATE utf8mb4_unicode_ci AS fullName,
             f.parent_phone COLLATE utf8mb4_unicode_ci AS phone
      FROM family_child_enrollments e
      JOIN family_children c ON c.id = e.child_id
      JOIN family_accounts f ON f.id = e.family_id
      WHERE e.course_slug COLLATE utf8mb4_unicode_ci = ${courseSlug} COLLATE utf8mb4_unicode_ci
        AND e.batch_key COLLATE utf8mb4_unicode_ci = ${batchKey} COLLATE utf8mb4_unicode_ci
        AND e.status = 'active'
        AND c.status = 'active'
        AND f.status = 'active'
    ) x
    WHERE email IS NOT NULL AND email <> ''
  `)
}

function dashboardUrl() {
  return publicAbsoluteUrl("/dashboard/courses")
}

async function sendLiveSessionEmail(input: {
  session: CourseLiveSessionRow
  recipient: { email: string; fullName: string | null; phone?: string | null }
  stage: LiveReminderStage
}) {
  const course = courseName(input.session.courseSlug)
  const name = clean(input.recipient.fullName, 160)
  const { sessionTime, accessTime } = liveSessionReminderTimes(input.session)
  const isTomorrow = input.stage === "day_before"
  const subject = `${course}: ${input.session.sessionTitle} ${isTomorrow ? "is tomorrow" : "access is open"}`
  const html = [
    `<p>Hello${name ? ` ${escapeHtml(name.split(" ")[0])}` : ""},</p>`,
    isTomorrow
      ? `<p>Your <strong>${escapeHtml(input.session.sessionTitle)}</strong> for <strong>${escapeHtml(course)}</strong> is tomorrow at ${escapeHtml(sessionTime)}.</p>`
      : `<p>Your <strong>${escapeHtml(input.session.sessionTitle)}</strong> for <strong>${escapeHtml(course)}</strong> starts today at ${escapeHtml(sessionTime)}.</p>`,
    isTomorrow
      ? `<p>Your live-class access link will become available in your dashboard 30 minutes before the session, at ${escapeHtml(accessTime)}.</p>`
      : `<p>Your live-class access link is now available. Please log in to your dashboard, go to Courses, and use the live-class access button on your course card.</p>`,
    `<p><a href="${escapeHtml(dashboardUrl())}" style="display:inline-block;background:#0d4f9a;color:#ffffff;text-decoration:none;font-weight:800;padding:12px 18px;border-radius:10px;">Open student dashboard</a></p>`,
    `<p>Tochukwu Tech and AI Academy</p>`
  ].filter(Boolean).join("")
  const text = [
    `Hello${name ? ` ${name.split(" ")[0]}` : ""},`,
    "",
    isTomorrow
      ? `Your ${input.session.sessionTitle} for ${course} is tomorrow at ${sessionTime}.`
      : `Your ${input.session.sessionTitle} for ${course} starts today at ${sessionTime}.`,
    "",
    isTomorrow
      ? `Your live-class access link will become available in your dashboard 30 minutes before the session, at ${accessTime}.`
      : "Your live-class access link is now available. Please log in to your dashboard, go to Courses, and use the live-class access button on your course card.",
    "",
    `Dashboard: ${dashboardUrl()}`,
    "",
    "Tochukwu Tech and AI Academy"
  ].join("\n")
  return sendBrevoTransactionalEmail({ to: input.recipient.email, name, subject, html, text })
}

function liveReminderDueAt(session: CourseLiveSessionRow, stage: LiveReminderStage) {
  if (!session.startsAt) return null
  if (stage === "day_before") {
    return new Date(watWallDateTimeMs(session.startsAt) - 24 * 60 * 60 * 1000)
  }
  return new Date(watWallDateTimeMs(session.startsAt) - LIVE_SESSION_ACCESS_MINUTES_BEFORE * 60 * 1000)
}

async function reminderAlreadySent(sessionUuid: string, stage: LiveReminderStage) {
  const rows = await prisma.$queryRaw<Array<{ id: bigint }>>(Prisma.sql`
    SELECT id
    FROM tochukwu_course_live_session_reminder_log
    WHERE session_uuid = ${sessionUuid}
      AND reminder_stage = ${stage}
      AND sent_at IS NOT NULL
    LIMIT 1
  `)
  return Boolean(rows[0])
}

type ReminderDeliveryClaim = {
  shouldAttempt: boolean
  terminal: boolean
  attempts: number
}

async function claimReminderDelivery(input: {
  sessionUuid: string
  stage: LiveReminderStage
  recipientKey: string
  channel: LiveReminderChannel
  destination: string
}): Promise<ReminderDeliveryClaim> {
  const now = new Date()
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO tochukwu_course_live_session_reminder_deliveries
        (session_uuid, reminder_stage, recipient_key, channel, destination, status, attempts, created_at, updated_at)
      VALUES
        (${input.sessionUuid}, ${input.stage}, ${input.recipientKey}, ${input.channel}, ${input.destination || null}, 'pending', 0, ${now}, ${now})
      ON DUPLICATE KEY UPDATE destination = VALUES(destination), updated_at = VALUES(updated_at)
    `
    const rows = await tx.$queryRaw<Array<{
      status: string
      attempts: number | bigint
      lastAttemptAt: Date | null
    }>>(Prisma.sql`
      SELECT status, attempts, last_attempt_at AS lastAttemptAt
      FROM tochukwu_course_live_session_reminder_deliveries
      WHERE session_uuid = ${input.sessionUuid}
        AND reminder_stage = ${input.stage}
        AND recipient_key = ${input.recipientKey}
        AND channel = ${input.channel}
      LIMIT 1
      FOR UPDATE
    `)
    const row = rows[0]
    const attempts = Number(row?.attempts || 0)
    if (["sent", "skipped", "failed_permanent"].includes(clean(row?.status, 32))) {
      return { shouldAttempt: false, terminal: true, attempts }
    }
    if (attempts >= LIVE_REMINDER_MAX_CHANNEL_ATTEMPTS) {
      await tx.$executeRaw`
        UPDATE tochukwu_course_live_session_reminder_deliveries
        SET status = 'failed_permanent', updated_at = ${now}
        WHERE session_uuid = ${input.sessionUuid}
          AND reminder_stage = ${input.stage}
          AND recipient_key = ${input.recipientKey}
          AND channel = ${input.channel}
      `
      return { shouldAttempt: false, terminal: true, attempts }
    }
    if (row?.lastAttemptAt && now.getTime() - row.lastAttemptAt.getTime() < LIVE_REMINDER_RETRY_DELAY_MS) {
      return { shouldAttempt: false, terminal: false, attempts }
    }
    const nextAttempts = attempts + 1
    await tx.$executeRaw`
      UPDATE tochukwu_course_live_session_reminder_deliveries
      SET status = 'processing', attempts = ${nextAttempts}, last_attempt_at = ${now}, last_error = NULL, updated_at = ${now}
      WHERE session_uuid = ${input.sessionUuid}
        AND reminder_stage = ${input.stage}
        AND recipient_key = ${input.recipientKey}
        AND channel = ${input.channel}
    `
    return { shouldAttempt: true, terminal: false, attempts: nextAttempts }
  })
}

async function finishReminderDelivery(input: {
  sessionUuid: string
  stage: LiveReminderStage
  recipientKey: string
  channel: LiveReminderChannel
  status: "sent" | "skipped" | "failed" | "failed_permanent"
  providerMessageId?: string | null
  error?: string
}) {
  const now = new Date()
  await prisma.$executeRaw`
    UPDATE tochukwu_course_live_session_reminder_deliveries
    SET status = ${input.status},
        provider_message_id = ${clean(input.providerMessageId, 500) || null},
        last_error = ${clean(input.error, 500) || null},
        sent_at = ${input.status === "sent" || input.status === "skipped" ? now : null},
        updated_at = ${now}
    WHERE session_uuid = ${input.sessionUuid}
      AND reminder_stage = ${input.stage}
      AND recipient_key = ${input.recipientKey}
      AND channel = ${input.channel}
  `
}

async function deliverReminderChannel(input: {
  sessionUuid: string
  stage: LiveReminderStage
  recipientKey: string
  channel: LiveReminderChannel
  destination: string
  send: () => Promise<{ ok: boolean; skipped?: boolean; reason?: string; messageId?: string | null }>
}) {
  const claim = await claimReminderDelivery(input)
  if (!claim.shouldAttempt) return { terminal: claim.terminal, sent: false, error: "" }
  try {
    const result = await input.send()
    if (result.skipped && result.reason !== "missing_phone") {
      throw new Error(`WhatsApp reminder was not submitted: ${result.reason || "unknown reason"}.`)
    }
    const status = result.skipped ? "skipped" : "sent"
    await finishReminderDelivery({
      ...input,
      status,
      providerMessageId: result.messageId
    })
    return { terminal: true, sent: status === "sent", error: "" }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const terminal = claim.attempts >= LIVE_REMINDER_MAX_CHANNEL_ATTEMPTS
    await finishReminderDelivery({
      ...input,
      status: terminal ? "failed_permanent" : "failed",
      error: message
    })
    return { terminal, sent: false, error: message }
  }
}

async function recordReminderStage(input: {
  sessionUuid: string
  stage: LiveReminderStage
  dueAt: Date
  recipientCount: number
  sentCount: number
  completed: boolean
  lastError?: string
}) {
  const now = new Date()
  await prisma.$executeRaw`
    INSERT INTO tochukwu_course_live_session_reminder_log
      (session_uuid, reminder_stage, due_at, recipient_count, sent_count, last_error, created_at, sent_at)
    VALUES
      (${input.sessionUuid}, ${input.stage}, ${input.dueAt}, ${input.recipientCount}, ${input.sentCount}, ${clean(input.lastError, 500) || null}, ${now}, ${input.completed ? now : null})
    ON DUPLICATE KEY UPDATE
      due_at = VALUES(due_at),
      recipient_count = VALUES(recipient_count),
      sent_count = VALUES(sent_count),
      last_error = VALUES(last_error),
      sent_at = VALUES(sent_at)
  `
}

export async function sendDueLiveSessionReminders() {
  await ensureCourseLiveSessionTables()
  const sessions = await prisma.$queryRaw<CourseLiveSessionRow[]>(Prisma.sql`
    SELECT id, session_uuid AS sessionUuid, course_slug AS courseSlug, batch_key AS batchKey, batch_label AS batchLabel,
      session_title AS sessionTitle, day_offset AS dayOffset, time_of_day AS timeOfDay, starts_at AS startsAt,
      zoom_meeting_id AS zoomMeetingId, zoom_join_url AS zoomJoinUrl, zoom_start_url AS zoomStartUrl,
      is_visible AS isVisible, reminder_enabled AS reminderEnabled, reminder_minutes_before AS reminderMinutesBefore,
      reminder_send_at AS reminderSendAt, reminder_sent_at AS reminderSentAt, reminder_last_error AS reminderLastError
    FROM tochukwu_course_batch_live_sessions
    WHERE reminder_enabled = 1
      AND COALESCE(TRIM(zoom_join_url), '') <> ''
    ORDER BY reminder_send_at ASC, starts_at ASC
    LIMIT 25
  `)
  const now = Date.now()
  let sent = 0
  let whatsappSent = 0
  let attemptedSessions = 0
  let attemptedStages = 0
  for (const session of sessions) {
    const stages: LiveReminderStage[] = ["day_before", "access_open"]
    let sessionAttempted = false
    for (const stage of stages) {
      const dueAt = liveReminderDueAt(session, stage)
      if (
        !dueAt
        || dueAt.getTime() > now
        || !reminderStageMatchesWatDate(session, stage, now)
        || await reminderAlreadySent(session.sessionUuid, stage)
      ) continue
      attemptedStages += 1
      sessionAttempted = true
      const recipients = await listSessionRecipients(normalizeSlug(session.courseSlug), normalizeBatchKey(session.batchKey))
      const reminderTimes = liveSessionReminderTimes(session)
      const errors: string[] = []
      let allTerminal = true
      for (const recipient of recipients) {
        const recipientKey = clean(recipient.email, 320).toLowerCase()
        const emailResult = await deliverReminderChannel({
          sessionUuid: session.sessionUuid,
          stage,
          recipientKey,
          channel: "email",
          destination: recipient.email,
          send: () => sendLiveSessionEmail({ session, recipient, stage })
        })
        const whatsappResult = shouldSendWhatsAppReminder(stage)
          ? await deliverReminderChannel({
              sessionUuid: session.sessionUuid,
              stage,
              recipientKey,
              channel: "whatsapp",
              destination: clean(recipient.phone, 80),
              send: () => sendLiveClassReminderWhatsApp({
                phone: recipient.phone,
                fullName: recipient.fullName,
                courseSlug: session.courseSlug,
                sessionTitle: session.sessionTitle,
                stage,
                sessionTime: reminderTimes.sessionTime,
                accessTime: reminderTimes.accessTime
              })
            })
          : { terminal: true, sent: false, error: "" }
        if (emailResult.sent) {
          sent += 1
        }
        if (whatsappResult.sent) whatsappSent += 1
        allTerminal = allTerminal && emailResult.terminal && whatsappResult.terminal
        if (emailResult.error) errors.push(`Email ${recipient.email}: ${emailResult.error}`)
        if (whatsappResult.error) errors.push(`WhatsApp ${recipient.email}: ${whatsappResult.error}`)
      }
      const deliveryCounts = await prisma.$queryRaw<Array<{ emailSent: number | bigint }>>(Prisma.sql`
        SELECT COUNT(*) AS emailSent
        FROM tochukwu_course_live_session_reminder_deliveries
        WHERE session_uuid = ${session.sessionUuid}
          AND reminder_stage = ${stage}
          AND channel = 'email'
          AND status = 'sent'
      `)
      await recordReminderStage({
        sessionUuid: session.sessionUuid,
        stage,
        dueAt,
        recipientCount: recipients.length,
        sentCount: Number(deliveryCounts[0]?.emailSent || 0),
        completed: allTerminal,
        lastError: errors.join(" | ") || (allTerminal ? "" : "One or more reminder channels are awaiting retry.")
      })
    }
    if (sessionAttempted) attemptedSessions += 1
  }
  return { ok: true, attemptedSessions, attemptedStages, sent, whatsappSent }
}
