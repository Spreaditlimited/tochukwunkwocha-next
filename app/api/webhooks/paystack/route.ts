import crypto from "crypto"
import { NextResponse } from "next/server"

import { sendCourseOrderMetaPurchase } from "@/lib/meta-events"
import { reportPaymentProviderIssue } from "@/lib/payment-provider-alerts"
import { sendEmail } from "@/lib/email"
import { issueBuildBookingAccess, issuePrivateCoachingBookingAccess, markBuildDiscoveryPaymentPaid, markPrivateCoachingPaymentPaid } from "@/lib/discovery-booking-access"
import { completePaidDomainCheckout } from "@/lib/payments/domain-checkout"
import { completePaidDomainRenewal } from "@/lib/payments/domain-renewal"
import { createAffiliateCommissionForOrder, markCourseOrderPaid, markInstallmentPaymentPaid, siteBaseUrl } from "@/lib/payments/course-checkout"
import { recordPaystackAuditEvent, validateCourseOrderPaystackPayment } from "@/lib/payments/paystack-audit"
import { provisionStudentForPaidOrder } from "@/lib/payments/post-payment-student"
import { confirmPaystackSchoolAdvanced } from "@/lib/payments/school-advanced"
import { fulfillPaidShopOrder, SHOP_PAYMENT_SCOPE } from "@/lib/shop"
import { isCourseEnrollmentConflict } from "@/lib/enrollment-guard"
import { reconcileAffiliatePayoutWebhook } from "@/lib/admin-affiliates"

export const dynamic = "force-dynamic"

function timingSafeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

type PaystackWebhookPayload = {
  event?: unknown
  data?: {
    reference?: unknown
    metadata?: Record<string, unknown>
    id?: unknown
    status?: unknown
    amount?: unknown
    currency?: unknown
    transfer_code?: unknown
    domain?: unknown
    message?: unknown
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const secret = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET
  const signature = request.headers.get("x-paystack-signature") || ""
  if (!secret) {
    await reportPaymentProviderIssue({ provider: "paystack", operation: "webhook processing", summary: "PAYSTACK_SECRET_KEY is missing.", errorCode: "missing_secret_key" })
    return NextResponse.json({ ok: false, error: "Webhook processing is unavailable." }, { status: 503 })
  }
  if (!signature) return NextResponse.json({ ok: false, error: "Missing webhook signature." }, { status: 401 })
  const expected = crypto.createHmac("sha512", secret).update(rawBody).digest("hex")
  if (!timingSafeEqual(signature, expected)) return NextResponse.json({ ok: false, error: "Invalid webhook signature." }, { status: 401 })

  let payload: PaystackWebhookPayload
  try {
    payload = JSON.parse(rawBody || "{}") as PaystackWebhookPayload
  } catch {
    return NextResponse.json({ ok: false, error: "Malformed webhook payload." }, { status: 400 })
  }
  const event = String(payload?.event || "").toLowerCase()
  const data = payload?.data || {}
  const reference = String(data.reference || "").trim()
  const metadata = data.metadata || {}
  const metadataOrderUuid = String(metadata.order_uuid || metadata.orderUuid || "").trim()
  await recordPaystackAuditEvent({
    orderUuid: metadataOrderUuid || null,
    providerReference: reference || null,
    providerEventId: data.id ? String(data.id) : null,
    source: "webhook",
    eventType: event || "unknown",
    outcome: event === "charge.success" || event.startsWith("transfer.") ? "received" : "ignored",
    providerStatus: data.status ? String(data.status) : null,
    receivedAmountMinor: Number.isFinite(Number(data.amount)) ? Number(data.amount) : null,
    receivedCurrency: data.currency ? String(data.currency) : null
  })
  if (["transfer.success", "transfer.failed", "transfer.reversed"].includes(event)) {
    if (!reference) return NextResponse.json({ ok: true, ignored: true, reason: "missing_transfer_reference" })
    const result = await reconcileAffiliatePayoutWebhook({
      event,
      reference,
      transferId: data.id ? String(data.id) : "",
      transferCode: data.transfer_code ? String(data.transfer_code) : "",
      status: data.status ? String(data.status) : "",
      domain: data.domain ? String(data.domain) : "",
      amountMinor: Number.isFinite(Number(data.amount)) ? Math.round(Number(data.amount)) : null,
      currency: data.currency ? String(data.currency) : "",
      message: data.message ? String(data.message) : ""
    })
    return NextResponse.json({ ok: true, scope: "affiliate_payout", result })
  }
  if (event !== "charge.success") return NextResponse.json({ ok: true, ignored: true })

  const paymentScope = String(metadata.payment_scope || "").toLowerCase()
  if (paymentScope === SHOP_PAYMENT_SCOPE) {
    const orderUuid = String(metadata.order_uuid || "").trim()
    if (!orderUuid) {
      return NextResponse.json({ ok: true, ignored: true, reason: "missing_shop_order_uuid" })
    }
    await fulfillPaidShopOrder({
      orderUuid,
      providerReference: reference,
      providerOrderId: data.id ? String(data.id) : null,
      paidAmountMinor: Number.isFinite(Number(data.amount)) ? Number(data.amount) : null,
      paidCurrency: data.currency ? String(data.currency) : null
    })
    return NextResponse.json({ ok: true, scope: SHOP_PAYMENT_SCOPE, orderUuid })
  }
  if (paymentScope === "domain_registration") {
    const result = await completePaidDomainCheckout(reference)
    return NextResponse.json({ ok: true, scope: "domain_registration", orderUuid: result.orderUuid })
  }
  if (paymentScope === "domain_renewal") {
    const result = await completePaidDomainRenewal(reference)
    return NextResponse.json({ ok: true, scope: "domain_renewal", domainName: result.domainName })
  }
  if (paymentScope === "school_advanced") {
    await confirmPaystackSchoolAdvanced(reference)
    return NextResponse.json({ ok: true, scope: "school_advanced" })
  }
  if (paymentScope === "build-discovery") {
    const payment = await markBuildDiscoveryPaymentPaid(reference, data.id ? String(data.id) : null, {
      amountMinor: Number.isFinite(Number(data.amount)) ? Math.round(Number(data.amount)) : null,
      currency: data.currency ? String(data.currency) : null,
      leadUuid: String(metadata.lead_uuid || ""),
      provider: "paystack"
    })
    if (!payment.alreadyPaid) {
      const issued = await issueBuildBookingAccess({ leadUuid: payment.leadUuid, score: payment.score, discoveryApproved: true })
      const bookingUrl = `${siteBaseUrl()}/schools/book-call?source=build&build_access=${encodeURIComponent(issued.token)}&payment=success`
      await sendEmail({
        to: payment.email,
        subject: "Payment confirmed — book your build discovery call",
        text: `Hello ${payment.fullName || "there"},\n\nYour payment has been confirmed. Book your build discovery call here:\n${bookingUrl}\n\nThis secure link expires in 3 days.`
      })
    }
    return NextResponse.json({ ok: true, scope: "build-discovery" })
  }
  if (paymentScope === "private-ai-coaching-discovery") {
    const payment = await markPrivateCoachingPaymentPaid(reference, data.id ? String(data.id) : null, {
      amountMinor: Number.isFinite(Number(data.amount)) ? Math.round(Number(data.amount)) : null,
      currency: data.currency ? String(data.currency) : null,
      leadUuid: String(metadata.lead_uuid || ""),
      provider: "paystack"
    })
    if (!payment.alreadyPaid && payment.paymentType === "discovery") {
      const issued = await issuePrivateCoachingBookingAccess(payment.leadUuid)
      const bookingUrl = `${siteBaseUrl()}/schools/book-call?source=private_ai_coaching&coaching_access=${encodeURIComponent(issued.token)}&payment=success`
      await sendEmail({
        to: payment.email,
        subject: "Payment confirmed — book your private AI coaching call",
        text: `Hello ${payment.fullName || "there"},\n\nYour payment has been confirmed. Book your private AI coaching discovery call here:\n${bookingUrl}\n\nThis secure link expires in 3 days.`
      })
    }
    return NextResponse.json({ ok: true, scope: "private-ai-coaching-discovery" })
  }
  if (paymentScope === "installment" || metadata.installment_plan_uuid) {
    try {
      await markInstallmentPaymentPaid(reference, data.id ? String(data.id) : null, {
        amountMinor: Number.isFinite(Number(data.amount)) ? Math.round(Number(data.amount)) : null,
        currency: data.currency ? String(data.currency) : null,
        planUuid: String(metadata.installment_plan_uuid || "")
      })
    } catch (error) {
      if (isCourseEnrollmentConflict(error)) {
        return NextResponse.json({ ok: true, scope: "installment", duplicateReview: true })
      }
      throw error
    }
    return NextResponse.json({ ok: true, scope: "installment" })
  }

  if (paymentScope && paymentScope !== "course_checkout") {
    return NextResponse.json({ ok: true, ignored: true, reason: "unknown_payment_scope" })
  }

  const orderUuid = metadataOrderUuid
  if (!orderUuid) {
    await recordPaystackAuditEvent({
      providerReference: reference || null,
      providerEventId: data.id ? String(data.id) : null,
      source: "webhook",
      eventType: event,
      outcome: "ignored",
      providerStatus: data.status ? String(data.status) : null,
      errorCode: "missing_order_uuid",
      errorMessage: "Paystack course webhook did not include an order UUID."
    })
    return NextResponse.json({ ok: true, ignored: true, reason: "missing_order_uuid" })
  }
  try {
    const receivedAmountMinor = Number.isFinite(Number(data.amount)) ? Math.round(Number(data.amount)) : null
    const receivedCurrency = data.currency ? String(data.currency) : null
    const validation = await validateCourseOrderPaystackPayment({
      orderUuid,
      providerReference: reference,
      receivedAmountMinor,
      receivedCurrency
    })
    if (!validation.ok) {
      await recordPaystackAuditEvent({
        orderUuid,
        providerReference: reference,
        providerEventId: data.id ? String(data.id) : null,
        source: "webhook",
        eventType: event,
        outcome: "mismatch",
        providerStatus: data.status ? String(data.status) : null,
        expectedAmountMinor: validation.expected?.expectedAmountMinor,
        receivedAmountMinor,
        expectedCurrency: validation.expected?.expectedCurrency,
        receivedCurrency,
        errorCode: validation.reason,
        errorMessage: "Paystack amount or currency did not match the course order."
      })
      return NextResponse.json({ ok: false, rejected: true, reason: validation.reason })
    }
    await recordPaystackAuditEvent({
      orderUuid,
      providerReference: reference,
      providerEventId: data.id ? String(data.id) : null,
      source: "webhook",
      eventType: event,
      outcome: "verified",
      providerStatus: data.status ? String(data.status) : "success",
      expectedAmountMinor: validation.expected.expectedAmountMinor,
      receivedAmountMinor,
      expectedCurrency: validation.expected.expectedCurrency,
      receivedCurrency
    })
    const order = await markCourseOrderPaid({
      orderUuid,
      providerReference: reference,
      providerOrderId: data.id ? String(data.id) : null
    })
    const provisioned = await provisionStudentForPaidOrder(order, { createSession: false })
    if (!provisioned?.account) throw new Error("The paid enrollment account could not be provisioned.")
    await createAffiliateCommissionForOrder(orderUuid).catch((error) => {
      console.error("[paystack-webhook] affiliate commission failed after enrollment provisioning", {
        orderUuid,
        error: error instanceof Error ? error.message : String(error)
      })
    })
    await recordPaystackAuditEvent({
      orderUuid,
      providerReference: reference,
      providerEventId: data.id ? String(data.id) : null,
      source: "webhook",
      eventType: "student.provision",
      outcome: "provisioned",
      providerStatus: "success"
    })
    await sendCourseOrderMetaPurchase({ orderUuid }).catch(() => null)
    return NextResponse.json({ ok: true, scope: "course_checkout", orderUuid })
  } catch (error) {
    await recordPaystackAuditEvent({
      orderUuid,
      providerReference: reference,
      providerEventId: data.id ? String(data.id) : null,
      source: "webhook",
      eventType: event,
      outcome: "failed",
      providerStatus: data.status ? String(data.status) : null,
      errorCode: "webhook_processing_failed",
      errorMessage: error instanceof Error ? error.message : String(error)
    })
    if (isCourseEnrollmentConflict(error)) {
      return NextResponse.json({ ok: true, scope: "course_checkout", orderUuid, duplicateReview: true })
    }
    throw error
  }
}
