import crypto, { randomUUID } from "crypto"

import { getAdminSettingValue } from "@/lib/admin-settings"
import { configuredLearningCourseSlugSql, dayLevelCourseSlugRegex } from "@/lib/learning-course-catalog"
import { prisma } from "@/lib/prisma"
import { getCourse } from "@/lib/public-offers"
import { addColumnIfMissing } from "@/lib/schema-guards"

export type CheckoutProvider = "paystack" | "stripe"

export type CheckoutPricing = {
  currency: string
  baseAmountMinor: number
  courseAmountMinor?: number
  vatPercent?: number
  vatAmountMinor?: number
  subtotalAmountMinor?: number
  processingFeeMinor?: number
  discountMinor: number
  finalAmountMinor: number
  groupDiscountMinor?: number
  groupUnitAmountMinor?: number | null
  standardUnitAmountMinor?: number | null
  couponCode?: string | null
  couponId?: number | null
}

export type CheckoutBatch = {
  courseSlug: string
  batchKey: string
  batchLabel: string
  status: string
  isActive: boolean
  brevoListId: string | null
  seatLimit: number | null
  enrolledCount: number
  remainingSeats: number | null
  batchStartAt: string | null
}

type LearningCourseRow = {
  slug: string
  name?: string | null
  price_ngn_minor?: number | bigint | null
  price_gbp_minor?: number | bigint | null
  price_usd_minor?: number | bigint | null
  price_eur_minor?: number | bigint | null
  is_enrollment_locked?: number | bigint | boolean | null
  payment_methods?: string | null
  enrollment_mode?: string | null
}

type CourseBatchRow = {
  course_slug: string
  batch_key: string
  batch_label: string
  status: string | null
  is_active: number | bigint | boolean | null
  brevo_list_id: string | null
  seat_limit: number | bigint | null
  batch_start_at: Date | string | null
}

type CouponRow = {
  id: number | bigint
  code: string
  description: string | null
  discount_type: string
  percent_off: number | string | null
  fixed_ngn_minor: number | bigint | null
  fixed_gbp_minor: number | bigint | null
  course_slug: string | null
  starts_at: Date | string | null
  ends_at: Date | string | null
  is_active: number | bigint | boolean
  max_uses: number | bigint | null
  max_uses_per_email: number | bigint | null
}

const courseReferencePrefixes: Record<string, string> = {
  "prompt-to-profit": "PTP",
  "prompt-to-profit-holiday": "PTP",
  "prompt-to-production": "PTPROD",
  "ai-for-everyday-business-owners": "AIEBO",
  "prompt-to-profit-schools": "PTPS"
}

const HOLIDAY_COURSE_SLUG = "prompt-to-profit-holiday"
const IMMEDIATE_ACCESS_COURSE_SLUGS = new Set(["ai-for-everyday-business-owners"])
const HOLIDAY_GROUP_DISCOUNT_MIN_SEATS = 10
const HOLIDAY_GROUP_DISCOUNT_UNIT_MINOR_NGN = 900_000

function now() {
  return new Date()
}

function toInt(value: unknown, fallback = 0) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? Math.round(numberValue) : fallback
}

export function normalizeEmail(value: unknown) {
  const email = String(value || "").trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ""
}

export function normalizeCourse(value: unknown) {
  const slug = String(value || "").trim().toLowerCase()
  if (slug === "prompt-to-profit-advanced") return "prompt-to-production"
  return slug
}

export function isNigeriaCountry(value: unknown) {
  const country = String(value || "").trim().toLowerCase()
  return country === "ng" || country === "nga" || country === "nigeria"
}

export function providerForCountry(country: unknown, requested?: unknown): CheckoutProvider {
  return isNigeriaCountry(country) ? "paystack" : "stripe"
}

export function manualTransferAllowedForCountry(country: unknown) {
  return isNigeriaCountry(country)
}

export function stripeCurrencyForCountry(country: unknown) {
  const text = String(country || "").trim().toLowerCase()
  if (["gb", "gbr", "uk", "united kingdom", "england", "scotland", "wales"].includes(text)) return "GBP"
  if (["ie", "ireland", "fr", "france", "de", "germany", "es", "spain", "it", "italy"].includes(text)) return "EUR"
  return "USD"
}

export function formatMinorAmount(minor: number, currency: string) {
  const locale = currency === "NGN" ? "en-NG" : currency === "GBP" ? "en-GB" : currency === "EUR" ? "en-IE" : "en-US"
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "NGN" ? 0 : 2
  }).format(minor / 100)
}

function normalizeBatchKey(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64)
}

function normalizeBuyerType(value: unknown): "student" | "family" {
  return String(value || "").trim().toLowerCase() === "family" ? "family" : "student"
}

export function familyEnrollmentEnabledForCourse(courseSlug: string) {
  const slug = normalizeCourse(courseSlug)
  const disabled = String(process.env.FAMILY_ENROLLMENT_DISABLED_COURSES || "")
    .split(",")
    .map((item) => normalizeCourse(item))
    .filter(Boolean)
  return !disabled.includes(slug)
}

export function normalizeSeatCount(input: { buyerType?: unknown; seatCount?: unknown; courseSlug?: string }) {
  const buyerType = normalizeBuyerType(input.buyerType)
  if (buyerType !== "family") return 1
  if (!familyEnrollmentEnabledForCourse(input.courseSlug || "")) return 1
  const count = Math.round(Number(input.seatCount || 2))
  return Math.max(2, Math.min(500, Number.isFinite(count) ? count : 2))
}

function groupEnrollmentUnitPriceMinor(courseSlug: string, standardUnitMinor: number, seatCount: number, currency: string) {
  const slug = normalizeCourse(courseSlug)
  const seats = Math.max(1, Math.round(Number(seatCount || 1)))
  const standard = Math.max(0, Math.round(Number(standardUnitMinor || 0)))
  if (slug === HOLIDAY_COURSE_SLUG && currency === "NGN" && seats >= HOLIDAY_GROUP_DISCOUNT_MIN_SEATS) {
    return HOLIDAY_GROUP_DISCOUNT_UNIT_MINOR_NGN
  }
  return standard
}

function groupPricingForSeats(courseSlug: string, standardUnitMinor: number, seatCount: number, currency: string) {
  const seats = Math.max(1, Math.round(Number(seatCount || 1)))
  const standardUnitAmountMinor = Math.max(0, Math.round(Number(standardUnitMinor || 0)))
  const groupUnitAmountMinor = groupEnrollmentUnitPriceMinor(courseSlug, standardUnitAmountMinor, seats, currency)
  const amountMinor = groupUnitAmountMinor * seats
  const groupDiscountMinor = Math.max(0, (standardUnitAmountMinor - groupUnitAmountMinor) * seats)
  return {
    amountMinor,
    groupDiscountMinor,
    groupUnitAmountMinor,
    standardUnitAmountMinor
  }
}

export function siteBaseUrl() {
  const configured = process.env.SITE_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  return configured.replace(/\/$/, "")
}

async function findLearningCourse(courseSlug: string) {
  try {
    const rows = await prisma.$queryRaw<LearningCourseRow[]>`
      SELECT course_slug AS slug, course_title AS name, price_ngn_minor, price_gbp_minor, price_usd_minor, price_eur_minor, is_enrollment_locked, payment_methods, enrollment_mode
      FROM tochukwu_learning_courses
      WHERE course_slug = ${courseSlug}
        AND NOT EXISTS (
          SELECT 1
          FROM tochukwu_learning_modules lm
          WHERE lm.module_slug COLLATE utf8mb4_unicode_ci = tochukwu_learning_courses.course_slug COLLATE utf8mb4_unicode_ci
             OR lm.module_title COLLATE utf8mb4_unicode_ci = tochukwu_learning_courses.course_title COLLATE utf8mb4_unicode_ci
        )
        AND tochukwu_learning_courses.course_slug NOT REGEXP ${dayLevelCourseSlugRegex}
        AND (
          tochukwu_learning_courses.course_slug IN (${configuredLearningCourseSlugSql()})
          OR EXISTS (
            SELECT 1
            FROM course_batches cb
            WHERE cb.course_slug COLLATE utf8mb4_unicode_ci = tochukwu_learning_courses.course_slug COLLATE utf8mb4_unicode_ci
          )
        )
      LIMIT 1
    `
    return rows[0] || null
  } catch (_error) {
    return null
  }
}

export async function listCheckoutBatches(courseSlugInput: string): Promise<CheckoutBatch[]> {
  const courseSlug = normalizeCourse(courseSlugInput)
  if (IMMEDIATE_ACCESS_COURSE_SLUGS.has(courseSlug)) return []
  const rows = await prisma.$queryRaw<CourseBatchRow[]>`
    SELECT course_slug, batch_key, batch_label, status, is_active, brevo_list_id, seat_limit, batch_start_at
    FROM course_batches
    WHERE course_slug = ${courseSlug}
      AND (is_active = 1 OR (${courseSlug} = ${HOLIDAY_COURSE_SLUG} AND status = 'open'))
    ORDER BY is_active DESC, batch_start_at IS NULL ASC, batch_start_at ASC, created_at DESC
  `

  const batches: CheckoutBatch[] = []
  for (const row of rows) {
    const key = normalizeBatchKey(row.batch_key)
    const enrolledCount = await countEnrolledSeats(courseSlug, key)
    const seatLimit = row.seat_limit === null || row.seat_limit === undefined ? null : Math.max(0, toInt(row.seat_limit))
    batches.push({
      courseSlug,
      batchKey: key,
      batchLabel: String(row.batch_label || key),
      status: String(row.status || "open"),
      isActive: Boolean(Number(row.is_active || 0)),
      brevoListId: row.brevo_list_id ? String(row.brevo_list_id) : null,
      seatLimit,
      enrolledCount,
      remainingSeats: seatLimit === null ? null : Math.max(0, seatLimit - enrolledCount),
      batchStartAt: row.batch_start_at ? new Date(row.batch_start_at).toISOString() : null
    })
  }
  return batches
}

export async function resolveCheckoutBatch(courseSlugInput: string, batchKeyInput?: unknown) {
  const courseSlug = normalizeCourse(courseSlugInput)
  const requestedKey = normalizeBatchKey(batchKeyInput)
  const batches = await listCheckoutBatches(courseSlug)
  if (!batches.length) return null
  if (requestedKey) {
    const selected = batches.find((batch) => batch.batchKey === requestedKey)
    if (selected) return selected
    throw new Error("Selected batch is unavailable. Please choose another batch.")
  }
  return batches[0]
}

async function countEnrolledSeats(courseSlug: string, batchKey: string) {
  if (!batchKey) return 0
  const rows = await prisma.$queryRaw<Array<{ enrolled_count: number | bigint | null }>>`
    SELECT (
      COALESCE((
        SELECT SUM(CASE WHEN seat_count IS NULL OR seat_count < 1 THEN 1 ELSE seat_count END)
        FROM course_orders
        WHERE course_slug = ${courseSlug}
          AND batch_key = ${batchKey}
          AND status = 'paid'
      ), 0)
      +
      COALESCE((
        SELECT SUM(CASE WHEN seat_count IS NULL OR seat_count < 1 THEN 1 ELSE seat_count END)
        FROM course_manual_payments
        WHERE course_slug = ${courseSlug}
          AND batch_key = ${batchKey}
          AND status = 'approved'
      ), 0)
    ) AS enrolled_count
  `
  return toInt(rows[0]?.enrolled_count)
}

export async function assertBatchCapacity(batch: CheckoutBatch | null, seatCount: number) {
  if (!batch) return
  if (batch.remainingSeats !== null && seatCount > batch.remainingSeats) {
    throw new Error(`Only ${batch.remainingSeats} seats are left in this batch.`)
  }
}

async function adminCoursePriceMinor(courseSlug: string, currency: string) {
  const slug = normalizeCourse(courseSlug)
  const key =
    slug === "prompt-to-production"
      ? currency === "NGN"
        ? "PROMPT_TO_PRODUCTION_PRICE_NGN_MINOR"
        : currency === "GBP"
          ? "PROMPT_TO_PRODUCTION_PRICE_GBP"
          : ""
      : slug === HOLIDAY_COURSE_SLUG || slug === "prompt-to-profit"
        ? currency === "NGN"
          ? "PROMPT_TO_PROFIT_PRICE_NGN_MINOR"
          : currency === "GBP"
            ? "PROMPT_TO_PROFIT_PRICE_GBP"
            : ""
        : ""
  if (!key) return 0
  const raw = Number(await getAdminSettingValue(key))
  if (!Number.isFinite(raw) || raw <= 0) return 0
  return key.endsWith("_GBP") ? Math.round(raw * 100) : Math.round(raw)
}

async function vatPercent(provider: CheckoutProvider) {
  const raw = Number(await getAdminSettingValue(provider === "stripe" ? "INTL_VAT_PERCENT" : "SITE_VAT_PERCENT"))
  return Number.isFinite(raw) && raw >= 0 ? raw : provider === "stripe" ? 20 : 7.5
}

async function stripeFixedFeeMinor(currency: string) {
  const raw = Number(await getAdminSettingValue(`STRIPE_FEE_FIXED_${currency}_MINOR`))
  if (Number.isFinite(raw) && raw >= 0) return Math.round(raw)
  if (currency === "GBP") return 20
  if (currency === "EUR") return 25
  return 30
}

async function grossUpStripeAmount(netMinor: number, currency: string) {
  const bpsRaw = Number(await getAdminSettingValue("STRIPE_FEE_BPS"))
  const bps = Number.isFinite(bpsRaw) && bpsRaw >= 0 ? Math.round(bpsRaw) : 150
  const fixed = await stripeFixedFeeMinor(currency)
  if (bps >= 10000) return netMinor + fixed
  return Math.ceil((netMinor + fixed) / (1 - bps / 10000) + 1)
}

function grossUpPaystackAmount(netMinor: number) {
  const safeNet = Math.max(0, Math.round(Number(netMinor || 0)))
  const feeAtNet = Math.round(safeNet * 0.015) + (safeNet < 250_000 ? 0 : 10_000)
  if (feeAtNet > 200_000) return safeNet + 200_000
  return Math.ceil((safeNet + (safeNet < 250_000 ? 0 : 10_000)) / (1 - 0.015) + 1)
}

async function composePricingBreakdown(input: {
  provider: CheckoutProvider
  currency: string
  courseMinor: number
  taxPercent: number
  discountMinor?: number
  installment?: boolean
  manualTransfer?: boolean
}) {
  const courseAmountMinor = Math.max(0, Math.round(input.courseMinor))
  const vatAmountMinor = input.provider === "paystack" && input.installment
    ? 0
    : Math.round((courseAmountMinor * input.taxPercent) / 100)
  const subtotalAmountMinor = courseAmountMinor + vatAmountMinor
  const discountMinor = Math.min(subtotalAmountMinor, Math.max(0, Math.round(Number(input.discountMinor || 0))))
  const discountedSubtotalMinor = Math.max(0, subtotalAmountMinor - discountMinor)
  const finalAmountMinor = input.installment || input.manualTransfer
    ? discountedSubtotalMinor
    : input.provider === "stripe"
      ? await grossUpStripeAmount(discountedSubtotalMinor, input.currency)
      : grossUpPaystackAmount(discountedSubtotalMinor)
  const processingFeeMinor = input.installment || input.manualTransfer
    ? 0
    : Math.max(0, finalAmountMinor - discountedSubtotalMinor)

  return {
    baseAmountMinor: subtotalAmountMinor,
    courseAmountMinor,
    vatPercent: input.provider === "paystack" && input.installment ? 0 : input.taxPercent,
    vatAmountMinor,
    subtotalAmountMinor,
    processingFeeMinor,
    discountMinor,
    finalAmountMinor
  }
}

export async function basePricing(input: { courseSlug: string; country?: string; provider?: CheckoutProvider; seatCount?: number; installment?: boolean; manualTransfer?: boolean }) {
  const courseSlug = normalizeCourse(input.courseSlug)
  const provider = input.provider || providerForCountry(input.country)
  const learningCourse = await findLearningCourse(courseSlug)

  if (learningCourse && Number(learningCourse.is_enrollment_locked || 0) === 1) {
    throw new Error("Enrollment is currently locked for this course.")
  }

  const currency = provider === "paystack" ? "NGN" : stripeCurrencyForCountry(input.country)
  const configuredMinor =
    currency === "NGN"
      ? toInt(learningCourse?.price_ngn_minor)
      : currency === "GBP"
        ? toInt(learningCourse?.price_gbp_minor)
        : currency === "EUR"
          ? toInt(learningCourse?.price_eur_minor)
          : toInt(learningCourse?.price_usd_minor)
  const adminMinor = await adminCoursePriceMinor(courseSlug, currency)
  const seatCount = Math.max(1, Number(input.seatCount || 1))
  const unitMinor = configuredMinor > 0 ? configuredMinor : adminMinor
  if (unitMinor <= 0) {
    throw new Error(`Missing ${currency} price for ${courseSlug}. Configure it in the course settings or admin pricing settings.`)
  }
  const groupPricing = groupPricingForSeats(courseSlug, unitMinor, seatCount, currency)
  const courseMinor = groupPricing.amountMinor
  const installmentSurchargeRaw = Number(await getAdminSettingValue("INSTALLMENT_SURCHARGE_PERCENT"))
  const installmentSurcharge = input.installment && Number.isFinite(installmentSurchargeRaw) ? Math.max(0, installmentSurchargeRaw) : 0
  const installmentCourseMinor = Math.round(courseMinor * (1 + installmentSurcharge / 100))
  const taxPercent = await vatPercent(provider)
  const breakdown = await composePricingBreakdown({
    provider,
    currency,
    courseMinor: installmentCourseMinor,
    taxPercent,
    installment: input.installment,
    manualTransfer: input.manualTransfer
  })

  return {
    courseSlug,
    courseName: learningCourse?.name || getCourse(courseSlug)?.title || courseSlug,
    currency,
    ...breakdown,
    groupDiscountMinor: groupPricing.groupDiscountMinor,
    groupUnitAmountMinor: groupPricing.groupUnitAmountMinor,
    standardUnitAmountMinor: groupPricing.standardUnitAmountMinor,
    learningCourse
  }
}

export function normalizeCouponCode(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 40)
}

function resolveDiscountMinor(coupon: CouponRow, currency: string, baseAmountMinor: number) {
  const discountType = String(coupon.discount_type || "").toLowerCase()
  if (discountType === "percent") {
    const pct = Number(coupon.percent_off || 0)
    if (!Number.isFinite(pct) || pct <= 0) return 0
    return Math.round((baseAmountMinor * Math.min(100, pct)) / 100)
  }
  const fixed = currency === "NGN" ? toInt(coupon.fixed_ngn_minor) : toInt(coupon.fixed_gbp_minor)
  return Math.min(baseAmountMinor, Math.max(0, fixed))
}

export async function evaluateCoupon(input: {
  couponCode: string
  courseSlug: string
  email?: string
  currency: string
  baseAmountMinor: number
}) {
  const code = normalizeCouponCode(input.couponCode)
  const email = normalizeEmail(input.email)
  if (!code) throw new Error("Enter a valid coupon code.")

  const rows = await prisma.$queryRaw<CouponRow[]>`
    SELECT id, code, description, discount_type, percent_off, fixed_ngn_minor, fixed_gbp_minor, course_slug,
           starts_at, ends_at, is_active, max_uses, max_uses_per_email
    FROM course_coupons
    WHERE code = ${code}
    LIMIT 1
  `
  const coupon = rows[0]
  if (!coupon) throw new Error("Coupon not found.")
  if (!Number(coupon.is_active || 0)) throw new Error("This coupon is not active.")

  const now = Date.now()
  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) throw new Error("This coupon is not active yet.")
  if (coupon.ends_at && new Date(coupon.ends_at).getTime() < now) throw new Error("This coupon has expired.")

  const scopedCourse = String(coupon.course_slug || "").trim().toLowerCase()
  if (scopedCourse && scopedCourse !== input.courseSlug) throw new Error("This coupon is not valid for this course.")

  const usage = await prisma.$queryRaw<Array<{ total_uses: bigint; email_uses: bigint }>>`
    SELECT
      (SELECT COUNT(*) FROM coupon_redemptions WHERE coupon_id = ${coupon.id}) AS total_uses,
      (SELECT COUNT(*) FROM coupon_redemptions WHERE coupon_id = ${coupon.id} AND email = ${email || "__missing_email__"}) AS email_uses
  `
  const totalUses = Number(usage[0]?.total_uses || 0)
  const emailUses = Number(usage[0]?.email_uses || 0)
  const maxUses = toInt(coupon.max_uses)
  const maxUsesPerEmail = toInt(coupon.max_uses_per_email)
  if (maxUses > 0 && totalUses >= maxUses) throw new Error("This coupon has reached its usage limit.")
  if (maxUsesPerEmail > 0 && email && emailUses >= maxUsesPerEmail) throw new Error("You have reached the usage limit for this coupon.")

  const discountMinor = resolveDiscountMinor(coupon, input.currency, input.baseAmountMinor)
  if (!discountMinor) throw new Error(`This coupon cannot be used for ${input.currency} checkout.`)
  const finalAmountMinor = Math.max(0, input.baseAmountMinor - discountMinor)
  if (finalAmountMinor <= 0) throw new Error("Coupon discount is too high for this checkout amount.")

  return {
    coupon: {
      id: Number(coupon.id),
      code: coupon.code,
      description: coupon.description || ""
    },
    pricing: {
      currency: input.currency,
      baseAmountMinor: input.baseAmountMinor,
      discountMinor,
      finalAmountMinor,
      couponCode: coupon.code,
      couponId: Number(coupon.id)
    } satisfies CheckoutPricing
  }
}

export async function pricingWithCoupon(input: { courseSlug: string; country?: string; provider?: CheckoutProvider; email?: string; couponCode?: string }) {
  const base = await basePricing(input)
  let pricing: CheckoutPricing = {
    ...base,
    currency: base.currency,
    baseAmountMinor: base.baseAmountMinor,
    discountMinor: 0,
    finalAmountMinor: base.finalAmountMinor,
    groupDiscountMinor: base.groupDiscountMinor,
    groupUnitAmountMinor: base.groupUnitAmountMinor,
    standardUnitAmountMinor: base.standardUnitAmountMinor,
    couponCode: null,
    couponId: null
  }
  let coupon: Awaited<ReturnType<typeof evaluateCoupon>>["coupon"] | null = null

  if (input.couponCode) {
    const evaluated = await evaluateCoupon({
      couponCode: input.couponCode,
      courseSlug: base.courseSlug,
      email: input.email,
      currency: base.currency,
      baseAmountMinor: base.baseAmountMinor
    })
    const recomposed = await composePricingBreakdown({
      provider: input.provider || providerForCountry(input.country),
      currency: base.currency,
      courseMinor: Number(base.courseAmountMinor || 0),
      taxPercent: Number(base.vatPercent || 0),
      discountMinor: evaluated.pricing.discountMinor
    })
    pricing = {
      ...base,
      ...recomposed,
      couponCode: evaluated.pricing.couponCode,
      couponId: evaluated.pricing.couponId,
      groupDiscountMinor: base.groupDiscountMinor,
      groupUnitAmountMinor: base.groupUnitAmountMinor,
      standardUnitAmountMinor: base.standardUnitAmountMinor
    }
    coupon = evaluated.coupon
  }

  return { ...base, pricing, coupon }
}

export async function checkoutContext(input: {
  courseSlug: string
  country?: string
  provider?: CheckoutProvider
  email?: string
  couponCode?: string
  buyerType?: unknown
  seatCount?: unknown
  batchKey?: unknown
  installment?: boolean
  manualTransfer?: boolean
}) {
  const courseSlug = normalizeCourse(input.courseSlug)
  const buyerType = normalizeBuyerType(input.buyerType)
  const seatCount = normalizeSeatCount({ buyerType, seatCount: input.seatCount, courseSlug })
  const provider = input.provider || providerForCountry(input.country)
  const batch = await resolveCheckoutBatch(courseSlug, input.batchKey)
  await assertBatchCapacity(batch, seatCount)
  const result = await pricingWithCoupon({
    courseSlug,
    country: input.country,
    provider,
    email: input.email,
    couponCode: input.couponCode
  })
  if (seatCount > 1 || input.installment || input.manualTransfer) {
    const base = await basePricing({ courseSlug, country: input.country, provider, seatCount, installment: input.installment, manualTransfer: input.manualTransfer })
    let pricing: CheckoutPricing = {
      ...base,
      currency: base.currency,
      baseAmountMinor: base.baseAmountMinor,
      discountMinor: 0,
      finalAmountMinor: base.finalAmountMinor,
      groupDiscountMinor: base.groupDiscountMinor,
      groupUnitAmountMinor: base.groupUnitAmountMinor,
      standardUnitAmountMinor: base.standardUnitAmountMinor,
      couponCode: null,
      couponId: null
    }
    let coupon: Awaited<ReturnType<typeof evaluateCoupon>>["coupon"] | null = null
    if (input.couponCode) {
      const evaluated = await evaluateCoupon({
        couponCode: input.couponCode,
        courseSlug,
        email: input.email,
        currency: base.currency,
        baseAmountMinor: base.baseAmountMinor
      })
      const recomposed = await composePricingBreakdown({
        provider,
        currency: base.currency,
        courseMinor: Number(base.courseAmountMinor || 0),
        taxPercent: Number(base.vatPercent || 0),
        discountMinor: evaluated.pricing.discountMinor,
        installment: input.installment,
        manualTransfer: input.manualTransfer
      })
      pricing = {
        ...base,
        ...recomposed,
        couponCode: evaluated.pricing.couponCode,
        couponId: evaluated.pricing.couponId,
        groupDiscountMinor: base.groupDiscountMinor,
        groupUnitAmountMinor: base.groupUnitAmountMinor,
        standardUnitAmountMinor: base.standardUnitAmountMinor
      }
      coupon = evaluated.coupon
    }
    return { ...base, pricing, coupon, batch, buyerType, seatCount }
  }
  return { ...result, batch, buyerType, seatCount }
}

export async function createCourseOrder(input: {
  courseSlug: string
  firstName: string
  email: string
  phone?: string
  country?: string
  provider: CheckoutProvider
  pricing: CheckoutPricing
  batch?: CheckoutBatch | null
  buyerType?: "student" | "family"
  seatCount?: number
  fbp?: string
  fbc?: string
  fbclid?: string
}) {
  const orderUuid = randomUUID()
  const now = new Date()

  await addColumnIfMissing("course_orders", "fbp", "VARCHAR(190) NULL")
  await addColumnIfMissing("course_orders", "fbc", "VARCHAR(190) NULL")
  await addColumnIfMissing("course_orders", "fbclid", "TEXT NULL")

  await prisma.$executeRaw`
    INSERT INTO course_orders
      (order_uuid, course_slug, first_name, email, phone, country, currency, amount_minor, base_amount_minor,
       discount_minor, final_amount_minor, coupon_code, coupon_id, provider, buyer_type, seat_count, status, batch_key, batch_label,
       fbp, fbc, fbclid, created_at, updated_at)
    VALUES
      (${orderUuid}, ${input.courseSlug}, ${input.firstName}, ${input.email}, ${input.phone || null}, ${input.country || null},
       ${input.pricing.currency}, ${input.pricing.finalAmountMinor}, ${input.pricing.baseAmountMinor}, ${input.pricing.discountMinor},
       ${input.pricing.finalAmountMinor}, ${input.pricing.couponCode || null}, ${input.pricing.couponId || null}, ${input.provider},
       ${input.buyerType || "student"}, ${input.seatCount || 1}, 'pending', ${input.batch?.batchKey || null}, ${input.batch?.batchLabel || null},
       ${String(input.fbp || "").trim().slice(0, 190) || null}, ${String(input.fbc || "").trim().slice(0, 190) || null},
       ${String(input.fbclid || "").trim().slice(0, 2000) || null}, ${now}, ${now})
  `

  return orderUuid
}

export async function updateCourseOrderProvider(orderUuid: string, providerReference: string, providerOrderId?: string | null) {
  await prisma.$executeRaw`
    UPDATE course_orders
    SET provider_reference = ${providerReference}, provider_order_id = ${providerOrderId || null}, updated_at = ${new Date()}
    WHERE order_uuid = ${orderUuid}
  `
}

export async function recordCouponRedemption(input: {
  couponId?: number | null
  orderUuid: string
  email: string
  currency: string
  discountMinor: number
}) {
  if (!input.couponId || input.discountMinor <= 0) return
  try {
    await prisma.$executeRaw`
      INSERT INTO coupon_redemptions (coupon_id, order_uuid, email, currency, discount_minor, created_at)
      VALUES (${input.couponId}, ${input.orderUuid}, ${input.email}, ${input.currency}, ${input.discountMinor}, ${new Date()})
      ON DUPLICATE KEY UPDATE discount_minor = VALUES(discount_minor)
    `
  } catch (_error) {
    // Coupon tables may not exist in older DB snapshots; payment state should still be recorded.
  }
}

export async function markCourseOrderPaid(input: {
  orderUuid: string
  providerReference?: string | null
  providerOrderId?: string | null
}) {
  const paidAt = new Date()
  try {
    await prisma.$executeRaw`
      UPDATE course_orders
      SET status = 'paid',
          paid_at = ${paidAt},
          provider_reference = COALESCE(${input.providerReference || null}, provider_reference),
          provider_order_id = COALESCE(${input.providerOrderId || null}, provider_order_id),
          updated_at = ${paidAt}
      WHERE order_uuid = ${input.orderUuid}
    `
  } catch (_error) {
    await prisma.$executeRaw`
      UPDATE course_orders
      SET status = 'paid', updated_at = ${paidAt}
      WHERE order_uuid = ${input.orderUuid}
    `
  }

  const rows = await prisma.$queryRaw<
    Array<{
      order_uuid: string
      course_slug: string | null
      first_name: string | null
      email: string | null
      phone: string | null
      currency: string | null
      discount_minor: number | bigint | null
      coupon_id: number | bigint | null
      buyer_type: string | null
      seat_count: number | bigint | null
      batch_key: string | null
      batch_label: string | null
    }>
  >`
    SELECT order_uuid, course_slug, first_name, email, phone, currency, discount_minor, coupon_id, buyer_type, seat_count, batch_key, batch_label
    FROM course_orders
    WHERE order_uuid = ${input.orderUuid}
    LIMIT 1
  `
  const order = rows[0]
  if (order) {
    await recordCouponRedemption({
      couponId: order.coupon_id ? Number(order.coupon_id) : null,
      orderUuid: input.orderUuid,
      email: String(order.email || ""),
      currency: String(order.currency || ""),
      discountMinor: Number(order.discount_minor || 0)
    })
  }
  return order
}

export async function createManualPayment(input: {
  courseSlug: string
  firstName: string
  email: string
  phone?: string
  country?: string
  pricing: CheckoutPricing
  transferReference?: string
  proofUrl: string
  proofPublicId?: string | null
  batch?: CheckoutBatch | null
  buyerType?: "student" | "family"
  seatCount?: number
}) {
  const paymentUuid = `mp_${randomUUID().replace(/-/g, "")}`
  const now = new Date()

  await prisma.$executeRaw`
    INSERT INTO course_manual_payments
      (payment_uuid, course_slug, batch_key, batch_label, first_name, email, phone, country, currency, amount_minor,
       base_amount_minor, discount_minor, final_amount_minor, coupon_code, coupon_id, transfer_reference, proof_url,
       proof_public_id, buyer_type, seat_count, status, created_at, updated_at)
    VALUES
      (${paymentUuid}, ${input.courseSlug}, ${input.batch?.batchKey || null}, ${input.batch?.batchLabel || null}, ${input.firstName}, ${input.email}, ${input.phone || null}, ${input.country || null},
       ${input.pricing.currency}, ${input.pricing.finalAmountMinor}, ${input.pricing.baseAmountMinor}, ${input.pricing.discountMinor},
       ${input.pricing.finalAmountMinor}, ${input.pricing.couponCode || null}, ${input.pricing.couponId || null},
       ${input.transferReference || null}, ${input.proofUrl}, ${input.proofPublicId || null}, ${input.buyerType || "student"}, ${input.seatCount || 1}, 'pending_verification', ${now}, ${now})
  `

  return paymentUuid
}

export async function upsertWhatsAppContact(input: {
  email: string
  fullName: string
  phone: string
  courseSlug: string
  source: string
  optedIn: boolean
}) {
  if (!input.optedIn || !input.phone) return
  const phone = String(input.phone || "").trim().replace(/[^\d+]/g, "")
  const phoneE164 = phone.startsWith("+") ? phone : phone.startsWith("0") ? `+234${phone.slice(1)}` : phone ? `+${phone}` : ""
  if (!phoneE164) return
  const timestamp = now()
  await prisma.$executeRaw`
    INSERT INTO tochukwu_whatsapp_contacts
      (email, full_name, phone_e164, course_slug, source, whatsapp_opted_in, whatsapp_opted_in_at, whatsapp_opted_out_at, opt_in_version, created_at, updated_at)
    VALUES
      (${input.email}, ${input.fullName}, ${phoneE164}, ${input.courseSlug}, ${input.source}, 1, ${timestamp}, NULL, 'enrollment_whatsapp_v1', ${timestamp}, ${timestamp})
    ON DUPLICATE KEY UPDATE
      full_name = VALUES(full_name),
      course_slug = VALUES(course_slug),
      source = VALUES(source),
      whatsapp_opted_in = 1,
      whatsapp_opted_in_at = VALUES(whatsapp_opted_in_at),
      whatsapp_opted_out_at = NULL,
      updated_at = VALUES(updated_at)
  `.catch(() => null)
}

export async function recordAffiliateAttribution(input: {
  sourceUuid: string
  courseSlug: string
  affiliateCode?: string
  buyerEmail: string
  buyerCountry?: string
  buyerCurrency: string
  orderAmountMinor: number
}) {
  const affiliateCode = String(input.affiliateCode || "").trim().toUpperCase().slice(0, 40)
  if (!affiliateCode) return
  const timestamp = now()
  const buyerEmail = normalizeEmail(input.buyerEmail)
  const rows = await prisma.$queryRaw<Array<{
    profileId: bigint | null
    affiliateCode: string | null
    affiliateEmail: string | null
    profileStatus: string | null
    eligibilityStatus: string | null
    isAffiliateEligible: number | bigint | boolean | null
  }>>`
    SELECT p.id AS profileId,
           p.affiliate_code AS affiliateCode,
           a.email AS affiliateEmail,
           p.status AS profileStatus,
           p.eligibility_status AS eligibilityStatus,
           r.is_affiliate_eligible AS isAffiliateEligible
    FROM tochukwu_affiliate_profiles p
    LEFT JOIN student_accounts a ON a.id = p.account_id
    LEFT JOIN tochukwu_affiliate_course_rules r
      ON r.course_slug COLLATE utf8mb4_unicode_ci = ${input.courseSlug} COLLATE utf8mb4_unicode_ci
     AND r.is_affiliate_eligible = 1
     AND (r.starts_at IS NULL OR r.starts_at <= NOW())
     AND (r.ends_at IS NULL OR r.ends_at >= NOW())
    WHERE p.affiliate_code COLLATE utf8mb4_unicode_ci = ${affiliateCode} COLLATE utf8mb4_unicode_ci
    LIMIT 1
  `.catch(() => [])
  const profile = rows[0]
  let status = "rejected"
  let rejectionReason = "Invalid affiliate code"
  let affiliateProfileId: bigint | null = null
  let resolvedCode: string | null = null
  if (profile?.profileId) {
    affiliateProfileId = profile.profileId
    resolvedCode = String(profile.affiliateCode || affiliateCode).trim().slice(0, 40)
    if (String(profile.profileStatus || "").trim() !== "active") {
      rejectionReason = "Affiliate profile is not active"
    } else if (String(profile.eligibilityStatus || "").trim() !== "eligible") {
      rejectionReason = "Affiliate profile is not eligible"
    } else if (!Boolean(Number(profile.isAffiliateEligible || 0))) {
      rejectionReason = "Course not affiliate-eligible"
    } else if (normalizeEmail(profile.affiliateEmail) && normalizeEmail(profile.affiliateEmail) === buyerEmail) {
      rejectionReason = "Self-referrals are not eligible"
    } else {
      status = "accepted"
      rejectionReason = ""
    }
  }
  await prisma.$executeRaw`
    INSERT INTO tochukwu_affiliate_attributions
      (attribution_uuid, order_uuid, course_slug, affiliate_profile_id, affiliate_code, buyer_email, buyer_country, buyer_currency, order_amount_minor, attribution_status, rejection_reason, risk_score, risk_flags_json, created_at, updated_at)
    VALUES
      (${`aa_${randomUUID().replace(/-/g, "")}`}, ${input.sourceUuid}, ${input.courseSlug}, ${affiliateProfileId}, ${resolvedCode || affiliateCode}, ${buyerEmail},
       ${input.buyerCountry || null}, ${input.buyerCurrency}, ${input.orderAmountMinor}, ${status}, ${rejectionReason || null}, 0, '[]', ${timestamp}, ${timestamp})
    ON DUPLICATE KEY UPDATE
      affiliate_profile_id = VALUES(affiliate_profile_id),
      affiliate_code = VALUES(affiliate_code),
      attribution_status = VALUES(attribution_status),
      rejection_reason = VALUES(rejection_reason),
      updated_at = VALUES(updated_at)
  `.catch(() => null)
}

export async function createAffiliateCommissionForOrder(orderUuid: string) {
  const uuid = String(orderUuid || "").trim()
  if (!uuid || String(process.env.AFFILIATE_ENABLED || "1").trim() === "0") return

  try {
    const existing = await prisma.$queryRaw<Array<{ id: bigint }>>`
      SELECT id
      FROM tochukwu_affiliate_commissions
      WHERE order_uuid = ${uuid}
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
        riskScore: number | bigint | null
        riskFlagsJson: string | null
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
             a.risk_score AS riskScore,
             a.risk_flags_json AS riskFlagsJson,
             r.commission_type AS commissionType,
             r.commission_value AS commissionValue,
             r.commission_currency AS commissionCurrency,
             r.hold_days AS holdDays
      FROM tochukwu_affiliate_attributions a
      JOIN tochukwu_affiliate_profiles p ON p.id = a.affiliate_profile_id
      JOIN tochukwu_affiliate_course_rules r
        ON r.course_slug COLLATE utf8mb4_unicode_ci = a.course_slug COLLATE utf8mb4_unicode_ci
      WHERE a.order_uuid = ${uuid}
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

    const orderAmountMinor = Math.max(0, toInt(row.orderAmountMinor))
    const commissionType = String(row.commissionType || "percentage").trim().toLowerCase().slice(0, 20) || "percentage"
    const commissionValue = Math.max(0, toInt(row.commissionValue))
    const commissionAmountMinor =
      commissionType === "fixed" ? commissionValue : Math.floor((orderAmountMinor * Math.min(commissionValue, 10000)) / 10000)
    if (commissionAmountMinor <= 0) return

    const holdDays = Math.max(0, Math.min(120, toInt(row.holdDays, Number(process.env.AFFILIATE_DEFAULT_HOLD_DAYS || 30))))
    const timestamp = now()
    const payableAt = new Date(Date.now() + holdDays * 24 * 60 * 60 * 1000)
    await prisma.$executeRaw`
      INSERT INTO tochukwu_affiliate_commissions
        (commission_uuid, attribution_id, order_uuid, course_slug, affiliate_profile_id, affiliate_code,
         buyer_email, currency, order_amount_minor, commission_type, commission_rate_or_value,
         commission_amount_minor, status, risk_score, risk_flags_json, payable_at, created_at, updated_at)
      VALUES
        (${`acm_${randomUUID().replace(/-/g, "")}`}, ${row.attributionId}, ${uuid}, ${String(row.courseSlug || "").trim().slice(0, 120)},
         ${row.affiliateProfileId}, ${String(row.affiliateCode || "").trim().slice(0, 40)}, ${normalizeEmail(row.buyerEmail)},
         ${String(row.commissionCurrency || row.buyerCurrency || "NGN").trim().toUpperCase().slice(0, 10)}, ${orderAmountMinor},
         ${commissionType}, ${commissionValue}, ${commissionAmountMinor}, 'pending',
         ${toInt(row.riskScore)}, ${row.riskFlagsJson || "[]"}, ${payableAt}, ${timestamp}, ${timestamp})
      ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at)
    `
  } catch (_error) {
    return
  }
}

function randomPasswordHash() {
  const salt = crypto.randomBytes(16).toString("hex")
  const password = crypto.randomBytes(18).toString("base64url")
  const hash = crypto.scryptSync(password, salt, 64).toString("hex")
  return { salt, hash }
}

export async function findOrCreateStudentAccount(input: { fullName: string; email: string; phone?: string }) {
  const email = normalizeEmail(input.email)
  if (!email) throw new Error("Valid email is required.")
  const existing = await prisma.studentAccount.findUnique({ where: { email } })
  if (existing) return existing
  const password = randomPasswordHash()
  const timestamp = now()
  return prisma.studentAccount.create({
    data: {
      accountUuid: `sa_${randomUUID().replace(/-/g, "")}`,
      fullName: input.fullName,
      email,
      passwordHash: password.hash,
      passwordSalt: password.salt,
      mustResetPassword: true,
      phoneE164: input.phone || null,
      createdAt: timestamp,
      updatedAt: timestamp
    }
  })
}

export async function createInstallmentPlan(input: {
  accountId: bigint | number
  courseSlug: string
  country?: string
  provider: CheckoutProvider
  pricing: CheckoutPricing
  batch: CheckoutBatch
  buyerType?: "student" | "family"
  seatCount?: number
}) {
  const planUuid = `ip_${randomUUID().replace(/-/g, "")}`
  const timestamp = now()
  await prisma.$executeRaw`
    INSERT INTO student_installment_plans
      (plan_uuid, account_id, course_slug, batch_key, batch_label, country, provider, currency, target_amount_minor, base_amount_minor,
       discount_minor, coupon_code, coupon_id, buyer_type, seat_count, total_paid_minor, status, created_at, updated_at)
    VALUES
      (${planUuid}, ${input.accountId}, ${input.courseSlug}, ${input.batch.batchKey}, ${input.batch.batchLabel}, ${input.country || null}, ${input.provider},
       ${input.pricing.currency}, ${input.pricing.finalAmountMinor}, ${input.pricing.baseAmountMinor}, ${input.pricing.discountMinor},
       ${input.pricing.couponCode || null}, ${input.pricing.couponId || null}, ${input.buyerType || "student"}, ${input.seatCount || 1},
       0, 'open', ${timestamp}, ${timestamp})
  `
  return planUuid
}

export async function createInstallmentPayment(input: {
  planUuid: string
  amountMinor: number
  provider: CheckoutProvider
  providerReference?: string | null
  providerOrderId?: string | null
  currency: string
}) {
  const paymentUuid = `iw_${randomUUID().replace(/-/g, "")}`
  const plans = await prisma.$queryRaw<Array<{ id: bigint; target_amount_minor: number | bigint; total_paid_minor: number | bigint; status: string | null }>>`
    SELECT id, target_amount_minor, total_paid_minor, status
    FROM student_installment_plans
    WHERE plan_uuid = ${input.planUuid}
    LIMIT 1
  `
  const plan = plans[0]
  if (!plan) throw new Error("Installment plan not found.")
  if (String(plan.status || "").toLowerCase() !== "open") throw new Error("Installment plan is not open.")
  const remaining = Math.max(0, Number(plan.target_amount_minor || 0) - Number(plan.total_paid_minor || 0))
  const amountMinor = Math.min(Math.max(100, Math.round(input.amountMinor)), remaining || Math.round(input.amountMinor))
  const timestamp = now()
  await prisma.$executeRaw`
    INSERT INTO student_installment_payments
      (payment_uuid, plan_id, provider, provider_reference, provider_order_id, currency, amount_minor, status, paid_at, created_at, updated_at)
    VALUES
      (${paymentUuid}, ${plan.id}, ${input.provider}, ${input.providerReference || null}, ${input.providerOrderId || null},
       ${input.currency}, ${amountMinor}, 'pending', NULL, ${timestamp}, ${timestamp})
  `
  return { paymentUuid, amountMinor }
}

export async function markInstallmentPaymentPaid(reference: string, providerOrderId?: string | null) {
  const rows = await prisma.$queryRaw<Array<{ id: bigint; plan_id: bigint; amount_minor: number | bigint; status: string | null }>>`
    SELECT id, plan_id, amount_minor, status
    FROM student_installment_payments
    WHERE provider_reference = ${reference}
    ORDER BY id DESC
    LIMIT 1
  `
  const payment = rows[0]
  if (!payment) throw new Error("Installment payment not found.")
  if (String(payment.status || "").toLowerCase() !== "paid") {
    const timestamp = now()
    await prisma.$executeRaw`
      UPDATE student_installment_payments
      SET status = 'paid', provider_order_id = COALESCE(${providerOrderId || null}, provider_order_id), paid_at = ${timestamp}, updated_at = ${timestamp}
      WHERE id = ${payment.id}
    `
    await prisma.$executeRaw`
      UPDATE student_installment_plans
      SET total_paid_minor = total_paid_minor + ${Number(payment.amount_minor || 0)}, updated_at = ${timestamp}
      WHERE id = ${payment.plan_id}
    `
  }
  await autoEnrollInstallmentPlanIfEligible(Number(payment.plan_id)).catch(() => null)
  return payment.plan_id
}

export async function autoEnrollInstallmentPlanIfEligible(planIdInput: number | bigint) {
  const planId = Number(planIdInput || 0)
  if (!Number.isFinite(planId) || planId <= 0) return null
  const rows = await prisma.$queryRaw<Array<{
    id: bigint
    plan_uuid: string
    account_id: bigint
    course_slug: string
    batch_key: string | null
    batch_label: string | null
    country: string | null
    provider: string | null
    currency: string | null
    target_amount_minor: number | bigint
    total_paid_minor: number | bigint
    base_amount_minor: number | bigint | null
    discount_minor: number | bigint | null
    coupon_code: string | null
    coupon_id: number | bigint | null
    buyer_type: string | null
    seat_count: number | bigint | null
    family_account_id: number | bigint | null
    status: string | null
    enrolled_order_uuid: string | null
    full_name: string | null
    email: string | null
    phone_e164: string | null
  }>>`
    SELECT pl.id, pl.plan_uuid, pl.account_id, pl.course_slug, pl.batch_key, pl.batch_label, pl.country, pl.provider,
           pl.currency, pl.target_amount_minor, pl.total_paid_minor, pl.base_amount_minor, pl.discount_minor,
           pl.coupon_code, pl.coupon_id, pl.buyer_type, pl.seat_count, pl.family_account_id, pl.status,
           pl.enrolled_order_uuid, a.full_name, a.email, a.phone_e164
    FROM student_installment_plans pl
    JOIN student_accounts a ON a.id = pl.account_id
    WHERE pl.id = ${planId}
    LIMIT 1
  `
  const plan = rows[0]
  if (!plan) return null
  if (String(plan.status || "").toLowerCase() === "enrolled") return { enrolled: true, orderUuid: plan.enrolled_order_uuid || null }
  const targetAmountMinor = Number(plan.target_amount_minor || 0)
  const totalPaidMinor = Number(plan.total_paid_minor || 0)
  if (targetAmountMinor <= 0 || totalPaidMinor < targetAmountMinor) return { enrolled: false }

  const orderUuid = randomUUID()
  const timestamp = now()
  const buyerType = String(plan.buyer_type || "student").toLowerCase() === "family" ? "family" : "student"
  const seatCount = buyerType === "family" ? Math.max(2, Number(plan.seat_count || 2)) : 1
  let familyAccountId = Number(plan.family_account_id || 0) || null

  if (buyerType === "family") {
    const { provisionFamilyOrder } = await import("@/lib/family-enrollment")
    const credited = await provisionFamilyOrder({
      sourceType: "course_order",
      sourceUuid: orderUuid,
      parentAccountId: plan.account_id,
      parentName: String(plan.full_name || "Parent"),
      parentEmail: String(plan.email || ""),
      parentPhone: String(plan.phone_e164 || ""),
      courseSlug: String(plan.course_slug || ""),
      batchKey: String(plan.batch_key || ""),
      batchLabel: String(plan.batch_label || ""),
      quantity: seatCount
    })
    if (!credited.ok) throw new Error(credited.error || "Could not credit group seats.")
    familyAccountId = Number(credited.familyId || familyAccountId || 0) || null
  }

  await addColumnIfMissing("course_orders", "family_account_id", "BIGINT NULL")
  await prisma.$executeRaw`
    INSERT INTO course_orders
      (order_uuid, course_slug, first_name, email, phone, country, currency, amount_minor, base_amount_minor,
       discount_minor, final_amount_minor, coupon_code, coupon_id, provider, buyer_type, seat_count, family_account_id,
       status, batch_key, batch_label, paid_at, created_at, updated_at)
    VALUES
      (${orderUuid}, ${plan.course_slug}, ${plan.full_name || "Student"}, ${plan.email}, ${plan.phone_e164 || null},
       ${plan.country || null}, ${plan.currency || "NGN"}, ${targetAmountMinor}, ${Number(plan.base_amount_minor || targetAmountMinor)},
       ${Number(plan.discount_minor || 0)}, ${targetAmountMinor}, ${plan.coupon_code || null}, ${plan.coupon_id ? Number(plan.coupon_id) : null},
       'wallet', ${buyerType}, ${seatCount}, ${familyAccountId}, 'paid', ${plan.batch_key || null}, ${plan.batch_label || null},
       ${timestamp}, ${timestamp}, ${timestamp})
  `
  await prisma.$executeRaw`
    UPDATE student_installment_plans
    SET status = 'enrolled', enrolled_order_uuid = ${orderUuid}, family_account_id = COALESCE(${familyAccountId}, family_account_id), updated_at = ${timestamp}
    WHERE id = ${planId}
  `
  return { enrolled: true, orderUuid }
}

export function courseReferencePrefix(courseSlug: string) {
  const slug = normalizeCourse(courseSlug)
  return courseReferencePrefixes[slug] || slug.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase() || "COURSE"
}

export async function initializePaystack(input: {
  email: string
  amountMinor: number
  reference: string
  metadata: Record<string, unknown>
  callbackUrl?: string
}) {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) throw new Error("Missing PAYSTACK_SECRET_KEY")
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      email: input.email,
      amount: input.amountMinor,
      reference: input.reference,
      callback_url: input.callbackUrl || `${siteBaseUrl()}/api/payments/paystack/return`,
      metadata: input.metadata
    })
  })
  const json = await response.json().catch(() => null)
  if (!response.ok || !json?.status || !json?.data?.authorization_url) {
    throw new Error(json?.message || `Paystack initialize failed (${response.status})`)
  }
  return {
    checkoutUrl: String(json.data.authorization_url),
    providerReference: String(json.data.reference || input.reference),
    providerOrderId: json.data.access_code ? String(json.data.access_code) : null
  }
}

export async function initializeStripe(input: {
  email: string
  amountMinor: number
  currency: string
  courseName: string
  orderUuid: string
  courseSlug: string
  successUrl?: string
  cancelUrl?: string
  metadata?: Record<string, string>
}) {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) throw new Error("Missing STRIPE_SECRET_KEY")
  const params = new URLSearchParams()
  params.set("mode", "payment")
  params.set("customer_email", input.email)
  params.set("success_url", input.successUrl || `${siteBaseUrl()}/api/payments/stripe/return?session_id={CHECKOUT_SESSION_ID}`)
  params.set("cancel_url", input.cancelUrl || `${siteBaseUrl()}/checkout/${input.courseSlug}?payment=cancelled&order=${input.orderUuid}`)
  params.set("line_items[0][quantity]", "1")
  params.set("line_items[0][price_data][currency]", input.currency.toLowerCase())
  params.set("line_items[0][price_data][unit_amount]", String(input.amountMinor))
  params.set("line_items[0][price_data][product_data][name]", input.courseName)
  params.set("client_reference_id", input.orderUuid)
  params.set("metadata[order_uuid]", input.orderUuid)
  params.set("metadata[course_slug]", input.courseSlug)
  params.set("payment_intent_data[metadata][order_uuid]", input.orderUuid)
  params.set("payment_intent_data[metadata][course_slug]", input.courseSlug)
  for (const [key, value] of Object.entries(input.metadata || {})) {
    params.set(`metadata[${key}]`, value)
    params.set(`payment_intent_data[metadata][${key}]`, value)
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  })
  const json = await response.json().catch(() => null)
  if (!response.ok || !json?.id || !json?.url) {
    throw new Error(json?.error?.message || `Stripe Checkout failed (${response.status})`)
  }
  return {
    checkoutUrl: String(json.url),
    providerReference: String(json.id),
    providerOrderId: null
  }
}

export async function verifyPaystackTransaction(reference: string) {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) throw new Error("Missing PAYSTACK_SECRET_KEY")
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secret}`,
      Accept: "application/json"
    }
  })
  const json = await response.json().catch(() => null)
  if (!response.ok || !json?.status || !json?.data) {
    throw new Error(json?.message || `Paystack verify failed (${response.status})`)
  }
  if (String(json.data.status || "").toLowerCase() !== "success") {
    throw new Error("Paystack payment was not successful.")
  }
  return {
    reference: String(json.data.reference || reference),
    providerOrderId: json.data.id ? String(json.data.id) : null,
    metadata: json.data.metadata || {}
  }
}

export async function retrieveStripeSession(sessionId: string) {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) throw new Error("Missing STRIPE_SECRET_KEY")
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secret}`
    }
  })
  const json = await response.json().catch(() => null)
  if (!response.ok || !json?.id) {
    throw new Error(json?.error?.message || `Stripe session lookup failed (${response.status})`)
  }
  if (String(json.payment_status || "").toLowerCase() !== "paid") {
    throw new Error("Stripe payment has not been marked paid.")
  }
  return {
    id: String(json.id),
    orderUuid: String(json.client_reference_id || json.metadata?.order_uuid || ""),
    courseSlug: String(json.metadata?.course_slug || ""),
    paymentIntentId: json.payment_intent ? String(json.payment_intent) : null,
    metadata: json.metadata || {}
  }
}
