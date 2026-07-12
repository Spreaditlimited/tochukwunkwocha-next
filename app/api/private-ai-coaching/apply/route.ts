import { NextResponse } from "next/server"

import { createPrivateCoachingLead } from "@/lib/payments/service-checkout"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const result = await createPrivateCoachingLead(body)
    return NextResponse.json({ ok: true, leadUuid: result.leadUuid, checkoutUrl: `/checkout/private-ai-coaching-discovery?lead=${encodeURIComponent(result.leadUuid)}` })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not submit coaching application." }, { status: 400 })
  }
}
