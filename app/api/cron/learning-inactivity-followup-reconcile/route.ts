import { NextRequest, NextResponse } from "next/server"

import { reconcileLearningFollowupCampaigns } from "@/lib/learning-inactivity-followups"
import { beginAutomationRun, finishAutomationRun } from "@/lib/automation-runs"

export const dynamic = "force-dynamic"
export const maxDuration = 300

function authorized(request: NextRequest) {
  const secret = String(process.env.CRON_SECRET || "").trim()
  if (!secret) return process.env.NODE_ENV !== "production"
  return request.headers.get("authorization") === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  const runUuid = await beginAutomationRun("learning-inactivity-reconcile")
  try {
    const result = await reconcileLearningFollowupCampaigns()
    await finishAutomationRun(runUuid, { ok: true, result: { ...result, snapshots: undefined } })
    return NextResponse.json({ ok: true, ...result, snapshots: undefined })
  } catch (error) {
    await finishAutomationRun(runUuid, { ok: false, error }).catch(() => null)
    console.error("learning_inactivity_followup_reconcile_failed", error)
    return NextResponse.json({ ok: false, error: "Learning follow-up reconciliation failed." }, { status: 500 })
  }
}
