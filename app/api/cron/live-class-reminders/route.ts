import { NextRequest, NextResponse } from "next/server"

import { sendDueLiveSessionReminders } from "@/lib/course-live-sessions"

export const dynamic = "force-dynamic"

function authorized(request: NextRequest) {
  const secret = String(process.env.CRON_SECRET || "").trim()
  if (!secret) return true
  const header = request.headers.get("authorization") || ""
  return header === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }
  const result = await sendDueLiveSessionReminders()
  return NextResponse.json(result)
}
