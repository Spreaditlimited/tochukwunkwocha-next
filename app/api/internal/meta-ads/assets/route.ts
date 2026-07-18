import { NextResponse } from "next/server"

import { requireAdmin } from "@/lib/auth"
import { discoverMetaAdsAssets } from "@/lib/meta-ads-campaigns"
import { safeMetaAdsError } from "@/lib/meta-ads-api"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await requireAdmin("/internal/marketing")
  if (!session.isOwner) return NextResponse.json({ ok: false, error: "Owner access is required." }, { status: 403 })
  try {
    return NextResponse.json({ ok: true, assets: await discoverMetaAdsAssets() }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("[meta-ads-assets] Asset discovery failed", { name: error instanceof Error ? error.name : "UnknownError" })
    return NextResponse.json({ ok: false, error: safeMetaAdsError(error) }, { status: 502 })
  }
}
