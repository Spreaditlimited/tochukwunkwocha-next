import { NextResponse } from "next/server"

import { getStudentSession } from "@/lib/student-auth"
import { studentApiErrorResponse } from "@/lib/student-api-error"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    const session = await getStudentSession()
    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Please sign in to continue." },
        { status: 401, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
      )
    }
    const response = NextResponse.json({
      ok: true,
      account: {
        accountUuid: session.account.accountUuid,
        fullName: session.account.fullName,
        email: session.account.email,
        profilePictureUrl: session.account.profilePictureUrl,
        domainsAutoRenewEnabled: session.account.domainsAutoRenewEnabled === true,
        certificateNameConfirmedAt: session.account.certificateNameConfirmedAt?.toISOString() || null,
        certificateNameUpdatedAt: session.account.certificateNameUpdatedAt?.toISOString() || null,
        certificateNameNeedsConfirmation: !session.account.certificateNameConfirmedAt
      }
    })
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate")
    return response
  } catch (error) {
    return studentApiErrorResponse(error, "Your session could not be verified. Please sign in again.", {
      status: 401,
      context: "student_session_load_failed",
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" }
    })
  }
}
