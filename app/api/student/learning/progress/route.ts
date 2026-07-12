import { NextResponse } from "next/server"

import { saveStudentLessonProgress } from "@/lib/learning-player"
import { requireStudent } from "@/lib/student-auth"

export async function POST(request: Request) {
  const session = await requireStudent()
  const body = await request.json().catch(() => null)
  const lessonId = Number(body?.lessonId || body?.lesson_id || 0)
  if (!Number.isFinite(lessonId) || lessonId <= 0) {
    return NextResponse.json({ ok: false, error: "lessonId is required" }, { status: 400 })
  }

  const result = await saveStudentLessonProgress({
    accountId: session.account.id,
    email: session.account.email,
    lessonId: Math.trunc(lessonId),
    markComplete: !!(body?.markComplete || body?.mark_complete),
    watchSeconds: Number(body?.watchSeconds || body?.watch_seconds || 0)
  })
  if (!result.ok) return NextResponse.json(result, { status: 403 })
  return NextResponse.json(result)
}
