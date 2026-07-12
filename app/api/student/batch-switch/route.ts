import { NextResponse } from "next/server"

import { switchEnrollmentBatch } from "@/lib/student-batch-switch"
import { getStudentSession } from "@/lib/student-auth"

export async function POST(request: Request) {
  const session = await getStudentSession()
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })

  try {
    const result = await switchEnrollmentBatch(session.account, {
      sourceType: String(body.sourceType || ""),
      sourceId: String(body.sourceId || ""),
      targetBatchKey: String(body.targetBatchKey || "")
    })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not change batch."
    const status = /not found|incomplete|required/i.test(message) ? 400 : 409
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
