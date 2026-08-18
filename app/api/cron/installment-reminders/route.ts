import { NextRequest, NextResponse } from "next/server"

import { beginAutomationRun, finishAutomationRun } from "@/lib/automation-runs"
import { processInstallmentReminders } from "@/lib/installment-reminders"

export const dynamic = "force-dynamic"
export const maxDuration = 300

function authorized(request: NextRequest) {
  const secret = String(process.env.CRON_SECRET || "").trim()
  if (!secret) return true
  return request.headers.get("authorization") === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }
  const runUuid = await beginAutomationRun("installment-reminders")
  try {
    const result = await processInstallmentReminders({ limit: 50 })
    const ok = result.failed === 0
    await finishAutomationRun(runUuid, { ok, result })
    return NextResponse.json({ ok, result }, { status: ok ? 200 : 500 })
  } catch (error) {
    await finishAutomationRun(runUuid, { ok: false, error })
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Installment reminder processing failed."
    }, { status: 500 })
  }
}
