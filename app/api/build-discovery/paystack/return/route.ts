import { NextResponse } from "next/server"

import { issueBuildBookingAccess, markBuildDiscoveryPaymentPaid } from "@/lib/discovery-booking-access"
import { siteBaseUrl, verifyPaystackTransaction } from "@/lib/payments/course-checkout"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const reference = url.searchParams.get("reference") || url.searchParams.get("trxref") || ""
  try {
    if (!reference) throw new Error("Missing payment reference.")
    const tx = await verifyPaystackTransaction(reference)
    const payment = await markBuildDiscoveryPaymentPaid(tx.reference, tx.providerOrderId)
    const issued = await issueBuildBookingAccess({ leadUuid: payment.leadUuid, score: payment.score, discoveryApproved: true })
    return NextResponse.redirect(`${siteBaseUrl()}/schools/book-call?source=build&build_access=${encodeURIComponent(issued.token)}&payment=success`)
  } catch {
    return NextResponse.redirect(`${siteBaseUrl()}/build-scorecard?payment=failed`)
  }
}
