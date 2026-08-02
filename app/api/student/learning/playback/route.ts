import { NextResponse } from "next/server"

import { getLessonPlaybackSource } from "@/lib/learning-player"
import { studentApiErrorResponse } from "@/lib/student-api-error"
import { buildSignedLessonEmbedUrlFromRuntimeSettings } from "@/lib/learning-playback"
import { consumeServerRateLimit } from "@/lib/server-rate-limit"
import { requireStudent } from "@/lib/student-auth"

export async function POST(request: Request) {
  const session = await requireStudent()
  const rateLimit = consumeServerRateLimit({
    key: `learning-playback:${session.account.id}`,
    limit: 30,
    windowMs: 60_000
  })
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many video requests. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    )
  }
  const body = await request.json().catch(() => null)
  const lessonId = Number(body?.lessonId || body?.lesson_id || 0)
  if (!Number.isFinite(lessonId) || lessonId <= 0) {
    return NextResponse.json({ ok: false, error: "Choose a lesson and try again." }, { status: 400 })
  }

  const source = await getLessonPlaybackSource(session.account.id, session.account.email, Math.trunc(lessonId))
  if (!source.ok) return NextResponse.json({ ok: false, error: source.error }, { status: 403 })

  try {
    const playback = await buildSignedLessonEmbedUrlFromRuntimeSettings({ videoUid: source.videoUid, hlsUrl: source.hlsUrl })
    return NextResponse.json({ ok: true, playback })
  } catch (error) {
    return studentApiErrorResponse(error, "Could not load this lesson video. Please try again.", {
      status: 500,
      context: "student_lesson_playback_failed"
    })
  }
}
