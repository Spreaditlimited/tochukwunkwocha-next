import { NextResponse } from "next/server"

import { recaptchaEnabled } from "@/lib/recaptcha"

export async function GET() {
  return NextResponse.json({
    ok: true,
    enabled: recaptchaEnabled(),
    siteKey: recaptchaEnabled() ? String(process.env.RECAPTCHA_SITE_KEY || "").trim() : ""
  })
}
