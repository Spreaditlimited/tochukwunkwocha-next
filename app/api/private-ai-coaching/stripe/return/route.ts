import { NextResponse } from "next/server"

import { issuePrivateCoachingBookingAccess, markPrivateCoachingPaymentPaid } from "@/lib/discovery-booking-access"
import { retrieveStripeSession, siteBaseUrl } from "@/lib/payments/course-checkout"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const sessionId = url.searchParams.get("session_id") || ""
  try {
    if (!sessionId) throw new Error("Missing Stripe session.")
    const session = await retrieveStripeSession(sessionId)
    const payment = await markPrivateCoachingPaymentPaid(session.id, session.paymentIntentId)
    if (payment.paymentType !== "discovery") {
      return NextResponse.redirect(`${siteBaseUrl()}/private-ai-build-coaching/subscribe?payment=success`)
    }
    const issued = await issuePrivateCoachingBookingAccess(payment.leadUuid)
    return NextResponse.redirect(`${siteBaseUrl()}/schools/book-call?source=private_ai_coaching&coaching_access=${encodeURIComponent(issued.token)}&payment=success`)
  } catch {
    return NextResponse.redirect(`${siteBaseUrl()}/private-ai-build-coaching/apply?payment=failed`)
  }
}
