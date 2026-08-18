import crypto from "crypto"

import { sendStudentAccountReadyEmail, sendStudentPendingManualPaymentEmail, syncEnrollmentToBrevo } from "@/lib/enrollment-notifications"
import { prisma } from "@/lib/prisma"
import { addColumnIfMissing } from "@/lib/schema-guards"
import { sendEnrollmentConfirmedWhatsApp, sendManualPaymentSubmittedWhatsApp } from "@/lib/transactional-whatsapp"

type ManualPaymentNotification = {
  paymentUuid: string
  email: string
  fullName: string
  phone: string
  courseSlug: string
  dashboardPath: string
  temporaryPassword?: string | null
  resetToken?: string | null
  sendEmail: boolean
}

export type EnrollmentConfirmationNotification = {
  sourceType: "course_order" | "manual_payment" | "backfill"
  sourceUuid: string
  email: string
  fullName: string
  phone: string
  courseSlug: string
  batchKey: string
  batchLabel: string
  dashboardPath: string
  temporaryPassword?: string | null
  brevoListId?: number | string | null
  syncBrevo?: boolean
  sendEmail?: boolean
  sendWhatsApp?: boolean
}

type OutboxRow = {
  id: bigint
  eventUuid: string
  eventType: string
  payloadEncrypted: string
  attempts: number | bigint
  brevoSyncedAt: Date | null
  emailSentAt: Date | null
  whatsappSentAt: Date | null
}

let outboxColumnsReady: Promise<void> | null = null

async function ensureNotificationOutboxColumns() {
  if (!outboxColumnsReady) outboxColumnsReady = (async () => {
    await addColumnIfMissing("tochukwu_notification_outbox", "brevo_synced_at", "DATETIME NULL")
    await addColumnIfMissing("tochukwu_notification_outbox", "brevo_status", "VARCHAR(24) NULL")
    await addColumnIfMissing("tochukwu_notification_outbox", "email_status", "VARCHAR(24) NULL")
    await addColumnIfMissing("tochukwu_notification_outbox", "whatsapp_status", "VARCHAR(24) NULL")
    await addColumnIfMissing("tochukwu_notification_outbox", "email_message_id", "VARCHAR(500) NULL")
    await addColumnIfMissing("tochukwu_notification_outbox", "whatsapp_message_id", "VARCHAR(500) NULL")
  })().catch((error) => { outboxColumnsReady = null; throw error })
  await outboxColumnsReady
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

function encryptPayload(payload: ManualPaymentNotification | EnrollmentConfirmationNotification) {
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
  await ensureNotificationOutboxColumns()
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

export async function enqueueEnrollmentConfirmationNotification(input: EnrollmentConfirmationNotification) {
  await ensureNotificationOutboxColumns()
  const sourceUuid = String(input.sourceUuid || "").trim().slice(0, 100)
  if (!sourceUuid) throw new Error("Enrollment notification source UUID is required.")
  const eventUuid = `ecn_${crypto.createHash("sha256").update(`${input.sourceType}:${sourceUuid}`).digest("hex").slice(0, 40)}`
  const payload = encryptPayload(input)
  await prisma.$executeRaw`
    INSERT INTO tochukwu_notification_outbox
      (event_uuid, event_type, source_uuid, payload_encrypted, status, attempts, next_attempt_at,
       brevo_status, email_status, whatsapp_status, created_at, updated_at)
    VALUES
      (${eventUuid}, 'enrollment_confirmed', ${sourceUuid}, ${payload}, 'pending', 0, NOW(),
       'pending', 'pending', 'pending', NOW(), NOW())
    ON DUPLICATE KEY UPDATE
      payload_encrypted = IF(status = 'completed', payload_encrypted, VALUES(payload_encrypted)),
      status = IF(status = 'completed', status, 'pending'),
      next_attempt_at = IF(status = 'completed', next_attempt_at, NOW()),
      updated_at = NOW()
  `
  return eventUuid
}

export async function processPaymentNotificationOutbox(input?: { limit?: number; eventUuid?: string }) {
  await ensureNotificationOutboxColumns()
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
        SELECT id, event_uuid AS eventUuid, event_type AS eventType, payload_encrypted AS payloadEncrypted, attempts,
               brevo_synced_at AS brevoSyncedAt, email_sent_at AS emailSentAt, whatsapp_sent_at AS whatsappSentAt
        FROM tochukwu_notification_outbox
        WHERE event_uuid = ${eventUuid}
          AND status IN ('pending', 'retry')
          AND next_attempt_at <= NOW()
        LIMIT 1
      `
    : await prisma.$queryRaw<OutboxRow[]>`
        SELECT id, event_uuid AS eventUuid, event_type AS eventType, payload_encrypted AS payloadEncrypted, attempts,
               brevo_synced_at AS brevoSyncedAt, email_sent_at AS emailSentAt, whatsapp_sent_at AS whatsappSentAt
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
      const deliveryErrors: string[] = []
      if (row.eventType === "enrollment_confirmed") {
        const payload = decryptPayload(row.payloadEncrypted) as unknown as EnrollmentConfirmationNotification
        if (payload.syncBrevo === false && !row.brevoSyncedAt) {
          await prisma.$executeRaw`UPDATE tochukwu_notification_outbox SET brevo_synced_at=NOW(), brevo_status='skipped', updated_at=NOW() WHERE id=${row.id}`
        } else if (!row.brevoSyncedAt) {
          try {
            const result = await syncEnrollmentToBrevo({
              fullName: payload.fullName,
              email: payload.email,
              phone: payload.phone,
              courseSlug: payload.courseSlug,
              batchKey: payload.batchKey,
              batchLabel: payload.batchLabel,
              source: `${payload.sourceType}_enrollment_confirmed`,
              listId: payload.brevoListId
            })
            if (!result.ok || result.skipped) throw new Error(result.error || result.reason || "Brevo enrollment sync was skipped.")
            await prisma.$executeRaw`UPDATE tochukwu_notification_outbox SET brevo_synced_at=NOW(), brevo_status='sent', updated_at=NOW() WHERE id=${row.id}`
          } catch (error) {
            deliveryErrors.push(`Brevo: ${error instanceof Error ? error.message : String(error)}`)
          }
        }
        if (payload.sendEmail === false && !row.emailSentAt) {
          await prisma.$executeRaw`UPDATE tochukwu_notification_outbox SET email_sent_at=NOW(), email_status='skipped', updated_at=NOW() WHERE id=${row.id}`
        } else if (!row.emailSentAt) {
          try {
            const result = await sendStudentAccountReadyEmail({
              email: payload.email,
              fullName: payload.fullName,
              courseSlug: payload.courseSlug,
              temporaryPassword: payload.temporaryPassword,
              dashboardPath: payload.dashboardPath,
              batchLabel: payload.batchLabel
            })
            if (!result.ok) throw new Error(("error" in result && result.error) || "Enrollment confirmation email was skipped.")
            const messageId = "messageId" in result ? result.messageId : null
            await prisma.$executeRaw`UPDATE tochukwu_notification_outbox SET email_sent_at=NOW(), email_status='sent', email_message_id=${messageId || null}, updated_at=NOW() WHERE id=${row.id}`
          } catch (error) {
            deliveryErrors.push(`Email: ${error instanceof Error ? error.message : String(error)}`)
          }
        }
        if (payload.sendWhatsApp === false && !row.whatsappSentAt) {
          await prisma.$executeRaw`UPDATE tochukwu_notification_outbox SET whatsapp_sent_at=NOW(), whatsapp_status='skipped', updated_at=NOW() WHERE id=${row.id}`
        } else if (!row.whatsappSentAt) {
          try {
            const result = await sendEnrollmentConfirmedWhatsApp({
              phone: payload.phone,
              fullName: payload.fullName,
              courseSlug: payload.courseSlug,
              dashboardPath: payload.dashboardPath
            })
            if (!result.ok || result.skipped) throw new Error(result.reason || "Enrollment confirmation WhatsApp was skipped.")
            await prisma.$executeRaw`UPDATE tochukwu_notification_outbox SET whatsapp_sent_at=NOW(), whatsapp_status='sent', whatsapp_message_id=${result.messageId || null}, updated_at=NOW() WHERE id=${row.id}`
          } catch (error) {
            deliveryErrors.push(`WhatsApp: ${error instanceof Error ? error.message : String(error)}`)
          }
        }
      } else {
        const payload = decryptPayload(row.payloadEncrypted) as ManualPaymentNotification
        if (payload.sendEmail && !row.emailSentAt) {
          const result = await sendStudentPendingManualPaymentEmail({
            email: payload.email,
            fullName: payload.fullName,
            courseSlug: payload.courseSlug,
            temporaryPassword: payload.temporaryPassword,
            resetToken: payload.resetToken,
            dashboardPath: payload.dashboardPath
          })
          if (!result.ok) throw new Error("Pending-payment email was skipped.")
          await prisma.$executeRaw`UPDATE tochukwu_notification_outbox SET email_sent_at=NOW(), email_status='sent', updated_at=NOW() WHERE id=${row.id}`
        }
        if (payload.phone && !row.whatsappSentAt) {
          const result = await sendManualPaymentSubmittedWhatsApp({
            phone: payload.phone,
            fullName: payload.fullName,
            courseSlug: payload.courseSlug,
            dashboardPath: payload.dashboardPath
          })
          if (!result.ok || result.skipped) throw new Error(result.reason || "Pending-payment WhatsApp was skipped.")
          await prisma.$executeRaw`UPDATE tochukwu_notification_outbox SET whatsapp_sent_at=NOW(), whatsapp_status='sent', whatsapp_message_id=${result.messageId || null}, updated_at=NOW() WHERE id=${row.id}`
        }
      }
      if (deliveryErrors.length) throw new Error(deliveryErrors.join(" | "))
      await prisma.$executeRaw`
        UPDATE tochukwu_notification_outbox
        SET status = 'completed', completed_at = NOW(), last_error = NULL,
            payload_encrypted = '', updated_at = NOW()
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
