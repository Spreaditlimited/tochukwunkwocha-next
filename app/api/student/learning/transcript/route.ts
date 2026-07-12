import { NextResponse } from "next/server"

import { getStudentLessonTranscript } from "@/lib/learning-player"
import { requireStudent } from "@/lib/student-auth"

export async function POST(request: Request) {
  const session = await requireStudent()
  const body = await request.json().catch(() => null)
  const lessonId = Number(body?.lessonId || body?.lesson_id || 0)
  if (!Number.isFinite(lessonId) || lessonId <= 0) {
    return NextResponse.json({ ok: false, error: "lessonId is required" }, { status: 400 })
  }
  const result = await getStudentLessonTranscript(session.account.id, session.account.email, Math.trunc(lessonId))
  if (!result.ok) return NextResponse.json(result, { status: 404 })
  return NextResponse.json(result)
}
