import { randomUUID } from "crypto"

import { sendEmail } from "@/lib/email"
import { siteBaseUrl } from "@/lib/payments/course-checkout"
import { serviceCheckoutPricing } from "@/lib/payments/service-checkout"
import { prisma } from "@/lib/prisma"
import { addColumnIfMissing } from "@/lib/schema-guards"

export const SCHOOL_CALL_TIMEZONE = "Africa/Lagos"

type ZoomResult = {
  ok: boolean
  error?: string
  data?: Record<string, unknown> | null
}

export type BuildScorecardLead = {
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
  followUpRequired: boolean
  discoveryPaymentApprovedAt: string
  discoveryPaymentApprovedBy: string
  discoveryPaymentLinkSentAt: string
  discoveryPayment: {
    status: string
    amountMinor: number
    provider: string
    reference: string
    checkoutUrl: string
    paidAt: string
    createdAt: string
  }
  answers: Array<{ question?: string; answer?: string; score?: number }>
  sourcePath: string
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

export type BuildCallBooking = {
  bookingUuid: string
  fullName: string
  schoolName: string
  workEmail: string
  phone: string
  role: string
  studentPopulation: string
  sourceLeadUuid: string
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
  buildLeadUuid: string
  buildBusinessName: string
  buildScore: number
  buildBandKey: string
  buildHeadline: string
  buildAnswers: Array<{ question?: string; answer?: string; score?: number }>
}

export type CallSlot = {
  startIso: string
  endIso: string
  label: string
}

function clean(value: unknown, max = 400) {
  return String(value || "").trim().slice(0, max)
}

function normalizeEmail(value: unknown) {
  const email = clean(value, 220).toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ""
}

function sqlFromIso(value: unknown) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(String(value || ""))
  if (!Number.isFinite(date.getTime())) return null
  return date.toISOString().slice(0, 19).replace("T", " ")
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

function parseAnswers(value: unknown) {
  try {
    const parsed = typeof value === "string" && value ? JSON.parse(value) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function ensureBuildServiceTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_build_scorecard_leads (
      id BIGINT NOT NULL AUTO_INCREMENT,
      lead_uuid VARCHAR(64) NOT NULL,
      full_name VARCHAR(180) NOT NULL,
      business_name VARCHAR(220) NOT NULL,
      work_email VARCHAR(220) NOT NULL,
      phone VARCHAR(80) NULL,
      role_title VARCHAR(140) NULL,
      company_size VARCHAR(80) NULL,
      score INT NOT NULL DEFAULT 0,
      band_key VARCHAR(40) NOT NULL,
      headline VARCHAR(255) NULL,
      next_step VARCHAR(255) NULL,
      follow_up_required TINYINT(1) NOT NULL DEFAULT 0,
      answers_json LONGTEXT NULL,
      discovery_payment_approved_at DATETIME NULL,
      discovery_payment_approved_by VARCHAR(180) NULL,
      discovery_payment_link_sent_at DATETIME NULL,
      source_path VARCHAR(255) NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_build_scorecard_lead_uuid (lead_uuid),
      KEY idx_tochukwu_build_scorecard_email (work_email),
      KEY idx_tochukwu_build_scorecard_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_build_discovery_payments (
      id BIGINT NOT NULL AUTO_INCREMENT,
      payment_uuid VARCHAR(64) NOT NULL,
      lead_uuid VARCHAR(64) NOT NULL,
      work_email VARCHAR(220) NOT NULL,
      full_name VARCHAR(180) NOT NULL,
      amount_minor INT NOT NULL DEFAULT 0,
      payment_provider VARCHAR(40) NOT NULL DEFAULT 'paystack',
      payment_reference VARCHAR(120) NOT NULL,
      checkout_url VARCHAR(1200) NULL,
      payment_order_id VARCHAR(120) NULL,
      payment_status VARCHAR(40) NOT NULL DEFAULT 'initiated',
      paid_at DATETIME NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_build_discovery_payment_uuid (payment_uuid),
      UNIQUE KEY uniq_build_discovery_reference (payment_reference),
      KEY idx_build_discovery_lead (lead_uuid),
      KEY idx_build_discovery_status (payment_status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS school_call_bookings_tochukwu (
      id BIGINT NOT NULL AUTO_INCREMENT,
      booking_uuid VARCHAR(64) NOT NULL,
      manage_token VARCHAR(128) NOT NULL,
      full_name VARCHAR(180) NOT NULL,
      school_name VARCHAR(220) NOT NULL,
      work_email VARCHAR(220) NOT NULL,
      phone VARCHAR(80) NULL,
      role_title VARCHAR(140) NULL,
      student_population VARCHAR(60) NULL,
      lead_source_type VARCHAR(40) NOT NULL DEFAULT 'school',
      lead_source_path VARCHAR(255) NULL,
      source_lead_uuid VARCHAR(64) NULL,
      timezone_label VARCHAR(80) NOT NULL DEFAULT 'Africa/Lagos',
      slot_start_utc DATETIME NULL,
      slot_end_utc DATETIME NULL,
      duration_minutes INT NOT NULL DEFAULT 30,
      status VARCHAR(40) NOT NULL DEFAULT 'booked',
      zoom_meeting_id VARCHAR(120) NULL,
      zoom_join_url VARCHAR(1200) NULL,
      zoom_start_url VARCHAR(1200) NULL,
      cancel_reason VARCHAR(255) NULL,
      reschedule_note VARCHAR(255) NULL,
      assigned_owner VARCHAR(180) NULL,
      call_outcome_status VARCHAR(40) NULL,
      outcome_feedback TEXT NULL,
      next_follow_up_at DATETIME NULL,
      outcome_updated_by VARCHAR(120) NULL,
      outcome_updated_at DATETIME NULL,
      cancelled_at DATETIME NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_school_call_booking_uuid_tochukwu (booking_uuid),
      UNIQUE KEY uniq_school_call_manage_token_tochukwu (manage_token),
      UNIQUE KEY uniq_school_call_slot_start_tochukwu (slot_start_utc)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await addColumnIfMissing("tochukwu_build_scorecard_leads", "discovery_payment_link_sent_at", "DATETIME NULL")
  await addColumnIfMissing("school_call_bookings_tochukwu", "lead_source_type", "VARCHAR(40) NOT NULL DEFAULT 'school'")
  await addColumnIfMissing("school_call_bookings_tochukwu", "source_lead_uuid", "VARCHAR(64) NULL")
  await addColumnIfMissing("school_call_bookings_tochukwu", "call_outcome_status", "VARCHAR(40) NULL")
  await addColumnIfMissing("school_call_bookings_tochukwu", "outcome_feedback", "TEXT NULL")
  await addColumnIfMissing("school_call_bookings_tochukwu", "next_follow_up_at", "DATETIME NULL")
}

function getLagosDateParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: SCHOOL_CALL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  })
  const parts = formatter.formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value || ""
  return {
    year: Number(get("year") || 0),
    month: Number(get("month") || 0),
    day: Number(get("day") || 0),
    weekday: get("weekday").toLowerCase()
  }
}

function timeZoneOffsetMinutes(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  })
  const byType: Record<string, string> = {}
  dtf.formatToParts(date).forEach((part) => {
    byType[part.type] = part.value
  })
  const asUTC = Date.UTC(
    Number(byType.year || 0),
    Number(byType.month || 1) - 1,
    Number(byType.day || 1),
    Number(byType.hour || 0),
    Number(byType.minute || 0),
    Number(byType.second || 0)
  )
  return (asUTC - date.getTime()) / 60000
}

function lagosLocalToUtcIso(year: number, month: number, day: number, hour: number, minute: number) {
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0)
  const probe = new Date(naiveUtcMs)
  const offsetMin = timeZoneOffsetMinutes(probe, SCHOOL_CALL_TIMEZONE)
  return new Date(naiveUtcMs - offsetMin * 60000).toISOString()
}

function slotLabel(iso: string) {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return ""
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: SCHOOL_CALL_TIMEZONE
  }).format(date)
}

export function buildCandidateSlots(days = 21, durationMinutes = 30): CallSlot[] {
  const now = new Date()
  const slots: CallSlot[] = []
  for (let i = 0; i < Math.max(7, Math.min(35, days)); i += 1) {
    const cursor = new Date(now.getTime() + i * 24 * 60 * 60 * 1000)
    const parts = getLagosDateParts(cursor)
    if (!parts.year || !parts.month || !parts.day) continue
    if (parts.weekday === "sat" || parts.weekday === "sun") continue
    for (const hour of [10, 12, 14, 16]) {
      const startIso = lagosLocalToUtcIso(parts.year, parts.month, parts.day, hour, 0)
      const startDate = new Date(startIso)
      if (!Number.isFinite(startDate.getTime())) continue
      if (startDate.getTime() <= now.getTime() + 2 * 60 * 60 * 1000) continue
      const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000)
      slots.push({ startIso: startDate.toISOString(), endIso: endDate.toISOString(), label: slotLabel(startDate.toISOString()) })
    }
  }
  return slots.sort((a, b) => a.startIso.localeCompare(b.startIso))
}

export async function listAvailableCallSlots() {
  await ensureBuildServiceTables()
  const rows = await prisma.$queryRaw<Array<{ slotStartUtc: Date | string | null }>>`
    SELECT slot_start_utc AS slotStartUtc
    FROM school_call_bookings_tochukwu
    WHERE status IN ('booked', 'rescheduled')
      AND slot_start_utc IS NOT NULL
  `
  const booked = new Set(rows.map((row) => isoFromValue(row.slotStartUtc)).filter(Boolean))
  return buildCandidateSlots(30, 30).filter((slot) => !booked.has(slot.startIso)).slice(0, 60)
}

export async function listBuildScorecardLeads(limit = 200): Promise<BuildScorecardLead[]> {
  await ensureBuildServiceTables()
  const safeLimit = Math.max(10, Math.min(300, Math.round(Number(limit || 200))))
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
    SELECT
      b.id, b.lead_uuid, b.full_name, b.business_name, b.work_email, b.phone, b.role_title, b.company_size,
      b.score, b.band_key, b.headline, b.next_step, b.follow_up_required, b.answers_json, b.source_path,
      b.discovery_payment_approved_at, b.discovery_payment_approved_by, b.discovery_payment_link_sent_at,
      p.payment_status AS discovery_payment_status,
      p.amount_minor AS discovery_payment_amount_minor,
      p.payment_provider AS discovery_payment_provider,
      p.payment_reference AS discovery_payment_reference,
      p.checkout_url AS discovery_payment_checkout_url,
      p.paid_at AS discovery_payment_paid_at,
      p.created_at AS discovery_payment_created_at,
      b.created_at, b.updated_at,
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
    FROM tochukwu_build_scorecard_leads b
    LEFT JOIN tochukwu_build_discovery_payments p
      ON p.id = (
        SELECT p2.id
        FROM tochukwu_build_discovery_payments p2
        WHERE p2.lead_uuid = b.lead_uuid
        ORDER BY p2.id DESC
        LIMIT 1
      )
    LEFT JOIN school_call_bookings_tochukwu c
      ON c.id = (
        SELECT c2.id
        FROM school_call_bookings_tochukwu c2
        WHERE c2.lead_source_type = 'build'
          AND (c2.source_lead_uuid = b.lead_uuid OR c2.work_email = b.work_email)
        ORDER BY COALESCE(c2.slot_start_utc, c2.created_at) DESC, c2.id DESC
        LIMIT 1
      )
    ORDER BY b.created_at DESC, b.id DESC
    LIMIT ${safeLimit}
  `)
  return rows.map((row) => ({
    id: Number(row.id || 0),
    leadUuid: clean(row.lead_uuid, 64),
    fullName: clean(row.full_name, 180),
    schoolName: clean(row.business_name, 220),
    workEmail: clean(row.work_email, 220),
    phone: clean(row.phone, 80),
    role: clean(row.role_title, 140),
    studentPopulation: clean(row.company_size, 80),
    score: Number(row.score || 0),
    bandKey: clean(row.band_key, 40),
    headline: clean(row.headline, 255),
    nextStep: clean(row.next_step, 255),
    followUpRequired: Number(row.follow_up_required || 0) === 1,
    discoveryPaymentApprovedAt: isoFromValue(row.discovery_payment_approved_at),
    discoveryPaymentApprovedBy: clean(row.discovery_payment_approved_by, 180),
    discoveryPaymentLinkSentAt: isoFromValue(row.discovery_payment_link_sent_at),
    discoveryPayment: {
      status: clean(row.discovery_payment_status, 40).toLowerCase(),
      amountMinor: Number(row.discovery_payment_amount_minor || 0),
      provider: clean(row.discovery_payment_provider, 40).toLowerCase(),
      reference: clean(row.discovery_payment_reference, 120),
      checkoutUrl: clean(row.discovery_payment_checkout_url, 1200),
      paidAt: isoFromValue(row.discovery_payment_paid_at),
      createdAt: isoFromValue(row.discovery_payment_created_at)
    },
    answers: parseAnswers(row.answers_json),
    sourcePath: clean(row.source_path, 255),
    createdAt: isoFromValue(row.created_at),
    updatedAt: isoFromValue(row.updated_at),
    call: {
      bookingUuid: clean(row.call_booking_uuid, 64),
      status: clean(row.call_status, 40),
      outcomeStatus: clean(row.call_outcome_status, 40).toLowerCase(),
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

export async function listBuildCalls(): Promise<BuildCallBooking[]> {
  await ensureBuildServiceTables()
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT
      c.booking_uuid, c.full_name, c.school_name, c.work_email, c.phone, c.role_title, c.student_population,
      c.source_lead_uuid, c.status, c.slot_start_utc, c.slot_end_utc, c.zoom_join_url, c.zoom_meeting_id,
      c.created_at, c.updated_at, c.cancel_reason, c.reschedule_note, c.assigned_owner, c.call_outcome_status,
      c.outcome_feedback, c.next_follow_up_at, c.outcome_updated_by, c.outcome_updated_at,
      b.lead_uuid AS build_lead_uuid, b.business_name, b.score AS build_score, b.band_key,
      b.headline AS build_headline, b.answers_json
    FROM school_call_bookings_tochukwu c
    LEFT JOIN tochukwu_build_scorecard_leads b
      ON b.lead_uuid = c.source_lead_uuid OR (c.source_lead_uuid IS NULL AND b.work_email = c.work_email)
    WHERE c.lead_source_type = 'build'
    ORDER BY COALESCE(c.slot_start_utc, c.created_at) DESC, c.id DESC
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
    sourceLeadUuid: clean(row.source_lead_uuid, 64),
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
    outcomeUpdatedAt: isoFromValue(row.outcome_updated_at),
    buildLeadUuid: clean(row.build_lead_uuid, 64),
    buildBusinessName: clean(row.business_name, 220),
    buildScore: Number(row.build_score || 0),
    buildBandKey: clean(row.band_key, 40),
    buildHeadline: clean(row.build_headline, 255),
    buildAnswers: parseAnswers(row.answers_json)
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

async function zoomApi(method: string, path: string, body?: Record<string, unknown>): Promise<ZoomResult> {
  const token = await zoomAccessToken()
  const response = await fetch(`https://api.zoom.us/v2${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined
  })
  if (response.status === 204) return { ok: true, data: null }
  const json = await response.json().catch(() => null)
  if (!response.ok) return { ok: false, error: json?.message || json?.reason || `Zoom API failed (${response.status})`, data: json }
  return { ok: true, data: json }
}

async function createZoomMeeting(input: { topic: string; startTimeIso: string; durationMinutes: number; agenda?: string }) {
  const hostId = clean(process.env.ZOOM_HOST_USER_ID, 120)
  if (!hostId) return { ok: false, error: "Missing ZOOM_HOST_USER_ID" } satisfies ZoomResult
  return zoomApi("POST", `/users/${encodeURIComponent(hostId)}/meetings`, {
    topic: clean(input.topic, 200),
    type: 2,
    start_time: input.startTimeIso,
    duration: input.durationMinutes,
    timezone: SCHOOL_CALL_TIMEZONE,
    agenda: clean(input.agenda, 1500),
    settings: {
      join_before_host: false,
      waiting_room: true,
      approval_type: 2,
      mute_upon_entry: true,
      registrants_email_notification: false
    }
  })
}

async function updateZoomMeeting(meetingId: string, input: { topic: string; startTimeIso: string; durationMinutes: number }) {
  const id = clean(meetingId, 120)
  if (!id) return { ok: false, error: "meetingId is required" } satisfies ZoomResult
  return zoomApi("PATCH", `/meetings/${encodeURIComponent(id)}`, {
    topic: clean(input.topic, 200),
    start_time: input.startTimeIso,
    duration: input.durationMinutes,
    timezone: SCHOOL_CALL_TIMEZONE
  })
}

async function cancelZoomMeeting(meetingId: string) {
  const id = clean(meetingId, 120)
  if (!id) return { ok: true, data: null } satisfies ZoomResult
  return zoomApi("DELETE", `/meetings/${encodeURIComponent(id)}`)
}

export async function updateBuildCallOutcome(input: {
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
      AND lead_source_type = 'build'
    LIMIT 1
  `
}

export async function cancelBuildCall(input: { bookingUuid: string; note: string }) {
  const bookingUuid = clean(input.bookingUuid, 72)
  if (!bookingUuid) throw new Error("bookingUuid is required.")
  await ensureBuildServiceTables()
  const rows = await prisma.$queryRaw<Array<{ id: bigint; zoomMeetingId: string | null }>>`
    SELECT id, zoom_meeting_id AS zoomMeetingId
    FROM school_call_bookings_tochukwu
    WHERE booking_uuid = ${bookingUuid}
      AND lead_source_type = 'build'
    LIMIT 1
  `
  const booking = rows[0]
  if (!booking) throw new Error("Build call booking not found.")
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

export async function rescheduleBuildCall(input: { bookingUuid: string; slotStartIso: string; note: string }) {
  const bookingUuid = clean(input.bookingUuid, 72)
  const start = new Date(input.slotStartIso)
  if (!bookingUuid) throw new Error("bookingUuid is required.")
  if (!Number.isFinite(start.getTime())) throw new Error("Invalid slot.")
  await ensureBuildServiceTables()
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT id, school_name AS schoolName, zoom_meeting_id AS zoomMeetingId
    FROM school_call_bookings_tochukwu
    WHERE booking_uuid = ${bookingUuid}
      AND lead_source_type = 'build'
    LIMIT 1
  `
  const booking = rows[0]
  if (!booking) throw new Error("Build call booking not found.")
  const end = new Date(start.getTime() + 30 * 60 * 1000)
  const topic = `Build Discovery Call - ${clean(booking.schoolName, 220) || "Build lead"}`
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

function firstName(fullName: string) {
  return clean(fullName, 180).split(/\s+/).filter(Boolean)[0] || "there"
}

function notificationRecipients() {
  const configured = clean(process.env.SCHOOL_NOTIFICATION_EMAILS || process.env.SCHOOL_ALERT_EMAILS || process.env.SCHOOL_CALL_ALERT_EMAILS, 5000)
  const raw = configured || "support@tochukwunkwocha.com,partnerships@tochukwunkwocha.com"
  return Array.from(new Set(raw.split(",").map((item) => normalizeEmail(item)).filter(Boolean)))
}

async function sendBuildCallEmails(input: { fullName: string; businessName: string; workEmail: string; phone: string; role: string; slotIso: string; zoomJoinUrl: string }) {
  const slotHuman = slotLabel(input.slotIso)
  const userText = [
    `Hello ${firstName(input.fullName)},`,
    "",
    "Your Build discovery call has been booked successfully.",
    `Business: ${input.businessName}`,
    `Time: ${slotHuman} (WAT)`,
    input.zoomJoinUrl ? `Zoom link: ${input.zoomJoinUrl}` : ""
  ].filter(Boolean).join("\n")
  await sendEmail({
    to: input.workEmail,
    subject: "Your Build Discovery Call is Booked",
    text: userText,
    html: userText.replace(/\n/g, "<br/>")
  }).catch(() => null)

  const adminText = [
    "New Build discovery call booking",
    `Name: ${input.fullName}`,
    `Business: ${input.businessName}`,
    `Email: ${input.workEmail}`,
    `Phone: ${input.phone}`,
    `Role: ${input.role}`,
    `Time: ${slotHuman} (WAT)`,
    input.zoomJoinUrl ? `Zoom join link: ${input.zoomJoinUrl}` : ""
  ].filter(Boolean).join("\n")
  await Promise.all(notificationRecipients().map((to) => sendEmail({
    to,
    subject: `Build Discovery Call Booked - ${input.businessName}`,
    text: adminText,
    html: adminText.replace(/\n/g, "<br/>")
  }).catch(() => null)))
}

export async function bookBuildCallFromLead(input: { leadUuid: string; slotStartIso: string }) {
  const leadUuid = clean(input.leadUuid, 64)
  const start = new Date(input.slotStartIso)
  if (!leadUuid) throw new Error("leadUuid is required.")
  if (!Number.isFinite(start.getTime())) throw new Error("Invalid slot.")
  if (start.getTime() <= Date.now() + 60 * 60 * 1000) throw new Error("This slot is no longer available.")
  await ensureBuildServiceTables()
  const leads = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT lead_uuid, full_name, business_name, work_email, phone, role_title, company_size, source_path
    FROM tochukwu_build_scorecard_leads
    WHERE lead_uuid = ${leadUuid}
    LIMIT 1
  `
  const lead = leads[0]
  if (!lead) throw new Error("Build scorecard lead not found.")
  const workEmail = normalizeEmail(lead.work_email)
  if (!clean(lead.full_name, 180) || !clean(lead.business_name, 220) || !workEmail) throw new Error("Lead contact details are incomplete.")
  const active = await prisma.$queryRaw<Array<{ bookingUuid: string }>>`
    SELECT booking_uuid AS bookingUuid
    FROM school_call_bookings_tochukwu
    WHERE lead_source_type = 'build'
      AND (source_lead_uuid = ${leadUuid} OR work_email = ${workEmail})
      AND status IN ('booked', 'rescheduled')
    LIMIT 1
  `
  if (active.length) throw new Error("This lead already has an active Build call booking.")
  const end = new Date(start.getTime() + 30 * 60 * 1000)
  const bookingUuid = `build_call_${randomUUID()}`
  const manageToken = `${randomUUID()}${randomUUID().replace(/-/g, "")}`
  const topic = `Build Discovery Call - ${clean(lead.business_name, 220)}`
  const zoom = await createZoomMeeting({
    topic,
    startTimeIso: start.toISOString(),
    durationMinutes: 30,
    agenda: `Build discovery call with ${clean(lead.full_name, 180)} from ${clean(lead.business_name, 220)}`
  })
  if (!zoom.ok || !zoom.data) throw new Error(zoom.error || "Could not create Zoom meeting.")
  await prisma.$executeRaw`
    INSERT INTO school_call_bookings_tochukwu
      (booking_uuid, manage_token, full_name, school_name, work_email, phone, role_title, student_population,
       lead_source_type, lead_source_path, source_lead_uuid, timezone_label, slot_start_utc, slot_end_utc,
       duration_minutes, status, zoom_meeting_id, zoom_join_url, zoom_start_url, created_at, updated_at)
    VALUES
      (${bookingUuid}, ${manageToken}, ${clean(lead.full_name, 180)}, ${clean(lead.business_name, 220)}, ${workEmail},
       ${clean(lead.phone, 80) || null}, ${clean(lead.role_title, 140) || null}, ${clean(lead.company_size, 80) || null},
       'build', ${clean(lead.source_path, 255) || "/build"}, ${leadUuid}, ${SCHOOL_CALL_TIMEZONE},
       ${sqlFromIso(start.toISOString())}, ${sqlFromIso(end.toISOString())}, 30, 'booked',
       ${clean(zoom.data.id, 120) || null}, ${clean(zoom.data.join_url, 1200) || null}, ${clean(zoom.data.start_url, 1200) || null},
       UTC_TIMESTAMP(), UTC_TIMESTAMP())
  `
  await sendBuildCallEmails({
    fullName: clean(lead.full_name, 180),
    businessName: clean(lead.business_name, 220),
    workEmail,
    phone: clean(lead.phone, 80),
    role: clean(lead.role_title, 140),
    slotIso: start.toISOString(),
    zoomJoinUrl: clean(zoom.data.join_url, 1200)
  })
}

export async function sendBuildDiscoveryPaymentLink(input: { leadUuid: string; actor: string; country: string; provider: string }) {
  const leadUuid = clean(input.leadUuid, 64)
  if (!leadUuid) throw new Error("leadUuid is required.")
  await ensureBuildServiceTables()
  const leads = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT lead_uuid, full_name, business_name, work_email, score, band_key, follow_up_required, discovery_payment_approved_at
    FROM tochukwu_build_scorecard_leads
    WHERE lead_uuid = ${leadUuid}
    LIMIT 1
  `
  const lead = leads[0]
  if (!lead) throw new Error("Build scorecard lead not found.")
  if (clean(lead.band_key, 40) !== "manual_review" && Number(lead.follow_up_required || 0) !== 1) {
    throw new Error("Payment-link approval is only available for manual-review submissions.")
  }
  const hasCall = await prisma.$queryRaw<Array<{ id: bigint }>>`
    SELECT id
    FROM school_call_bookings_tochukwu
    WHERE lead_source_type = 'build'
      AND (source_lead_uuid = ${leadUuid} OR work_email = ${normalizeEmail(lead.work_email)})
    LIMIT 1
  `
  if (hasCall.length) throw new Error("This lead already has a linked call.")
  await prisma.$executeRaw`
    UPDATE tochukwu_build_scorecard_leads
    SET discovery_payment_approved_at = COALESCE(discovery_payment_approved_at, UTC_TIMESTAMP()),
        discovery_payment_approved_by = COALESCE(discovery_payment_approved_by, ${clean(input.actor, 180) || "admin"}),
        updated_at = UTC_TIMESTAMP()
    WHERE lead_uuid = ${leadUuid}
    LIMIT 1
  `
  const latestRows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT payment_uuid, payment_reference, payment_status, checkout_url
    FROM tochukwu_build_discovery_payments
    WHERE lead_uuid = ${leadUuid}
    ORDER BY id DESC
    LIMIT 1
  `
  const latest = latestRows[0]
  if (clean(latest?.payment_status, 40).toLowerCase() === "paid") throw new Error("Discovery payment has already been completed.")
  const checkoutUrl = `${siteBaseUrl()}/checkout/build-discovery?lead=${encodeURIComponent(leadUuid)}`
  const pricing = await serviceCheckoutPricing({ slug: "build-discovery", country: clean(input.country, 80) || "NG" })
  const text = [
    `Hello ${firstName(clean(lead.full_name, 180))},`,
    "",
    "Your Build application has been reviewed and approved to proceed to a paid discovery call.",
    `Pay here: ${checkoutUrl}`,
    "",
    "After successful payment, you will be redirected to select an available call slot."
  ].join("\n")
  await sendEmail({
    to: normalizeEmail(lead.work_email),
    subject: "Complete Your Build Discovery Call Payment",
    text,
    html: text.replace(/\n/g, "<br/>")
  })
  await prisma.$executeRaw`
    UPDATE tochukwu_build_scorecard_leads
    SET discovery_payment_link_sent_at = UTC_TIMESTAMP(),
        updated_at = UTC_TIMESTAMP()
    WHERE lead_uuid = ${leadUuid}
    LIMIT 1
  `
  return { checkoutUrl, reference: clean(latest?.payment_reference, 120), provider: pricing.provider }
}

export async function resendRecentBuildCallNotifications(input: { lookbackHours: number }) {
  await ensureBuildServiceTables()
  const lookbackHours = Math.max(1, Math.min(24 * 30, Math.round(Number(input.lookbackHours || 72))))
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT booking_uuid, full_name, school_name, work_email, phone, role_title, slot_start_utc, zoom_join_url
    FROM school_call_bookings_tochukwu
    WHERE lead_source_type = 'build'
      AND status IN ('booked', 'rescheduled')
      AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${lookbackHours} HOUR)
    ORDER BY created_at DESC, id DESC
    LIMIT 120
  `
  let leadSent = 0
  let adminSent = 0
  for (const row of rows) {
    await sendBuildCallEmails({
      fullName: clean(row.full_name, 180),
      businessName: clean(row.school_name, 220),
      workEmail: normalizeEmail(row.work_email),
      phone: clean(row.phone, 80),
      role: clean(row.role_title, 140),
      slotIso: isoFromValue(row.slot_start_utc),
      zoomJoinUrl: clean(row.zoom_join_url, 1200)
    })
    leadSent += 1
    adminSent += notificationRecipients().length
  }
  return { scanned: rows.length, leadSent, adminSent }
}
