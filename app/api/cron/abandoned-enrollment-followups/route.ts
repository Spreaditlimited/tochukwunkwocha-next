import { NextRequest, NextResponse } from "next/server"

import { processAbandonedEnrollmentFollowups } from "@/lib/abandoned-enrollment-followups"
import { acquireAutomationLease, releaseAutomationLease } from "@/lib/automation-leases"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const AUTOMATION_KEY = "paystack-provider-work"

function authorized(request: NextRequest) {
  const secret = String(process.env.CRON_SECRET || "").trim()
  if (!secret) return true
  return request.headers.get("authorization") === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }
  const leaseToken = await acquireAutomationLease(AUTOMATION_KEY, 540)
  if (!leaseToken) {
    return NextResponse.json({ ok: true, skipped: true, reason: "paystack_provider_work_already_running" })
  }
  try {
    const result = await processAbandonedEnrollmentFollowups({ limit: 30 })
    return NextResponse.json({ ok: result.failed === 0, result })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Abandoned enrollment follow-up processing failed."
    }, { status: 500 })
  } finally {
    await releaseAutomationLease(AUTOMATION_KEY, leaseToken).catch(() => null)
  }
}
