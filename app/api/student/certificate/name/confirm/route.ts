import { NextResponse } from "next/server"

import { confirmStudentCertificateName, requireStudent } from "@/lib/student-auth"

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
    const message = error instanceof Error ? error.message : "Could not confirm certificate name."
    return NextResponse.json({ ok: false, error: message }, { status: message.includes("already") ? 409 : 400 })
  }
}
