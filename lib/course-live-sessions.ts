import { randomUUID } from "crypto"
import { Prisma } from "@prisma/client"

import { sendBrevoTransactionalEmail } from "@/lib/brevo-transactional"
import { prisma } from "@/lib/prisma"
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
      reminder_minutes_before INT NOT NULL DEFAULT 720,
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
  const reminderMinutesBefore = Math.max(0, toInt(input.reminderMinutesBefore, 720))
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
      SELECT LOWER(o.email) AS email, o.first_name AS fullName, o.phone AS phone
      FROM course_orders o
      WHERE o.course_slug COLLATE utf8mb4_unicode_ci = ${courseSlug} COLLATE utf8mb4_unicode_ci
        AND o.batch_key COLLATE utf8mb4_unicode_ci = ${batchKey} COLLATE utf8mb4_unicode_ci
        AND o.status = 'paid'
        AND COALESCE(o.buyer_type, 'student') <> 'family'

      UNION

      SELECT LOWER(m.email) AS email, m.first_name AS fullName, m.phone AS phone
      FROM course_manual_payments m
      WHERE m.course_slug COLLATE utf8mb4_unicode_ci = ${courseSlug} COLLATE utf8mb4_unicode_ci
        AND m.batch_key COLLATE utf8mb4_unicode_ci = ${batchKey} COLLATE utf8mb4_unicode_ci
        AND m.status = 'approved'
        AND COALESCE(m.buyer_type, 'student') <> 'family'

      UNION

      SELECT LOWER(c.email) AS email, c.full_name AS fullName, f.parent_phone AS phone
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
  return clean(process.env.SITE_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://tochukwunkwocha.com", 500).replace(/\/$/, "") + "/dashboard/courses"
}

async function sendLiveSessionEmail(input: {
  session: CourseLiveSessionRow
  recipient: { email: string; fullName: string | null; phone?: string | null }
}) {
  const course = courseName(input.session.courseSlug)
  const name = clean(input.recipient.fullName, 160)
  const sessionTime = input.session.startsAt ? formatDateTimeWAT(input.session.startsAt) : ""
  const zoomUrl = clean(input.session.zoomJoinUrl, 1200)
  const subject = `${course}: ${input.session.sessionTitle} is today`
  const html = [
    `<p>Hello${name ? ` ${escapeHtml(name.split(" ")[0])}` : ""},</p>`,
    `<p>Your live class for <strong>${escapeHtml(course)}</strong> is scheduled for today.</p>`,
    `<p><strong>Session:</strong> ${escapeHtml(input.session.sessionTitle)}<br/><strong>Time:</strong> ${escapeHtml(sessionTime)}<br/><strong>Batch:</strong> ${escapeHtml(input.session.batchLabel || input.session.batchKey)}</p>`,
    `<p><a href="${escapeHtml(zoomUrl)}" style="display:inline-block;background:#0d4f9a;color:#ffffff;text-decoration:none;font-weight:800;padding:12px 18px;border-radius:10px;">Join Zoom Class</a></p>`,
    `<p>You can also find this Zoom button inside your student dashboard course card.</p>`,
    `<p><a href="${escapeHtml(dashboardUrl())}" style="color:#0d4f9a;font-weight:700;">Open student dashboard</a></p>`
  ].join("")
  const text = [
    `Hello${name ? ` ${name.split(" ")[0]}` : ""},`,
    "",
    `Your live class for ${course} is scheduled for today.`,
    `Session: ${input.session.sessionTitle}`,
    `Time: ${sessionTime}`,
    `Batch: ${input.session.batchLabel || input.session.batchKey}`,
    `Zoom: ${zoomUrl}`,
    "",
    `Dashboard: ${dashboardUrl()}`
  ].join("\n")
  return sendBrevoTransactionalEmail({ to: input.recipient.email, name, subject, html, text })
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
      AND reminder_sent_at IS NULL
      AND COALESCE(TRIM(zoom_join_url), '') <> ''
    ORDER BY reminder_send_at ASC, starts_at ASC
    LIMIT 25
  `)
  const now = Date.now()
  let sent = 0
  let attemptedSessions = 0
  for (const session of sessions) {
    const dueAt = session.reminderSendAt || session.startsAt
    if (!dueAt || watWallDateTimeMs(dueAt) > now) continue
    attemptedSessions += 1
    const recipients = await listSessionRecipients(normalizeSlug(session.courseSlug), normalizeBatchKey(session.batchKey))
    let sessionSent = 0
    let lastError = ""
    for (const recipient of recipients) {
      try {
        await sendLiveSessionEmail({ session, recipient })
        await sendLiveClassReminderWhatsApp({
          phone: recipient.phone,
          fullName: recipient.fullName,
          courseSlug: session.courseSlug,
          sessionTitle: session.sessionTitle
        }).catch(() => null)
        sessionSent += 1
        sent += 1
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
      }
    }
    await prisma.$executeRaw`
      UPDATE tochukwu_course_batch_live_sessions
      SET reminder_sent_at = ${new Date()},
          reminder_last_error = ${lastError || null},
          updated_at = ${new Date()}
      WHERE id = ${session.id}
      LIMIT 1
    `
  }
  return { ok: true, attemptedSessions, sent }
}
