import crypto from "crypto"
import { NextResponse } from "next/server"

import { sendCourseOrderMetaPurchase } from "@/lib/meta-events"
import { completePaidDomainCheckout } from "@/lib/payments/domain-checkout"
import { createAffiliateCommissionForOrder, markCourseOrderPaid, markInstallmentPaymentPaid } from "@/lib/payments/course-checkout"
import { provisionStudentForPaidOrder } from "@/lib/payments/post-payment-student"

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
  if (!webhookSecret || !signature) return NextResponse.json({ ok: false, error: "Missing webhook signature." }, { status: 401 })
  if (!verifyStripeSignature(rawBody, signature, webhookSecret)) return NextResponse.json({ ok: false, error: "Invalid webhook signature." }, { status: 401 })

  const payload = JSON.parse(rawBody || "{}")
  if (String(payload?.type || "") !== "checkout.session.completed") return NextResponse.json({ ok: true, ignored: true })
  const session = payload.data?.object || {}
  if (String(session.payment_status || "").toLowerCase() !== "paid") return NextResponse.json({ ok: true, ignored: true, reason: "not_paid" })

  const metadata = session.metadata || {}
  const paymentScope = String(metadata.payment_scope || "").toLowerCase()
  if (paymentScope === "domain_registration") {
    const result = await completePaidDomainCheckout(String(session.id || ""))
    return NextResponse.json({ ok: true, scope: "domain_registration", orderUuid: result.orderUuid })
  }
  if (paymentScope === "installment" || metadata.installment_plan_uuid) {
    await markInstallmentPaymentPaid(String(session.id || ""), session.payment_intent ? String(session.payment_intent) : null)
    return NextResponse.json({ ok: true, scope: "installment" })
  }

  const orderUuid = String(session.client_reference_id || metadata.order_uuid || "").trim()
  if (!orderUuid) return NextResponse.json({ ok: true, ignored: true, reason: "missing_order_uuid" })
  const order = await markCourseOrderPaid({
    orderUuid,
    providerReference: String(session.id || ""),
    providerOrderId: session.payment_intent ? String(session.payment_intent) : String(session.id || "")
  })
  await createAffiliateCommissionForOrder(orderUuid)
  await provisionStudentForPaidOrder(order)
  await sendCourseOrderMetaPurchase({ orderUuid }).catch(() => null)
  return NextResponse.json({ ok: true, scope: "course_checkout", orderUuid })
}
