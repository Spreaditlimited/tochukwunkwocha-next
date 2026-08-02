import { NextResponse } from "next/server"

import { convertIndividualEnrollmentToGroup } from "@/lib/group-enrollment-conversion"
import { studentApiErrorResponse } from "@/lib/student-api-error"
import { getStudentSession, verifyStudentPassword } from "@/lib/student-auth"

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

export async function POST(request: Request) {
  const session = await getStudentSession()
  if (!session) return NextResponse.json({ ok: false, error: "Please sign in to continue." }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: "The request could not be processed. Please try again." }, { status: 400 })

  const sourceTypeInput = clean(body.sourceType, 40)
  if (!["course_order", "manual_payment"].includes(sourceTypeInput)) {
    return NextResponse.json({ ok: false, error: "Select a valid enrollment to move." }, { status: 400 })
  }
  const sourceType = sourceTypeInput as "course_order" | "manual_payment"
  const sourceUuid = clean(body.sourceUuid, 80)
  const childName = clean(body.childName, 180)
  const currentPassword = String(body.currentPassword || "")
  if (!sourceUuid || !childName || !currentPassword || body.confirmConversion !== true) {
    return NextResponse.json({ ok: false, error: "Complete the learner details, password, and confirmation." }, { status: 400 })
  }
  if (!await verifyStudentPassword(session.account.id, currentPassword)) {
    return NextResponse.json({ ok: false, error: "Current password is incorrect." }, { status: 401 })
  }

  try {
    const result = await convertIndividualEnrollmentToGroup({
      parentAccountId: session.account.id,
      parentName: session.account.fullName,
      parentEmail: session.account.email,
      sourceType,
      sourceUuid,
      childName,
      childAge: clean(body.childAge, 40),
      childClassLevel: clean(body.childClassLevel, 80)
    })
    return NextResponse.json({
      ...result,
      message: result.alreadyConverted
        ? "This enrollment is already in your group workspace."
        : "Enrollment moved to Group Enrollment successfully."
    })
  } catch (error) {
    const internalMessage = error instanceof Error ? error.message : String(error)
    const status = /does not belong|password/i.test(internalMessage) ? 403 : 400
    return studentApiErrorResponse(error, "The enrollment move could not be completed. Please try again.", {
      status,
      context: "individual_to_group_conversion_failed",
      details: { accountId: session.account.id.toString(), sourceType, sourceUuid }
    })
  }
}
