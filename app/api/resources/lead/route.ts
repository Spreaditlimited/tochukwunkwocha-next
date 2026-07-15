import { NextResponse } from "next/server"

import { subscribeMarketingLead } from "@/lib/marketing"
import { clientIpFromRequest, verifyRecaptchaToken } from "@/lib/recaptcha"
import { captureResourceLead } from "@/lib/resources"

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
      expectedAction: "resource_gate",
      request,
      remoteip: clientIpFromRequest(request)
    })
    if (!recaptcha.ok) {
      return NextResponse.json({ ok: false, error: "Captcha verification failed. Please try again." }, { status: 400 })
    }
    const result = await captureResourceLead({
      resourceUuid: String(body.resourceUuid || ""),
      firstName: String(body.firstName || ""),
      email: String(body.email || ""),
      source: "resource_gate",
      pageUrl: String(body.pageUrl || ""),
      pathname: String(body.pathname || "")
    })
    await subscribeMarketingLead({
      firstName: String(body.firstName || ""),
      email: String(body.email || ""),
      source: "resource_gate",
      pageType: "resource",
      pageUrl: String(body.pageUrl || ""),
      pathname: String(body.pathname || ""),
      fbclid: String(body.fbclid || ""),
      fbp: String(body.fbp || ""),
      fbc: String(body.fbc || ""),
      clientIp: clientIpFromRequest(request),
      userAgent: request.headers.get("user-agent") || ""
    }).catch(() => null)
    return NextResponse.json({ ok: true, ...result }, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not unlock this resource right now." },
      { status: 400 }
    )
  }
}
