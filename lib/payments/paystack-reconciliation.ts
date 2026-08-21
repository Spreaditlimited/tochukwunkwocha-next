import { sendCourseOrderMetaPurchase } from "@/lib/meta-events"
import { prisma } from "@/lib/prisma"
import {
  createAffiliateCommissionForOrder,
  inspectPaystackTransaction,
  isPaystackTransactionNotFound,
  markCourseOrderPaid,
  normalizeCourse
} from "@/lib/payments/course-checkout"
import {
  ensurePaystackAuditTable,
  isPaystackProcessingStatus,
  recordPaystackAuditEvent,
  validateCourseOrderPaystackPayment
} from "@/lib/payments/paystack-audit"
import { provisionStudentForPaidOrder } from "@/lib/payments/post-payment-student"
import { isCourseEnrollmentConflict } from "@/lib/enrollment-guard"
import { Prisma } from "@prisma/client"

type ReconciliationCandidate = {
  orderUuid: string | null
  courseSlug: string | null
  batchKey: string | null
  email: string | null
  status: string | null
  providerReference: string | null
  accountId: bigint | number | null
  createdAt: Date | null
}

export type PaystackReconciliationResult = {
  candidateCount: number
  checked: number
  markedPaid: number
  accountsCreated: number
  provisioned: number
  stillProcessing: number
  notPaid: number
  mismatched: number
  duplicateReview: number
  failed: number
  terminalOrdersDeleted: number
}

function clean(value: unknown, max = 190) {
  return String(value || "").trim().slice(0, max)
}

const MISSING_PAYSTACK_REFERENCE_GRACE_MS = 24 * 60 * 60 * 1000
const TERMINAL_PAYSTACK_STATUSES = new Set(["abandoned", "failed", "reversed"])

export function isPermanentPaystackReconciliationError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false
  if (error.code !== "P2010") return false
  const mysqlCode = clean((error.meta as { code?: unknown } | undefined)?.code, 20)
  return new Set(["1054", "1146", "1265", "1267"]).has(mysqlCode)
}

export async function cleanupTerminalPaystackOrders(input?: { minimumAgeHours?: number; limit?: number; dryRun?: boolean }) {
  await ensurePaystackAuditTable()
  const minimumAgeHours = Math.max(24, Math.min(24 * 30, Math.round(Number(input?.minimumAgeHours || 24))))
  const limit = Math.max(1, Math.min(300, Math.round(Number(input?.limit || 120))))
  const rows = await prisma.$queryRaw<Array<{
    orderUuid: string
    status: string
    email: string | null
    courseSlug: string | null
    updatedAt: Date | null
  }>>`
    SELECT co.order_uuid AS orderUuid, co.status, co.email, co.course_slug AS courseSlug, co.updated_at AS updatedAt
    FROM course_orders co
    WHERE LOWER(COALESCE(co.provider, '')) = 'paystack'
      AND (
        co.status IN ('failed', 'initialization_failed')
        OR (co.status IN ('pending', 'initializing') AND COALESCE(TRIM(co.provider_reference), '') = '')
      )
      AND co.updated_at < DATE_SUB(NOW(), INTERVAL ${minimumAgeHours} HOUR)
      AND NOT EXISTS (
        SELECT 1 FROM tochukwu_paystack_payment_events successful
        WHERE successful.order_uuid COLLATE utf8mb4_unicode_ci = co.order_uuid COLLATE utf8mb4_unicode_ci
          AND successful.outcome IN ('verified', 'provisioned')
      )
      AND NOT EXISTS (
        SELECT 1 FROM family_seat_ledger ledger
        WHERE ledger.source_type = 'course_order'
          AND ledger.source_uuid COLLATE utf8mb4_unicode_ci = co.order_uuid COLLATE utf8mb4_unicode_ci
      )
      AND NOT EXISTS (
        SELECT 1 FROM tochukwu_course_enrollment_claims claim
        WHERE claim.source_type = 'course_order'
          AND claim.source_uuid COLLATE utf8mb4_unicode_ci = co.order_uuid COLLATE utf8mb4_unicode_ci
      )
    ORDER BY co.updated_at ASC, co.id ASC
    LIMIT ${limit}
  `
  if (input?.dryRun) return { eligible: rows.length, deleted: 0, orderUuids: rows.map((row) => row.orderUuid) }

  let deleted = 0
  for (const row of rows) {
    const removed = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE tochukwu_abandoned_enrollment_followups
        SET status = 'stopped', stopped_at = NOW(), stopped_reason = 'terminal_payment_cleanup',
            locked_at = NULL, last_error = NULL, updated_at = NOW()
        WHERE order_uuid COLLATE utf8mb4_unicode_ci = ${row.orderUuid} COLLATE utf8mb4_unicode_ci
          AND status IN ('pending', 'retry', 'processing')
      `.catch(() => 0)
      await tx.$executeRaw`
        DELETE enrollment FROM family_child_enrollments enrollment
        JOIN family_children child ON child.id = enrollment.child_id
        WHERE child.source_type = 'course_order'
          AND child.source_uuid COLLATE utf8mb4_unicode_ci = ${row.orderUuid} COLLATE utf8mb4_unicode_ci
          AND child.status = 'pending_payment'
          AND enrollment.status = 'pending_payment'
      `.catch(() => 0)
      await tx.$executeRaw`
        DELETE FROM family_children
        WHERE source_type = 'course_order'
          AND source_uuid COLLATE utf8mb4_unicode_ci = ${row.orderUuid} COLLATE utf8mb4_unicode_ci
          AND status = 'pending_payment'
      `.catch(() => 0)
      return tx.$executeRaw`
        DELETE FROM course_orders
        WHERE order_uuid = ${row.orderUuid}
          AND (
            status IN ('failed', 'initialization_failed')
            OR (status IN ('pending', 'initializing') AND COALESCE(TRIM(provider_reference), '') = '')
          )
          AND updated_at < DATE_SUB(NOW(), INTERVAL ${minimumAgeHours} HOUR)
        LIMIT 1
      `
    })
    if (Number(removed || 0) !== 1) continue
    deleted += 1
    await recordPaystackAuditEvent({
      orderUuid: row.orderUuid,
      source: "reconciliation",
      eventType: "order.cleanup",
      outcome: "ignored",
      providerStatus: row.status,
      errorCode: "terminal_order_deleted_after_24h",
      errorMessage: `Terminal unpaid Paystack order removed from the enrollment registry after ${minimumAgeHours} hours.`
    })
  }
  return { eligible: rows.length, deleted, orderUuids: rows.map((row) => row.orderUuid) }
}

async function markOrderTerminal(orderUuid: string, status: string) {
  if (!TERMINAL_PAYSTACK_STATUSES.has(clean(status, 40).toLowerCase())) return
  await prisma.$executeRaw`
    UPDATE course_orders
    SET status = 'failed', updated_at = ${new Date()}
    WHERE order_uuid = ${orderUuid}
      AND COALESCE(status, 'pending') NOT IN ('paid', 'duplicate_payment_review')
    LIMIT 1
  `
}

export async function reconcileCoursePaystackOrders(input?: {
  courseSlug?: string
  batchKey?: string
  orderUuid?: string
  limit?: number
}): Promise<PaystackReconciliationResult> {
  const requestedCourse = normalizeCourse(input?.courseSlug)
  const courseSlug = requestedCourse && requestedCourse !== "all" ? requestedCourse : "all"
  const requestedBatch = clean(input?.batchKey, 80)
  const batchKey = requestedBatch && requestedBatch !== "all" ? requestedBatch : "all"
  const orderUuid = clean(input?.orderUuid, 64)
  const limit = Math.max(1, Math.min(Math.round(Number(input?.limit || 80)), 300))

  const candidates = await prisma.$queryRaw<ReconciliationCandidate[]>`
    SELECT
      co.order_uuid AS orderUuid,
      co.course_slug AS courseSlug,
      co.batch_key AS batchKey,
      co.email,
      co.status,
      co.provider_reference AS providerReference,
      co.created_at AS createdAt,
      (
        SELECT sa.id
        FROM student_accounts sa
        WHERE LOWER(sa.email) COLLATE utf8mb4_unicode_ci = LOWER(co.email) COLLATE utf8mb4_unicode_ci
        LIMIT 1
      ) AS accountId
    FROM course_orders co
    WHERE LOWER(COALESCE(co.provider, '')) = 'paystack'
      AND co.provider_reference IS NOT NULL
      AND TRIM(co.provider_reference) <> ''
      AND (${orderUuid} = '' OR co.order_uuid = ${orderUuid})
      AND (${courseSlug} = 'all' OR co.course_slug = ${courseSlug})
      AND (${batchKey} = 'all' OR COALESCE(co.batch_key, '') = ${batchKey})
      AND (
        COALESCE(co.status, '') <> 'paid'
        OR NOT EXISTS (
          SELECT 1
          FROM student_accounts sa
          WHERE LOWER(sa.email) COLLATE utf8mb4_unicode_ci = LOWER(co.email) COLLATE utf8mb4_unicode_ci
        )
        OR (
          co.status = 'paid'
          AND COALESCE(co.buyer_type, 'student') = 'family'
          AND (
            NOT EXISTS (
              SELECT 1
              FROM family_seat_ledger ledger
              WHERE ledger.source_type = 'course_order'
                AND ledger.entry_type = 'purchase'
                AND ledger.source_uuid COLLATE utf8mb4_unicode_ci = co.order_uuid COLLATE utf8mb4_unicode_ci
            )
            OR EXISTS (
              SELECT 1
              FROM family_children child
              JOIN family_child_enrollments enrollment ON enrollment.child_id = child.id
              WHERE child.source_type = 'course_order'
                AND enrollment.source_type = 'course_order'
                AND child.source_uuid COLLATE utf8mb4_unicode_ci = co.order_uuid COLLATE utf8mb4_unicode_ci
                AND enrollment.source_uuid COLLATE utf8mb4_unicode_ci = co.order_uuid COLLATE utf8mb4_unicode_ci
                AND (child.status = 'pending_payment' OR enrollment.status = 'pending_payment')
            )
          )
        )
      )
      AND COALESCE(co.status, '') NOT IN ('initialization_failed', 'duplicate_payment_review', 'abandoned', 'failed', 'reversed', 'expired', 'cancelled')
    ORDER BY co.created_at DESC
    LIMIT ${limit}
  `

  const result: PaystackReconciliationResult = {
    candidateCount: candidates.length,
    checked: 0,
    markedPaid: 0,
    accountsCreated: 0,
    provisioned: 0,
    stillProcessing: 0,
    notPaid: 0,
    mismatched: 0,
    duplicateReview: 0,
    failed: 0,
    terminalOrdersDeleted: 0
  }

  for (const candidate of candidates) {
    const orderUuid = clean(candidate.orderUuid, 80)
    const reference = clean(candidate.providerReference)
    if (!orderUuid || !reference) {
      result.failed += 1
      continue
    }

    try {
      let providerOrderId: string | null = null
      const wasPaid = clean(candidate.status, 40).toLowerCase() === "paid"

      if (!wasPaid) {
        try {
          const transaction = await inspectPaystackTransaction(reference)
          result.checked += 1
          providerOrderId = transaction.providerOrderId
          if (!transaction.successful) {
            const processing = isPaystackProcessingStatus(transaction.providerStatus)
            if (processing) result.stillProcessing += 1
            else {
              result.notPaid += 1
              if (TERMINAL_PAYSTACK_STATUSES.has(transaction.providerStatus)) {
                await markOrderTerminal(orderUuid, transaction.providerStatus)
              }
            }
            await recordPaystackAuditEvent({
              orderUuid,
              providerReference: reference,
              providerEventId: transaction.providerOrderId,
              source: "reconciliation",
              eventType: "transaction.verify",
              outcome: processing ? "processing" : "not_paid",
              providerStatus: transaction.providerStatus,
              receivedAmountMinor: transaction.amountMinor,
              receivedCurrency: transaction.currency
            })
            continue
          }
          const validation = await validateCourseOrderPaystackPayment({
            orderUuid,
            providerReference: reference,
            receivedAmountMinor: transaction.amountMinor,
            receivedCurrency: transaction.currency
          })
          if (!validation.ok) {
            result.mismatched += 1
            await recordPaystackAuditEvent({
              orderUuid,
              providerReference: reference,
              providerEventId: transaction.providerOrderId,
              source: "reconciliation",
              eventType: "transaction.verify",
              outcome: "mismatch",
              providerStatus: transaction.providerStatus,
              expectedAmountMinor: validation.expected?.expectedAmountMinor,
              receivedAmountMinor: transaction.amountMinor,
              expectedCurrency: validation.expected?.expectedCurrency,
              receivedCurrency: transaction.currency,
              errorCode: validation.reason,
              errorMessage: "Paystack amount or currency did not match the course order."
            })
            continue
          }
          await recordPaystackAuditEvent({
            orderUuid,
            providerReference: reference,
            providerEventId: transaction.providerOrderId,
            source: "reconciliation",
            eventType: "transaction.verify",
            outcome: "verified",
            providerStatus: transaction.providerStatus,
            expectedAmountMinor: validation.expected.expectedAmountMinor,
            receivedAmountMinor: transaction.amountMinor,
            expectedCurrency: validation.expected.expectedCurrency,
            receivedCurrency: transaction.currency
          })
        } catch (error) {
          result.checked += 1
          if (isPermanentPaystackReconciliationError(error)) throw error
          if (isPaystackTransactionNotFound(error)) {
            const createdAtMs = candidate.createdAt?.getTime() || 0
            const beyondGracePeriod = createdAtMs > 0 && Date.now() - createdAtMs >= MISSING_PAYSTACK_REFERENCE_GRACE_MS
            if (beyondGracePeriod) {
              await markOrderTerminal(orderUuid, "abandoned")
              result.notPaid += 1
            } else {
              result.stillProcessing += 1
            }
            await recordPaystackAuditEvent({
              orderUuid,
              providerReference: reference,
              source: "reconciliation",
              eventType: "transaction.verify",
              outcome: beyondGracePeriod ? "not_paid" : "processing",
              providerStatus: "transaction_not_found",
              errorCode: "transaction_not_found",
              errorMessage: error.providerMessage || "Paystack transaction reference was not found."
            })
            continue
          }
          result.failed += 1
          await recordPaystackAuditEvent({
            orderUuid,
            providerReference: reference,
            source: "reconciliation",
            eventType: "transaction.verify",
            outcome: "failed",
            errorCode: "verification_request_failed",
            errorMessage: error instanceof Error ? error.message : String(error)
          })
          continue
        }
      }

      const order = wasPaid
        ? await markCourseOrderPaid({ orderUuid })
        : await markCourseOrderPaid({ orderUuid, providerReference: reference, providerOrderId })
      if (!order) {
        result.failed += 1
        continue
      }

      if (!wasPaid) result.markedPaid += 1
      await createAffiliateCommissionForOrder(orderUuid).catch(() => null)
      const provisioned = await provisionStudentForPaidOrder(order)
      if (!provisioned?.account) {
        result.failed += 1
        continue
      }

      result.provisioned += 1
      if (!candidate.accountId) result.accountsCreated += 1
      await recordPaystackAuditEvent({
        orderUuid,
        providerReference: reference,
        providerEventId: providerOrderId,
        source: "reconciliation",
        eventType: "student.provision",
        outcome: "provisioned",
        providerStatus: "success"
      })
      await sendCourseOrderMetaPurchase({ orderUuid }).catch(() => null)
    } catch (error) {
      if (isPermanentPaystackReconciliationError(error)) throw error
      if (isCourseEnrollmentConflict(error)) {
        result.duplicateReview += 1
        await recordPaystackAuditEvent({
          orderUuid,
          providerReference: reference,
          source: "reconciliation",
          eventType: "student.provision",
          outcome: "failed",
          errorCode: error.code,
          errorMessage: error.message
        })
        continue
      }
      result.failed += 1
      await recordPaystackAuditEvent({
        orderUuid,
        providerReference: reference,
        source: "reconciliation",
        eventType: "student.provision",
        outcome: "failed",
        errorCode: "provision_failed",
        errorMessage: error instanceof Error ? error.message : String(error)
      })
    }
  }

  if (!orderUuid) {
    const cleanup = await cleanupTerminalPaystackOrders({ minimumAgeHours: 24, limit })
    result.terminalOrdersDeleted = cleanup.deleted
  }
  return result
}
