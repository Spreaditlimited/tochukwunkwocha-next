import crypto from "crypto"
import { NextResponse } from "next/server"

import { sendCourseOrderMetaPurchase } from "@/lib/meta-events"
import { reportPaymentProviderIssue } from "@/lib/payment-provider-alerts"
import { completePaidDomainCheckout } from "@/lib/payments/domain-checkout"
import { createAffiliateCommissionForOrder, markCourseOrderPaid, markInstallmentPaymentPaid } from "@/lib/payments/course-checkout"
import { recordPaystackAuditEvent, validateCourseOrderPaystackPayment } from "@/lib/payments/paystack-audit"
import { provisionStudentForPaidOrder } from "@/lib/payments/post-payment-student"
import { fulfillPaidShopOrder, SHOP_PAYMENT_SCOPE } from "@/lib/shop"
import { isCourseEnrollmentConflict } from "@/lib/enrollment-guard"

export const dynamic = "force-dynamic"

function timingSafeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const secret = process.env.PAYSTACK_SECRET_KEY
  const signature = request.headers.get("x-paystack-signature") || ""
  if (!secret) {
    await reportPaymentProviderIssue({ provider: "paystack", operation: "webhook processing", summary: "PAYSTACK_SECRET_KEY is missing.", errorCode: "missing_secret_key" })
    return NextResponse.json({ ok: false, error: "Webhook processing is unavailable." }, { status: 503 })
  }
  if (!signature) return NextResponse.json({ ok: false, error: "Missing webhook signature." }, { status: 401 })
  const expected = crypto.createHmac("sha512", secret).update(rawBody).digest("hex")
  if (!timingSafeEqual(signature, expected)) return NextResponse.json({ ok: false, error: "Invalid webhook signature." }, { status: 401 })

  const payload = JSON.parse(rawBody || "{}")
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
    outcome: event === "charge.success" ? "received" : "ignored",
    providerStatus: data.status ? String(data.status) : null,
    receivedAmountMinor: Number.isFinite(Number(data.amount)) ? Number(data.amount) : null,
    receivedCurrency: data.currency ? String(data.currency) : null
  })
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
  if (paymentScope === "installment" || metadata.installment_plan_uuid) {
    try {
      await markInstallmentPaymentPaid(reference, data.id ? String(data.id) : null)
    } catch (error) {
      if (isCourseEnrollmentConflict(error)) {
        return NextResponse.json({ ok: true, scope: "installment", duplicateReview: true })
      }
      throw error
    }
    return NextResponse.json({ ok: true, scope: "installment" })
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
