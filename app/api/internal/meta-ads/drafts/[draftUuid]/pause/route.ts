import { NextRequest, NextResponse } from "next/server"

import { requireAdmin } from "@/lib/auth"
import { pauseMetaAdDraft } from "@/lib/meta-ads-campaigns"

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin")
  return origin === request.nextUrl.origin
}

export async function POST(request: NextRequest, context: { params: Promise<{ draftUuid: string }> }) {
  const session = await requireAdmin("/internal/marketing")
  if (!session.isOwner) return NextResponse.json({ ok: false, error: "Owner access is required." }, { status: 403 })
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "Cross-origin request rejected." }, { status: 403 })
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ ok: false, error: "JSON request required." }, { status: 415 })
  }
  try {
    const { draftUuid } = await context.params
    return NextResponse.json({ ok: true, ...(await pauseMetaAdDraft(draftUuid, session)) })
  } catch (error) {
    console.error("[meta-ads-pause] Pause failed", { name: error instanceof Error ? error.name : "UnknownError" })
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not pause the campaign." }, { status: 400 })
  }
}
