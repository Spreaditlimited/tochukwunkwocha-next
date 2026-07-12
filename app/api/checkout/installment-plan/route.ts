import { NextResponse } from "next/server"

import {
  checkoutContext,
  createInstallmentPlan,
  findOrCreateStudentAccount,
  formatMinorAmount,
  normalizeCourse,
  normalizeEmail,
  providerForCountry,
  recordAffiliateAttribution,
  upsertWhatsAppContact
} from "@/lib/payments/course-checkout"
import { createStudentSessionForAccount, setStudentSessionCookie } from "@/lib/student-auth"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const firstName = String(body.firstName || "").trim().slice(0, 160)
    const email = normalizeEmail(body.email)
    const phone = String(body.phone || "").trim().slice(0, 40)
    const country = String(body.country || "NG").trim().slice(0, 120)
    const courseSlug = normalizeCourse(body.courseSlug)
    const provider = providerForCountry(country, body.provider)

    if (!firstName || !email || !phone) {
      return NextResponse.json({ ok: false, error: "Full name, valid email, and phone number are required." }, { status: 400 })
    }

    const account = await findOrCreateStudentAccount({ fullName: firstName, email, phone })
    const session = await createStudentSessionForAccount(account)
    await setStudentSessionCookie(session.token)
    const context = await checkoutContext({
      courseSlug,
      country,
      provider,
      email,
      couponCode: body.couponCode,
      buyerType: body.buyerType,
      seatCount: body.seatCount,
      batchKey: body.batchKey,
      installment: true
    })
    if (!context.batch) {
      return NextResponse.json({ ok: false, error: "No open batch is available for this course." }, { status: 409 })
    }

    const planUuid = await createInstallmentPlan({
      accountId: account.id,
      courseSlug,
      country,
      provider,
      pricing: context.pricing,
      batch: context.batch,
      buyerType: context.buyerType,
      seatCount: context.seatCount
    })
    await recordAffiliateAttribution({
      sourceUuid: planUuid,
      courseSlug,
      affiliateCode: body.affiliateCode,
      buyerEmail: email,
      buyerCountry: country,
      buyerCurrency: context.pricing.currency,
      orderAmountMinor: context.pricing.finalAmountMinor
    })
    await upsertWhatsAppContact({
      email,
      fullName: firstName,
      phone,
      courseSlug,
      source: "installment_enrollment",
      optedIn: body.whatsappOptIn === true
    })

    return NextResponse.json({
      ok: true,
      planUuid,
      pricing: {
        ...context.pricing,
        label: formatMinorAmount(context.pricing.finalAmountMinor, context.pricing.currency),
        baseLabel: formatMinorAmount(context.pricing.baseAmountMinor, context.pricing.currency),
        courseAmountLabel: formatMinorAmount(Number(context.pricing.courseAmountMinor || 0), context.pricing.currency),
        vatLabel: formatMinorAmount(Number(context.pricing.vatAmountMinor || 0), context.pricing.currency),
        subtotalLabel: formatMinorAmount(Number(context.pricing.subtotalAmountMinor || 0), context.pricing.currency),
        processingFeeLabel: formatMinorAmount(Number(context.pricing.processingFeeMinor || 0), context.pricing.currency),
        discountLabel: formatMinorAmount(context.pricing.discountMinor, context.pricing.currency),
        groupDiscountLabel: formatMinorAmount(Number(context.pricing.groupDiscountMinor || 0), context.pricing.currency),
        groupUnitLabel: context.pricing.groupUnitAmountMinor ? formatMinorAmount(Number(context.pricing.groupUnitAmountMinor), context.pricing.currency) : null
      },
      batch: context.batch
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not create installment plan" }, { status: 500 })
  }
}
