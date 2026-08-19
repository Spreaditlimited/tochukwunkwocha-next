import { NextResponse } from "next/server"

import { getLearningSupportForStudent } from "@/lib/learning-player"
import { studentApiErrorResponse } from "@/lib/student-api-error"
import { requireStudent } from "@/lib/student-auth"

function jsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? Number(item) : item))
  ) as T
}

export async function GET(request: Request) {
  try {
    const session = await requireStudent()
    const url = new URL(request.url)
    const courseSlug = String(url.searchParams.get("course") || "").trim().toLowerCase()
    if (!courseSlug) return NextResponse.json({ ok: false, error: "Choose a course and try again." }, { status: 400 })
    const support = await getLearningSupportForStudent(session.account.id, session.account.email, courseSlug)
    return NextResponse.json(jsonSafe({ ok: true, support }))
  } catch (error) {
    return studentApiErrorResponse(error, "Could not load learning support. Please try again.", { status: 503, context: "student_learning_support_failed" })
  }
}
