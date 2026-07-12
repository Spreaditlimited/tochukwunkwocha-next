import { NextResponse } from "next/server"

import { getStudentSession, setStudentPassword, verifyStudentPassword } from "@/lib/student-auth"

export async function POST(request: Request) {
  const session = await getStudentSession()
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })

  const currentPassword = String(body.currentPassword || "")
  const newPassword = String(body.newPassword || "")
  if (newPassword.length < 8) {
    return NextResponse.json({ ok: false, error: "New password must be at least 8 characters" }, { status: 400 })
  }
  if (currentPassword === newPassword) {
    return NextResponse.json({ ok: false, error: "New password must be different from current password" }, { status: 400 })
  }
  const valid = await verifyStudentPassword(session.account.id, currentPassword)
  if (!valid) return NextResponse.json({ ok: false, error: "Current password is incorrect" }, { status: 401 })

  await setStudentPassword(session.account.id, newPassword)
  return NextResponse.json({ ok: true, message: "Password updated successfully." })
}
