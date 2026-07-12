import crypto from "crypto"
import { Prisma } from "@prisma/client"

import { ensureBuildServiceTables, listAvailableCallSlots, SCHOOL_CALL_TIMEZONE } from "@/lib/admin-build-service"
import { sendEmail } from "@/lib/email"
import { siteBaseUrl } from "@/lib/payments/course-checkout"
import { prisma } from "@/lib/prisma"

export { listAvailableCallSlots }

export type BookingSource = "school" | "build" | "private_ai_coaching"

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function normalizeEmail(value: unknown) {
  const email = clean(value, 220).toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ""
}

function shaToken(token: string) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex")
}

function sqlFromIso(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value || ""))
  if (!Number.isFinite(date.getTime())) return null
  return date.toISOString().slice(0, 19).replace("T", " ")
}

function slotLabel(iso: string) {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return ""
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: SCHOOL_CALL_TIMEZONE }).format(date)
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

async function createZoomMeeting(input: { topic: string; startTimeIso: string; durationMinutes: number; agenda: string }) {
  const hostId = clean(process.env.ZOOM_HOST_USER_ID, 120)
  if (!hostId) return { ok: false, error: "Missing ZOOM_HOST_USER_ID", data: null }
  return zoomApi("POST", `/users/${encodeURIComponent(hostId)}/meetings`, {
    topic: clean(input.topic, 200),
    type: 2,
    start_time: input.startTimeIso,
    duration: input.durationMinutes,
    timezone: SCHOOL_CALL_TIMEZONE,
    agenda: clean(input.agenda, 1500),
    settings: { join_before_host: false, waiting_room: true, approval_type: 2, mute_upon_entry: true, registrants_email_notification: false }
  })
}

async function updateZoomMeeting(meetingId: string, input: { topic: string; startTimeIso: string; durationMinutes: number }) {
  const id = clean(meetingId, 120)
  if (!id) return { ok: false, error: "meetingId is required", data: null }
  return zoomApi("PATCH", `/meetings/${encodeURIComponent(id)}`, {
    topic: clean(input.topic, 200),
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

async function verifyBuildAccess(token: string) {
  const hash = shaToken(token)
  if (!token) return { ok: false, error: "Missing booking access token" }
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT id, lead_uuid, score, discovery_approved, expires_at, used_at
    FROM tochukwu_build_booking_access
    WHERE token_hash = ${hash}
    LIMIT 1
  `).catch(() => [])
  const row = rows[0]
  if (!row) return { ok: false, error: "Invalid booking access token" }
  const score = Number(row.score || 0)
  const discoveryApproved = Number(row.discovery_approved || 0) === 1
  if (score < 70 && !discoveryApproved) return { ok: false, error: "Booking access is only available for approved submissions" }
  if (row.used_at) return { ok: false, error: "This booking access token has already been used" }
  if (row.expires_at && new Date(String(row.expires_at)).getTime() < Date.now()) return { ok: false, error: "Booking access token expired" }
  return { ok: true, id: Number(row.id || 0), leadUuid: clean(row.lead_uuid, 64) }
}

async function verifyCoachingAccess(token: string) {
  const hash = shaToken(token)
  if (!token) return { ok: false, error: "Missing private coaching booking access token" }
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT id, lead_uuid, expires_at, used_at
    FROM tochukwu_private_ai_coaching_booking_access
    WHERE token_hash = ${hash}
    LIMIT 1
  `).catch(() => [])
  const row = rows[0]
  if (!row) return { ok: false, error: "Invalid private coaching booking access token" }
  if (row.used_at) return { ok: false, error: "This booking access token has already been used" }
  if (row.expires_at && new Date(String(row.expires_at)).getTime() < Date.now()) return { ok: false, error: "Booking access token expired" }
  return { ok: true, id: Number(row.id || 0), leadUuid: clean(row.lead_uuid, 64) }
}

async function privateCoachingLead(leadUuid: string) {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT lead_uuid, full_name, work_email, phone, experience_level, availability, goal_text
    FROM tochukwu_private_ai_coaching_leads
    WHERE lead_uuid = ${leadUuid}
    LIMIT 1
  `).catch(() => [])
  return rows[0] || null
}

export async function assertCanViewSlots(input: { source: BookingSource; buildAccessToken?: string; coachingAccessToken?: string }) {
  if (input.source === "build") {
    const access = await verifyBuildAccess(clean(input.buildAccessToken, 260))
    if (!access.ok) throw new Error(access.error)
  }
  if (input.source === "private_ai_coaching") {
    const access = await verifyCoachingAccess(clean(input.coachingAccessToken, 260))
    if (!access.ok) throw new Error(access.error)
  }
}

export async function bookPublicCall(body: Record<string, unknown>) {
  await ensureBuildServiceTables()
  const source = clean(body.sourceType, 40).toLowerCase() === "build"
    ? "build"
    : clean(body.sourceType, 40).toLowerCase() === "private_ai_coaching"
      ? "private_ai_coaching"
      : "school"
  const start = new Date(clean(body.slotStartIso, 80))
  if (!Number.isFinite(start.getTime())) throw new Error("Invalid slot time.")
  if (start.getTime() <= Date.now() + 60 * 60 * 1000) throw new Error("This slot is no longer available.")
  const available = await listAvailableCallSlots()
  if (!available.some((slot) => slot.startIso === start.toISOString())) throw new Error("Selected slot is not part of available schedule.")

  let fullName = clean(body.fullName, 180)
  let schoolName = clean(body.schoolName, 220)
  let workEmail = normalizeEmail(body.workEmail)
  let phone = clean(body.phone, 80)
  let role = clean(body.role, 140)
  let studentPopulation = clean(body.studentPopulation, 80)
  let sourceLeadUuid = ""
  let buildAccessId = 0
  let coachingAccessId = 0

  if (source === "build") {
    const access = await verifyBuildAccess(clean(body.buildAccessToken, 260))
    if (!access.ok) throw new Error(access.error)
    sourceLeadUuid = access.leadUuid || ""
    buildAccessId = access.id || 0
  } else if (source === "private_ai_coaching") {
    const access = await verifyCoachingAccess(clean(body.coachingAccessToken, 260))
    if (!access.ok) throw new Error(access.error)
    sourceLeadUuid = access.leadUuid || ""
    coachingAccessId = access.id || 0
    const lead = await privateCoachingLead(sourceLeadUuid)
    if (!lead) throw new Error("Private coaching application not found.")
    fullName = clean(lead.full_name, 180)
    workEmail = normalizeEmail(lead.work_email)
    phone = clean(lead.phone, 80) || phone || "-"
    schoolName = `Private coaching - ${fullName}`
    role = clean(lead.experience_level, 140) || "Private coaching applicant"
    studentPopulation = clean(lead.availability, 80) || "Private coaching discovery"
  }

  if (source !== "private_ai_coaching" && (!fullName || !schoolName || !workEmail || !phone || !role || !studentPopulation)) {
    throw new Error("Please complete all required fields.")
  }
  if (!fullName || !workEmail) throw new Error("Could not load contact details.")

  const end = new Date(start.getTime() + 30 * 60 * 1000)
  const bookingUuid = `school_call_${crypto.randomUUID()}`
  const manageToken = `${crypto.randomUUID()}${crypto.randomUUID().replace(/-/g, "")}`
  const callLabel = source === "private_ai_coaching" ? "Private AI Build Coaching Discovery Call" : source === "build" ? "Build Discovery Call" : "School Onboarding Call"
  const zoom = await createZoomMeeting({
    topic: `${callLabel} - ${source === "school" ? schoolName : fullName}`,
    startTimeIso: start.toISOString(),
    durationMinutes: 30,
    agenda: `${callLabel} with ${fullName} (${role}) from ${schoolName}`
  })
  if (!zoom.ok || !zoom.data) throw new Error(zoom.error || "Could not create Zoom meeting.")

  await prisma.$executeRaw`
    INSERT INTO school_call_bookings_tochukwu
      (booking_uuid, manage_token, full_name, school_name, work_email, phone, role_title, student_population,
       lead_source_type, lead_source_path, source_lead_uuid, timezone_label, slot_start_utc, slot_end_utc,
       duration_minutes, status, zoom_meeting_id, zoom_join_url, zoom_start_url, created_at, updated_at)
    VALUES
      (${bookingUuid}, ${manageToken}, ${fullName}, ${schoolName}, ${workEmail}, ${phone || null}, ${role || null}, ${studentPopulation || null},
       ${source}, ${source === "build" ? "/build-scorecard/" : source === "private_ai_coaching" ? "/private-ai-build-coaching/" : "/schools/book-call/"},
       ${sourceLeadUuid || null}, ${SCHOOL_CALL_TIMEZONE}, ${sqlFromIso(start.toISOString())}, ${sqlFromIso(end.toISOString())},
       30, 'booked', ${clean(zoom.data.id, 120) || null}, ${clean(zoom.data.join_url, 1200) || null}, ${clean(zoom.data.start_url, 1200) || null},
       UTC_TIMESTAMP(), UTC_TIMESTAMP())
  `

  if (source === "build" && buildAccessId) await prisma.$executeRaw`UPDATE tochukwu_build_booking_access SET used_at = UTC_TIMESTAMP() WHERE id = ${buildAccessId} LIMIT 1`
  if (source === "private_ai_coaching" && coachingAccessId) await prisma.$executeRaw`UPDATE tochukwu_private_ai_coaching_booking_access SET used_at = UTC_TIMESTAMP() WHERE id = ${coachingAccessId} LIMIT 1`

  const label = slotLabel(start.toISOString())
  const manageUrl = `${siteBaseUrl()}/schools/book-call?manage=${encodeURIComponent(manageToken)}`
  const userSubject = source === "private_ai_coaching" ? "Your Private Coaching Discovery Call is Booked" : source === "build" ? "Your Build Discovery Call is Booked" : "Your School Call is Booked"
  const userText = [
    `Hello ${fullName.split(/\s+/)[0] || "there"},`,
    "",
    "Your call has been booked successfully.",
    `Time: ${label} (WAT)`,
    `Zoom link: ${clean(zoom.data.join_url, 1200)}`,
    `Manage booking: ${manageUrl}`
  ].join("\n")
  if (source !== "build") await sendEmail({ to: workEmail, subject: userSubject, text: userText, html: userText.replace(/\n/g, "<br/>") }).catch(() => null)
  const adminRecipients = source === "school"
    ? (process.env.SCHOOL_NOTIFICATION_EMAILS || "support@tochukwunkwocha.com").split(",").map((item) => normalizeEmail(item)).filter(Boolean)
    : ["support@tochukwunkwocha.com"]
  await Promise.all(adminRecipients.map((to) => sendEmail({
    to,
    subject: source === "private_ai_coaching" ? `Private AI Build Coaching Discovery Call Booked - ${fullName}` : source === "build" ? `Build Discovery Call Booked - ${fullName}` : `School Call Booked - ${schoolName}`,
    text: [`New ${callLabel}`, `Name: ${fullName}`, `Organisation: ${schoolName}`, `Email: ${workEmail}`, `Phone: ${phone}`, `Time: ${label} (WAT)`, `Zoom: ${clean(zoom.data.join_url, 1200)}`, `Manage: ${manageUrl}`].join("\n"),
    html: [`New ${callLabel}`, `Name: ${fullName}`, `Organisation: ${schoolName}`, `Email: ${workEmail}`, `Phone: ${phone}`, `Time: ${label} (WAT)`, `Zoom: ${clean(zoom.data.join_url, 1200)}`, `Manage: ${manageUrl}`].join("<br/>")
  }).catch(() => null)))

  return { bookingUuid, manageToken, zoomJoinUrl: clean(zoom.data.join_url, 1200), slotStartIso: start.toISOString(), slotEndIso: end.toISOString(), slotLabel: label, status: "booked" }
}

export async function getManagedBooking(manageToken: string) {
  await ensureBuildServiceTables()
  const token = clean(manageToken, 128)
  if (!token) throw new Error("Missing manage token.")
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT booking_uuid, manage_token, full_name, school_name, work_email, phone, role_title, student_population,
      lead_source_type, status, slot_start_utc, slot_end_utc, zoom_join_url
    FROM school_call_bookings_tochukwu
    WHERE manage_token = ${token}
    LIMIT 1
  `)
  const row = rows[0]
  if (!row) throw new Error("Booking not found.")
  const startIso = row.slot_start_utc ? new Date(String(row.slot_start_utc)).toISOString() : ""
  return {
    bookingUuid: clean(row.booking_uuid, 72),
    manageToken: clean(row.manage_token, 128),
    fullName: clean(row.full_name, 180),
    schoolName: clean(row.school_name, 220),
    workEmail: normalizeEmail(row.work_email),
    phone: clean(row.phone, 80),
    role: clean(row.role_title, 140),
    studentPopulation: clean(row.student_population, 80),
    sourceType: clean(row.lead_source_type, 40),
    status: clean(row.status, 40),
    slotStartIso: startIso,
    slotEndIso: row.slot_end_utc ? new Date(String(row.slot_end_utc)).toISOString() : "",
    slotLabel: startIso ? slotLabel(startIso) : "",
    zoomJoinUrl: clean(row.zoom_join_url, 1200)
  }
}

export async function rescheduleManagedBooking(input: { manageToken: string; slotStartIso: string; note?: string }) {
  const booking = await getManagedBooking(input.manageToken)
  if (booking.status === "cancelled") throw new Error("Booking is already cancelled.")
  const start = new Date(input.slotStartIso)
  if (!Number.isFinite(start.getTime())) throw new Error("Invalid slot.")
  if (start.getTime() <= Date.now() + 60 * 60 * 1000) throw new Error("This slot is no longer available.")
  const available = await listAvailableCallSlots()
  if (!available.some((slot) => slot.startIso === start.toISOString())) throw new Error("Selected slot is not part of available schedule.")
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT id, zoom_meeting_id
    FROM school_call_bookings_tochukwu
    WHERE manage_token = ${clean(input.manageToken, 128)}
    LIMIT 1
  `)
  const row = rows[0]
  const end = new Date(start.getTime() + 30 * 60 * 1000)
  const callLabel = booking.sourceType === "private_ai_coaching" ? "Private AI Build Coaching Discovery Call" : booking.sourceType === "build" ? "Build Discovery Call" : "School Onboarding Call"
  const zoom = row?.zoom_meeting_id
    ? await updateZoomMeeting(clean(row.zoom_meeting_id, 120), { topic: `${callLabel} - ${booking.sourceType === "school" ? booking.schoolName : booking.fullName}`, startTimeIso: start.toISOString(), durationMinutes: 30 })
    : await createZoomMeeting({
        topic: `${callLabel} - ${booking.sourceType === "school" ? booking.schoolName : booking.fullName}`,
        startTimeIso: start.toISOString(),
        durationMinutes: 30,
        agenda: `${callLabel} with ${booking.fullName} (${booking.role}) from ${booking.schoolName}`
      })
  if (!zoom.ok) throw new Error(zoom.error || "Could not update Zoom meeting.")
  await prisma.$executeRaw`
    UPDATE school_call_bookings_tochukwu
    SET status = 'rescheduled',
        reschedule_note = ${clean(input.note, 255) || "Rescheduled by attendee"},
        slot_start_utc = ${sqlFromIso(start.toISOString())},
        slot_end_utc = ${sqlFromIso(end.toISOString())},
        zoom_meeting_id = COALESCE(zoom_meeting_id, ${clean(zoom.data?.id, 120) || null}),
        zoom_join_url = COALESCE(zoom_join_url, ${clean(zoom.data?.join_url, 1200) || null}),
        zoom_start_url = COALESCE(zoom_start_url, ${clean(zoom.data?.start_url, 1200) || null}),
        updated_at = UTC_TIMESTAMP()
    WHERE manage_token = ${clean(input.manageToken, 128)}
    LIMIT 1
  `
  return { slotLabel: slotLabel(start.toISOString()) }
}

export async function cancelManagedBooking(input: { manageToken: string; reason?: string }) {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT zoom_meeting_id
    FROM school_call_bookings_tochukwu
    WHERE manage_token = ${clean(input.manageToken, 128)}
    LIMIT 1
  `)
  if (!rows[0]) throw new Error("Booking not found.")
  if (rows[0].zoom_meeting_id) await cancelZoomMeeting(clean(rows[0].zoom_meeting_id, 120)).catch(() => null)
  await prisma.$executeRaw`
    UPDATE school_call_bookings_tochukwu
    SET status = 'cancelled',
        cancel_reason = ${clean(input.reason, 255) || "Cancelled by attendee"},
        cancelled_at = UTC_TIMESTAMP(),
        slot_start_utc = NULL,
        slot_end_utc = NULL,
        updated_at = UTC_TIMESTAMP()
    WHERE manage_token = ${clean(input.manageToken, 128)}
    LIMIT 1
  `
}
