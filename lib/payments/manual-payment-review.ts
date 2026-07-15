import crypto from "crypto"

import { sendStudentAccountReadyEmail, syncEnrollmentToBrevo } from "@/lib/enrollment-notifications"
import { provisionFamilyOrder } from "@/lib/family-enrollment"
import { sendManualPaymentMetaPurchase } from "@/lib/manual-payment-meta"
import { prisma } from "@/lib/prisma"
import {
  assertBatchCapacity,
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

async function createAffiliateCommissionForOrder(orderUuid: string) {
  if (String(process.env.AFFILIATE_ENABLED || "1").trim() === "0") return

  try {
    const existing = await prisma.$queryRaw<{ id: bigint }[]>`
      SELECT id
      FROM tochukwu_affiliate_commissions
      WHERE order_uuid = ${orderUuid}
      LIMIT 1
    `
    if (existing.length) return

    const rows = await prisma.$queryRaw<
      Array<{
        attributionId: bigint
        courseSlug: string | null
        affiliateProfileId: bigint | null
        affiliateCode: string | null
        buyerEmail: string | null
        buyerCurrency: string | null
        orderAmountMinor: number | bigint | null
        attributionStatus: string | null
        riskScore: number | bigint | null
        riskFlagsJson: string | null
        profileStatus: string | null
        eligibilityStatus: string | null
        commissionType: string | null
        commissionValue: number | bigint | null
        commissionCurrency: string | null
        holdDays: number | bigint | null
      }>
    >`
      SELECT a.id AS attributionId,
             a.course_slug AS courseSlug,
             a.affiliate_profile_id AS affiliateProfileId,
             a.affiliate_code AS affiliateCode,
             a.buyer_email AS buyerEmail,
             a.buyer_currency AS buyerCurrency,
             a.order_amount_minor AS orderAmountMinor,
             a.attribution_status AS attributionStatus,
             a.risk_score AS riskScore,
             a.risk_flags_json AS riskFlagsJson,
             p.status AS profileStatus,
             p.eligibility_status AS eligibilityStatus,
             r.commission_type AS commissionType,
             r.commission_value AS commissionValue,
             r.commission_currency AS commissionCurrency,
             r.hold_days AS holdDays
      FROM tochukwu_affiliate_attributions a
      JOIN tochukwu_affiliate_profiles p ON p.id = a.affiliate_profile_id
      JOIN tochukwu_affiliate_course_rules r ON r.course_slug = a.course_slug
      WHERE a.order_uuid = ${orderUuid}
        AND a.attribution_status = 'accepted'
        AND p.status = 'active'
        AND p.eligibility_status = 'eligible'
        AND r.is_affiliate_eligible = 1
        AND (r.starts_at IS NULL OR r.starts_at <= NOW())
        AND (r.ends_at IS NULL OR r.ends_at >= NOW())
      LIMIT 1
    `
    const row = rows[0]
    if (!row?.affiliateProfileId) return

    const orderAmountMinor = Math.max(0, toNumber(row.orderAmountMinor))
    const commissionType = clean(row.commissionType, 20).toLowerCase() || "percentage"
    const commissionValue = Math.max(0, toNumber(row.commissionValue))
    const commissionAmountMinor =
      commissionType === "fixed" ? commissionValue : Math.floor((orderAmountMinor * Math.min(commissionValue, 10000)) / 10000)
    if (commissionAmountMinor <= 0) return

    const holdDays = Math.max(0, Math.min(120, toNumber(row.holdDays, Number(process.env.AFFILIATE_DEFAULT_HOLD_DAYS || 30))))
    const payableAt = new Date(Date.now() + holdDays * 24 * 60 * 60 * 1000)
    const now = new Date()
    await prisma.$executeRaw`
      INSERT INTO tochukwu_affiliate_commissions
        (commission_uuid, attribution_id, order_uuid, course_slug, affiliate_profile_id, affiliate_code,
         buyer_email, currency, order_amount_minor, commission_type, commission_rate_or_value,
         commission_amount_minor, status, risk_score, risk_flags_json, payable_at, created_at, updated_at)
      VALUES
        (${`acm_${crypto.randomUUID().replace(/-/g, "")}`}, ${row.attributionId}, ${orderUuid}, ${clean(row.courseSlug, 120)},
         ${row.affiliateProfileId}, ${clean(row.affiliateCode, 40)}, ${normalizeEmail(row.buyerEmail)},
         ${clean(row.commissionCurrency || row.buyerCurrency || "NGN", 10).toUpperCase()}, ${orderAmountMinor},
         ${commissionType}, ${commissionValue}, ${commissionAmountMinor}, 'pending',
         ${toNumber(row.riskScore)}, ${row.riskFlagsJson || "[]"}, ${payableAt}, ${now}, ${now})
      ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at)
    `
  } catch (_error) {
    return
  }
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
  if (nextStatus === "approved") {
    const courseSlug = clean(payment.course_slug, 120).toLowerCase()
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

  const email = normalizeEmail(payment.email)
  if (!email) throw new Error("Approved payment has no valid student email.")

  const existingAccount = await prisma.studentAccount.findUnique({ where: { email } })
  const account =
    existingAccount ||
    (await findOrCreateStudentAccount({
      fullName: clean(payment.first_name, 180) || "Student",
      email,
      phone: clean(payment.phone, 80) || undefined
    }))

  let resetToken: string | null = null
  if (!existingAccount) {
    const reset = await createStudentPasswordResetToken(email, { neverExpires: true })
    resetToken = reset?.token || null
    if (resetToken) {
      await sendStudentAccountReadyEmail({
        email,
        fullName: account.fullName || clean(payment.first_name, 180) || "Student",
        courseSlug: clean(payment.course_slug, 120),
        resetToken
      })
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

  await recordCouponRedemption({
    couponId: payment.coupon_id ? Number(payment.coupon_id) : null,
    orderUuid: paymentUuid,
    email,
    currency: clean(payment.currency, 10) || "NGN",
    discountMinor: toNumber(payment.discount_minor)
  })

  let familyProvisioned: Awaited<ReturnType<typeof provisionFamilyOrder>> | null = null
  if (clean(payment.buyer_type, 40).toLowerCase() === "family") {
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
  }

  await createAffiliateCommissionForOrder(paymentUuid)
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
    familyProvisioned
  }
}
