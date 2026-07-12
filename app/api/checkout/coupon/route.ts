import { NextResponse } from "next/server"

import { checkoutContext, formatMinorAmount, providerForCountry } from "@/lib/payments/course-checkout"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const provider = providerForCountry(body.country, body.provider)
    const result = await checkoutContext({
      courseSlug: body.courseSlug,
      country: body.country,
      provider,
      email: body.email,
      couponCode: body.couponCode,
      buyerType: body.buyerType,
      seatCount: body.seatCount,
      batchKey: body.batchKey,
      installment: body.installment === true
    })

    return NextResponse.json({
      ok: true,
      provider,
      coupon: result.coupon,
      pricing: {
        ...result.pricing,
        label: formatMinorAmount(result.pricing.finalAmountMinor, result.pricing.currency),
        baseLabel: formatMinorAmount(result.pricing.baseAmountMinor, result.pricing.currency),
        courseAmountLabel: formatMinorAmount(Number(result.pricing.courseAmountMinor || 0), result.pricing.currency),
        vatLabel: formatMinorAmount(Number(result.pricing.vatAmountMinor || 0), result.pricing.currency),
        subtotalLabel: formatMinorAmount(Number(result.pricing.subtotalAmountMinor || 0), result.pricing.currency),
        processingFeeLabel: formatMinorAmount(Number(result.pricing.processingFeeMinor || 0), result.pricing.currency),
        discountLabel: formatMinorAmount(result.pricing.discountMinor, result.pricing.currency),
        groupDiscountLabel: formatMinorAmount(Number(result.pricing.groupDiscountMinor || 0), result.pricing.currency),
        groupUnitLabel: result.pricing.groupUnitAmountMinor ? formatMinorAmount(Number(result.pricing.groupUnitAmountMinor), result.pricing.currency) : null
      }
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not apply coupon" }, { status: 400 })
  }
}
