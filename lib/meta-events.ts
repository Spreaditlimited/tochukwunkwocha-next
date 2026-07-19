import crypto from "crypto"

import { getMetaCapiConfig } from "@/lib/meta-capi-config"
import { prisma } from "@/lib/prisma"
import { addColumnIfMissing } from "@/lib/schema-guards"

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function toInt(value: unknown, fallback = 0) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? Math.round(numberValue) : fallback
}

function normalizeEmail(value: unknown) {
  const email = clean(value, 320).toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ""
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex")
}

function splitName(value: unknown) {
  const parts = clean(value, 180).replace(/\s+/g, " ").split(" ").filter(Boolean)
  return {
    firstName: parts[0] || "",
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : ""
  }
}

function normalizePhoneForMeta(value: unknown, country?: unknown) {
  let digits = clean(value, 80).replace(/\D/g, "")
  if (!digits) return ""
  const countryText = clean(country, 80).toLowerCase()
  if ((countryText === "ng" || countryText === "nga" || countryText === "nigeria") && digits.startsWith("0")) {
    digits = `234${digits.slice(1)}`
  }
  return digits
}

function normalizeCountryForMeta(value: unknown) {
  const country = clean(value, 80).toLowerCase()
  if (!country) return ""
  const map: Record<string, string> = {
    nigeria: "ng",
    ng: "ng",
    nga: "ng",
    "united kingdom": "gb",
    uk: "gb",
    gb: "gb",
    england: "gb",
    scotland: "gb",
    wales: "gb",
    "united states": "us",
    "united states of america": "us",
    usa: "us",
    us: "us",
    canada: "ca",
    ca: "ca",
    ghana: "gh",
    gh: "gh",
    kenya: "ke",
    ke: "ke",
    "south africa": "za",
    za: "za"
  }
  if (map[country]) return map[country]
  return /^[a-z]{2}$/.test(country) ? country : ""
}

function fbcFromFbclid(value: unknown) {
  const fbclid = clean(value, 2000)
  if (!fbclid) return ""
  return `fb.1.${Date.now()}.${fbclid}`
}

function metaUserData(input: {
  email?: unknown
  fullName?: unknown
  firstName?: unknown
  lastName?: unknown
  phone?: unknown
  country?: unknown
  fbp?: unknown
  fbc?: unknown
  fbclid?: unknown
  externalId?: unknown
  clientIp?: unknown
  userAgent?: unknown
}) {
  const email = normalizeEmail(input.email)
  const split = splitName(input.fullName || input.firstName)
  const firstName = clean(input.firstName, 120) || split.firstName
  const lastName = clean(input.lastName, 120) || split.lastName
  const phone = normalizePhoneForMeta(input.phone, input.country)
  const country = normalizeCountryForMeta(input.country)
  const fbc = clean(input.fbc, 300) || fbcFromFbclid(input.fbclid)
  const externalId = clean(input.externalId, 190)

  return {
    em: email ? [sha256(email)] : undefined,
    ph: phone ? [sha256(phone)] : undefined,
    fn: firstName ? [sha256(firstName)] : undefined,
    ln: lastName ? [sha256(lastName)] : undefined,
    country: country ? [sha256(country)] : undefined,
    external_id: externalId ? [sha256(externalId)] : undefined,
    fbp: clean(input.fbp, 300) || undefined,
    fbc: fbc || undefined,
    client_ip_address: clean(input.clientIp, 80) || undefined,
    client_user_agent: clean(input.userAgent, 500) || undefined
  }
}

async function ensureCourseOrderMetaColumns() {
  await addColumnIfMissing("course_orders", "meta_purchase_sent", "TINYINT(1) NOT NULL DEFAULT 0")
  await addColumnIfMissing("course_orders", "meta_purchase_sent_at", "DATETIME NULL")
  await addColumnIfMissing("course_orders", "meta_purchase_event_id", "VARCHAR(190) NULL")
  await addColumnIfMissing("course_orders", "fbclid", "TEXT NULL")
  await addColumnIfMissing("course_orders", "client_ip", "VARCHAR(80) NULL")
  await addColumnIfMissing("course_orders", "user_agent", "VARCHAR(500) NULL")
}

export async function sendCourseOrderMetaPurchase(input: {
  orderUuid: string
  eventSourceUrl?: string
  force?: boolean
}) {
  const { pixelId, accessToken, apiVersion } = await getMetaCapiConfig()
  if (!pixelId || !accessToken) return { skipped: true, reason: "not_configured" }

  await ensureCourseOrderMetaColumns()

  const orderUuid = clean(input.orderUuid, 80)
  const rows = await prisma.$queryRaw<
    Array<{
      orderUuid: string
      courseSlug: string | null
      firstName: string | null
      email: string | null
      phone: string | null
      country: string | null
      currency: string | null
      finalAmountMinor: number | bigint | null
      amountMinor: number | bigint | null
      status: string | null
      buyerType: string | null
      seatCount: number | bigint | null
      fbp: string | null
      fbc: string | null
      fbclid: string | null
      clientIp: string | null
      userAgent: string | null
      metaPurchaseSent: number | bigint | boolean | null
      metaPurchaseEventId: string | null
    }>
  >`
    SELECT order_uuid AS orderUuid, course_slug AS courseSlug, first_name AS firstName, email, phone, country,
           currency, final_amount_minor AS finalAmountMinor, amount_minor AS amountMinor, status, buyer_type AS buyerType,
           seat_count AS seatCount, fbp, fbc, fbclid, client_ip AS clientIp, user_agent AS userAgent,
           meta_purchase_sent AS metaPurchaseSent, meta_purchase_event_id AS metaPurchaseEventId
    FROM course_orders
    WHERE order_uuid = ${orderUuid}
    LIMIT 1
  `
  const order = rows[0]
  if (!order) return { skipped: true, reason: "missing_order" }
  if (clean(order.status, 40).toLowerCase() !== "paid") return { skipped: true, reason: "not_paid" }
  if (!input.force && Boolean(Number(order.metaPurchaseSent || 0))) {
    return { skipped: true, reason: "already_sent", eventId: clean(order.metaPurchaseEventId, 190) }
  }

  const eventId = clean(order.metaPurchaseEventId, 190) || `course_purchase_${orderUuid}`
  const currency = clean(order.currency, 10).toUpperCase() || "NGN"
  const valueMinor = toInt(order.finalAmountMinor || order.amountMinor)
  const courseSlug = clean(order.courseSlug, 120) || "course"

  const body = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: "website",
        event_source_url: clean(input.eventSourceUrl, 1200) || process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_BASE_URL || "http://localhost:3000",
        user_data: metaUserData({
          email: order.email,
          fullName: order.firstName,
          phone: order.phone,
          country: order.country,
          fbp: order.fbp,
          fbc: order.fbc,
          fbclid: order.fbclid,
          externalId: orderUuid,
          clientIp: order.clientIp,
          userAgent: order.userAgent
        }),
        custom_data: {
          currency,
          value: valueMinor / 100,
          content_name: courseSlug,
          content_ids: [courseSlug],
          content_type: "product",
          num_items: Math.max(1, toInt(order.seatCount, 1)),
          order_id: orderUuid
        }
      }
    ]
  }

  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${encodeURIComponent(pixelId)}/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store"
  })
  const json = await response.json().catch(() => null)
  if (!response.ok || json?.error) {
    throw new Error(json?.error?.message || `Meta CAPI failed (${response.status})`)
  }

  await prisma.$executeRaw`
    UPDATE course_orders
    SET meta_purchase_sent = 1,
        meta_purchase_sent_at = ${new Date()},
        meta_purchase_event_id = ${eventId},
        updated_at = ${new Date()}
    WHERE order_uuid = ${orderUuid}
    LIMIT 1
  `

  return { skipped: false, eventId }
}

export async function sendMetaLeadEvent(input: {
  eventId: string
  email: string
  firstName?: string
  lastName?: string
  phone?: string
  country?: string
  eventSourceUrl?: string
  fbp?: string
  fbc?: string
  fbclid?: string
  externalId?: string
  clientIp?: string
  userAgent?: string
  contentName?: string
  contentCategory?: string
}) {
  const { pixelId, accessToken, apiVersion } = await getMetaCapiConfig()
  if (!pixelId || !accessToken) return { skipped: true, reason: "not_configured" }

  const email = normalizeEmail(input.email)
  const eventId = clean(input.eventId, 190)
  if (!email || !eventId) return { skipped: true, reason: "missing_identity" }

  const body = {
    data: [
      {
        event_name: "Lead",
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: "website",
        event_source_url: clean(input.eventSourceUrl, 1200) || process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_BASE_URL || "http://localhost:3000",
        user_data: metaUserData({
          email,
          fullName: input.firstName,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          country: input.country,
          fbp: input.fbp,
          fbc: input.fbc,
          fbclid: input.fbclid,
          externalId: input.externalId || email,
          clientIp: input.clientIp,
          userAgent: input.userAgent
        }),
        custom_data: {
          content_name: clean(input.contentName, 255) || "Website Lead",
          content_category: clean(input.contentCategory, 80) || "site"
        }
      }
    ]
  }

  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${encodeURIComponent(pixelId)}/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store"
  })
  const json = await response.json().catch(() => null)
  if (!response.ok || json?.error) {
    throw new Error(json?.error?.message || `Meta CAPI failed (${response.status})`)
  }

  return { skipped: false, eventId }
}
