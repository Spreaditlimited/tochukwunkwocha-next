import { NextResponse } from "next/server"

import { createLearningAssignment } from "@/lib/learning-player"
import { requireStudent } from "@/lib/student-auth"

export async function POST(request: Request) {
  const session = await requireStudent()
  const body = await request.json().catch(() => null)
  try {
    await createLearningAssignment({
      accountId: session.account.id,
      email: session.account.email,
      fullName: session.account.fullName,
      courseSlug: String(body?.courseSlug || body?.course_slug || ""),
      lessonId: body?.lessonId || body?.lesson_id ? Number(body.lessonId || body.lesson_id) : null,
      moduleId: body?.moduleId || body?.module_id ? Number(body.moduleId || body.module_id) : null,
      submissionKind: String(body?.submissionKind || body?.submission_kind || "text"),
      submissionText: String(body?.submissionText || body?.submission_text || ""),
      submissionLink: String(body?.submissionLink || body?.submission_link || ""),
      screenshotUrls: Array.isArray(body?.screenshotUrls || body?.screenshot_urls)
        ? (body.screenshotUrls || body.screenshot_urls).map((url: unknown) => String(url || ""))
        : []
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not submit assignment." }, { status: 400 })
  }
}
