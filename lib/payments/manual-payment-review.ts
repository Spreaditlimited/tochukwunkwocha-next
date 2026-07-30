import { sendStudentAccountReadyEmail, syncEnrollmentToBrevo } from "@/lib/enrollment-notifications"
import { provisionFamilyOrder } from "@/lib/family-enrollment"
import { sendManualPaymentMetaPurchase } from "@/lib/manual-payment-meta"
import { prisma } from "@/lib/prisma"
import { sendEnrollmentConfirmedWhatsApp } from "@/lib/transactional-whatsapp"
import {
  assertBatchCapacity,
  createAffiliateCommissionForOrder,
  findOrCreateStudentAccount,
  normalizeEmail,
  recordCouponRedemption,
  resolveCheckoutBatch,
  siteBaseUrl
} from "@/lib/payments/course-checkout"
import { createStudentPasswordResetToken } from "@/lib/student-auth"

type ManualPaymentRow = {
  payment_uuid: string
  course_slug: string | null
  batch_key: string | null
  batch_label: string | null
  first_name: string | null
  email: string | null
  phone: string | null
  country: string | null
  currency: string | null
  amount_minor: number | bigint | null
  discount_minor: number | bigint | null
  coupon_id: number | bigint | null
  buyer_type: string | null
  seat_count: number | bigint | null
  status: string | null
}

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function toNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? Math.round(numberValue) : fallback
}

async function findManualPayment(paymentUuid: string) {
  const rows = await prisma.$queryRaw<ManualPaymentRow[]>`
    SELECT payment_uuid, course_slug, batch_key, batch_label, first_name, email, phone, country, currency,
           amount_minor, discount_minor, coupon_id, buyer_type, seat_count, status
    FROM course_manual_payments
    WHERE payment_uuid = ${paymentUuid}
    LIMIT 1
  `
  return rows[0] || null
}

async function findExistingApprovedIndividualEnrollment(input: {
  email: string
  courseSlug: string
  excludeManualPaymentUuid: string
}) {
  const [manualRows, orderRows] = await Promise.all([
    prisma.$queryRaw<Array<{ sourceUuid: string; batchKey: string | null }>>`
      SELECT payment_uuid AS sourceUuid, batch_key AS batchKey
      FROM course_manual_payments
      WHERE LOWER(TRIM(email)) = ${input.email}
        AND LOWER(TRIM(course_slug)) = ${input.courseSlug}
        AND status = 'approved'
        AND COALESCE(buyer_type, 'student') <> 'family'
        AND payment_uuid <> ${input.excludeManualPaymentUuid}
      ORDER BY id DESC
      LIMIT 1
    `,
    prisma.$queryRaw<Array<{ sourceUuid: string; batchKey: string | null }>>`
      SELECT order_uuid AS sourceUuid, batch_key AS batchKey
      FROM course_orders
      WHERE LOWER(TRIM(email)) = ${input.email}
        AND LOWER(TRIM(course_slug)) = ${input.courseSlug}
        AND status = 'paid'
        AND COALESCE(buyer_type, 'student') <> 'family'
      ORDER BY id DESC
      LIMIT 1
    `
  ])

  if (manualRows[0]) return { sourceType: "manual payment", ...manualRows[0] }
  if (orderRows[0]) return { sourceType: "online order", ...orderRows[0] }
  return null
}

async function updateManualPaymentReview(input: {
  paymentUuid: string
  status: "approved" | "rejected"
  reviewedBy: string
  reviewNote?: string
}) {
  const reviewedAt = new Date()
  try {
    await prisma.$executeRaw`
      UPDATE course_manual_payments
      SET status = ${input.status},
          reviewed_by = ${input.reviewedBy},
          review_note = CASE
            WHEN ${input.reviewNote || null} IS NULL THEN review_note
            WHEN COALESCE(review_note, '') = '' THEN ${input.reviewNote || null}
            ELSE CONCAT(review_note, '\n', ${input.reviewNote || null})
          END,
          reviewed_at = ${reviewedAt},
          updated_at = ${reviewedAt}
      WHERE payment_uuid = ${input.paymentUuid}
      LIMIT 1
    `
  } catch (_error) {
    await prisma.$executeRaw`
      UPDATE course_manual_payments
      SET status = ${input.status},
          updated_at = ${reviewedAt}
      WHERE payment_uuid = ${input.paymentUuid}
      LIMIT 1
    `
  }
}

async function appendManualPaymentReviewNote(paymentUuid: string, note: string) {
  const timestamp = new Date()
  await prisma.$executeRaw`
    UPDATE course_manual_payments
    SET review_note = CASE
          WHEN COALESCE(review_note, '') = '' THEN ${clean(note, 500)}
          ELSE CONCAT(review_note, '\n', ${clean(note, 500)})
        END,
        updated_at = ${timestamp}
    WHERE payment_uuid = ${paymentUuid}
    LIMIT 1
  `.catch(() => 0)
}

async function returnApprovedPaymentToPending(paymentUuid: string, reason: string) {
  const timestamp = new Date()
  await prisma.$executeRaw`
    UPDATE course_manual_payments
    SET status = 'pending_verification',
        review_note = CASE
          WHEN COALESCE(review_note, '') = '' THEN ${`[PROVISIONING_FAILED] ${clean(reason, 430)}`}
          ELSE CONCAT(review_note, '\n', ${`[PROVISIONING_FAILED] ${clean(reason, 430)}`})
        END,
        updated_at = ${timestamp}
    WHERE payment_uuid = ${paymentUuid}
      AND status = 'approved'
    LIMIT 1
  `.catch(() => 0)
}

export async function reviewManualPayment(input: {
  paymentUuid: string
  action: "approve" | "reject"
  reviewedBy: string
  reviewNote?: string
}) {
  const paymentUuid = clean(input.paymentUuid, 64)
  if (!paymentUuid) throw new Error("Missing manual payment reference.")

  const payment = await findManualPayment(paymentUuid)
  if (!payment) throw new Error("Manual payment not found.")
  if (payment.status === "recovery_required") {
    throw new Error("Complete the recovered customer's name, email, and phone before reviewing this payment.")
  }

  const nextStatus = input.action === "approve" ? "approved" : "rejected"
  const email = normalizeEmail(payment.email)
  const courseSlug = clean(payment.course_slug, 120).toLowerCase()

  if (nextStatus === "approved") {
    if (!email) throw new Error("This payment has no valid student email and cannot be approved.")
    if (!courseSlug) throw new Error("This payment has no valid course and cannot be approved.")
    if (clean(payment.status, 40).toLowerCase() === "approved") {
      throw new Error("This enrollment has already been approved.")
    }

    if (clean(payment.buyer_type, 40).toLowerCase() !== "family") {
      const existingEnrollment = await findExistingApprovedIndividualEnrollment({
        email,
        courseSlug,
        excludeManualPaymentUuid: paymentUuid
      })
      if (existingEnrollment) {
        throw new Error(
          `This email already has an approved enrollment for this course (${existingEnrollment.sourceType} ${existingEnrollment.sourceUuid}). Reject or correct the duplicate registration instead.`
        )
      }
    }

    const batchKey = clean(payment.batch_key, 64)
    const seatCount = Math.max(1, toNumber(payment.seat_count, 1))
    if (batchKey) {
      const batch = await resolveCheckoutBatch(courseSlug, batchKey)
      await assertBatchCapacity(batch, seatCount)
    }
  }

  await updateManualPaymentReview({
    paymentUuid,
    status: nextStatus,
    reviewedBy: clean(input.reviewedBy, 120) || "admin",
    reviewNote: clean(input.reviewNote, 500) || undefined
  })

  if (nextStatus !== "approved") {
    return { ok: true as const, paymentUuid, status: nextStatus, accountCreated: false, familyProvisioned: null }
  }

  let existingAccount = null
  let account
  try {
    existingAccount = await prisma.studentAccount.findUnique({ where: { email } })
    account =
      existingAccount ||
      (await findOrCreateStudentAccount({
        fullName: clean(payment.first_name, 180) || "Student",
        email,
        phone: clean(payment.phone, 80) || undefined
      }))
  } catch (error) {
    await returnApprovedPaymentToPending(paymentUuid, error instanceof Error ? error.message : "The parent account could not be prepared.")
    throw error
  }

  let familyProvisioned: Awaited<ReturnType<typeof provisionFamilyOrder>> | null = null
  if (clean(payment.buyer_type, 40).toLowerCase() === "family") {
    try {
      familyProvisioned = await provisionFamilyOrder({
        sourceType: "manual_payment",
        sourceUuid: paymentUuid,
        parentAccountId: account.id,
        parentName: account.fullName || clean(payment.first_name, 180) || "Student",
        parentEmail: account.email,
        parentPhone: account.phoneE164 || clean(payment.phone, 80),
        courseSlug: clean(payment.course_slug, 120),
        batchKey: clean(payment.batch_key, 64),
        batchLabel: clean(payment.batch_label, 120),
        quantity: Math.max(1, toNumber(payment.seat_count, 1))
      })
      if (!familyProvisioned.ok) {
        throw new Error(familyProvisioned.error || "The group seats could not be credited.")
      }
    } catch (error) {
      await returnApprovedPaymentToPending(paymentUuid, error instanceof Error ? error.message : "The group seats could not be credited.")
      throw error
    }
  }

  const reset = await createStudentPasswordResetToken(email, { neverExpires: true })
  const resetToken = reset?.token || null
  let activationEmailSent = false
  if (resetToken) {
    try {
      await sendStudentAccountReadyEmail({
        email,
        fullName: account.fullName || clean(payment.first_name, 180) || "Student",
        courseSlug: clean(payment.course_slug, 120),
        resetToken
      })
      activationEmailSent = true
    } catch (error) {
      await appendManualPaymentReviewNote(
        paymentUuid,
        `[ACTIVATION_EMAIL_FAILED] ${error instanceof Error ? error.message : "The activation email could not be sent."}`
      )
    }
  }
  await syncEnrollmentToBrevo({
    fullName: account.fullName || clean(payment.first_name, 180) || "Student",
    email,
    phone: account.phoneE164 || clean(payment.phone, 80),
    courseSlug: clean(payment.course_slug, 120),
    batchKey: clean(payment.batch_key, 64),
    batchLabel: clean(payment.batch_label, 120),
    source: "manual_payment_approved"
  }).catch(() => null)
  await sendEnrollmentConfirmedWhatsApp({
    phone: account.phoneE164 || clean(payment.phone, 80),
    fullName: account.fullName || clean(payment.first_name, 180) || "Student",
    courseSlug: clean(payment.course_slug, 120),
    dashboardPath: clean(payment.buyer_type, 40).toLowerCase() === "family" ? "/dashboard/family" : "/dashboard/courses"
  }).catch(() => null)

  await recordCouponRedemption({
    couponId: payment.coupon_id ? Number(payment.coupon_id) : null,
    orderUuid: paymentUuid,
    email,
    currency: clean(payment.currency, 10) || "NGN",
    discountMinor: toNumber(payment.discount_minor)
  }).catch(() => null)

  const affiliateCommission = await createAffiliateCommissionForOrder(paymentUuid)
  if (!affiliateCommission.ok) {
    await appendManualPaymentReviewNote(
      paymentUuid,
      `[AFFILIATE_COMMISSION_RETRY_REQUIRED] ${affiliateCommission.error || "Affiliate credit will be retried by reconciliation."}`
    )
  }
  await sendManualPaymentMetaPurchase({
    paymentUuid,
    eventSourceUrl: `${siteBaseUrl()}/checkout/${clean(payment.course_slug, 120) || "prompt-to-profit"}`
  }).catch(() => null)

  return {
    ok: true as const,
    paymentUuid,
    status: nextStatus,
    accountCreated: !existingAccount,
    resetToken,
    activationEmailSent,
    familyProvisioned,
    affiliateCommission
  }
}
