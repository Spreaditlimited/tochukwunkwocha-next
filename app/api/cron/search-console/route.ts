import { NextResponse } from "next/server"
import { importSearchConsolePerformance } from "@/lib/search-console"

export const runtime = "nodejs"
export const maxDuration = 300

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization")
  const acceptedSecrets = [process.env.CRON_SECRET, process.env.GOOGLE_SEARCH_CONSOLE_CRON_SECRET]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
  if (!acceptedSecrets.some((secret) => authorization === `Bearer ${secret}`)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  const params = new URL(request.url).searchParams
  try {
    return NextResponse.json(await importSearchConsolePerformance({ startDate: params.get("startDate") || undefined, endDate: params.get("endDate") || undefined, days: params.get("days") ? Number(params.get("days")) : undefined, siteUrl: params.get("siteUrl") || undefined }))
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Search Console import failed." }, { status: 500 })
  }
}
