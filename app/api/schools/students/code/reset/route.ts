import { NextResponse } from "next/server"

import { getSchoolAdminSession } from "@/lib/school-auth"
import { resetSchoolStudentCode } from "@/lib/school-dashboard"

export async function POST(request: Request) {
  const session = await getSchoolAdminSession()
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => null)
  const studentId = Number(body?.studentId || 0)
  if (!Number.isSafeInteger(studentId) || studentId <= 0) {
    return NextResponse.json({ ok: false, error: "A valid student is required." }, { status: 400 })
  }

  try {
    const result = await resetSchoolStudentCode({
      schoolId: session.schoolId,
      studentId,
      adminId: session.id
    })
    return NextResponse.json({ ok: true, newCode: result.newCode })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not reset the access code."
    const status = /not found/i.test(message) ? 404 : 409
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
