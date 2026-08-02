import { NextResponse } from "next/server"

import { checkStudentDomainAvailability } from "@/lib/student-domain-actions"
import { studentApiErrorResponse } from "@/lib/student-api-error"
import { requireStudent } from "@/lib/student-auth"

export async function POST(request: Request) {
  await requireStudent()
  const body = await request.json().catch(() => null)
  try {
    const result = await checkStudentDomainAvailability(body?.domainName || body?.domain_name)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return studentApiErrorResponse(error, "Could not check domain.", { status: 400, context: "student_domain_check_failed" })
  }
}
