import { NextRequest, NextResponse } from "next/server"

import { suppressAdvancedUpgradeRecipient, verifyAdvancedUpgradeUnsubscribeToken } from "@/lib/advanced-upgrade-campaign"
import { publicAbsoluteUrl } from "@/lib/public-site-url"

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const token = String(formData.get("token") || "")
  const email = verifyAdvancedUpgradeUnsubscribeToken(token)
  if (!email) return NextResponse.redirect(publicAbsoluteUrl("/email-preferences/advanced-upgrade?status=invalid"), 303)
  await suppressAdvancedUpgradeRecipient(email)
  return NextResponse.redirect(publicAbsoluteUrl("/email-preferences/advanced-upgrade?status=unsubscribed"), 303)
}
