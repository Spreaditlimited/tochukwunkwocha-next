import { NextResponse } from "next/server"

import { studentApiErrorResponse } from "@/lib/student-api-error"

import { CERTIFICATE_PROOF_MARKER, getLearnerCertificateBatchKey } from "@/lib/certificate-eligibility"
import {
  addCertificateProofMessage,
  notifyCertificateProofAdmins
} from "@/lib/certificate-proof-conversation"
import { prisma } from "@/lib/prisma"
import { requireStudent } from "@/lib/student-auth"


function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

export async function POST(request: Request) {
  try {
    const session = await requireStudent()
    const body = await request.json().catch(() => null)
    const courseSlug = clean(body?.courseSlug || body?.course_slug, 120).toLowerCase()
    const message = clean(body?.message, 8000)
    if (!courseSlug) return NextResponse.json({ ok: false, error: "Course is required." }, { status: 400 })
    if (message.length < 2) return NextResponse.json({ ok: false, error: "Message is too short." }, { status: 400 })
    const email = session.account.email.toLowerCase()
    const batchKey = await getLearnerCertificateBatchKey(session.account.id, email, courseSlug)
    const rows = await prisma.$queryRaw<Array<{ id: bigint; status: string }>>`
      SELECT id, status
      FROM tochukwu_learning_assignments
      WHERE account_id = ${session.account.id}
        AND LOWER(student_email) COLLATE utf8mb4_general_ci = ${email}
        AND course_slug = ${courseSlug}
        AND submission_kind = 'link'
        AND submission_text = ${CERTIFICATE_PROOF_MARKER}
        AND COALESCE(certificate_batch_key, '') = ${batchKey}
      ORDER BY id DESC
      LIMIT 1
    `
    const proof = rows[0]
    if (!proof) {
      return NextResponse.json({ ok: false, error: "Submit your certificate proof before starting a review conversation." }, { status: 400 })
    }
    await addCertificateProofMessage({
      assignmentId: proof.id,
      courseSlug,
      accountId: session.account.id,
      authorType: "student",
      authorRef: email,
      authorName: session.account.fullName,
      messageType: "student_message",
      body: message
    })
    await prisma.$executeRaw`
      INSERT INTO tochukwu_learning_assignment_events
        (assignment_id, actor_type, actor_ref, event_type, event_note, metadata_json, created_at)
      VALUES
        (${proof.id}, 'student', ${email}, 'message_sent', ${message.slice(0, 800)},
         ${JSON.stringify({ source: "certificate_proof_review" })}, ${new Date()})
    `.catch(() => null)
    const notification = await notifyCertificateProofAdmins({
      assignmentId: proof.id,
      studentName: session.account.fullName,
      studentEmail: email,
      courseSlug,
      subject: "New Student Message About Certificate Proof",
      message
    }).catch(() => ({
      attempted: true,
      sent: false,
      error: "The message was saved, but the email notification could not be delivered."
    }))
    return NextResponse.json({ ok: true, notification })
  } catch (error) {
    return studentApiErrorResponse(error, "Could not send certificate proof message.", {
      status: 500,
      context: "student_certificate_proof_message_failed"
    })
  }
}
