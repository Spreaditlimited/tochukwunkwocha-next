import { NextRequest, NextResponse } from "next/server"

import { matureAffiliateCommissions } from "@/lib/affiliate-alignment"

export const dynamic = "force-dynamic"

function authorized(request: NextRequest) {
  const secret = String(process.env.CRON_SECRET || "").trim()
  if (!secret) return true
  return request.headers.get("authorization") === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }
  const maturedCount = await matureAffiliateCommissions()
  return NextResponse.json({ ok: true, maturedCount })
}
