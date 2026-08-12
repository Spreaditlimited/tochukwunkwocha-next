import crypto from "crypto"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

type RefundSource = "manual" | "online"

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

export async function ensureCourseRefundTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_course_payment_refunds (
      id BIGINT NOT NULL AUTO_INCREMENT,
      refund_uuid VARCHAR(64) NOT NULL,
      source_type VARCHAR(24) NOT NULL,
      payment_uuid VARCHAR(100) NOT NULL,
      course_slug VARCHAR(120) NULL,
      batch_key VARCHAR(64) NULL,
      customer_name VARCHAR(190) NULL,
      customer_email VARCHAR(220) NOT NULL,
      currency VARCHAR(12) NOT NULL,
      amount_minor BIGINT NOT NULL,
      refund_method VARCHAR(40) NOT NULL,
      refund_reference VARCHAR(190) NOT NULL,
      reason VARCHAR(1000) NOT NULL,
      access_revoked TINYINT(1) NOT NULL DEFAULT 1,
      recorded_by VARCHAR(190) NOT NULL,
      refunded_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_course_refund_uuid (refund_uuid),
      UNIQUE KEY uniq_tochukwu_course_refund_payment (source_type, payment_uuid),
      KEY idx_tochukwu_course_refund_date (refunded_at),
      KEY idx_tochukwu_course_refund_email (customer_email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}

export async function recordCoursePaymentRefund(input: {
  source: RefundSource
  paymentUuid: string
  reason: string
  refundMethod: string
  refundReference: string
  recordedBy: string
  refundedAt?: Date
}) {
  await ensureCourseRefundTable()
  const source = input.source
  const paymentUuid = clean(input.paymentUuid, 100)
  const reason = clean(input.reason, 1000)
  const refundMethod = clean(input.refundMethod, 40).toLowerCase()
  const refundReference = clean(input.refundReference, 190)
  const recordedBy = clean(input.recordedBy, 190) || "admin"
  const refundedAt = input.refundedAt || new Date()
  if (!paymentUuid || !reason || !refundReference) throw new Error("Payment, refund reason, and refund reference are required.")
  if (!new Set(["bank_transfer", "paystack", "stripe", "paypal", "cash", "other"]).has(refundMethod)) {
    throw new Error("Choose a valid refund method.")
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.$queryRaw<Array<{ refundUuid: string }>>(Prisma.sql`
      SELECT refund_uuid AS refundUuid
      FROM tochukwu_course_payment_refunds
      WHERE source_type = ${source} AND payment_uuid = ${paymentUuid}
      LIMIT 1 FOR UPDATE
    `)
    if (existing[0]) return { ok: true as const, alreadyRecorded: true, refundUuid: existing[0].refundUuid }

    const rows = source === "manual"
      ? await tx.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          SELECT id, payment_uuid AS paymentUuid, course_slug AS courseSlug, batch_key AS batchKey,
                 first_name AS customerName, email AS customerEmail, currency,
                 COALESCE(final_amount_minor, amount_minor, 0) AS amountMinor,
                 status, COALESCE(buyer_type, 'student') AS buyerType
          FROM course_manual_payments WHERE payment_uuid = ${paymentUuid} LIMIT 1 FOR UPDATE
        `)
      : await tx.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          SELECT id, order_uuid AS paymentUuid, course_slug AS courseSlug, batch_key AS batchKey,
                 first_name AS customerName, email AS customerEmail, currency,
                 COALESCE(final_amount_minor, amount_minor, 0) AS amountMinor,
                 status, COALESCE(buyer_type, 'student') AS buyerType
          FROM course_orders WHERE order_uuid = ${paymentUuid} LIMIT 1 FOR UPDATE
        `)
    const payment = rows[0]
    if (!payment) throw new Error("Course payment not found.")
    if (clean(payment.buyerType, 40).toLowerCase() === "family") {
      throw new Error("Group-payment refunds require a seat-ledger reversal and cannot be recorded with this form yet.")
    }
    const status = clean(payment.status, 40).toLowerCase()
    const validStatuses = source === "manual" ? ["approved", "revoked", "refunded"] : ["paid", "refunded"]
    if (!validStatuses.includes(status)) throw new Error("Only a confirmed course payment can be refunded.")
    const amountMinor = Number(payment.amountMinor || 0)
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new Error("The refundable payment amount is invalid.")

    const refundUuid = `refund_${crypto.randomUUID().replace(/-/g, "")}`
    const now = new Date()
    await tx.$executeRaw`
      INSERT INTO tochukwu_course_payment_refunds
        (refund_uuid, source_type, payment_uuid, course_slug, batch_key, customer_name, customer_email,
         currency, amount_minor, refund_method, refund_reference, reason, access_revoked,
         recorded_by, refunded_at, created_at, updated_at)
      VALUES
        (${refundUuid}, ${source}, ${paymentUuid}, ${clean(payment.courseSlug, 120) || null},
         ${clean(payment.batchKey, 64) || null}, ${clean(payment.customerName, 190) || null},
         ${clean(payment.customerEmail, 220).toLowerCase()}, ${clean(payment.currency, 12).toUpperCase() || "NGN"},
         ${amountMinor}, ${refundMethod}, ${refundReference}, ${reason}, 1,
         ${recordedBy}, ${refundedAt}, ${now}, ${now})
    `

    const auditNote = `\n[PAYMENT_REFUNDED] ${clean(payment.currency, 12).toUpperCase() || "NGN"} ${(amountMinor / 100).toFixed(2)} via ${refundMethod}; reference ${refundReference}; reason: ${reason}; recorded by ${recordedBy}.`
    if (source === "manual") {
      await tx.$executeRaw`
        UPDATE course_manual_payments
        SET status = 'refunded', review_note = CONCAT(COALESCE(review_note, ''), ${auditNote}), updated_at = ${now}
        WHERE payment_uuid = ${paymentUuid} LIMIT 1
      `
    } else {
      await tx.$executeRaw`
        UPDATE course_orders SET status = 'refunded', updated_at = ${now}
        WHERE order_uuid = ${paymentUuid} LIMIT 1
      `
    }
    await tx.$executeRaw`
      DELETE FROM tochukwu_course_enrollment_claims
      WHERE source_type = ${source === "manual" ? "manual_payment" : "course_order"}
        AND source_uuid = ${paymentUuid}
    `.catch(() => 0)
    const email = clean(payment.customerEmail, 220).toLowerCase()
    const account = email ? await tx.studentAccount.findUnique({ where: { email }, select: { id: true } }) : null
    const sessionsTerminated = account ? (await tx.studentSession.deleteMany({ where: { accountId: account.id } })).count : 0

    return { ok: true as const, alreadyRecorded: false, refundUuid, amountMinor, currency: clean(payment.currency, 12).toUpperCase() || "NGN", sessionsTerminated }
  })
}
