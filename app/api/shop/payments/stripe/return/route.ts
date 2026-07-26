import { NextResponse } from "next/server"

import { retrieveStripeSession } from "@/lib/payments/course-checkout"
import { fulfillPaidShopOrder, SHOP_PAYMENT_SCOPE } from "@/lib/shop"
import { absoluteUrl } from "@/lib/site-seo"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const sessionId = url.searchParams.get("session_id") || ""
  try {
    if (!sessionId) throw new Error("Missing Stripe session.")
    const session = await retrieveStripeSession(sessionId)
    if (String(session.metadata?.payment_scope || "") !== SHOP_PAYMENT_SCOPE) {
      throw new Error("This payment does not belong to a shop order.")
    }
    if (!session.orderUuid) throw new Error("Payment metadata is incomplete.")
    await fulfillPaidShopOrder({
      orderUuid: session.orderUuid,
      providerReference: session.id,
      providerOrderId: session.paymentIntentId,
      paidAmountMinor: session.amountMinor,
      paidCurrency: session.currency
    })
    return NextResponse.redirect(
      absoluteUrl(`/shop/order/${encodeURIComponent(session.orderUuid)}/success`)
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
