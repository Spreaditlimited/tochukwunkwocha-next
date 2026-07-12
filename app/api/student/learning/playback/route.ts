import { NextResponse } from "next/server"

import { getLessonPlaybackSource } from "@/lib/learning-player"
import { buildSignedLessonEmbedUrlFromRuntimeSettings } from "@/lib/learning-playback"
import { requireStudent } from "@/lib/student-auth"

export async function POST(request: Request) {
  const session = await requireStudent()
  const body = await request.json().catch(() => null)
  const lessonId = Number(body?.lessonId || body?.lesson_id || 0)
  if (!Number.isFinite(lessonId) || lessonId <= 0) {
    return NextResponse.json({ ok: false, error: "lessonId is required" }, { status: 400 })
  }

  const source = await getLessonPlaybackSource(session.account.id, session.account.email, Math.trunc(lessonId))
  if (!source.ok) return NextResponse.json({ ok: false, error: source.error }, { status: 403 })

  try {
    const playback = await buildSignedLessonEmbedUrlFromRuntimeSettings({ videoUid: source.videoUid, hlsUrl: source.hlsUrl })
    return NextResponse.json({ ok: true, playback })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not issue lesson playback token." },
      { status: 500 }
    )
  }
}
