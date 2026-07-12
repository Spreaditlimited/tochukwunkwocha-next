import crypto from "crypto"
import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

type ImportRow = {
  page?: string
  pageUrl?: string
  url?: string
  query?: string
  clicks?: number
  impressions?: number
  ctr?: number
  position?: number
}

function blogSlugFromUrl(value: string) {
  try {
    const url = new URL(value)
    const match = url.pathname.match(/^\/blog\/([^/]+)\/?$/)
    return match?.[1] || null
  } catch {
    const match = value.match(/\/blog\/([^/]+)\/?$/)
    return match?.[1] || null
  }
}

function classify(row: Required<Pick<ImportRow, "clicks" | "impressions" | "ctr" | "position">>) {
  if (row.impressions >= 100 && row.ctr < 0.015 && row.position <= 12) return "low_ctr"
  if (row.impressions >= 50 && row.position > 8 && row.position <= 25) return "ranking_push"
  return null
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const rows: ImportRow[] = Array.isArray(body?.rows) ? body.rows : Array.isArray(body) ? body : []
  if (!rows.length) return NextResponse.json({ error: "rows array is required" }, { status: 400 })

  const runUuid = `sc_run_${crypto.randomUUID()}`
  const now = new Date()

  await prisma.tochukwuSearchConsoleImportRun.create({
    data: {
      runUuid,
      source: String(body?.source || "manual_json").slice(0, 40),
      status: "running",
      startedAt: now,
      sourceStartDate: body?.startDate ? new Date(body.startDate) : null,
      sourceEndDate: body?.endDate ? new Date(body.endDate) : null,
      rowCount: 0,
      createdAt: now,
      updatedAt: now
    }
  })

  let imported = 0
  let opportunities = 0

  for (const input of rows.slice(0, 5000)) {
    const pageUrl = String(input.pageUrl || input.page || input.url || "").trim()
    const query = String(input.query || "").trim()
    if (!pageUrl || !query) continue

    const clicks = Number(input.clicks || 0)
    const impressions = Number(input.impressions || 0)
    const ctr = Number(input.ctr || 0)
    const position = Number(input.position || 0)
    const blogSlug = blogSlugFromUrl(pageUrl)
    const blog = blogSlug
      ? await prisma.tochukwuBlogPost.findUnique({
          where: { blogSlug },
          select: { pidBlog: true }
        })
      : null

    await prisma.tochukwuSearchConsoleQueryStat.create({
      data: {
        statUuid: `sc_stat_${crypto.randomUUID()}`,
        runUuid,
        pageUrl,
        blogSlug,
        query,
        clicks,
        impressions,
        ctr,
        position,
        startDate: body?.startDate ? new Date(body.startDate) : null,
        endDate: body?.endDate ? new Date(body.endDate) : null
      }
    })
    imported += 1

    const opportunityType = classify({ clicks, impressions, ctr, position })
    if (opportunityType && blogSlug) {
      await prisma.tochukwuSeoOpportunity.create({
        data: {
          pidOpportunity: `seo_opp_${crypto.randomUUID()}`,
          pageUrl,
          blogSlug,
          pidBlog: blog?.pidBlog || null,
          opportunityType,
          primaryQuery: query,
          clicks,
          impressions,
          ctr,
          position,
          confidence: Math.min(1, impressions / 1000 + (opportunityType === "low_ctr" ? 0.25 : 0.15)),
          status: "open",
          recommendation:
            opportunityType === "low_ctr"
              ? "Improve title/meta description alignment and add stronger intent-matched FAQ/CTA."
              : "Refresh content around the query, improve internal links, and answer search intent more directly.",
          recommendedCta: blogSlug.includes("school") || query.toLowerCase().includes("school") ? "ai_for_schools" : "prompt_to_profit",
          sourceStartDate: body?.startDate ? new Date(body.startDate) : null,
          sourceEndDate: body?.endDate ? new Date(body.endDate) : null
        }
      })
      opportunities += 1
    }
  }

  await prisma.tochukwuSearchConsoleImportRun.update({
    where: { runUuid },
    data: { status: "completed", completedAt: new Date(), rowCount: imported, updatedAt: new Date() }
  })

  return NextResponse.json({ runUuid, imported, opportunities })
}
