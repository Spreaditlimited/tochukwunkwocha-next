import crypto from "crypto"

import { prisma } from "@/lib/prisma"

export type EmailDeliveryStatus = "attempted" | "sent" | "failed" | "skipped"

let tablePromise: Promise<void> | null = null

function clean(value: unknown, max = 1000) {
  return String(value || "").trim().slice(0, max)
}

async function ensureEmailDeliveryTable() {
  if (!tablePromise) {
    tablePromise = prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS tochukwu_email_delivery_log (
        id BIGINT NOT NULL AUTO_INCREMENT,
        log_uuid VARCHAR(64) NOT NULL,
        recipient VARCHAR(220) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        provider VARCHAR(40) NOT NULL DEFAULT 'smtp',
        status VARCHAR(24) NOT NULL,
        message_id VARCHAR(500) NULL,
        provider_response VARCHAR(1000) NULL,
        error_message VARCHAR(2000) NULL,
        attempted_at DATETIME NOT NULL,
        completed_at DATETIME NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_email_delivery_log_uuid (log_uuid),
        KEY idx_email_delivery_recipient (recipient, attempted_at),
        KEY idx_email_delivery_status (status, attempted_at),
        KEY idx_email_delivery_attempted (attempted_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).then(() => undefined).catch((error) => {
      tablePromise = null
      throw error
    })
  }
  await tablePromise
}

export async function startEmailDeliveryLog(input: { recipient: string; subject: string }) {
  const logUuid = `email_${crypto.randomUUID().replace(/-/g, "")}`
  try {
    await ensureEmailDeliveryTable()
    await prisma.$executeRaw`
      INSERT INTO tochukwu_email_delivery_log
        (log_uuid, recipient, subject, provider, status, attempted_at)
      VALUES
        (${logUuid}, ${clean(input.recipient, 220)}, ${clean(input.subject, 255)}, 'smtp', 'attempted', ${new Date()})
    `
    return logUuid
  } catch (error) {
    console.error("email_delivery_log_start_failed", error)
    return null
  }
}

export async function finishEmailDeliveryLog(input: {
  logUuid: string | null
  status: Exclude<EmailDeliveryStatus, "attempted">
  messageId?: unknown
  providerResponse?: unknown
  error?: unknown
}) {
  if (!input.logUuid) return
  try {
    await ensureEmailDeliveryTable()
    await prisma.$executeRaw`
      UPDATE tochukwu_email_delivery_log
      SET status = ${input.status},
          message_id = ${clean(input.messageId, 500) || null},
          provider_response = ${clean(input.providerResponse, 1000) || null},
          error_message = ${clean(input.error instanceof Error ? input.error.message : input.error, 2000) || null},
          completed_at = ${new Date()}
      WHERE log_uuid = ${input.logUuid}
      LIMIT 1
    `
  } catch (error) {
    console.error("email_delivery_log_finish_failed", error)
  }
}

export async function listEmailDeliveryLogs(limit = 100) {
  await ensureEmailDeliveryTable()
  return prisma.$queryRaw<Array<{
    logUuid: string
    recipient: string
    subject: string
    provider: string
    status: EmailDeliveryStatus
    messageId: string | null
    providerResponse: string | null
    errorMessage: string | null
    attemptedAt: Date
    completedAt: Date | null
  }>>`
    SELECT
      log_uuid AS logUuid,
      recipient,
      subject,
      provider,
      status,
      message_id AS messageId,
      provider_response AS providerResponse,
      error_message AS errorMessage,
      attempted_at AS attemptedAt,
      completed_at AS completedAt
    FROM tochukwu_email_delivery_log
    ORDER BY attempted_at DESC, id DESC
    LIMIT ${Math.max(1, Math.min(limit, 300))}
  `
}
