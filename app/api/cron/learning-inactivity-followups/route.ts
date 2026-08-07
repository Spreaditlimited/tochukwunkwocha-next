import { NextRequest, NextResponse } from "next/server"

import { processLearningInactivityFollowups } from "@/lib/learning-inactivity-followups"

export const dynamic = "force-dynamic"
export const maxDuration = 300

function authorized(request: NextRequest) {
  const secret = String(process.env.CRON_SECRET || "").trim()
  if (!secret) return process.env.NODE_ENV !== "production"
  return request.headers.get("authorization") === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  try {
    const result = await processLearningInactivityFollowups()
    return NextResponse.json(result)
  } catch (error) {
    console.error("learning_inactivity_followup_cron_failed", error)
    return NextResponse.json({ ok: false, error: "Learning follow-up processing failed." }, { status: 500 })
  }
}
