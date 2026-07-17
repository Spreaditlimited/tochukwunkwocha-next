import { NextResponse } from "next/server"

import { checkStudentDomainAvailability } from "@/lib/student-domain-actions"
import { supportedCheckoutDomain } from "@/lib/payments/domain-checkout"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const result = await checkStudentDomainAvailability(supportedCheckoutDomain(body.domainName || body.domain_name))
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Domain lookup is temporarily unavailable." }, { status: 503 })
  }
}
