import { NextResponse } from "next/server"

import { deleteLearningReply } from "@/lib/learning-player"
import { studentApiErrorResponse } from "@/lib/student-api-error"
import { requireStudent } from "@/lib/student-auth"

export async function POST(request: Request) {
  const session = await requireStudent()
  const body = await request.json().catch(() => null)
  try {
    await deleteLearningReply({
      accountId: session.account.id,
      email: session.account.email,
      courseSlug: String(body?.courseSlug || body?.course_slug || ""),
      replyId: Number(body?.replyId || body?.reply_id || 0)
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return studentApiErrorResponse(error, "Could not delete reply.", { status: 400, context: "student_reply_delete_failed" })
  }
}
