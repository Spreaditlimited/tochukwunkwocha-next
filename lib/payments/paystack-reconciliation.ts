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
  isPaystackProcessingStatus,
  recordPaystackAuditEvent,
  validateCourseOrderPaystackPayment
} from "@/lib/payments/paystack-audit"
import { provisionStudentForPaidOrder } from "@/lib/payments/post-payment-student"
import { isCourseEnrollmentConflict } from "@/lib/enrollment-guard"

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
}

function clean(value: unknown, max = 190) {
  return String(value || "").trim().slice(0, max)
}

const MISSING_PAYSTACK_REFERENCE_GRACE_MS = 24 * 60 * 60 * 1000
const TERMINAL_PAYSTACK_STATUSES = new Set(["abandoned", "failed", "reversed"])

async function markOrderTerminal(orderUuid: string, status: string) {
  const terminalStatus = TERMINAL_PAYSTACK_STATUSES.has(status) ? status : "abandoned"
  await prisma.$executeRaw`
    UPDATE course_orders
    SET status = ${terminalStatus}, updated_at = ${new Date()}
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
      AND COALESCE(co.status, '') NOT IN ('duplicate_payment_review', 'abandoned', 'failed', 'reversed', 'expired', 'cancelled')
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
    failed: 0
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

  return result
}
