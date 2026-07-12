import { NextResponse } from "next/server"

import { createDomainRegistrationRequest } from "@/lib/student-domain-actions"
import { requireStudent } from "@/lib/student-auth"

export async function POST(request: Request) {
  const session = await requireStudent()
  const body = await request.json().catch(() => null)
  try {
    const result = await createDomainRegistrationRequest({
      accountId: session.account.id,
      email: session.account.email,
      domainName: String(body?.domainName || body?.domain_name || ""),
      years: Number(body?.years || 1),
      autoRenewEnabled: body?.autoRenewEnabled === true || body?.auto_renew_enabled === true
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not create registration request." }, { status: 400 })
  }
}
