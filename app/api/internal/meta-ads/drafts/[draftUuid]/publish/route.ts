import { NextRequest, NextResponse } from "next/server"

import { requireAdmin } from "@/lib/auth"
import { publishMetaAdDraft } from "@/lib/meta-ads-campaigns"

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
    const [{ draftUuid }, body] = await Promise.all([context.params, request.json()])
    return NextResponse.json({ ok: true, ...(await publishMetaAdDraft(draftUuid, String(body.confirmation || ""), session)) })
  } catch (error) {
    console.error("[meta-ads-publish] Publish failed", { name: error instanceof Error ? error.name : "UnknownError" })
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not publish the campaign." }, { status: 400 })
  }
}
