import { NextResponse } from "next/server"

import { checkoutContext, formatMinorAmount, manualTransferAllowedForCountry } from "@/lib/payments/course-checkout"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const country = String(body.country || "NG").trim()
    if (!manualTransferAllowedForCountry(country)) {
      return NextResponse.json({ ok: false, error: "Bank transfer is only available for Nigeria checkout." }, { status: 400 })
    }
    const result = await checkoutContext({
      courseSlug: body.courseSlug,
      country,
      provider: "paystack",
      email: body.email,
      couponCode: body.couponCode,
      buyerType: body.buyerType,
      seatCount: body.seatCount,
      batchKey: body.batchKey,
      manualTransfer: true
    })

    return NextResponse.json({
      ok: true,
      details: {
        bankName: process.env.MANUAL_BANK_NAME || "",
        accountName: process.env.MANUAL_BANK_ACCOUNT_NAME || "",
        accountNumber: process.env.MANUAL_BANK_ACCOUNT_NUMBER || "",
        note: process.env.MANUAL_BANK_NOTE || "",
        currency: result.pricing.currency,
        amountMinor: result.pricing.finalAmountMinor,
        amountLabel: formatMinorAmount(result.pricing.finalAmountMinor, result.pricing.currency),
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
        },
        coupon: result.coupon,
        batch: result.batch
      }
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not load manual payment details" }, { status: 400 })
  }
}
