import { NextResponse } from "next/server"

import { completePaidDomainRenewal } from "@/lib/payments/domain-renewal"
import { siteBaseUrl } from "@/lib/payments/course-checkout"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const reference = url.searchParams.get("reference") || url.searchParams.get("trxref") || ""
  try {
    const renewal = await completePaidDomainRenewal(reference)
    return NextResponse.redirect(`${siteBaseUrl()}/dashboard/domains?renewal=success&domain=${encodeURIComponent(renewal.domainName)}`)
  } catch (error) {
    console.error("[domain-renew-paystack-return] failed", {
      message: error instanceof Error ? error.message : "Unknown renewal failure",
      reference: reference.slice(0, 120)
    })
    return NextResponse.redirect(`${siteBaseUrl()}/dashboard/domains?renewal=failed`)
  }
}
