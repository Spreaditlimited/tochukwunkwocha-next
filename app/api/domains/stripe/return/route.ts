import { NextResponse } from "next/server"

import { completePaidDomainCheckout } from "@/lib/payments/domain-checkout"
import { siteBaseUrl } from "@/lib/payments/course-checkout"

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session_id") || ""
  try {
    const result = await completePaidDomainCheckout(sessionId)
    return NextResponse.redirect(`${siteBaseUrl()}/dashboard/domains?domain=payment_confirmed&order=${encodeURIComponent(result.orderUuid)}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment verification failed."
    return NextResponse.redirect(`${siteBaseUrl()}/services/domain-registration?payment=failed&reason=${encodeURIComponent(message.slice(0, 180))}`)
  }
}
