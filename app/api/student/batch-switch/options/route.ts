import { NextResponse } from "next/server"

import { getBatchSwitchOptions } from "@/lib/student-batch-switch"
import { getStudentSession } from "@/lib/student-auth"

export async function GET() {
  const session = await getStudentSession()
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const enrollments = await getBatchSwitchOptions(session.account)
  return NextResponse.json({ ok: true, enrollments })
}
