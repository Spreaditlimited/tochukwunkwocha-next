import { sendEmail } from "@/lib/email"
import { prisma } from "@/lib/prisma"
import { ensureBuildServiceTables, listAvailableCallSlots, SCHOOL_CALL_TIMEZONE } from "@/lib/admin-build-service"

export { listAvailableCallSlots }

export type SchoolCallBooking = {
  bookingUuid: string
  fullName: string
  schoolName: string
  workEmail: string
  phone: string
  role: string
  studentPopulation: string
  status: string
  slotStartIso: string
  slotEndIso: string
  zoomJoinUrl: string
  zoomMeetingId: string
  createdAt: string
  updatedAt: string
  cancelReason: string
  rescheduleNote: string
  assignedOwner: string
  callOutcomeStatus: string
  outcomeFeedback: string
  nextFollowUpAt: string
  outcomeUpdatedBy: string
  outcomeUpdatedAt: string
}

function clean(value: unknown, max = 400) {
  return String(value || "").trim().slice(0, max)
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

export async function listSchoolCalls(): Promise<SchoolCallBooking[]> {
  await ensureBuildServiceTables()
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT
      booking_uuid, full_name, school_name, work_email, phone, role_title, student_population,
      status, slot_start_utc, slot_end_utc, zoom_join_url, zoom_meeting_id,
      created_at, updated_at, cancel_reason, reschedule_note, assigned_owner, call_outcome_status,
      outcome_feedback, next_follow_up_at, outcome_updated_by, outcome_updated_at
    FROM school_call_bookings_tochukwu
    WHERE COALESCE(lead_source_type, 'school') <> 'build'
    ORDER BY COALESCE(slot_start_utc, created_at) DESC, id DESC
    LIMIT 300
  `
  return rows.map((row) => ({
    bookingUuid: clean(row.booking_uuid, 72),
    fullName: clean(row.full_name, 180),
    schoolName: clean(row.school_name, 220),
    workEmail: clean(row.work_email, 220),
    phone: clean(row.phone, 80),
    role: clean(row.role_title, 140),
    studentPopulation: clean(row.student_population, 60),
    status: clean(row.status, 40),
    slotStartIso: isoFromValue(row.slot_start_utc),
    slotEndIso: isoFromValue(row.slot_end_utc),
    zoomJoinUrl: clean(row.zoom_join_url, 1200),
    zoomMeetingId: clean(row.zoom_meeting_id, 120),
    createdAt: isoFromValue(row.created_at),
    updatedAt: isoFromValue(row.updated_at),
    cancelReason: clean(row.cancel_reason, 255),
    rescheduleNote: clean(row.reschedule_note, 255),
    assignedOwner: clean(row.assigned_owner, 180),
    callOutcomeStatus: clean(row.call_outcome_status, 40).toLowerCase(),
    outcomeFeedback: clean(row.outcome_feedback, 4000),
    nextFollowUpAt: isoFromValue(row.next_follow_up_at),
    outcomeUpdatedBy: clean(row.outcome_updated_by, 120),
    outcomeUpdatedAt: isoFromValue(row.outcome_updated_at)
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

async function zoomApi(method: string, path: string, body?: Record<string, unknown>) {
  const token = await zoomAccessToken()
  const response = await fetch(`https://api.zoom.us/v2${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined
  })
  if (response.status === 204) return { ok: true, data: null as Record<string, unknown> | null }
  const json = await response.json().catch(() => null)
  if (!response.ok) return { ok: false, error: json?.message || json?.reason || `Zoom API failed (${response.status})`, data: json }
  return { ok: true, data: json as Record<string, unknown> }
}

async function createZoomMeeting(input: { topic: string; startTimeIso: string; durationMinutes: number }) {
  const hostId = clean(process.env.ZOOM_HOST_USER_ID, 120)
  if (!hostId) return { ok: false, error: "Missing ZOOM_HOST_USER_ID", data: null }
  return zoomApi("POST", `/users/${encodeURIComponent(hostId)}/meetings`, {
    topic: input.topic,
    type: 2,
    start_time: input.startTimeIso,
    duration: input.durationMinutes,
    timezone: SCHOOL_CALL_TIMEZONE,
    settings: { join_before_host: false, waiting_room: true, approval_type: 2, mute_upon_entry: true, registrants_email_notification: false }
  })
}

async function updateZoomMeeting(meetingId: string, input: { topic: string; startTimeIso: string; durationMinutes: number }) {
  const id = clean(meetingId, 120)
  if (!id) return { ok: false, error: "meetingId is required", data: null }
  return zoomApi("PATCH", `/meetings/${encodeURIComponent(id)}`, {
    topic: input.topic,
    start_time: input.startTimeIso,
    duration: input.durationMinutes,
    timezone: SCHOOL_CALL_TIMEZONE
  })
}

async function cancelZoomMeeting(meetingId: string) {
  const id = clean(meetingId, 120)
  if (!id) return { ok: true, data: null }
  return zoomApi("DELETE", `/meetings/${encodeURIComponent(id)}`)
}

export async function updateSchoolCallOutcome(input: {
  bookingUuid: string
  outcomeStatus: string
  assignedOwner: string
  nextFollowUpAtIso: string
  outcomeFeedback: string
  outcomeUpdatedBy: string
}) {
  const bookingUuid = clean(input.bookingUuid, 72)
  const outcomeStatus = clean(input.outcomeStatus, 40).toLowerCase()
  if (!bookingUuid) throw new Error("bookingUuid is required.")
  if (!["pending", "completed", "no_show", "won", "lost", "follow_up"].includes(outcomeStatus)) throw new Error("Invalid outcome status.")
  await ensureBuildServiceTables()
  await prisma.$executeRaw`
    UPDATE school_call_bookings_tochukwu
    SET assigned_owner = ${clean(input.assignedOwner, 180) || null},
        call_outcome_status = ${outcomeStatus},
        outcome_feedback = ${clean(input.outcomeFeedback, 4000) || null},
        next_follow_up_at = ${sqlFromIso(input.nextFollowUpAtIso)},
        outcome_updated_by = ${clean(input.outcomeUpdatedBy, 120) || "admin"},
        outcome_updated_at = UTC_TIMESTAMP(),
        updated_at = UTC_TIMESTAMP()
    WHERE booking_uuid = ${bookingUuid}
      AND COALESCE(lead_source_type, 'school') <> 'build'
    LIMIT 1
  `
}

export async function cancelSchoolCall(input: { bookingUuid: string; note: string }) {
  const bookingUuid = clean(input.bookingUuid, 72)
  if (!bookingUuid) throw new Error("bookingUuid is required.")
  await ensureBuildServiceTables()
  const rows = await prisma.$queryRaw<Array<{ id: bigint; zoomMeetingId: string | null }>>`
    SELECT id, zoom_meeting_id AS zoomMeetingId
    FROM school_call_bookings_tochukwu
    WHERE booking_uuid = ${bookingUuid}
      AND COALESCE(lead_source_type, 'school') <> 'build'
    LIMIT 1
  `
  const booking = rows[0]
  if (!booking) throw new Error("School call booking not found.")
  if (booking.zoomMeetingId) {
    const zoom = await cancelZoomMeeting(booking.zoomMeetingId)
    if (!zoom.ok) throw new Error(zoom.error || "Could not cancel Zoom meeting.")
  }
  await prisma.$executeRaw`
    UPDATE school_call_bookings_tochukwu
    SET status = 'cancelled',
        cancel_reason = ${clean(input.note, 255) || "Cancelled by admin"},
        cancelled_at = UTC_TIMESTAMP(),
        slot_start_utc = NULL,
        slot_end_utc = NULL,
        updated_at = UTC_TIMESTAMP()
    WHERE id = ${booking.id}
    LIMIT 1
  `
}

export async function rescheduleSchoolCall(input: { bookingUuid: string; slotStartIso: string; note: string }) {
  const bookingUuid = clean(input.bookingUuid, 72)
  const start = new Date(input.slotStartIso)
  if (!bookingUuid) throw new Error("bookingUuid is required.")
  if (!Number.isFinite(start.getTime())) throw new Error("Invalid slot.")
  await ensureBuildServiceTables()
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT id, school_name AS schoolName, zoom_meeting_id AS zoomMeetingId
    FROM school_call_bookings_tochukwu
    WHERE booking_uuid = ${bookingUuid}
      AND COALESCE(lead_source_type, 'school') <> 'build'
    LIMIT 1
  `
  const booking = rows[0]
  if (!booking) throw new Error("School call booking not found.")
  const end = new Date(start.getTime() + 30 * 60 * 1000)
  const topic = `School Onboarding Call - ${clean(booking.schoolName, 220) || "School"}`
  let meeting: Record<string, unknown> = {}
  if (booking.zoomMeetingId) {
    const zoom = await updateZoomMeeting(clean(booking.zoomMeetingId, 120), { topic, startTimeIso: start.toISOString(), durationMinutes: 30 })
    if (!zoom.ok) throw new Error(zoom.error || "Could not update Zoom meeting.")
  } else {
    const zoom = await createZoomMeeting({ topic, startTimeIso: start.toISOString(), durationMinutes: 30 })
    if (!zoom.ok || !zoom.data) throw new Error(zoom.error || "Could not create Zoom meeting.")
    meeting = zoom.data
  }
  await prisma.$executeRaw`
    UPDATE school_call_bookings_tochukwu
    SET status = 'rescheduled',
        reschedule_note = ${clean(input.note, 255) || "Rescheduled by admin"},
        slot_start_utc = ${sqlFromIso(start.toISOString())},
        slot_end_utc = ${sqlFromIso(end.toISOString())},
        zoom_meeting_id = COALESCE(${clean(meeting.id, 120) || null}, zoom_meeting_id),
        zoom_join_url = COALESCE(${clean(meeting.join_url, 1200) || null}, zoom_join_url),
        zoom_start_url = COALESCE(${clean(meeting.start_url, 1200) || null}, zoom_start_url),
        updated_at = UTC_TIMESTAMP()
    WHERE id = ${booking.id}
    LIMIT 1
  `
}

function slotHuman(iso: string) {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return ""
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: SCHOOL_CALL_TIMEZONE }).format(date)
}

function notificationRecipients() {
  const configured = clean(process.env.SCHOOL_NOTIFICATION_EMAILS || process.env.SCHOOL_ALERT_EMAILS || process.env.SCHOOL_CALL_ALERT_EMAILS, 5000)
  const raw = configured || "support@tochukwunkwocha.com,partnerships@tochukwunkwocha.com"
  return Array.from(new Set(raw.split(",").map((item) => normalizeEmail(item)).filter(Boolean)))
}

export async function resendRecentSchoolCallNotifications(input: { lookbackHours: number }) {
  await ensureBuildServiceTables()
  const lookbackHours = Math.max(1, Math.min(24 * 30, Math.round(Number(input.lookbackHours || 72))))
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT booking_uuid, full_name, school_name, work_email, phone, role_title, student_population, slot_start_utc, zoom_join_url
    FROM school_call_bookings_tochukwu
    WHERE COALESCE(lead_source_type, 'school') <> 'build'
      AND status IN ('booked', 'rescheduled')
      AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${lookbackHours} HOUR)
    ORDER BY created_at DESC, id DESC
    LIMIT 120
  `
  let leadSent = 0
  let adminSent = 0
  for (const row of rows) {
    const workEmail = normalizeEmail(row.work_email)
    const when = slotHuman(isoFromValue(row.slot_start_utc))
    const zoomJoinUrl = clean(row.zoom_join_url, 1200)
    if (workEmail) {
      const text = [
        `Hello ${clean(row.full_name, 180).split(/\s+/)[0] || "there"},`,
        "",
        "Your school call has been booked successfully.",
        `School: ${clean(row.school_name, 220)}`,
        when ? `Time: ${when} (WAT)` : "",
        zoomJoinUrl ? `Zoom link: ${zoomJoinUrl}` : ""
      ].filter(Boolean).join("\n")
      await sendEmail({ to: workEmail, subject: "Your School Call is Booked", text, html: text.replace(/\n/g, "<br/>") }).catch(() => null)
      leadSent += 1
    }
    const adminText = [
      "New school call booking",
      `Name: ${clean(row.full_name, 180)}`,
      `School: ${clean(row.school_name, 220)}`,
      `Email: ${workEmail}`,
      `Phone: ${clean(row.phone, 80)}`,
      `Role: ${clean(row.role_title, 140)}`,
      `Student population: ${clean(row.student_population, 60)}`,
      when ? `Time: ${when} (WAT)` : "",
      zoomJoinUrl ? `Zoom join link: ${zoomJoinUrl}` : ""
    ].filter(Boolean).join("\n")
    await Promise.all(notificationRecipients().map((to) => sendEmail({ to, subject: `School Call Booked - ${clean(row.school_name, 220)}`, text: adminText, html: adminText.replace(/\n/g, "<br/>") }).catch(() => null)))
    adminSent += notificationRecipients().length
  }
  return { scanned: rows.length, leadSent, adminSent }
}
