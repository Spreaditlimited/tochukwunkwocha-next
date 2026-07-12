import { NextResponse } from "next/server"

import { createBuildScorecardLead } from "@/lib/payments/service-checkout"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const result = await createBuildScorecardLead(body)
    return NextResponse.json({ ok: true, leadUuid: result.leadUuid, checkoutUrl: `/checkout/build-discovery?lead=${encodeURIComponent(result.leadUuid)}` })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not submit build scorecard." }, { status: 400 })
  }
}
