import { NextResponse } from "next/server"

import { loadStudentDomainDns, saveDnsUpdateRequest } from "@/lib/student-domain-actions"
import { requireStudent } from "@/lib/student-auth"

export async function GET(request: Request) {
  const session = await requireStudent()
  try {
    const domainName = new URL(request.url).searchParams.get("domainName") || ""
    const result = await loadStudentDomainDns(session.account.id, domainName)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not load DNS zone." }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const session = await requireStudent()
  const body = await request.json().catch(() => null)
  try {
    const result = await saveDnsUpdateRequest({
      accountId: session.account.id,
      email: session.account.email,
      domainName: String(body?.domainName || body?.domain_name || ""),
      records: Array.isArray(body?.records) ? body.records : []
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not submit DNS update." }, { status: 400 })
  }
}
