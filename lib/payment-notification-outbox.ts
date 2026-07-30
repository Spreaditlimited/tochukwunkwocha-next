import crypto from "crypto"

import { sendStudentPendingManualPaymentEmail } from "@/lib/enrollment-notifications"
import { prisma } from "@/lib/prisma"
import { sendManualPaymentSubmittedWhatsApp } from "@/lib/transactional-whatsapp"

type ManualPaymentNotification = {
  paymentUuid: string
  email: string
  fullName: string
  phone: string
  courseSlug: string
  dashboardPath: string
  resetToken: string | null
  sendEmail: boolean
}

type OutboxRow = {
  id: bigint
  eventUuid: string
  payloadEncrypted: string
  attempts: number | bigint
  emailSentAt: Date | null
  whatsappSentAt: Date | null
}

function secretKey() {
  const secret = String(
    process.env.NOTIFICATION_OUTBOX_SECRET ||
      process.env.AUTH_SECRET ||
      process.env.ADMIN_SESSION_SECRET ||
      ""
  ).trim()
  if (!secret) throw new Error("Notification outbox encryption is not configured.")
  return crypto.createHash("sha256").update(secret).digest()
}

function encryptPayload(payload: ManualPaymentNotification) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", secretKey(), iv)
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final()
  ])
  return [
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url")
  ].join(".")
}

function decryptPayload(value: string) {
  const [ivText, tagText, encryptedText, extra] = String(value || "").split(".")
  if (!ivText || !tagText || !encryptedText || extra) throw new Error("Invalid notification payload.")
  const decipher = crypto.createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(ivText, "base64url"))
  decipher.setAuthTag(Buffer.from(tagText, "base64url"))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final()
  ])
  return JSON.parse(decrypted.toString("utf8")) as ManualPaymentNotification
}

export async function enqueueManualPaymentNotification(input: ManualPaymentNotification) {
  const eventUuid = `mpn_${crypto.createHash("sha256").update(input.paymentUuid).digest("hex").slice(0, 40)}`
  const payload = encryptPayload(input)
  await prisma.$executeRaw`
    INSERT INTO tochukwu_notification_outbox
      (event_uuid, event_type, source_uuid, payload_encrypted, status, attempts, next_attempt_at, created_at, updated_at)
    VALUES
      (${eventUuid}, 'manual_payment_submitted', ${input.paymentUuid}, ${payload}, 'pending', 0, NOW(), NOW(), NOW())
    ON DUPLICATE KEY UPDATE
      payload_encrypted = IF(status = 'completed', payload_encrypted, VALUES(payload_encrypted)),
      next_attempt_at = IF(status = 'completed', next_attempt_at, NOW()),
      updated_at = NOW()
  `
  return eventUuid
}

export async function processPaymentNotificationOutbox(input?: { limit?: number; eventUuid?: string }) {
  const limit = Math.max(1, Math.min(50, Math.round(Number(input?.limit || 20))))
  const eventUuid = String(input?.eventUuid || "").trim().slice(0, 64)
  await prisma.$executeRaw`
    UPDATE tochukwu_notification_outbox
    SET status = 'retry', locked_at = NULL, next_attempt_at = NOW(), updated_at = NOW()
    WHERE status = 'processing'
      AND locked_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)
  `
  const rows = eventUuid
    ? await prisma.$queryRaw<OutboxRow[]>`
        SELECT id, event_uuid AS eventUuid, payload_encrypted AS payloadEncrypted, attempts,
               email_sent_at AS emailSentAt, whatsapp_sent_at AS whatsappSentAt
        FROM tochukwu_notification_outbox
        WHERE event_uuid = ${eventUuid}
          AND status IN ('pending', 'retry')
          AND next_attempt_at <= NOW()
        LIMIT 1
      `
    : await prisma.$queryRaw<OutboxRow[]>`
        SELECT id, event_uuid AS eventUuid, payload_encrypted AS payloadEncrypted, attempts,
               email_sent_at AS emailSentAt, whatsapp_sent_at AS whatsappSentAt
        FROM tochukwu_notification_outbox
        WHERE status IN ('pending', 'retry')
          AND next_attempt_at <= NOW()
        ORDER BY next_attempt_at ASC, id ASC
        LIMIT ${limit}
      `

  let completed = 0
  let failed = 0
  for (const row of rows) {
    const claimed = await prisma.$executeRaw`
      UPDATE tochukwu_notification_outbox
      SET status = 'processing', locked_at = NOW(), updated_at = NOW()
      WHERE id = ${row.id} AND status IN ('pending', 'retry')
    `
    if (!Number(claimed || 0)) continue

    try {
      const payload = decryptPayload(row.payloadEncrypted)
      if (payload.sendEmail && !row.emailSentAt) {
        await sendStudentPendingManualPaymentEmail({
          email: payload.email,
          fullName: payload.fullName,
          courseSlug: payload.courseSlug,
          resetToken: payload.resetToken,
          dashboardPath: payload.dashboardPath
        })
        await prisma.$executeRaw`
          UPDATE tochukwu_notification_outbox SET email_sent_at = NOW(), updated_at = NOW() WHERE id = ${row.id}
        `
      }
      if (payload.phone && !row.whatsappSentAt) {
        await sendManualPaymentSubmittedWhatsApp({
          phone: payload.phone,
          fullName: payload.fullName,
          courseSlug: payload.courseSlug,
          dashboardPath: payload.dashboardPath
        })
        await prisma.$executeRaw`
          UPDATE tochukwu_notification_outbox SET whatsapp_sent_at = NOW(), updated_at = NOW() WHERE id = ${row.id}
        `
      }
      await prisma.$executeRaw`
        UPDATE tochukwu_notification_outbox
        SET status = 'completed', completed_at = NOW(), last_error = NULL, updated_at = NOW()
        WHERE id = ${row.id}
      `
      completed += 1
    } catch (error) {
      const attempts = Number(row.attempts || 0) + 1
      const nextAttemptAt = new Date(Date.now() + Math.min(60, 2 ** Math.min(6, attempts)) * 60_000)
      await prisma.$executeRaw`
        UPDATE tochukwu_notification_outbox
        SET status = 'retry', attempts = ${attempts}, next_attempt_at = ${nextAttemptAt},
            last_error = ${String(error instanceof Error ? error.message : error).slice(0, 1000)},
            locked_at = NULL, updated_at = NOW()
        WHERE id = ${row.id}
      `
      failed += 1
    }
  }
  return { checked: rows.length, completed, failed }
}
