import { NextResponse } from "next/server"

import { switchEnrollmentBatch } from "@/lib/student-batch-switch"
import { studentApiErrorResponse } from "@/lib/student-api-error"
import { getStudentSession } from "@/lib/student-auth"

export async function POST(request: Request) {
  const session = await getStudentSession()
  if (!session) return NextResponse.json({ ok: false, error: "Please sign in to continue." }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: "The request could not be processed. Please try again." }, { status: 400 })

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
    return studentApiErrorResponse(error, "Could not change batch.", { status, context: "student_batch_switch_failed" })
  }
}
