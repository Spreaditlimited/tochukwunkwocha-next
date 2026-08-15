import { after, NextResponse } from "next/server"

import { canAccessDashboardPath, getAdminSession } from "@/lib/auth"
import { executeBlogAutomationJob, getBlogAutomationJob, startBlogAutomationJob, type BlogAutomationJobType } from "@/lib/blog-automation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

function validType(value: unknown): BlogAutomationJobType | null { return value === "image" || value === "leadMagnet" ? value : null }
async function authorized() { const session = await getAdminSession(); return Boolean(session && canAccessDashboardPath(session, "/internal/blog")) }

export async function POST(request: Request, { params }: { params: Promise<{ pidBlog: string }> }) {
  if (!(await authorized())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { pidBlog } = await params
  const body = await request.json().catch(() => null), type = validType(body?.type)
  if (!type) return NextResponse.json({ error: "Choose image or leadMagnet generation." }, { status: 400 })
  try {
    const job = await startBlogAutomationJob(pidBlog, type)
    if (!job.alreadyRunning) after(async () => { await executeBlogAutomationJob(job.jobUuid) })
    return NextResponse.json(job, { status: job.alreadyRunning ? 200 : 202 })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start generation." }, { status: 500 }) }
}

export async function GET(request: Request, { params }: { params: Promise<{ pidBlog: string }> }) {
  if (!(await authorized())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { pidBlog } = await params, url = new URL(request.url), type = validType(url.searchParams.get("type"))
  if (!type) return NextResponse.json({ error: "Choose image or leadMagnet generation." }, { status: 400 })
  try { return NextResponse.json(await getBlogAutomationJob({ pidBlog, type, jobUuid: url.searchParams.get("jobUuid") || undefined })) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load generation progress." }, { status: 500 }) }
}
