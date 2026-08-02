import { NextResponse } from "next/server"

import { moveFamilyLearnerBatch } from "@/lib/family-enrollment"
import { studentApiErrorResponse } from "@/lib/student-api-error"
import { getStudentSession } from "@/lib/student-auth"

export async function POST(request: Request) {
  const session = await getStudentSession()
  if (!session) return NextResponse.json({ ok: false, error: "Please sign in to continue." }, { status: 401 })

  const body = await request.json().catch(() => null)
  const childId = Number(body?.childId || 0)
  const targetBatchKey = String(body?.targetBatchKey || "").trim()
  if (!Number.isSafeInteger(childId) || childId <= 0 || !targetBatchKey) {
    return NextResponse.json({ ok: false, error: "Learner and target batch are required." }, { status: 400 })
  }

  try {
    const result = await moveFamilyLearnerBatch({
      parentAccountId: session.account.id,
      childId,
      targetBatchKey
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not change the learner's batch."
    const status = /not found|incomplete|required|does not belong/i.test(message) ? 400 : 409
    return studentApiErrorResponse(error, "Could not change the learner's batch.", { status, context: "student_group_batch_change_failed" })
  }
}
