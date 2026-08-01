import { NextRequest, NextResponse } from "next/server"

import {
  stopAbandonedEnrollmentFollowups,
  verifyAbandonedEnrollmentStopToken
} from "@/lib/abandoned-enrollment-followups"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const orderUuid = verifyAbandonedEnrollmentStopToken(request.nextUrl.searchParams.get("token"))
    if (!orderUuid) {
      return NextResponse.json({ ok: false, error: "This reminder link is invalid." }, { status: 400 })
    }
    await stopAbandonedEnrollmentFollowups(orderUuid)
    return new NextResponse(
      "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Reminders stopped</title></head><body style=\"font-family:Arial,sans-serif;background:#f4f8fc;color:#06162d;padding:40px 20px\"><main style=\"max-width:560px;margin:auto;background:#fff;border:1px solid #dbe7f3;border-radius:16px;padding:32px\"><h1>Payment reminders stopped</h1><p>You will not receive further enrollment payment reminders for this course and intake.</p><p>Tochukwu Tech and AI Academy</p></main></body></html>",
      { headers: { "content-type": "text/html; charset=utf-8" } }
    )
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Payment reminders could not be stopped."
    }, { status: 500 })
  }
}
