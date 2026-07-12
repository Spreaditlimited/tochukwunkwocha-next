import { NextResponse } from "next/server"

import { confirmPaystackSchoolAdvanced } from "@/lib/payments/school-advanced"
import { siteBaseUrl } from "@/lib/payments/course-checkout"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const reference = String(url.searchParams.get("reference") || url.searchParams.get("trxref") || "").trim()
  if (!reference) {
    return NextResponse.redirect(`${siteBaseUrl()}/schools/dashboard?advanced_payment=failed`)
  }

  try {
    await confirmPaystackSchoolAdvanced(reference)
    return NextResponse.redirect(`${siteBaseUrl()}/schools/dashboard?advanced_payment=success`)
  } catch {
    return NextResponse.redirect(`${siteBaseUrl()}/schools/dashboard?advanced_payment=failed`)
  }
}
