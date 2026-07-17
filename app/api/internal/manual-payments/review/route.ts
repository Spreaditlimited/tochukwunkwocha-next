import { NextResponse } from "next/server"

import { canAccessDashboardPath, getAdminSession } from "@/lib/auth"
import { reviewManualPayment } from "@/lib/payments/manual-payment-review"

export async function POST(request: Request) {
  const admin = await getAdminSession()
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }
  if (!canAccessDashboardPath(admin, "/internal/manual-payments")) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const paymentUuid = String(body.paymentUuid || "").trim()
    const action = String(body.action || "").trim().toLowerCase()
    const reviewNote = String(body.reviewNote || "").trim()

    if (!paymentUuid) {
      return NextResponse.json({ ok: false, error: "Missing payment reference." }, { status: 400 })
    }
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ ok: false, error: "Invalid review action." }, { status: 400 })
    }

    const result = await reviewManualPayment({
      paymentUuid,
      action: action as "approve" | "reject",
      reviewedBy: admin.email || admin.adminUuid || "admin",
      reviewNote
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not review manual payment." },
      { status: 500 }
    )
  }
}
