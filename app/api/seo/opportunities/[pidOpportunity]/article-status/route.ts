import { NextResponse } from "next/server"

import { canAccessDashboardPath, getAdminSession } from "@/lib/auth"
import { getSeoNewArticleState, prepareSeoNewArticle } from "@/lib/seo-new-article"

export const runtime = "nodejs"
export const maxDuration = 60

function elapsedSeconds(startedAt: Date | null | undefined) {
  return startedAt ? Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000)) : 0
}

function progressFor(status: string, elapsed: number) {
  if (status === "starting") return { percent: 8, stage: "Checkpointing the research request" }
  if (status === "queued") return { percent: 14, stage: "OpenAI has queued the article research" }
  if (status === "in_progress") {
    if (elapsed < 45) return { percent: Math.min(35, 20 + Math.floor(elapsed / 3)), stage: "Researching search intent and authoritative sources" }
    if (elapsed < 150) return { percent: Math.min(72, 36 + Math.floor((elapsed - 45) / 3)), stage: "Writing the complete SEO article" }
    return { percent: Math.min(92, 73 + Math.floor((elapsed - 150) / 8)), stage: "Completing citations, links and metadata" }
  }
  if (status === "completed" || status === "ready") return { percent: 100, stage: "Article draft completed and validated" }
  if (status === "failed") return { percent: 100, stage: "Article generation stopped" }
  return { percent: 4, stage: "Ready to begin research" }
}

export async function POST(request: Request, { params }: { params: Promise<{ pidOpportunity: string }> }) {
  const session = await getAdminSession()
  if (!session || !canAccessDashboardPath(session, "/internal/seo")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { pidOpportunity } = await params
  const body = await request.json().catch(() => ({})) as { action?: string }
  const allowStart = body.action === "start"

  try {
    const result = await prepareSeoNewArticle(pidOpportunity, { allowStart })
    const state = await getSeoNewArticleState(pidOpportunity)
    const elapsed = elapsedSeconds(state.attempt?.startedAt)
    if (result.ready && "editUrl" in result) {
      return NextResponse.json({ status: "ready", openAiStatus: "completed", stage: "Article draft completed and validated", percent: 100, elapsedSeconds: elapsed, ready: true, editUrl: result.editUrl })
    }
    const openAiStatus = "openAiStatus" in result ? String(result.openAiStatus || "unknown") : String(state.artifact?.openAiResponseStatus || "unknown")
    const status = String(result.status || state.artifact?.status || "not_started")
    const progress = progressFor(status === "failed" ? "failed" : openAiStatus, elapsed)
    return NextResponse.json({ status, openAiStatus, stage: progress.stage, percent: progress.percent, elapsedSeconds: elapsed, ready: false, message: "message" in result ? result.message : undefined })
  } catch (error) {
    const state = await getSeoNewArticleState(pidOpportunity).catch(() => null)
    const failed = state?.artifact?.status === "failed"
    if (failed) {
      return NextResponse.json({ status: "failed", openAiStatus: state?.artifact?.openAiResponseStatus || "failed", stage: "Article generation stopped", percent: 100, elapsedSeconds: elapsedSeconds(state?.attempt?.startedAt), ready: false, message: state?.artifact?.errorMessage || (error instanceof Error ? error.message : "Article generation failed.") })
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not check article generation." }, { status: 503 })
  }
}
