import { NextResponse } from "next/server"

import { resolvePayoutAccount } from "@/lib/affiliate-payout"
import { studentApiErrorResponse } from "@/lib/student-api-error"
import { requireStudent } from "@/lib/student-auth"

export async function POST(request: Request) {
  await requireStudent()
  const body = await request.json().catch(() => null)
  try {
    const result = await resolvePayoutAccount({
      bankCode: String(body?.bankCode || body?.bank_code || ""),
      accountNumber: String(body?.accountNumber || body?.account_number || "")
    })
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    return studentApiErrorResponse(error, "Could not resolve account.", { status: 400, context: "student_payout_resolve_failed" })
  }
}
