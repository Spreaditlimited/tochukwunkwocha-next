import { NextResponse } from "next/server"

import { confirmStudentCertificateName, requireStudent } from "@/lib/student-auth"
import { studentApiErrorResponse } from "@/lib/student-api-error"

export async function POST() {
  try {
    const session = await requireStudent()
    const account = await confirmStudentCertificateName(session.account.id)
    return NextResponse.json({
      ok: true,
      certificateNameConfirmedAt: account.certificateNameConfirmedAt?.toISOString() || null,
      message: "Certificate name confirmed."
    })
  } catch (error) {
    return studentApiErrorResponse(error, "Could not confirm certificate name.", {
      status: error instanceof Error && error.message.includes("already") ? 409 : 400,
      context: "student_certificate_name_confirm_failed"
    })
  }
}
