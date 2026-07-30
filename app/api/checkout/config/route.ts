import { NextResponse } from "next/server"

import { checkoutContext, formatMinorAmount, normalizeCourse, providerForCountry } from "@/lib/payments/course-checkout"
import { ServerTiming } from "@/lib/server-timing"

export async function POST(request: Request) {
  const timing = new ServerTiming()
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
    timing.mark("checkout_context")
    return NextResponse.json({
      ok: true,
      batches: pricing.batches,
      pricing: {
        ...pricing.pricing,
        label: formatMinorAmount(pricing.pricing.finalAmountMinor, pricing.pricing.currency),
        baseLabel: formatMinorAmount(pricing.pricing.baseAmountMinor, pricing.pricing.currency),
        courseAmountLabel: formatMinorAmount(Number(pricing.pricing.courseAmountMinor || 0), pricing.pricing.currency),
        vatLabel: formatMinorAmount(Number(pricing.pricing.vatAmountMinor || 0), pricing.pricing.currency),
        subtotalLabel: formatMinorAmount(Number(pricing.pricing.subtotalAmountMinor || 0), pricing.pricing.currency),
        processingFeeLabel: formatMinorAmount(Number(pricing.pricing.processingFeeMinor || 0), pricing.pricing.currency),
        discountLabel: formatMinorAmount(pricing.pricing.discountMinor, pricing.pricing.currency),
        groupDiscountLabel: formatMinorAmount(Number(pricing.pricing.groupDiscountMinor || 0), pricing.pricing.currency),
        groupUnitLabel: pricing.pricing.groupUnitAmountMinor ? formatMinorAmount(Number(pricing.pricing.groupUnitAmountMinor), pricing.pricing.currency) : null
      }
    }, { headers: timing.headers() })
  } catch (error) {
    timing.mark("failed")
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not load checkout config" },
      { status: 500, headers: timing.headers() }
    )
  }
}
