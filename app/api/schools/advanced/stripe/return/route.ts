import { NextResponse } from "next/server"

import { confirmStripeSchoolAdvanced } from "@/lib/payments/school-advanced"
import { siteBaseUrl } from "@/lib/payments/course-checkout"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const sessionId = String(url.searchParams.get("session_id") || "").trim()
  if (!sessionId) {
    return NextResponse.redirect(`${siteBaseUrl()}/schools/dashboard?advanced_payment=failed`)
  }

  try {
    await confirmStripeSchoolAdvanced(sessionId)
    return NextResponse.redirect(`${siteBaseUrl()}/schools/dashboard?advanced_payment=success`)
  } catch {
    return NextResponse.redirect(`${siteBaseUrl()}/schools/dashboard?advanced_payment=failed`)
  }
}
