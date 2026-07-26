import { NextResponse } from "next/server"

import { verifyPaystackTransaction } from "@/lib/payments/course-checkout"
import { fulfillPaidShopOrder, SHOP_PAYMENT_SCOPE } from "@/lib/shop"
import { absoluteUrl } from "@/lib/site-seo"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const reference = url.searchParams.get("reference") || url.searchParams.get("trxref") || ""
  try {
    if (!reference) throw new Error("Missing Paystack reference.")
    const verified = await verifyPaystackTransaction(reference)
    if (String(verified.metadata?.payment_scope || "") !== SHOP_PAYMENT_SCOPE) {
      throw new Error("This payment does not belong to a shop order.")
    }
    const orderUuid = String(verified.metadata?.order_uuid || "")
    if (!orderUuid) throw new Error("Payment metadata is incomplete.")
    await fulfillPaidShopOrder({
      orderUuid,
      providerReference: verified.reference,
      providerOrderId: verified.providerOrderId,
      paidAmountMinor: verified.amountMinor,
      paidCurrency: verified.currency
    })
    return NextResponse.redirect(
      absoluteUrl(`/shop/order/${encodeURIComponent(orderUuid)}/success`)
    )
  } catch (error) {
    return NextResponse.redirect(
      absoluteUrl(
        `/shop/checkout?payment=failed&reason=${encodeURIComponent(
          error instanceof Error ? error.message : "Payment verification failed."
        )}`
      )
    )
  }
}
