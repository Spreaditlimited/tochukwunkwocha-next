import { NextResponse } from "next/server"

import { createLearningThread } from "@/lib/learning-player"
import { requireStudent } from "@/lib/student-auth"

export async function POST(request: Request) {
  const session = await requireStudent()
  const body = await request.json().catch(() => null)
  try {
    await createLearningThread({
      accountId: session.account.id,
      email: session.account.email,
      fullName: session.account.fullName,
      courseSlug: String(body?.courseSlug || body?.course_slug || ""),
      lessonId: body?.lessonId || body?.lesson_id ? Number(body.lessonId || body.lesson_id) : null,
      moduleId: body?.moduleId || body?.module_id ? Number(body.moduleId || body.module_id) : null,
      questionType: String(body?.questionType || body?.question_type || "peer"),
      title: String(body?.title || ""),
      body: String(body?.body || "")
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not create thread." }, { status: 400 })
  }
}
