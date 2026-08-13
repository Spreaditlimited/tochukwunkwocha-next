import { NextRequest, NextResponse } from "next/server"

import { reconcileCoursePaystackOrders } from "@/lib/payments/paystack-reconciliation"
import { reconcilePaidGroupOrders } from "@/lib/payments/group-order-reconciliation"
import { acquireAutomationLease, releaseAutomationLease } from "@/lib/automation-leases"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const AUTOMATION_KEY = "paystack-provider-work"

function authorized(request: NextRequest) {
  const secret = String(process.env.CRON_SECRET || "").trim()
  if (!secret) return true
  return request.headers.get("authorization") === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const leaseToken = await acquireAutomationLease(AUTOMATION_KEY, 540)
  if (!leaseToken) {
    return NextResponse.json({ ok: true, skipped: true, reason: "reconciliation_already_running" })
  }
  try {
    const paystack = await reconcileCoursePaystackOrders({
      courseSlug: "all",
      batchKey: "all",
      limit: 120
    })
    const groupOrders = await reconcilePaidGroupOrders({ limit: 120, minimumAgeMinutes: 5 })
    return NextResponse.json({ ok: true, result: paystack, groupOrders })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Paystack reconciliation failed."
      },
      { status: 500 }
    )
  } finally {
    await releaseAutomationLease(AUTOMATION_KEY, leaseToken).catch(() => null)
  }
}
