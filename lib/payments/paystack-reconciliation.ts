import { sendCourseOrderMetaPurchase } from "@/lib/meta-events"
import { prisma } from "@/lib/prisma"
import {
  createAffiliateCommissionForOrder,
  markCourseOrderPaid,
  normalizeCourse,
  verifyPaystackTransaction
} from "@/lib/payments/course-checkout"
import { provisionStudentForPaidOrder } from "@/lib/payments/post-payment-student"

type ReconciliationCandidate = {
  orderUuid: string | null
  courseSlug: string | null
  batchKey: string | null
  email: string | null
  status: string | null
  providerReference: string | null
  accountId: bigint | number | null
}

export type PaystackReconciliationResult = {
  candidateCount: number
  checked: number
  markedPaid: number
  accountsCreated: number
  provisioned: number
  notPaid: number
  failed: number
}

function clean(value: unknown, max = 190) {
  return String(value || "").trim().slice(0, max)
}

export async function reconcileCoursePaystackOrders(input?: {
  courseSlug?: string
  batchKey?: string
  limit?: number
}): Promise<PaystackReconciliationResult> {
  const requestedCourse = normalizeCourse(input?.courseSlug)
  const courseSlug = requestedCourse && requestedCourse !== "all" ? requestedCourse : "all"
  const requestedBatch = clean(input?.batchKey, 80)
  const batchKey = requestedBatch && requestedBatch !== "all" ? requestedBatch : "all"
  const limit = Math.max(1, Math.min(Math.round(Number(input?.limit || 80)), 300))

  const candidates = await prisma.$queryRaw<ReconciliationCandidate[]>`
    SELECT
      co.order_uuid AS orderUuid,
      co.course_slug AS courseSlug,
      co.batch_key AS batchKey,
      co.email,
      co.status,
      co.provider_reference AS providerReference,
      (
        SELECT sa.id
        FROM student_accounts sa
        WHERE LOWER(sa.email) = LOWER(co.email)
        LIMIT 1
      ) AS accountId
    FROM course_orders co
    WHERE LOWER(COALESCE(co.provider, '')) = 'paystack'
      AND co.provider_reference IS NOT NULL
      AND TRIM(co.provider_reference) <> ''
      AND (${courseSlug} = 'all' OR co.course_slug = ${courseSlug})
      AND (${batchKey} = 'all' OR COALESCE(co.batch_key, '') = ${batchKey})
      AND (
        COALESCE(co.status, '') <> 'paid'
        OR NOT EXISTS (
          SELECT 1
          FROM student_accounts sa
          WHERE LOWER(sa.email) = LOWER(co.email)
        )
      )
    ORDER BY co.created_at DESC
    LIMIT ${limit}
  `

  const result: PaystackReconciliationResult = {
    candidateCount: candidates.length,
    checked: 0,
    markedPaid: 0,
    accountsCreated: 0,
    provisioned: 0,
    notPaid: 0,
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
          const transaction = await verifyPaystackTransaction(reference)
          result.checked += 1
          providerOrderId = transaction.providerOrderId
        } catch (_error) {
          result.checked += 1
          result.notPaid += 1
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
      await sendCourseOrderMetaPurchase({ orderUuid }).catch(() => null)
    } catch (_error) {
      result.failed += 1
    }
  }

  return result
}
