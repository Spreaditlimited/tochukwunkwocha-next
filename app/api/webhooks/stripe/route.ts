import crypto from "crypto"
import { NextResponse } from "next/server"

import { sendCourseOrderMetaPurchase } from "@/lib/meta-events"
import { reportPaymentProviderIssue } from "@/lib/payment-provider-alerts"
import { completePaidDomainCheckout } from "@/lib/payments/domain-checkout"
import { createAffiliateCommissionForOrder, markCourseOrderPaid, markInstallmentPaymentPaid } from "@/lib/payments/course-checkout"
import { provisionStudentForPaidOrder } from "@/lib/payments/post-payment-student"
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
  if (paymentScope === "installment" || metadata.installment_plan_uuid) {
    try {
      await markInstallmentPaymentPaid(String(session.id || ""), session.payment_intent ? String(session.payment_intent) : null)
    } catch (error) {
      if (isCourseEnrollmentConflict(error)) {
        return NextResponse.json({ ok: true, scope: "installment", duplicateReview: true })
      }
      throw error
    }
    return NextResponse.json({ ok: true, scope: "installment" })
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
