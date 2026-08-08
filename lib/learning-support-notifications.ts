import crypto from "crypto"
import { Prisma } from "@prisma/client"

import { sendEmail } from "@/lib/email"
import { prisma } from "@/lib/prisma"
import { publicAbsoluteUrl } from "@/lib/public-site-url"

export type LearningSupportRecipientRole = "learner" | "group_owner" | "school_owner"

export type LearningSupportRecipient = {
  accountId: bigint
  learnerName: string
  recipientName: string
  recipientEmail: string
  role: LearningSupportRecipientRole
}

function clean(value: unknown, max = 1000) {
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

export function isDeliverableLearningSupportEmail(value: unknown) {
  const email = clean(value, 320).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false
  const domain = email.split("@")[1] || ""
  return domain !== "student-code.local"
    && domain !== "localhost"
    && !domain.endsWith(".localhost")
    && !domain.endsWith(".local")
}

export async function ensureLearningSupportNotificationTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_learning_support_notifications (
      id BIGINT NOT NULL AUTO_INCREMENT,
      notification_uuid VARCHAR(64) NOT NULL,
      idempotency_key VARCHAR(190) NOT NULL,
      assignment_id BIGINT NOT NULL,
      account_id BIGINT NOT NULL,
      event_type VARCHAR(40) NOT NULL,
      recipient_role VARCHAR(32) NOT NULL,
      recipient_email VARCHAR(320) NOT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'pending',
      attempts INT NOT NULL DEFAULT 0,
      provider_message_id VARCHAR(500) NULL,
      last_error VARCHAR(1000) NULL,
      sent_at DATETIME NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_learning_support_notification_uuid (notification_uuid),
      UNIQUE KEY uniq_learning_support_notification_idempotency (idempotency_key),
      KEY idx_learning_support_notification_assignment (assignment_id, created_at),
      KEY idx_learning_support_notification_status (status, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}

export async function resolveLearningSupportRecipient(accountId: bigint): Promise<LearningSupportRecipient | null> {
  const family = await prisma.$queryRaw<Array<{
    learnerName: string | null
    recipientName: string | null
    recipientEmail: string | null
  }>>(Prisma.sql`
    SELECT c.full_name AS learnerName, f.parent_name AS recipientName, f.parent_email AS recipientEmail
    FROM family_children c
    JOIN family_accounts f ON f.id = c.family_id
    WHERE c.account_id = ${accountId}
      AND c.status = 'active'
      AND f.status = 'active'
    ORDER BY c.id DESC
    LIMIT 1
  `).catch(() => [])
  if (family[0] && isDeliverableLearningSupportEmail(family[0].recipientEmail)) {
    return {
      accountId,
      learnerName: clean(family[0].learnerName, 180),
      recipientName: clean(family[0].recipientName, 180),
      recipientEmail: clean(family[0].recipientEmail, 320).toLowerCase(),
      role: "group_owner"
    }
  }

  const school = await prisma.$queryRaw<Array<{
    learnerName: string | null
    recipientName: string | null
    recipientEmail: string | null
  }>>(Prisma.sql`
    SELECT ss.full_name AS learnerName, sa.full_name AS recipientName, sa.email AS recipientEmail
    FROM school_students ss
    JOIN school_accounts sc ON sc.id = ss.school_id
    JOIN school_admins sa ON sa.school_id = sc.id AND sa.is_active = 1
    WHERE ss.account_id = ${accountId}
      AND ss.status = 'active'
      AND sc.status = 'active'
    ORDER BY sa.id ASC
    LIMIT 1
  `).catch(() => [])
  if (school[0] && isDeliverableLearningSupportEmail(school[0].recipientEmail)) {
    return {
      accountId,
      learnerName: clean(school[0].learnerName, 180),
      recipientName: clean(school[0].recipientName, 180),
      recipientEmail: clean(school[0].recipientEmail, 320).toLowerCase(),
      role: "school_owner"
    }
  }

  const accounts = await prisma.$queryRaw<Array<{ fullName: string | null; email: string | null }>>(Prisma.sql`
    SELECT full_name AS fullName, email
    FROM student_accounts
    WHERE id = ${accountId}
    LIMIT 1
  `)
  if (!accounts[0] || !isDeliverableLearningSupportEmail(accounts[0].email)) return null
  return {
    accountId,
    learnerName: clean(accounts[0].fullName, 180),
    recipientName: clean(accounts[0].fullName, 180),
    recipientEmail: clean(accounts[0].email, 320).toLowerCase(),
    role: "learner"
  }
}

export async function sendLearningSupportNotification(input: {
  assignmentId: bigint
  accountId: bigint
  courseSlug: string
  eventType: string
  idempotencyKey: string
  subject: string
  message: string
  learnerDashboardPath?: string
}) {
  await ensureLearningSupportNotificationTable()
  const recipient = await resolveLearningSupportRecipient(input.accountId)
  if (!recipient) return { attempted: false, sent: false, role: null, error: "No deliverable learner or owner email is available." }
  const key = clean(input.idempotencyKey, 190)
  if (!key) throw new Error("A notification idempotency key is required.")
  const now = new Date()
  const inserted = await prisma.$executeRaw`
    INSERT IGNORE INTO tochukwu_learning_support_notifications
      (notification_uuid, idempotency_key, assignment_id, account_id, event_type,
       recipient_role, recipient_email, status, attempts, created_at, updated_at)
    VALUES
      (${`lsn_${crypto.randomUUID().replace(/-/g, "")}`}, ${key}, ${input.assignmentId}, ${input.accountId},
       ${clean(input.eventType, 40)}, ${recipient.role}, ${recipient.recipientEmail}, 'processing', 1, ${now}, ${now})
  `
  if (!inserted) {
    const existing = await prisma.$queryRaw<Array<{ status: string }>>(Prisma.sql`
      SELECT status FROM tochukwu_learning_support_notifications WHERE idempotency_key = ${key} LIMIT 1
    `)
    return {
      attempted: false,
      sent: existing[0]?.status === "sent",
      role: recipient.role,
      error: existing[0]?.status === "failed" ? "The earlier notification attempt failed; use the explicit resend action to try again." : ""
    }
  }

  const dashboardUrl = publicAbsoluteUrl(input.learnerDashboardPath || "/dashboard/courses")
  const ownerRecipient = recipient.role !== "learner"
  const greeting = recipient.recipientName || (ownerRecipient ? "Programme Owner" : "Learner")
  const context = ownerRecipient
    ? `A Learning Support update is available for <strong>${escapeHtml(recipient.learnerName || "your learner")}</strong>.`
    : "A new Learning Support update is available in your dashboard."
  const instruction = ownerRecipient
    ? "The learner can sign in with their learner code to view the complete private conversation and reply from their own dashboard."
    : "Open your dashboard to view the complete private conversation and reply."
  try {
    const delivery = await sendEmail({
      to: recipient.recipientEmail,
      subject: clean(input.subject, 255),
      html: `<p>Hello ${escapeHtml(greeting)},</p><p>${context}</p><p><strong>Course:</strong> ${escapeHtml(input.courseSlug)}</p><p>${escapeHtml(input.message).replace(/\r?\n/g, "<br/>")}</p><p>${instruction}</p><p><a href="${escapeHtml(dashboardUrl)}">Open learner dashboard</a></p><p>Tochukwu Tech and AI Academy</p>`,
      text: `Hello ${greeting},\n\n${ownerRecipient ? `A Learning Support update is available for ${recipient.learnerName || "your learner"}.` : "A new Learning Support update is available in your dashboard."}\n\nCourse: ${input.courseSlug}\n\n${input.message}\n\n${instruction}\n\nOpen learner dashboard: ${dashboardUrl}\n\nTochukwu Tech and AI Academy`
    })
    const sent = Boolean(delivery.ok)
    const providerMessageId = "messageId" in delivery ? delivery.messageId : ""
    const deliveryError = "error" in delivery ? delivery.error : ""
    await prisma.$executeRaw`
      UPDATE tochukwu_learning_support_notifications
      SET status = ${sent ? "sent" : "failed"}, provider_message_id = ${clean(providerMessageId, 500) || null},
          last_error = ${sent ? null : clean(deliveryError, 1000) || "Email provider did not send the message."},
          sent_at = ${sent ? new Date() : null}, updated_at = ${new Date()}
      WHERE idempotency_key = ${key}
      LIMIT 1
    `
    return { attempted: true, sent, role: recipient.role, error: sent ? "" : deliveryError || "Email provider did not send the message." }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email delivery failed."
    await prisma.$executeRaw`
      UPDATE tochukwu_learning_support_notifications
      SET status = 'failed', last_error = ${clean(message, 1000)}, updated_at = ${new Date()}
      WHERE idempotency_key = ${key}
      LIMIT 1
    `
    return { attempted: true, sent: false, role: recipient.role, error: message }
  }
}
