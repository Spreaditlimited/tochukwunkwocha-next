import { NextResponse } from "next/server"

import { completePaidDomainCheckout } from "@/lib/payments/domain-checkout"
import { siteBaseUrl } from "@/lib/payments/course-checkout"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const reference = url.searchParams.get("reference") || url.searchParams.get("trxref") || ""
  try {
    const result = await completePaidDomainCheckout(reference)
    return NextResponse.redirect(`${siteBaseUrl()}/dashboard/domains?domain=payment_confirmed&order=${encodeURIComponent(result.orderUuid)}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment verification failed."
    return NextResponse.redirect(`${siteBaseUrl()}/dashboard/domains?payment=failed&reason=${encodeURIComponent(message.slice(0, 180))}#domainRegisterSection`)
  }
}
