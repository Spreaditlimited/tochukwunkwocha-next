import { NextResponse } from "next/server"

import {
  createInstallmentPayment,
  initializePaystack,
  initializeStripe,
  siteBaseUrl
} from "@/lib/payments/course-checkout"

export async function POST(request: Request) {
  try {
    const origin = new URL(request.url).origin
    const body = await request.json()
    const planUuid = String(body.planUuid || "").trim()
    const email = String(body.email || "").trim().toLowerCase()
    const provider = String(body.provider || "paystack").toLowerCase() === "stripe" ? "stripe" : "paystack"
    const currency = String(body.currency || (provider === "paystack" ? "NGN" : "USD")).trim().toUpperCase()
    const amountMinor = Math.round(Number(body.amountMinor || 0))

    if (!planUuid) return NextResponse.json({ ok: false, error: "Installment plan is required." }, { status: 400 })
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ ok: false, error: "Valid email is required." }, { status: 400 })
    if (!Number.isFinite(amountMinor) || amountMinor < 100) return NextResponse.json({ ok: false, error: "Enter a valid installment amount." }, { status: 400 })

    const reference = `IWP_${planUuid.replace(/[^a-zA-Z0-9]/g, "").slice(-12)}_${Date.now().toString().slice(-8)}`
    const payment =
      provider === "stripe"
        ? await initializeStripe({
            email,
            amountMinor,
            currency,
            courseName: "Course installment",
            orderUuid: reference,
            courseSlug: "installment",
            successUrl: `${origin}/api/payments/installments/stripe/return?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${origin}/dashboard?payment=cancelled`,
            metadata: {
              payment_scope: "installment",
              installment_plan_uuid: planUuid,
              installment_reference: reference
            }
          })
        : await initializePaystack({
            email,
            amountMinor,
            reference,
            callbackUrl: `${origin}/api/payments/installments/paystack/return`,
            metadata: { payment_scope: "installment", installment_plan_uuid: planUuid }
          })

    const saved = await createInstallmentPayment({
      planUuid,
      amountMinor,
      provider,
      providerReference: payment.providerReference || reference,
      providerOrderId: payment.providerOrderId,
      currency
    })

    return NextResponse.json({
      ok: true,
      paymentUuid: saved.paymentUuid,
      checkoutUrl: payment.checkoutUrl,
      reference: payment.providerReference || reference,
      callbackBaseUrl: siteBaseUrl()
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not start installment payment" }, { status: 500 })
  }
}
