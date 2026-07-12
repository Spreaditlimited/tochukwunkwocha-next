import { randomUUID } from "crypto"

import { sendEmail } from "@/lib/email"
import { prisma } from "@/lib/prisma"
import { ensureBuildServiceTables, listAvailableCallSlots, SCHOOL_CALL_TIMEZONE } from "@/lib/admin-build-service"
import { addColumnIfMissing } from "@/lib/schema-guards"

export { listAvailableCallSlots }

export type SchoolScorecardLead = {
  id: number
  leadUuid: string
  fullName: string
  schoolName: string
  workEmail: string
  phone: string
  role: string
  studentPopulation: string
  score: number
  bandKey: string
  headline: string
  nextStep: string
  answers: Array<{ question?: string; answer?: string; score?: number }>
  metaEventId: string
  metaLeadSent: boolean
  brevoSynced: boolean
  brevoError: string
  sourcePath: string
  eventSourceUrl: string
  createdAt: string
  updatedAt: string
  call: {
    bookingUuid: string
    status: string
    outcomeStatus: string
    assignedOwner: string
    zoomJoinUrl: string
    slotStartIso: string
    slotEndIso: string
    nextFollowUpAt: string
    outcomeUpdatedAt: string
    outcomeFeedback: string
  }
}

function clean(value: unknown, max = 400) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max)
}

function normalizeEmail(value: unknown) {
  const email = clean(value, 220).toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ""
}

function isoFromValue(value: unknown) {
  if (!value) return ""
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : ""
  const raw = clean(value, 80)
  if (!raw) return ""
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T")
  const withZone = /(?:Z|[+\-]\d{2}:\d{2})$/i.test(normalized) ? normalized : `${normalized}Z`
  const date = new Date(withZone)
  return Number.isFinite(date.getTime()) ? date.toISOString() : ""
}

function sqlFromIso(value: unknown) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(String(value || ""))
  if (!Number.isFinite(date.getTime())) return null
  return date.toISOString().slice(0, 19).replace("T", " ")
}

function parseAnswers(value: unknown) {
  try {
    const parsed = typeof value === "string" && value ? JSON.parse(value) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function ensureSchoolScorecardTables() {
  await ensureBuildServiceTables()
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_school_scorecard_leads (
      id BIGINT NOT NULL AUTO_INCREMENT,
      lead_uuid VARCHAR(64) NOT NULL,
      full_name VARCHAR(180) NOT NULL,
      school_name VARCHAR(220) NOT NULL,
      work_email VARCHAR(220) NOT NULL,
      phone VARCHAR(80) NULL,
      role_title VARCHAR(140) NULL,
      student_population VARCHAR(60) NULL,
      score INT NOT NULL DEFAULT 0,
      band_key VARCHAR(40) NOT NULL,
      headline VARCHAR(255) NULL,
      next_step VARCHAR(255) NULL,
      answers_json LONGTEXT NULL,
      source_path VARCHAR(255) NULL,
      event_source_url VARCHAR(1200) NULL,
      meta_event_id VARCHAR(120) NULL,
      meta_lead_sent TINYINT(1) NOT NULL DEFAULT 0,
      brevo_synced TINYINT(1) NOT NULL DEFAULT 0,
      brevo_error VARCHAR(255) NULL,
      client_ip VARCHAR(64) NULL,
      user_agent VARCHAR(400) NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_school_scorecard_lead_uuid (lead_uuid),
      KEY idx_tochukwu_school_scorecard_email (work_email),
      KEY idx_tochukwu_school_scorecard_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await addColumnIfMissing("tochukwu_school_scorecard_leads", "event_source_url", "VARCHAR(1200) NULL")
  await addColumnIfMissing("tochukwu_school_scorecard_leads", "meta_lead_sent", "TINYINT(1) NOT NULL DEFAULT 0")
  await addColumnIfMissing("tochukwu_school_scorecard_leads", "brevo_synced", "TINYINT(1) NOT NULL DEFAULT 0")
}

export async function listSchoolScorecardLeads(limit = 200): Promise<SchoolScorecardLead[]> {
  await ensureSchoolScorecardTables()
  const safeLimit = Math.max(10, Math.min(300, Math.round(Number(limit || 200))))
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
    SELECT
      s.id, s.lead_uuid, s.full_name, s.school_name, s.work_email, s.phone, s.role_title, s.student_population,
      s.score, s.band_key, s.headline, s.next_step, s.answers_json, s.meta_event_id, s.meta_lead_sent,
      s.brevo_synced, s.brevo_error, s.source_path, s.event_source_url, s.created_at, s.updated_at,
      c.booking_uuid AS call_booking_uuid,
      c.status AS call_status,
      c.call_outcome_status,
      c.assigned_owner,
      c.zoom_join_url,
      c.slot_start_utc AS call_slot_start_utc,
      c.slot_end_utc AS call_slot_end_utc,
      c.next_follow_up_at AS call_next_follow_up_at,
      c.outcome_updated_at AS call_outcome_updated_at,
      c.outcome_feedback AS call_outcome_feedback
    FROM tochukwu_school_scorecard_leads s
    LEFT JOIN school_call_bookings_tochukwu c
      ON c.id = (
        SELECT c2.id
        FROM school_call_bookings_tochukwu c2
        WHERE COALESCE(c2.lead_source_type, 'school') <> 'build'
          AND (c2.source_lead_uuid = s.lead_uuid OR c2.work_email = s.work_email)
        ORDER BY COALESCE(c2.slot_start_utc, c2.created_at) DESC, c2.id DESC
        LIMIT 1
      )
    ORDER BY s.created_at DESC, s.id DESC
    LIMIT ${safeLimit}
  `)
  return rows.map((row) => ({
    id: Number(row.id || 0),
    leadUuid: clean(row.lead_uuid, 64),
    fullName: clean(row.full_name, 180),
    schoolName: clean(row.school_name, 220),
    workEmail: clean(row.work_email, 220),
    phone: clean(row.phone, 80),
    role: clean(row.role_title, 140),
    studentPopulation: clean(row.student_population, 60),
    score: Number(row.score || 0),
    bandKey: clean(row.band_key, 40),
    headline: clean(row.headline, 255),
    nextStep: clean(row.next_step, 255),
    answers: parseAnswers(row.answers_json),
    metaEventId: clean(row.meta_event_id, 120),
    metaLeadSent: Number(row.meta_lead_sent || 0) === 1,
    brevoSynced: Number(row.brevo_synced || 0) === 1,
    brevoError: clean(row.brevo_error, 255),
    sourcePath: clean(row.source_path, 255),
    eventSourceUrl: clean(row.event_source_url, 1200),
    createdAt: isoFromValue(row.created_at),
    updatedAt: isoFromValue(row.updated_at),
    call: {
      bookingUuid: clean(row.call_booking_uuid, 64),
      status: clean(row.call_status, 40),
      outcomeStatus: clean(row.call_outcome_status, 40),
      assignedOwner: clean(row.assigned_owner, 180),
      zoomJoinUrl: clean(row.zoom_join_url, 1200),
      slotStartIso: isoFromValue(row.call_slot_start_utc),
      slotEndIso: isoFromValue(row.call_slot_end_utc),
      nextFollowUpAt: isoFromValue(row.call_next_follow_up_at),
      outcomeUpdatedAt: isoFromValue(row.call_outcome_updated_at),
      outcomeFeedback: clean(row.call_outcome_feedback, 4000)
    }
  }))
}

async function zoomAccessToken() {
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

async function createZoomMeeting(input: { topic: string; startTimeIso: string; durationMinutes: number; agenda?: string }) {
  const hostId = clean(process.env.ZOOM_HOST_USER_ID, 120)
  if (!hostId) throw new Error("Missing ZOOM_HOST_USER_ID")
  const token = await zoomAccessToken()
  const response = await fetch(`https://api.zoom.us/v2/users/${encodeURIComponent(hostId)}/meetings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      topic: input.topic,
      type: 2,
      start_time: input.startTimeIso,
      duration: input.durationMinutes,
      timezone: SCHOOL_CALL_TIMEZONE,
      agenda: input.agenda || "",
      settings: { join_before_host: false, waiting_room: true, approval_type: 2, mute_upon_entry: true, registrants_email_notification: false }
    })
  })
  const json = await response.json().catch(() => null)
  if (!response.ok || !json?.id) throw new Error(json?.message || `Could not create Zoom meeting (${response.status})`)
  return json as Record<string, unknown>
}

function notificationRecipients() {
  const configured = clean(process.env.SCHOOL_NOTIFICATION_EMAILS || process.env.SCHOOL_ALERT_EMAILS || process.env.SCHOOL_CALL_ALERT_EMAILS, 5000)
  const raw = configured || "support@tochukwunkwocha.com,partnerships@tochukwunkwocha.com"
  return Array.from(new Set(raw.split(",").map((item) => normalizeEmail(item)).filter(Boolean)))
}

function slotHuman(iso: string) {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return ""
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: SCHOOL_CALL_TIMEZONE }).format(date)
}

export async function bookSchoolCallFromScorecard(input: { leadUuid: string; slotStartIso: string }) {
  const leadUuid = clean(input.leadUuid, 64)
  const start = new Date(input.slotStartIso)
  if (!leadUuid) throw new Error("leadUuid is required.")
  if (!Number.isFinite(start.getTime())) throw new Error("Invalid slot.")
  if (start.getTime() <= Date.now() + 60 * 60 * 1000) throw new Error("This slot is no longer available.")
  await ensureSchoolScorecardTables()
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT lead_uuid, full_name, school_name, work_email, phone, role_title, student_population, source_path
    FROM tochukwu_school_scorecard_leads
    WHERE lead_uuid = ${leadUuid}
    LIMIT 1
  `
  const lead = rows[0]
  if (!lead) throw new Error("School scorecard lead not found.")
  const workEmail = normalizeEmail(lead.work_email)
  if (!clean(lead.full_name, 180) || !clean(lead.school_name, 220) || !workEmail || !clean(lead.phone, 80) || !clean(lead.role_title, 140)) {
    throw new Error("Lead contact details are incomplete.")
  }
  const active = await prisma.$queryRaw<Array<{ bookingUuid: string }>>`
    SELECT booking_uuid AS bookingUuid
    FROM school_call_bookings_tochukwu
    WHERE COALESCE(lead_source_type, 'school') <> 'build'
      AND (source_lead_uuid = ${leadUuid} OR work_email = ${workEmail})
      AND status IN ('booked', 'rescheduled')
    LIMIT 1
  `
  if (active.length) throw new Error("This lead already has an active call booking.")
  const end = new Date(start.getTime() + 30 * 60 * 1000)
  const bookingUuid = `school_call_${randomUUID()}`
  const manageToken = `${randomUUID()}${randomUUID().replace(/-/g, "")}`
  const meeting = await createZoomMeeting({
    topic: `School Onboarding Call - ${clean(lead.school_name, 220)}`,
    startTimeIso: start.toISOString(),
    durationMinutes: 30,
    agenda: `School onboarding call with ${clean(lead.full_name, 180)} from ${clean(lead.school_name, 220)}`
  })
  await prisma.$executeRaw`
    INSERT INTO school_call_bookings_tochukwu
      (booking_uuid, manage_token, full_name, school_name, work_email, phone, role_title, student_population,
       lead_source_type, lead_source_path, source_lead_uuid, timezone_label, slot_start_utc, slot_end_utc,
       duration_minutes, status, zoom_meeting_id, zoom_join_url, zoom_start_url, created_at, updated_at)
    VALUES
      (${bookingUuid}, ${manageToken}, ${clean(lead.full_name, 180)}, ${clean(lead.school_name, 220)}, ${workEmail},
       ${clean(lead.phone, 80)}, ${clean(lead.role_title, 140)}, ${clean(lead.student_population, 60) || null},
       'school', ${clean(lead.source_path, 255) || "/courses/prompt-to-profit-schools"}, ${leadUuid}, ${SCHOOL_CALL_TIMEZONE},
       ${sqlFromIso(start.toISOString())}, ${sqlFromIso(end.toISOString())}, 30, 'booked',
       ${clean(meeting.id, 120) || null}, ${clean(meeting.join_url, 1200) || null}, ${clean(meeting.start_url, 1200) || null},
       UTC_TIMESTAMP(), UTC_TIMESTAMP())
  `
  const when = slotHuman(start.toISOString())
  const text = [
    `Hello ${clean(lead.full_name, 180).split(/\s+/)[0] || "there"},`,
    "",
    "Your school call has been booked successfully.",
    `School: ${clean(lead.school_name, 220)}`,
    `Time: ${when} (WAT)`,
    clean(meeting.join_url, 1200) ? `Zoom link: ${clean(meeting.join_url, 1200)}` : ""
  ].filter(Boolean).join("\n")
  await sendEmail({ to: workEmail, subject: "Your School Call is Booked", text, html: text.replace(/\n/g, "<br/>") }).catch(() => null)
  const adminText = [
    "New school call booking",
    `Name: ${clean(lead.full_name, 180)}`,
    `School: ${clean(lead.school_name, 220)}`,
    `Email: ${workEmail}`,
    `Phone: ${clean(lead.phone, 80)}`,
    `Role: ${clean(lead.role_title, 140)}`,
    `Student population: ${clean(lead.student_population, 60)}`,
    `Time: ${when} (WAT)`,
    clean(meeting.join_url, 1200) ? `Zoom join link: ${clean(meeting.join_url, 1200)}` : ""
  ].filter(Boolean).join("\n")
  await Promise.all(notificationRecipients().map((to) => sendEmail({ to, subject: `School Call Booked - ${clean(lead.school_name, 220)}`, text: adminText, html: adminText.replace(/\n/g, "<br/>") }).catch(() => null)))
}
