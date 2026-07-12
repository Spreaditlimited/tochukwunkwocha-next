import { NextResponse } from "next/server"

import { checkStudentDomainAvailability } from "@/lib/student-domain-actions"
import { requireStudent } from "@/lib/student-auth"

export async function POST(request: Request) {
  await requireStudent()
  const body = await request.json().catch(() => null)
  try {
    const result = await checkStudentDomainAvailability(body?.domainName || body?.domain_name)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not check domain." }, { status: 400 })
  }
}
