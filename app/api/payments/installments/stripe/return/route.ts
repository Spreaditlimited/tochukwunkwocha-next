import { NextResponse } from "next/server"

import { markInstallmentPaymentPaid, retrieveStripeSession, siteBaseUrl } from "@/lib/payments/course-checkout"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const sessionId = String(url.searchParams.get("session_id") || "").trim()
  if (!sessionId) return NextResponse.redirect(`${siteBaseUrl()}/dashboard/installments?payment=failed`)
  try {
    const session = await retrieveStripeSession(sessionId)
    await markInstallmentPaymentPaid(session.id, session.paymentIntentId)
    return NextResponse.redirect(`${siteBaseUrl()}/dashboard/installments?payment=success`)
  } catch (_error) {
    return NextResponse.redirect(`${siteBaseUrl()}/dashboard/installments?payment=failed`)
  }
}
