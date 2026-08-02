import crypto from "crypto"
import { Prisma } from "@prisma/client"

import { sendEmail } from "@/lib/email"
import { prisma } from "@/lib/prisma"
import { publicSiteUrl } from "@/lib/public-site-url"


export type CertificateProofMessage = {
  id: number
  messageUuid: string
  assignmentId: number
  authorType: "student" | "admin" | "system"
  authorName: string
  messageType: string
  body: string
  createdAt: Date | null
}

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function escapeHtml(value: unknown) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function siteBaseUrl() {
  return publicSiteUrl()
}

export async function ensureCertificateProofConversationTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_learning_assignment_messages (
      id BIGINT NOT NULL AUTO_INCREMENT,
      message_uuid VARCHAR(64) NOT NULL,
      assignment_id BIGINT NOT NULL,
      course_slug VARCHAR(120) NOT NULL,
      account_id BIGINT NOT NULL,
      author_type VARCHAR(24) NOT NULL,
      author_ref VARCHAR(220) NULL,
      author_name VARCHAR(180) NULL,
      message_type VARCHAR(32) NOT NULL DEFAULT 'message',
      body TEXT NOT NULL,
      read_by_student_at DATETIME NULL,
      read_by_admin_at DATETIME NULL,
      created_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_learning_assignment_message_uuid (message_uuid),
      KEY idx_tochukwu_learning_assignment_message_thread (assignment_id, created_at),
      KEY idx_tochukwu_learning_assignment_message_admin (read_by_admin_at, created_at),
      KEY idx_tochukwu_learning_assignment_message_student (account_id, read_by_student_at, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}

export async function listCertificateProofMessages(
  assignmentId: bigint,
  input?: { accountId?: bigint; markStudentRead?: boolean; markAdminRead?: boolean }
) {
  await ensureCertificateProofConversationTable()
  const accountId = input?.accountId
  const rows = await prisma.$queryRaw<Array<{
    id: bigint
    messageUuid: string
    assignmentId: bigint
    authorType: string
    authorName: string | null
    messageType: string
    body: string
    createdAt: Date | null
  }>>(Prisma.sql`
    SELECT id, message_uuid AS messageUuid, assignment_id AS assignmentId,
      author_type AS authorType, author_name AS authorName,
      message_type AS messageType, body, created_at AS createdAt
    FROM tochukwu_learning_assignment_messages
    WHERE assignment_id = ${assignmentId}
      ${accountId ? Prisma.sql`AND account_id = ${accountId}` : Prisma.empty}
    ORDER BY id ASC
  `)
  const now = new Date()
  if (input?.markStudentRead) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE tochukwu_learning_assignment_messages
      SET read_by_student_at = COALESCE(read_by_student_at, ${now})
      WHERE assignment_id = ${assignmentId}
        ${accountId ? Prisma.sql`AND account_id = ${accountId}` : Prisma.empty}
        AND author_type IN ('admin', 'system')
    `)
  }
  if (input?.markAdminRead) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE tochukwu_learning_assignment_messages
      SET read_by_admin_at = COALESCE(read_by_admin_at, ${now})
      WHERE assignment_id = ${assignmentId}
        AND author_type = 'student'
    `)
  }
  return rows.map((row) => ({
    id: Number(row.id || 0),
    messageUuid: clean(row.messageUuid, 64),
    assignmentId: Number(row.assignmentId || 0),
    authorType: (["student", "admin", "system"].includes(clean(row.authorType, 24))
      ? clean(row.authorType, 24)
      : "system") as CertificateProofMessage["authorType"],
    authorName: clean(row.authorName, 180),
    messageType: clean(row.messageType, 32),
    body: clean(row.body, 20000),
    createdAt: row.createdAt
  }))
}

export async function addCertificateProofMessage(input: {
  assignmentId: bigint
  courseSlug: string
  accountId: bigint
  authorType: "student" | "admin" | "system"
  authorRef?: string
  authorName?: string
  messageType?: string
  body: string
}) {
  await ensureCertificateProofConversationTable()
  const body = clean(input.body, 20000)
  if (body.length < 2) throw new Error("Message is too short.")
  const now = new Date()
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO tochukwu_learning_assignment_messages
      (message_uuid, assignment_id, course_slug, account_id, author_type,
       author_ref, author_name, message_type, body, read_by_student_at,
       read_by_admin_at, created_at)
    VALUES
      (${`apm_${crypto.randomUUID().replace(/-/g, "")}`}, ${input.assignmentId},
       ${clean(input.courseSlug, 120).toLowerCase()}, ${input.accountId},
       ${input.authorType}, ${clean(input.authorRef, 220) || null},
       ${clean(input.authorName, 180) || null}, ${clean(input.messageType, 32) || "message"},
       ${body}, ${input.authorType === "student" ? null : now},
       ${input.authorType === "student" ? now : null}, ${now})
  `)
}

function learningSupportRecipients() {
  const configured = clean(
    process.env.LEARNING_SUPPORT_NOTIFICATION_EMAILS
      || process.env.SUPPORT_NOTIFICATION_EMAILS
      || "support@tochukwunkwocha.com",
    5000
  )
  return Array.from(new Set(
    configured
      .split(/[,\n;]/)
      .map((item) => item.trim().toLowerCase())
      .filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item))
  ))
}

export async function notifyCertificateProofAdmins(input: {
  assignmentId: bigint
  studentName: string
  studentEmail: string
  courseSlug: string
  subject: string
  message: string
}) {
  const recipients = learningSupportRecipients()
  if (!recipients.length) return { attempted: false, sent: false, error: "No Learning Support email is configured." }
  const adminUrl = `${siteBaseUrl()}/internal/learning#assignment-${input.assignmentId.toString()}`
  const subject = clean(input.subject, 255)
  const message = clean(input.message, 4000)
  const results = await Promise.all(recipients.map((to) => sendEmail({
    to,
    subject,
    text: [
      `${input.studentName || "A student"} (${input.studentEmail}) sent an update about certificate proof.`,
      `Course: ${input.courseSlug}`,
      "",
      message,
      "",
      `Open Learning Support: ${adminUrl}`
    ].join("\n"),
    html: [
      `<p><strong>${escapeHtml(input.studentName || "A student")}</strong> (${escapeHtml(input.studentEmail)}) sent an update about certificate proof.</p>`,
      `<p><strong>Course:</strong> ${escapeHtml(input.courseSlug)}</p>`,
      `<p>${escapeHtml(message).replace(/\r?\n/g, "<br/>")}</p>`,
      `<p><a href="${escapeHtml(adminUrl)}">Open Learning Support</a></p>`
    ].join("")
  }).catch((error) => ({
    ok: false,
    error: error instanceof Error ? error.message : "Email delivery failed."
  }))))
  const failures = results.filter((result) => !result.ok)
  return {
    attempted: true,
    sent: failures.length === 0,
    error: failures.map((result) => result.error || "Email delivery failed.").join(" ")
  }
}

export async function notifyCertificateProofStudent(input: {
  studentEmail: string
  studentName: string
  courseSlug: string
  subject: string
  message: string
}) {
  const dashboardUrl = `${siteBaseUrl()}/dashboard/certificate?course=${encodeURIComponent(input.courseSlug)}#proof-review`
  const message = clean(input.message, 8000)
  return sendEmail({
    to: input.studentEmail,
    subject: clean(input.subject, 255),
    text: [
      `Hello ${input.studentName || "Student"},`,
      "",
      message,
      "",
      `Open your certificate proof review: ${dashboardUrl}`,
      "",
      "Tochukwu Tech and AI Academy"
    ].join("\n"),
    html: [
      `<p>Hello ${escapeHtml(input.studentName || "Student")},</p>`,
      `<p>${escapeHtml(message).replace(/\r?\n/g, "<br/>")}</p>`,
      `<p><a href="${escapeHtml(dashboardUrl)}">Open your certificate proof review</a></p>`,
      "<p>Tochukwu Tech and AI Academy</p>"
    ].join("")
  })
}
