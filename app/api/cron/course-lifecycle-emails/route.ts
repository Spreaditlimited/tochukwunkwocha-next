import { NextRequest, NextResponse } from "next/server"

import { processCourseLifecycleEmails } from "@/lib/course-lifecycle-emails"
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
  const runUuid = await beginAutomationRun("course-lifecycle-emails")
  try {
    const forceDryRun = request.nextUrl.searchParams.get("dryRun") === "1"
    const requestedAt = forceDryRun ? new Date(String(request.nextUrl.searchParams.get("at") || "")) : null
    const result = await processCourseLifecycleEmails({
      forceDryRun,
      now: requestedAt && Number.isFinite(requestedAt.getTime()) ? requestedAt : undefined,
      courseSlug: forceDryRun ? request.nextUrl.searchParams.get("courseSlug") || "" : "",
      batchKey: forceDryRun ? request.nextUrl.searchParams.get("batchKey") || "" : "",
      stage: forceDryRun ? request.nextUrl.searchParams.get("stage") as "welcome_48h" | "batch_switch_24h" | "lesson_release" | "all" || "all" : "all",
      recipientEmail: forceDryRun ? request.nextUrl.searchParams.get("recipientEmail") || "" : "",
      limit: forceDryRun ? Number(request.nextUrl.searchParams.get("limit") || 100) : undefined
    })
    await finishAutomationRun(runUuid, { ok: result.ok, result })
    return NextResponse.json(result)
  } catch (error) {
    await finishAutomationRun(runUuid, { ok: false, error }).catch(() => null)
    console.error("course_lifecycle_email_cron_failed", error)
    return NextResponse.json({ ok: false, error: "Course lifecycle email processing failed." }, { status: 500 })
  }
}
