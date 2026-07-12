import { NextResponse } from "next/server"

import { getStudentSession, revokeOtherStudentSessions, revokeStudentSession } from "@/lib/student-auth"

export async function POST(request: Request) {
  const session = await getStudentSession()
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })

  if (body.action === "revoke_others") {
    await revokeOtherStudentSessions(session.account.id, session.token)
    return NextResponse.json({ ok: true })
  }

  const sessionUuid = String(body.sessionUuid || "").trim()
  if (!sessionUuid) return NextResponse.json({ ok: false, error: "Session is required" }, { status: 400 })
  await revokeStudentSession(session.account.id, sessionUuid, session.token)
  return NextResponse.json({ ok: true })
}
