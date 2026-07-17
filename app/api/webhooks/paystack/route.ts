import crypto from "crypto"
import { NextResponse } from "next/server"

import { sendCourseOrderMetaPurchase } from "@/lib/meta-events"
import { completePaidDomainCheckout } from "@/lib/payments/domain-checkout"
import { createAffiliateCommissionForOrder, markCourseOrderPaid, markInstallmentPaymentPaid } from "@/lib/payments/course-checkout"
import { provisionStudentForPaidOrder } from "@/lib/payments/post-payment-student"

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
  if (!secret || !signature) return NextResponse.json({ ok: false, error: "Missing webhook signature." }, { status: 401 })
  const expected = crypto.createHmac("sha512", secret).update(rawBody).digest("hex")
  if (!timingSafeEqual(signature, expected)) return NextResponse.json({ ok: false, error: "Invalid webhook signature." }, { status: 401 })

  const payload = JSON.parse(rawBody || "{}")
  const event = String(payload?.event || "").toLowerCase()
  const data = payload?.data || {}
  if (event !== "charge.success") return NextResponse.json({ ok: true, ignored: true })

  const reference = String(data.reference || "").trim()
  const metadata = data.metadata || {}
  const paymentScope = String(metadata.payment_scope || "").toLowerCase()
  if (paymentScope === "domain_registration") {
    const result = await completePaidDomainCheckout(reference)
    return NextResponse.json({ ok: true, scope: "domain_registration", orderUuid: result.orderUuid })
  }
  if (paymentScope === "installment" || metadata.installment_plan_uuid) {
    await markInstallmentPaymentPaid(reference, data.id ? String(data.id) : null)
    return NextResponse.json({ ok: true, scope: "installment" })
  }

  const orderUuid = String(metadata.order_uuid || metadata.orderUuid || "").trim()
  if (!orderUuid) return NextResponse.json({ ok: true, ignored: true, reason: "missing_order_uuid" })
  const order = await markCourseOrderPaid({
    orderUuid,
    providerReference: reference,
    providerOrderId: data.id ? String(data.id) : null
  })
  await createAffiliateCommissionForOrder(orderUuid)
  await provisionStudentForPaidOrder(order)
  await sendCourseOrderMetaPurchase({ orderUuid }).catch(() => null)
  return NextResponse.json({ ok: true, scope: "course_checkout", orderUuid })
}
