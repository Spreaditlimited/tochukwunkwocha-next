import { NextResponse } from "next/server"

import { issueBuildBookingAccess, markBuildDiscoveryPaymentPaid } from "@/lib/discovery-booking-access"
import { retrieveStripeSession, siteBaseUrl } from "@/lib/payments/course-checkout"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const sessionId = url.searchParams.get("session_id") || ""
  try {
    if (!sessionId) throw new Error("Missing Stripe session.")
    const session = await retrieveStripeSession(sessionId)
    const payment = await markBuildDiscoveryPaymentPaid(session.id, session.paymentIntentId)
    const issued = await issueBuildBookingAccess({ leadUuid: payment.leadUuid, score: payment.score, discoveryApproved: true })
    return NextResponse.redirect(`${siteBaseUrl()}/schools/book-call?source=build&build_access=${encodeURIComponent(issued.token)}&payment=success`)
  } catch {
    return NextResponse.redirect(`${siteBaseUrl()}/build-scorecard?payment=failed`)
  }
}
