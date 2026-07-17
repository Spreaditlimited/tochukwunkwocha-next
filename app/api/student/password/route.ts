import { NextResponse } from "next/server"

import { createStudentSessionForAccount, getStudentSession, setStudentPassword, setStudentSessionCookie, verifyStudentPassword } from "@/lib/student-auth"

export async function POST(request: Request) {
  const session = await getStudentSession()
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })

  const currentPassword = String(body.currentPassword || "")
  const newPassword = String(body.newPassword || "")
  if (newPassword.length < 12) {
    return NextResponse.json({ ok: false, error: "New password must be at least 12 characters" }, { status: 400 })
  }
  if (currentPassword === newPassword) {
    return NextResponse.json({ ok: false, error: "New password must be different from current password" }, { status: 400 })
  }
  const valid = await verifyStudentPassword(session.account.id, currentPassword)
  if (!valid) return NextResponse.json({ ok: false, error: "Current password is incorrect" }, { status: 401 })

  const account = await setStudentPassword(session.account.id, newPassword)
  const newSession = await createStudentSessionForAccount(account)
  await setStudentSessionCookie(newSession.token)
  return NextResponse.json({ ok: true, message: "Password updated successfully." })
}
