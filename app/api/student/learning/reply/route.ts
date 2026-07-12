import { NextResponse } from "next/server"

import { createLearningReply } from "@/lib/learning-player"
import { requireStudent } from "@/lib/student-auth"

export async function POST(request: Request) {
  const session = await requireStudent()
  const body = await request.json().catch(() => null)
  try {
    await createLearningReply({
      accountId: session.account.id,
      email: session.account.email,
      fullName: session.account.fullName,
      courseSlug: String(body?.courseSlug || body?.course_slug || ""),
      threadId: Number(body?.threadId || body?.thread_id || 0),
      parentReplyId: body?.parentReplyId || body?.parent_reply_id ? Number(body.parentReplyId || body.parent_reply_id) : null,
      body: String(body?.body || "")
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not create reply." }, { status: 400 })
  }
}
