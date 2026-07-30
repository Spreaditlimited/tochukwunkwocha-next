import { NextRequest, NextResponse } from "next/server"

import { processPaymentNotificationOutbox } from "@/lib/payment-notification-outbox"

export const dynamic = "force-dynamic"

function authorized(request: NextRequest) {
  const secret = String(process.env.CRON_SECRET || "").trim()
  if (!secret) return true
  return request.headers.get("authorization") === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }
  const result = await processPaymentNotificationOutbox({ limit: 30 })
  return NextResponse.json({ ok: result.failed === 0, result })
}
