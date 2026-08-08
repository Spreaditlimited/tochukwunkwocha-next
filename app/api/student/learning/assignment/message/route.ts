import { NextResponse } from "next/server"

import { addCertificateProofMessage, notifyCertificateProofAdmins } from "@/lib/certificate-proof-conversation"
import { ensureLearningSupportTables } from "@/lib/learning-player"
import { prisma } from "@/lib/prisma"
import { studentApiErrorResponse } from "@/lib/student-api-error"
import { requireStudent } from "@/lib/student-auth"

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

export async function POST(request: Request) {
  const session = await requireStudent()
  try {
    await ensureLearningSupportTables()
    const body = await request.json().catch(() => null)
    const assignmentId = BigInt(clean(body?.assignmentId || body?.assignment_id, 30) || "0")
    const courseSlug = clean(body?.courseSlug || body?.course_slug, 120).toLowerCase()
    const message = clean(body?.message, 8000)
    if (assignmentId <= BigInt(0) || !courseSlug) throw new Error("Assignment and course are required.")
    if (message.length < 2) throw new Error("Message is too short.")
    const rows = await prisma.$queryRaw<Array<{ id: bigint }>>`
      SELECT id
      FROM tochukwu_learning_assignments
      WHERE id = ${assignmentId}
        AND account_id = ${session.account.id}
        AND course_slug = ${courseSlug}
      LIMIT 1
    `
    if (!rows[0]) throw new Error("Assignment not found.")
    await addCertificateProofMessage({
      assignmentId,
      courseSlug,
      accountId: session.account.id,
      authorType: "student",
      authorRef: session.account.email.toLowerCase(),
      authorName: session.account.fullName,
      messageType: "student_message",
      body: message
    })
    await prisma.$executeRaw`
      INSERT INTO tochukwu_learning_assignment_events
        (assignment_id, actor_type, actor_ref, event_type, event_note, metadata_json, created_at)
      VALUES
        (${assignmentId}, 'student', ${session.account.email.toLowerCase()}, 'message_sent', ${message.slice(0, 800)},
         ${JSON.stringify({ source: "learner_assignment_dashboard" })}, ${new Date()})
    `.catch(() => null)
    const notification = await notifyCertificateProofAdmins({
      assignmentId,
      studentName: session.account.fullName,
      studentEmail: session.account.email.toLowerCase(),
      courseSlug,
      subject: "New Private Learning Support Message",
      message
    }).catch(() => ({ attempted: true, sent: false, error: "The reply was saved, but the admin email notification failed." }))
    return NextResponse.json({ ok: true, notification })
  } catch (error) {
    return studentApiErrorResponse(error, "Could not send assignment reply.", { status: 400, context: "student_assignment_reply_failed" })
  }
}
