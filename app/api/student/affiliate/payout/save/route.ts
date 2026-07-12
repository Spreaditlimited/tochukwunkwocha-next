import { NextResponse } from "next/server"

import { savePayoutAccount } from "@/lib/affiliate-payout"
import { requireStudent } from "@/lib/student-auth"

export async function POST(request: Request) {
  const session = await requireStudent()
  const body = await request.json().catch(() => null)
  try {
    const result = await savePayoutAccount({
      accountId: session.account.id,
      bankCode: String(body?.bankCode || body?.bank_code || ""),
      bankName: String(body?.bankName || body?.bank_name || ""),
      accountNumber: String(body?.accountNumber || body?.account_number || ""),
      accountName: String(body?.accountName || body?.account_name || ""),
      otpCode: String(body?.otpCode || body?.otp_code || ""),
      payoutEmail: String(body?.payoutEmail || body?.payout_email || "")
    })
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not save payout account." }, { status: 400 })
  }
}
