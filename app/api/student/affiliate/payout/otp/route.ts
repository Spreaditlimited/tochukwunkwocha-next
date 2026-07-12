import { NextResponse } from "next/server"

import { sendPayoutOtp } from "@/lib/affiliate-payout"
import { requireStudent } from "@/lib/student-auth"

export async function POST(request: Request) {
  const session = await requireStudent()
  const body = await request.json().catch(() => null)
  try {
    const result = await sendPayoutOtp({
      accountId: session.account.id,
      email: session.account.email,
      fullName: session.account.fullName,
      bankCode: String(body?.bankCode || body?.bank_code || ""),
      accountNumber: String(body?.accountNumber || body?.account_number || "")
    })
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not send verification code." }, { status: 400 })
  }
}
