import { NextResponse } from "next/server"

import { consumeStudentPasswordResetToken, createStudentSessionForAccount, setStudentSessionCookie } from "@/lib/student-auth"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })

  const token = String(body.token || "").trim()
  const password = String(body.password || "")
  if (!token || password.length < 12) {
    return NextResponse.json({ ok: false, error: "Valid token and password (12+ chars) are required" }, { status: 400 })
  }

  try {
    const account = await consumeStudentPasswordResetToken(token, password)
    const session = await createStudentSessionForAccount(account)
    await setStudentSessionCookie(session.token)
    return NextResponse.json({
      ok: true,
      account: {
        id: Number(account.id),
        email: account.email,
        fullName: account.fullName
      }
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not reset password" },
      { status: 400 }
    )
  }
}
