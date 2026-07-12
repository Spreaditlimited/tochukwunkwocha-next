import { NextResponse } from "next/server"

import { issuePrivateCoachingBookingAccess, markPrivateCoachingPaymentPaid } from "@/lib/discovery-booking-access"
import { siteBaseUrl, verifyPaystackTransaction } from "@/lib/payments/course-checkout"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const reference = url.searchParams.get("reference") || url.searchParams.get("trxref") || ""
  try {
    if (!reference) throw new Error("Missing payment reference.")
    const tx = await verifyPaystackTransaction(reference)
    const payment = await markPrivateCoachingPaymentPaid(tx.reference, tx.providerOrderId)
    if (payment.paymentType !== "discovery") {
      return NextResponse.redirect(`${siteBaseUrl()}/private-ai-build-coaching/subscribe?payment=success`)
    }
    const issued = await issuePrivateCoachingBookingAccess(payment.leadUuid)
    return NextResponse.redirect(`${siteBaseUrl()}/schools/book-call?source=private_ai_coaching&coaching_access=${encodeURIComponent(issued.token)}&payment=success`)
  } catch {
    return NextResponse.redirect(`${siteBaseUrl()}/private-ai-build-coaching/apply?payment=failed`)
  }
}
