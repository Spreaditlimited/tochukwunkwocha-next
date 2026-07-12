import { NextResponse } from "next/server"

import { createSchoolAdminSession, verifySchoolAdminCredentials } from "@/lib/school-auth"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 })
  const admin = await verifySchoolAdminCredentials({ email: body.email, password: body.password })
  if (!admin?.id) return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 })
  await createSchoolAdminSession(Number(admin.id))
  return NextResponse.json({ ok: true })
}
