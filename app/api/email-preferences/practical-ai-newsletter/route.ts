import { NextRequest, NextResponse } from "next/server"

import {
  suppressPracticalAiNewsletterRecipient,
  verifyPracticalAiNewsletterUnsubscribeToken
} from "@/lib/practical-ai-newsletter"
import { publicAbsoluteUrl } from "@/lib/public-site-url"

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const token = String(formData.get("token") || "")
  const email = verifyPracticalAiNewsletterUnsubscribeToken(token)
  if (!email) return NextResponse.redirect(publicAbsoluteUrl("/email-preferences/practical-ai-newsletter?status=invalid"), 303)
  await suppressPracticalAiNewsletterRecipient(email)
  return NextResponse.redirect(publicAbsoluteUrl("/email-preferences/practical-ai-newsletter?status=unsubscribed"), 303)
}
