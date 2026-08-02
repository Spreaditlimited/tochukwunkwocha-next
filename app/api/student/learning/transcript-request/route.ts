import { NextResponse } from "next/server"

import { requestTranscriptAccess } from "@/lib/learning-player"
import { studentApiErrorResponse } from "@/lib/student-api-error"
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
    return studentApiErrorResponse(error, "Could not request transcript access.", { status: 400, context: "student_transcript_request_failed" })
  }
}
