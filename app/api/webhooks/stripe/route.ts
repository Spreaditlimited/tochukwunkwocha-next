import crypto from "crypto"
import { NextResponse } from "next/server"

import { sendCourseOrderMetaPurchase } from "@/lib/meta-events"
import { reportPaymentProviderIssue } from "@/lib/payment-provider-alerts"
import { sendEmail } from "@/lib/email"
import { issueBuildBookingAccess, issuePrivateCoachingBookingAccess, markBuildDiscoveryPaymentPaid, markPrivateCoachingPaymentPaid } from "@/lib/discovery-booking-access"
import { completePaidDomainCheckout } from "@/lib/payments/domain-checkout"
import { createAffiliateCommissionForOrder, markCourseOrderPaid, markInstallmentPaymentPaid, siteBaseUrl } from "@/lib/payments/course-checkout"
import { provisionStudentForPaidOrder } from "@/lib/payments/post-payment-student"
import { confirmStripeSchoolAdvanced } from "@/lib/payments/school-advanced"
import { fulfillPaidShopOrder, SHOP_PAYMENT_SCOPE } from "@/lib/shop"
import { isCourseEnrollmentConflict } from "@/lib/enrollment-guard"

export const dynamic = "force-dynamic"

function parseStripeSignature(header: string) {
  return Object.fromEntries(
    header.split(",").map((part) => {
      const [key, ...rest] = part.split("=")
      return [key, rest.join("=")]
    })
  )
}

function verifyStripeSignature(rawBody: string, header: string, secret: string) {
  const parsed = parseStripeSignature(header)
  const timestamp = parsed.t
  const signature = parsed.v1
  if (!timestamp || !signature) return false
  const payload = `${timestamp}.${rawBody}`
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex")
  const left = Buffer.from(signature)
  const right = Buffer.from(expected)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get("stripe-signature") || ""
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    await reportPaymentProviderIssue({ provider: "stripe", operation: "webhook processing", summary: "STRIPE_WEBHOOK_SECRET is missing.", errorCode: "missing_webhook_secret" })
    return NextResponse.json({ ok: false, error: "Webhook processing is unavailable." }, { status: 503 })
  }
  if (!signature) return NextResponse.json({ ok: false, error: "Missing webhook signature." }, { status: 401 })
  if (!verifyStripeSignature(rawBody, signature, webhookSecret)) return NextResponse.json({ ok: false, error: "Invalid webhook signature." }, { status: 401 })

  const payload = JSON.parse(rawBody || "{}")
  if (String(payload?.type || "") !== "checkout.session.completed") return NextResponse.json({ ok: true, ignored: true })
  const session = payload.data?.object || {}
  if (String(session.payment_status || "").toLowerCase() !== "paid") return NextResponse.json({ ok: true, ignored: true, reason: "not_paid" })

  const metadata = session.metadata || {}
  const paymentScope = String(metadata.payment_scope || "").toLowerCase()
  if (paymentScope === SHOP_PAYMENT_SCOPE) {
    const orderUuid = String(session.client_reference_id || metadata.order_uuid || "").trim()
    if (!orderUuid) {
      return NextResponse.json({ ok: true, ignored: true, reason: "missing_shop_order_uuid" })
    }
    await fulfillPaidShopOrder({
      orderUuid,
      providerReference: String(session.id || ""),
      providerOrderId: session.payment_intent ? String(session.payment_intent) : null,
      paidAmountMinor: Number.isFinite(Number(session.amount_total))
        ? Number(session.amount_total)
        : null,
      paidCurrency: session.currency ? String(session.currency) : null
    })
    return NextResponse.json({ ok: true, scope: SHOP_PAYMENT_SCOPE, orderUuid })
  }
  if (paymentScope === "domain_registration") {
    const result = await completePaidDomainCheckout(String(session.id || ""))
    return NextResponse.json({ ok: true, scope: "domain_registration", orderUuid: result.orderUuid })
  }
  if (paymentScope === "school_advanced") {
    await confirmStripeSchoolAdvanced(String(session.id || ""))
    return NextResponse.json({ ok: true, scope: "school_advanced" })
  }
  if (paymentScope === "build-discovery") {
    const payment = await markBuildDiscoveryPaymentPaid(String(session.id || ""), session.payment_intent ? String(session.payment_intent) : null, {
      amountMinor: Number.isFinite(Number(session.amount_total)) ? Math.round(Number(session.amount_total)) : null,
      currency: session.currency ? String(session.currency) : null,
      leadUuid: String(metadata.lead_uuid || ""),
      provider: "stripe"
    })
    if (!payment.alreadyPaid) {
      const issued = await issueBuildBookingAccess({ leadUuid: payment.leadUuid, score: payment.score, discoveryApproved: true })
      const bookingUrl = `${siteBaseUrl()}/schools/book-call?source=build&build_access=${encodeURIComponent(issued.token)}&payment=success`
      await sendEmail({ to: payment.email, subject: "Payment confirmed — book your build discovery call", text: `Hello ${payment.fullName || "there"},\n\nYour payment has been confirmed. Book your build discovery call here:\n${bookingUrl}\n\nThis secure link expires in 3 days.` })
    }
    return NextResponse.json({ ok: true, scope: "build-discovery" })
  }
  if (paymentScope === "private-ai-coaching-discovery") {
    const payment = await markPrivateCoachingPaymentPaid(String(session.id || ""), session.payment_intent ? String(session.payment_intent) : null, {
      amountMinor: Number.isFinite(Number(session.amount_total)) ? Math.round(Number(session.amount_total)) : null,
      currency: session.currency ? String(session.currency) : null,
      leadUuid: String(metadata.lead_uuid || ""),
      provider: "stripe"
    })
    if (!payment.alreadyPaid && payment.paymentType === "discovery") {
      const issued = await issuePrivateCoachingBookingAccess(payment.leadUuid)
      const bookingUrl = `${siteBaseUrl()}/schools/book-call?source=private_ai_coaching&coaching_access=${encodeURIComponent(issued.token)}&payment=success`
      await sendEmail({ to: payment.email, subject: "Payment confirmed — book your private AI coaching call", text: `Hello ${payment.fullName || "there"},\n\nYour payment has been confirmed. Book your private AI coaching discovery call here:\n${bookingUrl}\n\nThis secure link expires in 3 days.` })
    }
    return NextResponse.json({ ok: true, scope: "private-ai-coaching-discovery" })
  }
  if (paymentScope === "installment" || metadata.installment_plan_uuid) {
    try {
      await markInstallmentPaymentPaid(String(session.id || ""), session.payment_intent ? String(session.payment_intent) : null, {
        amountMinor: Number.isFinite(Number(session.amount_total)) ? Math.round(Number(session.amount_total)) : null,
        currency: session.currency ? String(session.currency) : null,
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

  const orderUuid = String(session.client_reference_id || metadata.order_uuid || "").trim()
  if (!orderUuid) return NextResponse.json({ ok: true, ignored: true, reason: "missing_order_uuid" })
  let order
  try {
    order = await markCourseOrderPaid({
      orderUuid,
      providerReference: String(session.id || ""),
      providerOrderId: session.payment_intent ? String(session.payment_intent) : String(session.id || "")
    })
  } catch (error) {
    if (isCourseEnrollmentConflict(error)) {
      return NextResponse.json({ ok: true, scope: "course_checkout", orderUuid, duplicateReview: true })
    }
    throw error
  }
  const provisioned = await provisionStudentForPaidOrder(order, { createSession: false })
  if (!provisioned?.account) throw new Error("The paid enrollment account could not be provisioned.")
  await createAffiliateCommissionForOrder(orderUuid).catch((error) => {
    console.error("[stripe-webhook] affiliate commission failed after enrollment provisioning", {
      orderUuid,
      error: error instanceof Error ? error.message : String(error)
    })
  })
  await sendCourseOrderMetaPurchase({ orderUuid }).catch(() => null)
  return NextResponse.json({ ok: true, scope: "course_checkout", orderUuid })
}
