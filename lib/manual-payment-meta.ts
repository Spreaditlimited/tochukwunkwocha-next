import crypto from "crypto"

import { normalizeEmail, siteBaseUrl } from "@/lib/payments/course-checkout"
import { prisma } from "@/lib/prisma"
import { addColumnIfMissing } from "@/lib/schema-guards"

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function toInt(value: unknown, fallback = 0) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? Math.round(numberValue) : fallback
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex")
}

function normalizeMetaPhone(value: unknown, country?: unknown) {
  let digits = clean(value, 80).replace(/\D/g, "")
  if (!digits) return ""
  const countryText = clean(country, 80).toLowerCase()
  if ((countryText === "ng" || countryText === "nga" || countryText === "nigeria") && digits.startsWith("0")) digits = `234${digits.slice(1)}`
  return digits
}

function normalizeMetaCountry(value: unknown) {
  const country = clean(value, 80).toLowerCase()
  if (country === "nigeria" || country === "nga" || country === "ng") return "ng"
  if (country === "united kingdom" || country === "uk" || country === "gb") return "gb"
  if (country === "united states" || country === "united states of america" || country === "usa" || country === "us") return "us"
  return /^[a-z]{2}$/.test(country) ? country : ""
}

function metaFbcFromFbclid(value: unknown) {
  const fbclid = clean(value, 2000)
  return fbclid ? `fb.1.${Date.now()}.${fbclid}` : ""
}

export async function sendManualPaymentMetaPurchase(input: {
  paymentUuid: string
  fbp?: string
  fbc?: string
  fbclid?: string
  eventSourceUrl?: string
}) {
  const pixelId = clean(process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID, 120)
  const accessToken = clean(process.env.META_PIXEL_ACCESS_TOKEN, 1000)
  if (!pixelId || !accessToken) throw new Error("Meta Pixel settings are not configured.")
  await addColumnIfMissing("course_manual_payments", "fbp", "VARCHAR(190) NULL")
  await addColumnIfMissing("course_manual_payments", "fbc", "VARCHAR(190) NULL")
  await addColumnIfMissing("course_manual_payments", "fbclid", "TEXT NULL")
  await addColumnIfMissing("course_manual_payments", "client_ip", "VARCHAR(80) NULL")
  await addColumnIfMissing("course_manual_payments", "user_agent", "VARCHAR(500) NULL")
  const paymentUuid = clean(input.paymentUuid, 80)
  const rows = await prisma.$queryRaw<Array<{
    courseSlug: string | null
    firstName: string | null
    email: string | null
    phone: string | null
    country: string | null
    amountMinor: number | bigint | null
    currency: string | null
    status: string | null
    fbp: string | null
    fbc: string | null
    fbclid: string | null
    clientIp: string | null
    userAgent: string | null
  }>>`
    SELECT course_slug AS courseSlug, first_name AS firstName, email, phone, country, amount_minor AS amountMinor,
           currency, status, fbp, fbc, fbclid, client_ip AS clientIp, user_agent AS userAgent
    FROM course_manual_payments
    WHERE payment_uuid = ${paymentUuid}
    LIMIT 1
  `
  const payment = rows[0]
  if (!payment) throw new Error("Manual payment not found.")
  if (clean(payment.status, 40).toLowerCase() !== "approved") throw new Error("Only approved manual payments can send Meta purchase events.")

  const eventId = `ptp_manual_${paymentUuid}_${Date.now()}`
  const phone = normalizeMetaPhone(payment.phone, payment.country)
  const country = normalizeMetaCountry(payment.country)
  const fbc = clean(input.fbc, 300) || clean(payment.fbc, 300) || metaFbcFromFbclid(input.fbclid || payment.fbclid)
  const body = {
    data: [{
      event_name: "Purchase",
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: "website",
      event_source_url: clean(input.eventSourceUrl, 1200) || siteBaseUrl(),
      user_data: {
        em: normalizeEmail(payment.email) ? [sha256(normalizeEmail(payment.email))] : undefined,
        ph: phone ? [sha256(phone)] : undefined,
        fn: clean(payment.firstName, 120) ? [sha256(clean(payment.firstName, 120))] : undefined,
        country: country ? [sha256(country)] : undefined,
        external_id: paymentUuid ? [sha256(paymentUuid)] : undefined,
        fbp: clean(input.fbp, 300) || clean(payment.fbp, 300) || undefined,
        fbc: fbc || undefined,
        client_ip_address: clean(payment.clientIp, 80) || undefined,
        client_user_agent: clean(payment.userAgent, 500) || undefined
      },
      custom_data: {
        currency: clean(payment.currency, 10).toUpperCase() || "NGN",
        value: toInt(payment.amountMinor) / 100,
        content_name: clean(payment.courseSlug, 120) || "Course",
        content_ids: [clean(payment.courseSlug, 120) || "course"],
        content_type: "product",
        order_id: paymentUuid
      }
    }]
  }

  const response = await fetch(`https://graph.facebook.com/v20.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(accessToken)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  })
  const json = await response.json().catch(() => null)
  if (!response.ok || json?.error) throw new Error(json?.error?.message || `Meta CAPI failed (${response.status})`)

  await prisma.$executeRaw`
    UPDATE course_manual_payments
    SET meta_purchase_sent = 1,
        meta_purchase_sent_at = ${new Date()},
        updated_at = ${new Date()}
    WHERE payment_uuid = ${paymentUuid}
    LIMIT 1
  `
  return { eventId }
}
