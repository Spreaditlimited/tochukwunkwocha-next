import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

export type StudentInstallmentPlan = {
  planUuid: string
  courseSlug: string
  courseTitle: string
  batchKey: string
  batchLabel: string
  country: string
  provider: string
  currency: string
  baseAmountMinor: number
  discountMinor: number
  couponCode: string | null
  buyerType: "student" | "family"
  seatCount: number
  targetAmountMinor: number
  totalPaidMinor: number
  remainingMinor: number
  status: string
  enrolledOrderUuid: string | null
  canEnrolNow: boolean
  canCancel: boolean
  payments: Array<{
    paymentUuid: string
    provider: string
    providerReference: string | null
    currency: string
    amountMinor: number
    status: string
    paidAt: Date | string | null
    createdAt: Date | string
  }>
}

export async function listStudentInstallmentPlans(accountId: bigint): Promise<StudentInstallmentPlan[]> {
  const rows = await prisma.$queryRaw<Array<{
    id: bigint
    planUuid: string
    courseSlug: string | null
    courseTitle: string | null
    batchKey: string | null
    batchLabel: string | null
    country: string | null
    provider: string | null
    currency: string | null
    baseAmountMinor: number | bigint | null
    discountMinor: number | bigint | null
    couponCode: string | null
    buyerType: string | null
    seatCount: number | bigint | null
    targetAmountMinor: number | bigint | null
    totalPaidMinor: number | bigint | null
    status: string | null
    enrolledOrderUuid: string | null
    paymentCount: number | bigint | null
  }>>(Prisma.sql`
    SELECT pl.id,
           pl.plan_uuid AS planUuid,
           pl.course_slug AS courseSlug,
           lc.course_title AS courseTitle,
           pl.batch_key AS batchKey,
           pl.batch_label AS batchLabel,
           pl.country,
           pl.provider,
           pl.currency,
           pl.base_amount_minor AS baseAmountMinor,
           pl.discount_minor AS discountMinor,
           pl.coupon_code AS couponCode,
           pl.buyer_type AS buyerType,
           pl.seat_count AS seatCount,
           pl.target_amount_minor AS targetAmountMinor,
           pl.total_paid_minor AS totalPaidMinor,
           pl.status,
           pl.enrolled_order_uuid AS enrolledOrderUuid,
           COUNT(ip.id) AS paymentCount
    FROM student_installment_plans pl
    LEFT JOIN tochukwu_learning_courses lc
      ON lc.course_slug COLLATE utf8mb4_unicode_ci = pl.course_slug COLLATE utf8mb4_unicode_ci
    LEFT JOIN student_installment_payments ip
      ON ip.plan_id = pl.id
    WHERE pl.account_id = ${accountId}
    GROUP BY pl.id, pl.plan_uuid, pl.course_slug, lc.course_title, pl.batch_key, pl.batch_label, pl.country, pl.provider,
      pl.currency, pl.base_amount_minor, pl.discount_minor, pl.coupon_code, pl.buyer_type, pl.seat_count,
      pl.target_amount_minor, pl.total_paid_minor, pl.status, pl.enrolled_order_uuid
    ORDER BY pl.created_at DESC, pl.id DESC
  `)

  if (!rows.length) return []

  const planIds = rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id) && id > 0)
  const payments = planIds.length
    ? await prisma.$queryRaw<Array<{
        planId: bigint
        paymentUuid: string
        provider: string | null
        providerReference: string | null
        currency: string | null
        amountMinor: number | bigint | null
        status: string | null
        paidAt: Date | null
        createdAt: Date
      }>>(Prisma.sql`
        SELECT plan_id AS planId,
               payment_uuid AS paymentUuid,
               provider,
               provider_reference AS providerReference,
               currency,
               amount_minor AS amountMinor,
               status,
               paid_at AS paidAt,
               created_at AS createdAt
        FROM student_installment_payments
        WHERE plan_id IN (${Prisma.join(planIds)})
        ORDER BY created_at DESC, id DESC
      `)
    : []
  const paymentsByPlan = new Map<number, StudentInstallmentPlan["payments"]>()
  payments.forEach((payment) => {
    const planId = Number(payment.planId)
    const current = paymentsByPlan.get(planId) || []
    current.push({
      paymentUuid: clean(payment.paymentUuid, 80),
      provider: clean(payment.provider, 40),
      providerReference: payment.providerReference ? clean(payment.providerReference, 160) : null,
      currency: clean(payment.currency, 10) || "NGN",
      amountMinor: Number(payment.amountMinor || 0),
      status: clean(payment.status, 40) || "pending",
      paidAt: payment.paidAt,
      createdAt: payment.createdAt
    })
    paymentsByPlan.set(planId, current)
  })

  return rows.map((row) => {
    const targetAmountMinor = Number(row.targetAmountMinor || 0)
    const totalPaidMinor = Number(row.totalPaidMinor || 0)
    const status = clean(row.status, 40) || "open"
    const buyerType = clean(row.buyerType, 40).toLowerCase() === "family" ? "family" : "student"
    const paymentCount = Number(row.paymentCount || 0)
    return {
      planUuid: clean(row.planUuid, 80),
      courseSlug: clean(row.courseSlug, 120),
      courseTitle: clean(row.courseTitle, 220) || clean(row.courseSlug, 120),
      batchKey: clean(row.batchKey, 80),
      batchLabel: clean(row.batchLabel, 120),
      country: clean(row.country, 120) || "Nigeria",
      provider: clean(row.provider, 40) || (clean(row.currency, 10).toUpperCase() === "NGN" ? "paystack" : "stripe"),
      currency: clean(row.currency, 10) || "NGN",
      baseAmountMinor: Number(row.baseAmountMinor || targetAmountMinor),
      discountMinor: Number(row.discountMinor || 0),
      couponCode: row.couponCode ? clean(row.couponCode, 40) : null,
      buyerType,
      seatCount: buyerType === "family" ? Math.max(2, Number(row.seatCount || 2)) : 1,
      targetAmountMinor,
      totalPaidMinor,
      remainingMinor: Math.max(0, targetAmountMinor - totalPaidMinor),
      status,
      enrolledOrderUuid: row.enrolledOrderUuid ? clean(row.enrolledOrderUuid, 80) : null,
      canEnrolNow: targetAmountMinor > 0 && totalPaidMinor >= targetAmountMinor && status === "open",
      canCancel: status === "open" && totalPaidMinor <= 0 && paymentCount <= 0,
      payments: paymentsByPlan.get(Number(row.id)) || []
    }
  })
}
