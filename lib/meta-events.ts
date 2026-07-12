import crypto from "crypto"

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

async function ensureCourseOrderMetaColumns() {
  await addColumnIfMissing("course_orders", "meta_purchase_sent", "TINYINT(1) NOT NULL DEFAULT 0")
  await addColumnIfMissing("course_orders", "meta_purchase_sent_at", "DATETIME NULL")
  await addColumnIfMissing("course_orders", "meta_purchase_event_id", "VARCHAR(190) NULL")
}

export async function sendCourseOrderMetaPurchase(input: {
  orderUuid: string
  eventSourceUrl?: string
  force?: boolean
}) {
  const pixelId = clean(process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID, 120)
  const accessToken = clean(process.env.META_PIXEL_ACCESS_TOKEN, 1000)
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
      metaPurchaseSent: number | bigint | boolean | null
      metaPurchaseEventId: string | null
    }>
  >`
    SELECT order_uuid AS orderUuid, course_slug AS courseSlug, first_name AS firstName, email, phone, country,
           currency, final_amount_minor AS finalAmountMinor, amount_minor AS amountMinor, status, buyer_type AS buyerType,
           seat_count AS seatCount, fbp, fbc, meta_purchase_sent AS metaPurchaseSent, meta_purchase_event_id AS metaPurchaseEventId
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
  const email = normalizeEmail(order.email)
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
        user_data: {
          em: email ? [sha256(email)] : undefined,
          ph: clean(order.phone, 80) ? [sha256(clean(order.phone, 80).replace(/\D/g, ""))] : undefined,
          fn: clean(order.firstName, 120) ? [sha256(clean(order.firstName, 120))] : undefined,
          country: clean(order.country, 80) ? [sha256(clean(order.country, 80))] : undefined,
          fbp: clean(order.fbp, 300) || undefined,
          fbc: clean(order.fbc, 300) || undefined
        },
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

  const response = await fetch(`https://graph.facebook.com/v20.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(accessToken)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
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
  eventSourceUrl?: string
  fbp?: string
  fbc?: string
  contentName?: string
  contentCategory?: string
}) {
  const pixelId = clean(process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID, 120)
  const accessToken = clean(process.env.META_PIXEL_ACCESS_TOKEN, 1000)
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
        user_data: {
          em: [sha256(email)],
          fn: clean(input.firstName, 120) ? [sha256(clean(input.firstName, 120))] : undefined,
          fbp: clean(input.fbp, 300) || undefined,
          fbc: clean(input.fbc, 300) || undefined
        },
        custom_data: {
          content_name: clean(input.contentName, 255) || "Website Lead",
          content_category: clean(input.contentCategory, 80) || "site"
        }
      }
    ]
  }

  const response = await fetch(`https://graph.facebook.com/v20.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(accessToken)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  })
  const json = await response.json().catch(() => null)
  if (!response.ok || json?.error) {
    throw new Error(json?.error?.message || `Meta CAPI failed (${response.status})`)
  }

  return { skipped: false, eventId }
}
