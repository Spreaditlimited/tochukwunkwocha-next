import { NextRequest, NextResponse } from "next/server"

import { reconcileCoursePaystackOrders } from "@/lib/payments/paystack-reconciliation"

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

  try {
    const result = await reconcileCoursePaystackOrders({
      courseSlug: "all",
      batchKey: "all",
      limit: 120
    })
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Paystack reconciliation failed."
      },
      { status: 500 }
    )
  }
}
