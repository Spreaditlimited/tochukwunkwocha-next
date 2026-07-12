import { NextResponse } from "next/server"

import { listPayoutBanks } from "@/lib/affiliate-payout"
import { requireStudent } from "@/lib/student-auth"

export async function GET() {
  await requireStudent()
  try {
    const banks = await listPayoutBanks()
    return NextResponse.json({ ok: true, banks })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not load payout banks." }, { status: 400 })
  }
}
