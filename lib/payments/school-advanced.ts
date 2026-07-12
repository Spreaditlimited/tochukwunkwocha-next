import crypto from "crypto"
import { Prisma } from "@prisma/client"

import { initializePaystack, initializeStripe, isNigeriaCountry, retrieveStripeSession, siteBaseUrl, stripeCurrencyForCountry, verifyPaystackTransaction } from "@/lib/payments/course-checkout"
import { prisma } from "@/lib/prisma"
import { addColumnIfMissing } from "@/lib/schema-guards"

const DEFAULT_ADVANCED_MIN_SEATS = 5
const DEFAULT_ADVANCED_PRICE_NGN_MINOR = 25_000_000
const DEFAULT_ADVANCED_DISCOUNT_NGN_MINOR = 5_000_000
const DEFAULT_ADVANCED_DISCOUNT_GBP_MINOR = 2_000
const DEFAULT_ADVANCED_DISCOUNT_USD_MINOR = 2_000
const DEFAULT_ADVANCED_DISCOUNT_EUR_MINOR = 2_000

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function toInt(value: unknown, fallback = 0) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? Math.trunc(numberValue) : fallback
}

function vatBps(provider: "paystack" | "stripe") {
  const raw = Number(provider === "stripe" ? process.env.INTL_VAT_PERCENT : process.env.SITE_VAT_PERCENT)
  const percent = Number.isFinite(raw) && raw >= 0 ? raw : provider === "stripe" ? 20 : 7.5
  return Math.round(percent * 100)
}

function stripeFixedFeeMinor(currency: string) {
  const cur = currency.toUpperCase()
  const raw = Number(process.env[`STRIPE_FEE_FIXED_${cur}_MINOR`])
  if (Number.isFinite(raw) && raw >= 0) return Math.round(raw)
  if (cur === "GBP") return 20
  if (cur === "EUR") return 25
  return 30
}

function grossUpStripeAmount(netMinor: number, currency: string) {
  const net = Math.max(0, Math.round(netMinor))
  const bpsRaw = Number(process.env.STRIPE_FEE_BPS)
  const bps = Number.isFinite(bpsRaw) && bpsRaw >= 0 ? Math.round(bpsRaw) : 150
  const fixed = stripeFixedFeeMinor(currency)
  if (bps >= 10000) return net + fixed
  return Math.ceil((net + fixed) / (1 - bps / 10000) + 1)
}

async function ensureSchoolPaymentTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS school_orders (
      id BIGINT NOT NULL AUTO_INCREMENT,
      order_uuid VARCHAR(64) NOT NULL,
      school_id BIGINT NULL,
      school_name VARCHAR(220) NOT NULL,
      admin_name VARCHAR(180) NOT NULL,
      admin_email VARCHAR(220) NOT NULL,
      admin_phone VARCHAR(80) NULL,
      country VARCHAR(80) NULL,
      course_slug VARCHAR(120) NOT NULL,
      seats_requested INT NOT NULL,
      currency VARCHAR(12) NOT NULL,
      seat_course_slug VARCHAR(120) NULL,
      order_kind VARCHAR(50) NOT NULL DEFAULT 'school_enrollment',
      price_per_student_minor INT NOT NULL DEFAULT 0,
      vat_bps INT NOT NULL DEFAULT 0,
      subtotal_minor INT NOT NULL DEFAULT 0,
      vat_minor INT NOT NULL DEFAULT 0,
      processing_fee_minor INT NOT NULL DEFAULT 0,
      total_minor INT NOT NULL DEFAULT 0,
      provider VARCHAR(40) NOT NULL DEFAULT 'paystack',
      provider_reference VARCHAR(190) NULL,
      provider_order_id VARCHAR(190) NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'pending',
      paid_at DATETIME NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_school_order_uuid (order_uuid),
      KEY idx_school_order_admin (admin_email, status),
      KEY idx_school_order_provider_ref (provider_reference),
      KEY idx_school_order_school (school_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await addColumnIfMissing("school_orders", "seat_course_slug", "VARCHAR(120) NULL")
  await addColumnIfMissing("school_orders", "order_kind", "VARCHAR(50) NOT NULL DEFAULT 'school_enrollment'")
  await addColumnIfMissing("school_orders", "processing_fee_minor", "INT NOT NULL DEFAULT 0")
  await addColumnIfMissing("school_orders", "provider_reference", "VARCHAR(190) NULL")
  await addColumnIfMissing("school_orders", "provider_order_id", "VARCHAR(190) NULL")
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS school_course_seat_balances (
      id BIGINT NOT NULL AUTO_INCREMENT,
      school_id BIGINT NOT NULL,
      course_slug VARCHAR(120) NOT NULL,
      seats_purchased INT NOT NULL DEFAULT 0,
      seats_consumed INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_school_course_seat_balance (school_id, course_slug),
      KEY idx_school_course_seat_balance_school (school_id, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS school_seat_ledger (
      id BIGINT NOT NULL AUTO_INCREMENT,
      school_id BIGINT NOT NULL,
      course_slug VARCHAR(120) NOT NULL,
      entry_type VARCHAR(40) NOT NULL,
      quantity INT NOT NULL,
      source_order_uuid VARCHAR(64) NULL,
      idempotency_key VARCHAR(140) NULL,
      metadata_json LONGTEXT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_school_seat_ledger_idempotency (school_id, course_slug, entry_type, idempotency_key),
      KEY idx_school_seat_ledger_school (school_id, course_slug, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

async function resolveSchoolCountry(schoolId: number) {
  const rows = await prisma.$queryRaw<Array<{ country: string | null }>>`
    SELECT country
    FROM school_orders
    WHERE school_id = ${schoolId}
      AND country IS NOT NULL
      AND country <> ''
    ORDER BY paid_at DESC, id DESC
    LIMIT 1
  `.catch(() => [])
  return clean(rows[0]?.country, 80) || "Nigeria"
}

async function advancedCoursePricing() {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT price_ngn_minor, price_gbp_minor, price_usd_minor, price_eur_minor
    FROM tochukwu_learning_courses
    WHERE course_slug = 'prompt-to-production'
    LIMIT 1
  `).catch(() => [])
  const schoolsRows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT school_advanced_discount_ngn_minor, school_advanced_discount_gbp_minor, school_advanced_discount_usd_minor, school_advanced_discount_eur_minor
    FROM tochukwu_learning_courses
    WHERE course_slug IN ('prompt-to-profit-schools', 'prompt-to-profit')
    ORDER BY FIELD(course_slug, 'prompt-to-profit-schools', 'prompt-to-profit')
    LIMIT 1
  `).catch(() => [])
  const course = rows[0] || {}
  const discounts = schoolsRows[0] || {}
  return {
    ngn: toInt(course.price_ngn_minor, DEFAULT_ADVANCED_PRICE_NGN_MINOR),
    gbp: toInt(course.price_gbp_minor, 10_000),
    usd: toInt(course.price_usd_minor, 15_000),
    eur: toInt(course.price_eur_minor, 10_000),
    discountNgn: toInt(discounts.school_advanced_discount_ngn_minor, DEFAULT_ADVANCED_DISCOUNT_NGN_MINOR),
    discountGbp: toInt(discounts.school_advanced_discount_gbp_minor, DEFAULT_ADVANCED_DISCOUNT_GBP_MINOR),
    discountUsd: toInt(discounts.school_advanced_discount_usd_minor, DEFAULT_ADVANCED_DISCOUNT_USD_MINOR),
    discountEur: toInt(discounts.school_advanced_discount_eur_minor, DEFAULT_ADVANCED_DISCOUNT_EUR_MINOR)
  }
}

export async function quoteSchoolAdvancedSeats(input: { seatCount: unknown; country?: unknown }) {
  const seats = Math.max(0, toInt(input.seatCount, 0))
  const seatMinimum = Math.max(1, toInt(process.env.SCHOOLS_ADVANCED_MIN_SEATS, DEFAULT_ADVANCED_MIN_SEATS))
  const country = clean(input.country, 80) || "Nigeria"
  const provider = isNigeriaCountry(country) ? "paystack" : "stripe"
  const pricing = await advancedCoursePricing()
  const currency = provider === "paystack" ? "NGN" : stripeCurrencyForCountry(country)
  const base = currency === "GBP" ? pricing.gbp : currency === "EUR" ? pricing.eur : currency === "USD" ? pricing.usd : pricing.ngn
  const discount = currency === "GBP" ? pricing.discountGbp : currency === "EUR" ? pricing.discountEur : currency === "USD" ? pricing.discountUsd : pricing.discountNgn
  const pricePerSeatMinor = Math.max(0, base - discount)
  const subtotalMinor = seats * pricePerSeatMinor
  const vat = Math.round((subtotalMinor * vatBps(provider)) / 10000)
  const beforeFees = subtotalMinor + vat
  const totalMinor = provider === "stripe" ? grossUpStripeAmount(beforeFees, currency) : beforeFees
  return {
    provider,
    currency,
    seats,
    seatMinimum,
    basePricePerSeatMinor: base,
    discountPerSeatMinor: discount,
    pricePerSeatMinor,
    vatBps: vatBps(provider),
    subtotalMinor,
    vatMinor: vat,
    processingFeeMinor: Math.max(0, totalMinor - beforeFees),
    totalMinor
  }
}

export async function createSchoolAdvancedSeatCheckout(input: {
  schoolId: number
  schoolName: string
  adminName: string
  adminEmail: string
  courseSlug: string
  seatCount: unknown
}) {
  await ensureSchoolPaymentTables()
  const country = await resolveSchoolCountry(input.schoolId)
  const quote = await quoteSchoolAdvancedSeats({ seatCount: input.seatCount, country })
  if (quote.seats < quote.seatMinimum) throw new Error(`Minimum advanced seats is ${quote.seatMinimum}.`)
  const orderUuid = `sord_${crypto.randomUUID().replace(/-/g, "")}`
  const now = new Date()
  await prisma.$executeRaw`
    INSERT INTO school_orders
      (order_uuid, school_id, school_name, admin_name, admin_email, admin_phone, country, course_slug, seats_requested, currency,
       seat_course_slug, order_kind, price_per_student_minor, vat_bps, subtotal_minor, vat_minor, processing_fee_minor, total_minor,
       provider, status, created_at, updated_at)
    VALUES
      (${orderUuid}, ${input.schoolId}, ${input.schoolName}, ${input.adminName}, ${input.adminEmail.toLowerCase()}, NULL, ${country}, ${input.courseSlug || "prompt-to-profit"},
       ${quote.seats}, ${quote.currency}, 'prompt-to-production', 'advanced_seat_purchase', ${quote.pricePerSeatMinor}, ${quote.vatBps},
       ${quote.subtotalMinor}, ${quote.vatMinor}, ${quote.processingFeeMinor}, ${quote.totalMinor}, ${quote.provider}, 'pending', ${now}, ${now})
  `
  const reference = `SCHADV_${orderUuid.replace(/[^a-z0-9]/gi, "").slice(0, 22).toUpperCase()}`
  const metadata = {
    school_order_uuid: orderUuid,
    school_id: String(input.schoolId),
    order_kind: "advanced_seat_purchase",
    seat_course_slug: "prompt-to-production",
    seat_count: String(quote.seats)
  }
  const payment = quote.provider === "stripe"
    ? await initializeStripe({
        email: input.adminEmail.toLowerCase(),
        amountMinor: quote.totalMinor,
        currency: quote.currency,
        courseName: "Prompt to Profit Advanced School Seats",
        orderUuid,
        courseSlug: "prompt-to-production",
        metadata,
        successUrl: `${siteBaseUrl()}/api/schools/advanced/stripe/return?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${siteBaseUrl()}/schools/dashboard?advanced_payment=cancelled`
      })
    : await initializePaystack({
        email: input.adminEmail.toLowerCase(),
        amountMinor: quote.totalMinor,
        reference,
        callbackUrl: `${siteBaseUrl()}/api/schools/advanced/paystack/return`,
        metadata
      })

  await prisma.$executeRaw`
    UPDATE school_orders
    SET provider_reference = ${payment.providerReference || reference},
        provider_order_id = ${payment.providerOrderId || null},
        updated_at = ${new Date()}
    WHERE order_uuid = ${orderUuid}
    LIMIT 1
  `
  return { orderUuid, checkoutUrl: payment.checkoutUrl, provider: quote.provider, quote }
}

export async function markSchoolAdvancedOrderPaid(input: {
  provider: "paystack" | "stripe"
  providerReference?: string
  providerOrderId?: string | null
  orderUuid?: string
}) {
  await ensureSchoolPaymentTables()
  const providerReference = clean(input.providerReference, 190)
  const providerOrderId = clean(input.providerOrderId, 190)
  const orderUuid = clean(input.orderUuid, 80)
  if (!providerReference && !providerOrderId && !orderUuid) throw new Error("Missing order identifier.")

  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      SELECT id, order_uuid, school_id, seat_course_slug, order_kind, seats_requested, status
      FROM school_orders
      WHERE ${Prisma.join(
        [
          orderUuid ? Prisma.sql`order_uuid = ${orderUuid}` : null,
          providerReference ? Prisma.sql`provider_reference = ${providerReference}` : null,
          providerOrderId ? Prisma.sql`provider_order_id = ${providerOrderId}` : null
        ].filter(Boolean) as Prisma.Sql[],
        " OR "
      )}
      ORDER BY id DESC
      LIMIT 1
      FOR UPDATE
    `)
    const order = rows[0]
    if (!order) throw new Error("School order not found.")
    const alreadyPaid = clean(order.status, 40) === "paid"
    const schoolId = Number(order.school_id || 0)
    if (!schoolId) throw new Error("Advanced order is not linked to a school account.")
    const seatCourseSlug = clean(order.seat_course_slug, 120) || "prompt-to-production"
    const quantity = Number(order.seats_requested || 0)
    const now = new Date()

    if (!alreadyPaid) {
      await tx.$executeRaw`
        UPDATE school_orders
        SET status = 'paid',
            provider = ${input.provider},
            provider_reference = COALESCE(${providerReference || null}, provider_reference),
            provider_order_id = COALESCE(${providerOrderId || null}, provider_order_id),
            paid_at = ${now},
            updated_at = ${now}
        WHERE id = ${Number(order.id)}
        LIMIT 1
      `
      const balanceRows = await tx.$queryRaw<Array<{ id: number | bigint; seatsPurchased: number | bigint }>>`
        SELECT id, seats_purchased AS seatsPurchased
        FROM school_course_seat_balances
        WHERE school_id = ${schoolId}
          AND course_slug COLLATE utf8mb4_unicode_ci = ${seatCourseSlug} COLLATE utf8mb4_unicode_ci
        LIMIT 1
        FOR UPDATE
      `
      if (balanceRows[0]) {
        await tx.$executeRaw`
          UPDATE school_course_seat_balances
          SET seats_purchased = ${Number(balanceRows[0].seatsPurchased || 0) + quantity},
              updated_at = ${now}
          WHERE id = ${Number(balanceRows[0].id)}
          LIMIT 1
        `
      } else {
        await tx.$executeRaw`
          INSERT INTO school_course_seat_balances
            (school_id, course_slug, seats_purchased, seats_consumed, created_at, updated_at)
          VALUES
            (${schoolId}, ${seatCourseSlug}, ${quantity}, 0, ${now}, ${now})
        `
      }
      await tx.$executeRaw`
        INSERT INTO school_seat_ledger
          (school_id, course_slug, entry_type, quantity, source_order_uuid, idempotency_key, metadata_json, created_at, updated_at)
        VALUES
          (${schoolId}, ${seatCourseSlug}, 'purchase', ${quantity}, ${clean(order.order_uuid, 64)}, ${clean(order.order_uuid, 64)}, ${JSON.stringify({ order_kind: "advanced_seat_purchase", provider_reference: providerReference || null })}, ${now}, ${now})
        ON DUPLICATE KEY UPDATE id = id
      `
    }
  })
}

export async function confirmPaystackSchoolAdvanced(reference: string) {
  const tx = await verifyPaystackTransaction(reference)
  await markSchoolAdvancedOrderPaid({
    provider: "paystack",
    providerReference: tx.reference,
    providerOrderId: tx.providerOrderId,
    orderUuid: clean((tx.metadata as Record<string, unknown>)?.school_order_uuid, 80)
  })
}

export async function confirmStripeSchoolAdvanced(sessionId: string) {
  const session = await retrieveStripeSession(sessionId)
  await markSchoolAdvancedOrderPaid({
    provider: "stripe",
    providerReference: session.id,
    providerOrderId: session.paymentIntentId,
    orderUuid: session.orderUuid || ""
  })
}
