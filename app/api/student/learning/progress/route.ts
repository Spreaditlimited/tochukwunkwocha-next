import { NextResponse } from "next/server"

import { saveStudentLessonProgress } from "@/lib/learning-player"
import { consumeServerRateLimit } from "@/lib/server-rate-limit"
import { requireStudent } from "@/lib/student-auth"

export async function POST(request: Request) {
  const session = await requireStudent()
  const rateLimit = consumeServerRateLimit({
    key: `learning-progress:${session.account.id}`,
    limit: 20,
    windowMs: 60_000
  })
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Progress is being saved too frequently. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    )
  }
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
    watchSeconds: Math.min(120, Number(body?.watchSeconds || body?.watch_seconds || 0))
  })
  if (!result.ok) return NextResponse.json(result, { status: 403 })
  return NextResponse.json(result)
}
