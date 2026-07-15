import { NextResponse } from "next/server"

import { subscribeMarketingLead } from "@/lib/marketing"
import { clientIpFromRequest, verifyRecaptchaToken } from "@/lib/recaptcha"

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch (_error) {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 })
  }

  try {
    const recaptcha = await verifyRecaptchaToken({
      token: body.recaptchaToken,
      expectedAction: "marketing_lead_capture",
      request,
      remoteip: clientIpFromRequest(request)
    })
    if (!recaptcha.ok) {
      return NextResponse.json({ ok: false, error: "Captcha verification failed. Please try again." }, { status: 400 })
    }
    const result = await subscribeMarketingLead({
      ...body,
      clientIp: clientIpFromRequest(request),
      userAgent: request.headers.get("user-agent") || ""
    })
    return NextResponse.json({ ok: true, ...result }, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not subscribe right now." },
      { status: 400 }
    )
  }
}
