import { NextRequest, NextResponse } from "next/server"

import { requireAdmin } from "@/lib/auth"
import { createPausedPromptToProfitCampaign, listMetaAdDrafts } from "@/lib/meta-ads-campaigns"
import { safeMetaAdsError } from "@/lib/meta-ads-api"

export const dynamic = "force-dynamic"

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin")
  return origin === request.nextUrl.origin
}

export async function GET() {
  const session = await requireAdmin("/internal/marketing")
  if (!session.isOwner) return NextResponse.json({ ok: false, error: "Owner access is required." }, { status: 403 })
  return NextResponse.json({ ok: true, drafts: await listMetaAdDrafts() }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin("/internal/marketing")
  if (!session.isOwner) return NextResponse.json({ ok: false, error: "Owner access is required." }, { status: 403 })
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "Cross-origin request rejected." }, { status: 403 })
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ ok: false, error: "JSON request required." }, { status: 415 })
  }
  try {
    const body = await request.json()
    const result = await createPausedPromptToProfitCampaign(body, session)
    return NextResponse.json({ ok: true, ...result }, { status: 201 })
  } catch (error) {
    console.error("[meta-ads-drafts] Paused campaign creation failed", { name: error instanceof Error ? error.name : "UnknownError" })
    return NextResponse.json({ ok: false, error: safeMetaAdsError(error) }, { status: 400 })
  }
}
