import { NextResponse } from "next/server"

import { getSchoolAdminSession } from "@/lib/school-auth"

export async function GET() {
  const admin = await getSchoolAdminSession()
  return NextResponse.json({ ok: Boolean(admin), admin })
}
