import { NextRequest, NextResponse } from "next/server"

import { processAdvancedUpgradeCampaign } from "@/lib/advanced-upgrade-campaign"
import { beginAutomationRun, finishAutomationRun } from "@/lib/automation-runs"

export const dynamic = "force-dynamic"
export const maxDuration = 300

function authorized(request: NextRequest) {
  const secret = String(process.env.CRON_SECRET || "").trim()
  if (!secret) return true
  return request.headers.get("authorization") === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  const runUuid = await beginAutomationRun("advanced-upgrade-campaign")
  try {
    const dryRun = request.nextUrl.searchParams.get("dryRun") === "1"
    const requestedAt = dryRun ? new Date(String(request.nextUrl.searchParams.get("at") || "")) : null
    const result = await processAdvancedUpgradeCampaign({
      forceDryRun: dryRun,
      now: requestedAt && Number.isFinite(requestedAt.getTime()) ? requestedAt : undefined,
      recipientEmail: dryRun ? request.nextUrl.searchParams.get("recipientEmail") || "" : "",
      limit: Number(request.nextUrl.searchParams.get("limit") || 75)
    })
    await finishAutomationRun(runUuid, { ok: result.ok, result })
    return NextResponse.json(result)
  } catch (error) {
    await finishAutomationRun(runUuid, { ok: false, error }).catch(() => null)
    console.error("advanced_upgrade_campaign_cron_failed", error)
    return NextResponse.json({ ok: false, error: "Advanced upgrade campaign processing failed." }, { status: 500 })
  }
}
