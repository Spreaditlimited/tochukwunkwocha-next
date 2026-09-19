import { NextRequest, NextResponse } from "next/server"

import { beginAutomationRun, finishAutomationRun } from "@/lib/automation-runs"
import { processPracticalAiNewsletter } from "@/lib/practical-ai-newsletter"

export const dynamic = "force-dynamic"
export const maxDuration = 300

function authorized(request: NextRequest) {
  const secret = String(process.env.CRON_SECRET || "").trim()
  if (!secret) return process.env.NODE_ENV !== "production"
  return request.headers.get("authorization") === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  const runUuid = await beginAutomationRun("practical-ai-newsletter")
  try {
    const dryRun = request.nextUrl.searchParams.get("dryRun") === "1"
    const result = await processPracticalAiNewsletter({
      forceDryRun: dryRun,
      recipientEmail: dryRun ? request.nextUrl.searchParams.get("recipientEmail") || "" : "",
      limit: Number(request.nextUrl.searchParams.get("limit") || 80)
    })
    await finishAutomationRun(runUuid, { ok: result.ok, result })
    return NextResponse.json(result)
  } catch (error) {
    await finishAutomationRun(runUuid, { ok: false, error }).catch(() => null)
    console.error("practical_ai_newsletter_cron_failed", error)
    return NextResponse.json({ ok: false, error: "Practical AI newsletter processing failed." }, { status: 500 })
  }
}
