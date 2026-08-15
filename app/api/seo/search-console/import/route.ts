import { after, NextResponse } from "next/server"

import { canAccessDashboardPath, getAdminSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { executeSearchConsolePerformanceImport, startSearchConsolePerformanceImport } from "@/lib/search-console"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

function validDate(value: unknown) {
  const date = String(value || "")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const parsed = new Date(`${date}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? null : date
}

async function authorize() {
  const session = await getAdminSession()
  return session && canAccessDashboardPath(session, "/internal/seo") ? session : null
}

function payload(run: Awaited<ReturnType<typeof prisma.tochukwuSearchConsoleImportRun.findUnique>>) {
  if (!run) return null
  const elapsed = Math.max(0, Math.floor(((run.completedAt || new Date()).getTime() - run.startedAt.getTime()) / 1000))
  const ready = run.status === "completed" || run.status === "failed"
  return {
    runUuid: run.runUuid, siteUrl: run.siteUrl,
    startDate: run.sourceStartDate?.toISOString().slice(0, 10), endDate: run.sourceEndDate?.toISOString().slice(0, 10),
    rowCount: run.rowCount, status: run.status, error: run.errorMessage,
    startedAt: run.startedAt.toISOString(), completedAt: run.completedAt?.toISOString() || null,
    elapsedSeconds: elapsed, percent: ready ? 100 : run.rowCount > 0 ? 82 : elapsed < 5 ? 12 : elapsed < 20 ? 35 : 60,
    stage: run.status === "completed" ? "Import completed and SEO opportunities refreshed" : run.status === "failed" ? "Import stopped with an error" : run.rowCount > 0 ? "GSC rows saved; refreshing SEO opportunities" : elapsed < 5 ? "Connecting securely to Google Search Console" : "Downloading Search Console performance rows",
    ready
  }
}

export async function POST(request: Request) {
  if (!(await authorize())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await request.json().catch(() => null)
  const startDate = validDate(body?.startDate), endDate = validDate(body?.endDate)
  if (!startDate || !endDate || startDate > endDate) return NextResponse.json({ error: "Choose a valid import date range." }, { status: 400 })
  const latest = new Date(); latest.setUTCDate(latest.getUTCDate() - 2)
  if (endDate > latest.toISOString().slice(0, 10)) return NextResponse.json({ error: "Search Console data is available only through two days ago." }, { status: 400 })
  try {
    const reservation = await startSearchConsolePerformanceImport({ startDate, endDate })
    if (!reservation.started) {
      const run = await prisma.tochukwuSearchConsoleImportRun.findUnique({ where: { runUuid: reservation.run.runUuid } })
      return NextResponse.json({ ...payload(run), alreadyRunning: true }, { status: 409 })
    }
    after(async () => { await executeSearchConsolePerformanceImport(reservation.run).catch((error) => console.error("Manual Search Console import failed", error)) })
    const run = await prisma.tochukwuSearchConsoleImportRun.findUnique({ where: { runUuid: reservation.run.runUuid } })
    return NextResponse.json(payload(run), { status: 202 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start the Search Console import." }, { status: 500 })
  }
}

export async function GET(request: Request) {
  if (!(await authorize())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const runUuid = new URL(request.url).searchParams.get("runUuid") || ""
  if (!runUuid) return NextResponse.json({ error: "Import run ID is required." }, { status: 400 })
  const run = await prisma.tochukwuSearchConsoleImportRun.findUnique({ where: { runUuid } })
  return run ? NextResponse.json(payload(run)) : NextResponse.json({ error: "Import run was not found." }, { status: 404 })
}
