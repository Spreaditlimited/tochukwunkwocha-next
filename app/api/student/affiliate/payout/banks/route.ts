import { NextResponse } from "next/server"

import { listPayoutBanks } from "@/lib/affiliate-payout"
import { studentApiErrorResponse } from "@/lib/student-api-error"
import { requireStudent } from "@/lib/student-auth"

export async function GET() {
  await requireStudent()
  try {
    const banks = await listPayoutBanks()
    return NextResponse.json({ ok: true, banks })
  } catch (error) {
    return studentApiErrorResponse(error, "Could not load payout banks.", { status: 400, context: "student_payout_banks_failed" })
  }
}
