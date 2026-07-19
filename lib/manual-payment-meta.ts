import crypto from "crypto"

import { getMetaCapiConfig } from "@/lib/meta-capi-config"
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
  const { pixelId, accessToken, apiVersion, pixelSource, tokenSource, versionSource } = await getMetaCapiConfig()
  if (!pixelId || !accessToken) throw new Error("Meta Pixel settings are not configured.")
  if (!/^\d+$/.test(pixelId)) throw new Error("The configured Meta Pixel/Dataset ID is invalid.")
  if (!/^v\d+\.\d+$/.test(apiVersion)) throw new Error("The configured Meta Graph API version is invalid.")
  await addColumnIfMissing("course_manual_payments", "fbp", "VARCHAR(190) NULL")
  await addColumnIfMissing("course_manual_payments", "fbc", "VARCHAR(190) NULL")
  await addColumnIfMissing("course_manual_payments", "fbclid", "TEXT NULL")
  await addColumnIfMissing("course_manual_payments", "client_ip", "VARCHAR(80) NULL")
  await addColumnIfMissing("course_manual_payments", "user_agent", "VARCHAR(500) NULL")
  await addColumnIfMissing("course_manual_payments", "meta_purchase_dispatch_status", "VARCHAR(24) NOT NULL DEFAULT 'pending'")
  await addColumnIfMissing("course_manual_payments", "meta_purchase_event_id", "VARCHAR(190) NULL")
  await addColumnIfMissing("course_manual_payments", "meta_purchase_attempt_count", "INT NOT NULL DEFAULT 0")
  await addColumnIfMissing("course_manual_payments", "meta_purchase_last_error", "VARCHAR(500) NULL")
  await addColumnIfMissing("course_manual_payments", "meta_purchase_trace_id", "VARCHAR(190) NULL")
  await addColumnIfMissing("course_manual_payments", "meta_purchase_dispatch_started_at", "DATETIME NULL")
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
    metaPurchaseSent: number | bigint | boolean | null
    metaPurchaseDispatchStatus: string | null
    metaPurchaseEventId: string | null
    metaPurchaseDispatchStartedAt: Date | null
    reviewedAt: Date | null
    createdAt: Date | null
  }>>`
    SELECT course_slug AS courseSlug, first_name AS firstName, email, phone, country, amount_minor AS amountMinor,
           currency, status, fbp, fbc, fbclid, client_ip AS clientIp, user_agent AS userAgent,
           COALESCE(meta_purchase_sent, 0) AS metaPurchaseSent,
           meta_purchase_dispatch_status AS metaPurchaseDispatchStatus,
           meta_purchase_event_id AS metaPurchaseEventId,
           meta_purchase_dispatch_started_at AS metaPurchaseDispatchStartedAt,
           reviewed_at AS reviewedAt,
           created_at AS createdAt
    FROM course_manual_payments
    WHERE payment_uuid = ${paymentUuid}
    LIMIT 1
  `
  const payment = rows[0]
  if (!payment) throw new Error("Manual payment not found.")
  if (clean(payment.status, 40).toLowerCase() !== "approved") throw new Error("Only approved manual payments can send Meta purchase events.")
  const eventId = clean(payment.metaPurchaseEventId, 190) || `ptp_manual_${paymentUuid}`
  if (Boolean(Number(payment.metaPurchaseSent || 0))) return { eventId, alreadySent: true }

  const staleBefore = new Date(Date.now() - 5 * 60 * 1000)
  const locked = await prisma.$executeRaw`
    UPDATE course_manual_payments
    SET meta_purchase_dispatch_status = 'sending',
        meta_purchase_event_id = ${eventId},
        meta_purchase_attempt_count = COALESCE(meta_purchase_attempt_count, 0) + 1,
        meta_purchase_last_error = NULL,
        meta_purchase_trace_id = NULL,
        meta_purchase_dispatch_started_at = ${new Date()},
        updated_at = ${new Date()}
    WHERE payment_uuid = ${paymentUuid}
      AND COALESCE(meta_purchase_sent, 0) = 0
      AND (
        COALESCE(meta_purchase_dispatch_status, 'pending') IN ('pending', 'failed')
        OR meta_purchase_dispatch_started_at IS NULL
        OR meta_purchase_dispatch_started_at < ${staleBefore}
      )
    LIMIT 1
  `
  if (Number(locked) !== 1) throw new Error("This Meta purchase event is already being dispatched. Refresh before retrying.")

  const phone = normalizeMetaPhone(payment.phone, payment.country)
  const country = normalizeMetaCountry(payment.country)
  const fbc = clean(input.fbc, 300) || clean(payment.fbc, 300) || metaFbcFromFbclid(input.fbclid || payment.fbclid)
  const body = {
    data: [{
      event_name: "Purchase",
      event_time: Math.floor((payment.reviewedAt || payment.createdAt || new Date()).getTime() / 1000),
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

  let response: Response
  let json: { events_received?: number; error?: { message?: string; code?: number; error_subcode?: number; fbtrace_id?: string; type?: string } } | null = null
  try {
    response = await fetch(`https://graph.facebook.com/${apiVersion}/${encodeURIComponent(pixelId)}/events`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000)
    })
    json = await response.json().catch(() => null)
    if (!response.ok || json?.error) {
      const providerError = json?.error
      const configurationFailure = response.status === 400 && /does not exist|missing permissions|unsupported post request/i.test(providerError?.message || "")
      const safeMessage = configurationFailure
        ? "Meta could not authorize this server request for the configured dataset. The event was not marked as sent and is safe to retry."
        : `Meta did not accept the purchase event${providerError?.code ? ` (code ${providerError.code})` : ""}.`
      throw Object.assign(new Error(safeMessage), { providerError, providerStatus: response.status })
    }
    if (Number(json?.events_received || 0) < 1) {
      throw Object.assign(new Error("Meta responded without accepting the purchase event. The event remains safe to retry."), { providerStatus: response.status })
    }
  } catch (error) {
    const providerError = (error as { providerError?: { message?: string; code?: number; error_subcode?: number; fbtrace_id?: string; type?: string } }).providerError
    const timedOut = error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")
    const safeMessage = error instanceof Error && !timedOut
      ? clean(error.message, 500)
      : "Meta did not respond before the dispatch timed out. Retry the same event safely."
    await prisma.$executeRaw`
      UPDATE course_manual_payments
      SET meta_purchase_dispatch_status = 'failed',
          meta_purchase_last_error = ${safeMessage},
          meta_purchase_trace_id = ${clean(providerError?.fbtrace_id, 190) || null},
          updated_at = ${new Date()}
      WHERE payment_uuid = ${paymentUuid}
      LIMIT 1
    `
    console.error("[manual-payment-meta] Purchase dispatch failed", {
      paymentUuid,
      pixelId,
      apiVersion,
      pixelSource,
      tokenSource,
      versionSource,
      status: (error as { providerStatus?: number }).providerStatus,
      code: providerError?.code,
      subcode: providerError?.error_subcode,
      type: providerError?.type,
      traceId: providerError?.fbtrace_id,
      providerMessage: providerError?.message
    })
    throw new Error(safeMessage)
  }

  await prisma.$executeRaw`
    UPDATE course_manual_payments
    SET meta_purchase_sent = 1,
        meta_purchase_sent_at = ${new Date()},
        meta_purchase_dispatch_status = 'sent',
        meta_purchase_last_error = NULL,
        meta_purchase_trace_id = NULL,
        updated_at = ${new Date()}
    WHERE payment_uuid = ${paymentUuid}
    LIMIT 1
  `
  return { eventId, alreadySent: false, eventsReceived: Number(json?.events_received || 0) }
}
