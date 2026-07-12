import { NextResponse } from "next/server"

import { checkoutContext, formatMinorAmount, listCheckoutBatches, normalizeCourse, providerForCountry } from "@/lib/payments/course-checkout"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const courseSlug = normalizeCourse(body.courseSlug)
    const country = String(body.country || "NG").trim()
    const provider = providerForCountry(country, body.provider)
    const pricing = await checkoutContext({
      courseSlug,
      country,
      provider,
      email: body.email,
      couponCode: body.couponCode,
      buyerType: body.buyerType,
      seatCount: body.seatCount,
      batchKey: body.batchKey,
      installment: body.installment === true
    })
    const batches = await listCheckoutBatches(courseSlug)

    return NextResponse.json({
      ok: true,
      batches,
      pricing: {
        ...pricing.pricing,
        label: formatMinorAmount(pricing.pricing.finalAmountMinor, pricing.pricing.currency),
        baseLabel: formatMinorAmount(pricing.pricing.baseAmountMinor, pricing.pricing.currency),
        discountLabel: formatMinorAmount(pricing.pricing.discountMinor, pricing.pricing.currency),
        groupDiscountLabel: formatMinorAmount(Number(pricing.pricing.groupDiscountMinor || 0), pricing.pricing.currency),
        groupUnitLabel: pricing.pricing.groupUnitAmountMinor ? formatMinorAmount(Number(pricing.pricing.groupUnitAmountMinor), pricing.pricing.currency) : null
      }
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not load checkout config" }, { status: 500 })
  }
}
