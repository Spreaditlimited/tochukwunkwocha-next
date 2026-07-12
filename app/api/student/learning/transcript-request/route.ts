import { NextResponse } from "next/server"

import { requestTranscriptAccess } from "@/lib/learning-player"
import { requireStudent } from "@/lib/student-auth"

export async function POST(request: Request) {
  const session = await requireStudent()
  const body = await request.json().catch(() => null)
  try {
    await requestTranscriptAccess({
      accountId: session.account.id,
      email: session.account.email,
      courseSlug: String(body?.courseSlug || body?.course_slug || ""),
      lessonId: body?.lessonId || body?.lesson_id ? Number(body.lessonId || body.lesson_id) : null,
      reason: String(body?.reason || "")
    })
    return NextResponse.json({
      ok: true,
      message: "Transcript access request submitted for review.",
      transcript_access: { allowed: false, status: "pending" }
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not request transcript access." }, { status: 400 })
  }
}
