import crypto from "crypto"
import fs from "fs"
import { PrismaClient } from "@prisma/client"

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/)
    for (const line of lines) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (!match) continue
      let value = match[2] || ""
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
      if (!process.env[match[1]]) process.env[match[1]] = value
    }
  }
}

function clean(value, max = 1000) {
  return String(value || "").trim().slice(0, max)
}

async function zoomToken() {
  const accountId = clean(process.env.ZOOM_ACCOUNT_ID, 200)
  const clientId = clean(process.env.ZOOM_CLIENT_ID, 200)
  const clientSecret = clean(process.env.ZOOM_CLIENT_SECRET, 400)
  if (!accountId || !clientId || !clientSecret) throw new Error("Missing Zoom credentials")
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
  const response = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json" }
  })
  const json = await response.json().catch(() => null)
  if (!response.ok || !json?.access_token) throw new Error(json?.message || json?.reason || `Zoom auth failed (${response.status})`)
  return String(json.access_token)
}

async function createZoom(topic) {
  const hostId = clean(process.env.ZOOM_HOST_USER_ID, 120)
  if (!hostId) throw new Error("Missing ZOOM_HOST_USER_ID")
  const token = await zoomToken()
  const response = await fetch(`https://api.zoom.us/v2/users/${encodeURIComponent(hostId)}/meetings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      topic,
      type: 3,
      agenda: topic,
      settings: {
        join_before_host: false,
        waiting_room: true,
        approval_type: 2,
        mute_upon_entry: true,
        registrants_email_notification: false
      }
    })
  })
  const json = await response.json().catch(() => null)
  if (!response.ok || !json?.join_url) throw new Error(json?.message || `Could not create Zoom meeting (${response.status})`)
  return json
}

function wallDateFromBatch(start, dayOffset, hour) {
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + dayOffset, hour, 0, 0))
}

function stableSessionUuid(courseSlug, batchKey, offset, title) {
  return `live_${crypto.createHash("sha1").update(`${courseSlug}:${batchKey}:${offset}:${title}`).digest("hex").slice(0, 32)}`
}

async function main() {
  loadEnv()
  const prisma = new PrismaClient()
  try {
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

    const courseSlug = process.argv[2] || "prompt-to-profit-holiday"
    const batches = await prisma.$queryRawUnsafe(
      "SELECT batch_key AS batchKey, batch_label AS batchLabel, batch_start_at AS batchStartAt FROM course_batches WHERE course_slug = ? AND batch_start_at IS NOT NULL ORDER BY batch_start_at",
      courseSlug
    )
    const now = new Date()
    const sessions = [
      { title: "Day 1 Live Welcome Session", offset: 0 },
      { title: "Day 5 Live Closing Session", offset: 4 }
    ]
    let upserted = 0
    for (const batch of batches) {
      const existing = await prisma.$queryRawUnsafe(
        "SELECT zoom_meeting_id AS zoomMeetingId, zoom_join_url AS zoomJoinUrl, zoom_start_url AS zoomStartUrl FROM tochukwu_course_batch_live_sessions WHERE course_slug = ? AND batch_key = ? AND COALESCE(TRIM(zoom_join_url), '') <> '' ORDER BY id ASC LIMIT 1",
        courseSlug,
        batch.batchKey
      )
      let zoom = existing[0] || null
      if (!zoom) {
        const meeting = await createZoom(`${courseSlug} - ${batch.batchLabel || batch.batchKey}`)
        zoom = {
          zoomMeetingId: clean(meeting.id, 120),
          zoomJoinUrl: clean(meeting.join_url, 1200),
          zoomStartUrl: clean(meeting.start_url, 1200)
        }
      }
      for (const session of sessions) {
        const startsAt = wallDateFromBatch(batch.batchStartAt, session.offset, 19)
        const reminderSendAt = new Date(startsAt.getTime() - 720 * 60 * 1000)
        await prisma.$executeRawUnsafe(
          `INSERT INTO tochukwu_course_batch_live_sessions
            (session_uuid, course_slug, batch_key, batch_label, session_title, day_offset, time_of_day, starts_at,
             zoom_meeting_id, zoom_join_url, zoom_start_url, is_visible, reminder_enabled, reminder_minutes_before,
             reminder_send_at, reminder_sent_at, reminder_last_error, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
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
             updated_at = VALUES(updated_at)`,
          stableSessionUuid(courseSlug, batch.batchKey, session.offset, session.title),
          courseSlug,
          batch.batchKey,
          batch.batchLabel,
          session.title,
          session.offset,
          "19:00",
          startsAt,
          zoom.zoomMeetingId || null,
          zoom.zoomJoinUrl,
          zoom.zoomStartUrl || null,
          1,
          1,
          720,
          reminderSendAt,
          null,
          null,
          now,
          now
        )
        upserted += 1
      }
    }
    const rows = await prisma.$queryRawUnsafe(
      "SELECT batch_key AS batchKey, session_title AS title, DATE_FORMAT(starts_at, '%Y-%m-%d %H:%i:%s') AS startsAt, CASE WHEN zoom_join_url IS NULL OR zoom_join_url = '' THEN 'missing' ELSE 'ready' END AS zoom FROM tochukwu_course_batch_live_sessions WHERE course_slug = ? ORDER BY batch_key, starts_at",
      courseSlug
    )
    console.table(rows)
    console.log({ upserted })
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
