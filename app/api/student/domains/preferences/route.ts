import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { requireStudent } from "@/lib/student-auth"

export async function POST(request: Request) {
  const session = await requireStudent()
  try {
    const body = await request.json().catch(() => ({}))
    const enabled = body.autoRenewEnabled === true
    await prisma.studentAccount.update({
      where: { accountUuid: session.account.accountUuid },
      data: { domainsAutoRenewEnabled: enabled, updatedAt: new Date() }
    })
    return NextResponse.json({ ok: true, autoRenewEnabled: enabled })
  } catch {
    return NextResponse.json({ ok: false, error: "Could not save preference." }, { status: 400 })
  }
}
