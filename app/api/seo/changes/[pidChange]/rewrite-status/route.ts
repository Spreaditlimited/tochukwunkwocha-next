import { NextResponse } from "next/server"
import { canAccessDashboardPath, getAdminSession } from "@/lib/auth"
import { getSeoChangeReview, prepareSeoRewrite } from "@/lib/seo-review"

export const runtime = "nodejs"
export const maxDuration = 60

function elapsedSeconds(startedAt: Date | null) { return startedAt ? Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000)) : 0 }
function progressFor(status: string | null, elapsed: number) {
  if (status === "queued") return { percent: 12, stage: "OpenAI has queued the rewrite" }
  if (status === "in_progress") return { percent: Math.min(88, 22 + Math.floor(elapsed / 6)), stage: elapsed < 30 ? "Reading the article and SEO brief" : elapsed < 90 ? "Researching authoritative sources" : elapsed < 180 ? "Rewriting and improving the article" : "Completing the researched rewrite" }
  if (status === "completed") return { percent: 100, stage: "Rewrite completed and validated" }
  return { percent: 8, stage: "Preparing the background rewrite" }
}

export async function POST(_request: Request, { params }: { params: Promise<{ pidChange: string }> }) {
  const session = await getAdminSession()
  if (!session || !canAccessDashboardPath(session, "/internal/seo")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { pidChange } = await params, change = await getSeoChangeReview(pidChange)
  if (!change) return NextResponse.json({ error: "SEO rewrite was not found." }, { status: 404 })
  if (change.artifactStatus !== "rewriting" || !change.openAiResponseId) {
    const ready = Boolean(change.rewrittenHtml) && change.rewritePolicyCurrent
    return NextResponse.json({ status: ready ? "ready" : change.artifactStatus || change.status, openAiStatus: change.openAiResponseStatus || change.artifactStatus || "unknown", stage: ready ? "Rewrite ready for review" : "Rewrite is not currently processing", percent: ready ? 100 : change.artifactStatus === "failed" ? 100 : 0, elapsedSeconds: elapsedSeconds(change.rewriteStartedAt), ready })
  }
  try {
    const result = await prepareSeoRewrite(pidChange, { allowStart: false }), refreshed = await getSeoChangeReview(pidChange)
    if (!refreshed) throw new Error("SEO rewrite disappeared during status checking.")
    const ready = result.status !== "processing", elapsed = elapsedSeconds(refreshed.rewriteStartedAt || change.rewriteStartedAt)
    const progress = ready ? { percent: 100, stage: result.status === "awaiting_link_review" ? "Rewrite completed; internal links need review" : "Rewrite completed and validated" } : progressFor(refreshed.openAiResponseStatus, elapsed)
    return NextResponse.json({ status: result.status, openAiStatus: refreshed.openAiResponseStatus || "unknown", stage: progress.stage, percent: progress.percent, elapsedSeconds: elapsed, ready })
  } catch (error) {
    const refreshed = await getSeoChangeReview(pidChange)
    if (refreshed?.artifactStatus === "failed") return NextResponse.json({ status: "failed", openAiStatus: refreshed.openAiResponseStatus || "failed", stage: "Rewrite stopped with an error", percent: 100, elapsedSeconds: elapsedSeconds(refreshed.rewriteStartedAt || change.rewriteStartedAt), ready: true, message: refreshed.artifactErrorMessage })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not check rewrite status." }, { status: 503 })
  }
}
