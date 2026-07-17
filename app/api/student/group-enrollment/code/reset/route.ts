import { NextResponse } from "next/server"

import { resetFamilyChildAccessCode } from "@/lib/family-enrollment"
import { getStudentSession } from "@/lib/student-auth"

export async function POST(request: Request) {
  const session = await getStudentSession()
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => null)
  const childId = Number(body?.childId || 0)
  if (!Number.isSafeInteger(childId) || childId <= 0) {
    return NextResponse.json({ ok: false, error: "A valid learner is required." }, { status: 400 })
  }

  try {
    const result = await resetFamilyChildAccessCode({
      parentAccountId: session.account.id,
      childId
    })
    return NextResponse.json({ ok: true, newCode: result.newCode })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not reset the access code."
    const status = /not found/i.test(message) ? 404 : 409
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
