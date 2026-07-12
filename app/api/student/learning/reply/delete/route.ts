import { NextResponse } from "next/server"

import { deleteLearningReply } from "@/lib/learning-player"
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
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not delete reply." }, { status: 400 })
  }
}
