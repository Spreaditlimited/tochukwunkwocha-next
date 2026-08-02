import { NextResponse } from "next/server"

import { saveNameserverUpdateRequest } from "@/lib/student-domain-actions"
import { studentApiErrorResponse } from "@/lib/student-api-error"
import { requireStudent } from "@/lib/student-auth"

export async function POST(request: Request) {
  const session = await requireStudent()
  const body = await request.json().catch(() => null)
  try {
    const result = await saveNameserverUpdateRequest({
      accountId: session.account.id,
      email: session.account.email,
      domainName: String(body?.domainName || body?.domain_name || ""),
      nameservers: Array.isArray(body?.nameservers) ? body.nameservers.map((item: unknown) => String(item || "")) : []
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return studentApiErrorResponse(error, "Could not submit nameserver update.", { status: 400, context: "student_nameserver_update_failed" })
  }
}
