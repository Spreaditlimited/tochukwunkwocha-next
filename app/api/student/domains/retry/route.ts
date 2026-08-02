import { NextResponse } from "next/server"

import { retryPaidDomainCheckout } from "@/lib/payments/domain-checkout"
import { studentApiErrorResponse } from "@/lib/student-api-error"
import { requireStudent } from "@/lib/student-auth"

export async function POST(request: Request) {
  const session = await requireStudent()
  try {
    const body = await request.json().catch(() => ({}))
    const result = await retryPaidDomainCheckout(session.account.id, body.orderUuid)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return studentApiErrorResponse(error, "Could not retry registration.", { status: 400, context: "student_domain_retry_failed" })
  }
}
