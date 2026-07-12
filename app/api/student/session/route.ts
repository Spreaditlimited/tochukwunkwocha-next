import { NextResponse } from "next/server"

import { requireStudent } from "@/lib/student-auth"

export async function GET() {
  try {
    const session = await requireStudent()
    return NextResponse.json({
      ok: true,
      account: {
        accountUuid: session.account.accountUuid,
        fullName: session.account.fullName,
        email: session.account.email,
        domainsAutoRenewEnabled: session.account.domainsAutoRenewEnabled === true,
        certificateNameConfirmedAt: session.account.certificateNameConfirmedAt?.toISOString() || null,
        certificateNameUpdatedAt: session.account.certificateNameUpdatedAt?.toISOString() || null,
        certificateNameNeedsConfirmation: !session.account.certificateNameConfirmedAt
      }
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 })
  }
}
