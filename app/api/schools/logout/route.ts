import { NextResponse } from "next/server"

import { clearSchoolAdminSession } from "@/lib/school-auth"

export async function POST() {
  await clearSchoolAdminSession()
  return NextResponse.json({ ok: true })
}
