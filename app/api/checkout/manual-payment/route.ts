import { NextResponse } from "next/server"

import {
  checkoutContext,
  createManualPayment,
  manualTransferAllowedForCountry,
  normalizeCourse,
  normalizeEmail,
  recordAffiliateAttribution,
  upsertWhatsAppContact
} from "@/lib/payments/course-checkout"
import { clientIpFromRequest, verifyRecaptchaToken } from "@/lib/recaptcha"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const firstName = String(body.firstName || "").trim().slice(0, 160)
    const email = normalizeEmail(body.email)
    const phone = String(body.phone || "").trim().slice(0, 40)
    const country = String(body.country || "").trim().slice(0, 120)
    const courseSlug = normalizeCourse(body.courseSlug)
    const proofUrl = String(body.proofUrl || "").trim()
    const proofPublicId = String(body.proofPublicId || "").trim().slice(0, 255)
    const transferReference = String(body.transferReference || "").trim().slice(0, 190)

    if (!firstName || !email || !phone) {
      return NextResponse.json({ ok: false, error: "Full name, valid email, and phone number are required." }, { status: 400 })
    }
    const recaptcha = await verifyRecaptchaToken({
      token: body.recaptchaToken,
      expectedAction: "course_order_create",
      remoteip: clientIpFromRequest(request),
      request
    })
    if (!recaptcha.ok) {
      return NextResponse.json({ ok: false, error: "We could not verify this submission. Please try again." }, { status: 400 })
    }
    if (!manualTransferAllowedForCountry(country)) {
      return NextResponse.json({ ok: false, error: "Bank transfer is only available for Nigeria checkout." }, { status: 400 })
    }
    if (!/^https:\/\//i.test(proofUrl)) {
      return NextResponse.json({ ok: false, error: "Enter a valid HTTPS payment proof URL." }, { status: 400 })
    }

    const result = await checkoutContext({
      courseSlug,
      country,
      provider: "paystack",
      email,
      couponCode: body.couponCode,
      buyerType: body.buyerType,
      seatCount: body.seatCount,
      batchKey: body.batchKey
    })
    const paymentUuid = await createManualPayment({
      courseSlug,
      firstName,
      email,
      phone,
      country,
      pricing: result.pricing,
      transferReference,
      proofUrl,
      proofPublicId,
      batch: result.batch,
      buyerType: result.buyerType,
      seatCount: result.seatCount
    })
    await recordAffiliateAttribution({
      sourceUuid: paymentUuid,
      courseSlug,
      affiliateCode: body.affiliateCode,
      buyerEmail: email,
      buyerCountry: country,
      buyerCurrency: result.pricing.currency,
      orderAmountMinor: result.pricing.finalAmountMinor
    })
    await upsertWhatsAppContact({
      email,
      fullName: firstName,
      phone,
      courseSlug,
      source: "manual_enrollment",
      optedIn: body.whatsappOptIn === true
    })

    return NextResponse.json({ ok: true, paymentUuid, pricing: result.pricing })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not submit manual payment" }, { status: 500 })
  }
}
