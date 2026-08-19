import { randomUUID } from "crypto"
import { Prisma } from "@prisma/client"

import { getAdminSettingValues } from "@/lib/admin-settings"
import { ensureCourseRefundTable } from "@/lib/payment-refunds"
import { prisma } from "@/lib/prisma"

export type FinancialFilters = {
  period: string
  from: string
  to: string
  category: string
  currency: string
  provider: string
  product: string
  search: string
  sort: string
  page: number
}

export type FinancialTransaction = {
  transactionUuid: string
  sourceType: string
  category: string
  paymentType: string
  productSlug: string
  productLabel: string
  customerName: string
  customerEmail: string
  currency: string
  salesAmountMinor: number
  discountMinor: number
  vatMinor: number
  processingFeeMinor: number
  shippingMinor: number
  totalCollectedMinor: number
  provider: string
  paymentReference: string
  paidAt: Date
  breakdownQuality: "exact" | "estimated"
}

export type CurrencySummary = {
  currency: string
  salesAmountMinor: number
  courseRevenueMinor: number
  shopRevenueMinor: number
  discountMinor: number
  vatMinor: number
  processingFeeMinor: number
  shippingMinor: number
  totalCollectedMinor: number
  transactionCount: number
}

const PAGE_SIZE = 50

function clean(value: unknown, max = 190) {
  return String(value || "").trim().slice(0, max)
}

function dateText(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date)
}

function startOfPeriod(period: string, now: Date) {
  const lagosNow = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Lagos" }))
  const year = lagosNow.getFullYear()
  const month = lagosNow.getMonth()
  const day = lagosNow.getDate()
  if (period === "today") return new Date(year, month, day)
  if (period === "this_week") {
    const weekday = lagosNow.getDay() || 7
    return new Date(year, month, day - weekday + 1)
  }
  if (period === "last_month") return new Date(year, month - 1, 1)
  if (period === "this_quarter") return new Date(year, Math.floor(month / 3) * 3, 1)
  if (period === "this_year") return new Date(year, 0, 1)
  return new Date(year, month, 1)
}

export function parseFinancialFilters(input: Record<string, string | string[] | undefined>): FinancialFilters {
  const value = (key: string) => clean(Array.isArray(input[key]) ? input[key]?.[0] : input[key])
  const allowedPeriods = new Set(["today", "this_week", "this_month", "last_month", "this_quarter", "this_year", "custom", "all"])
  const allowedSorts = new Set(["newest", "oldest", "amount_high", "amount_low", "product"])
  const period = allowedPeriods.has(value("period")) ? value("period") : "this_month"
  let from = /^\d{4}-\d{2}-\d{2}$/.test(value("from")) ? value("from") : ""
  let to = /^\d{4}-\d{2}-\d{2}$/.test(value("to")) ? value("to") : ""
  const today = new Date()

  if (period === "all") {
    // Preset date inputs remain populated in the browser when an admin switches
    // to All time. All time must always win over those stale submitted values.
    from = ""
    to = ""
  } else if (period !== "custom") {
    const start = startOfPeriod(period, today)
    from = dateText(start)
    if (period === "last_month") to = dateText(new Date(start.getFullYear(), start.getMonth() + 1, 0))
    else to = dateText(today)
  }

  return {
    period,
    from,
    to,
    category: ["course", "shop"].includes(value("category")) ? value("category") : "",
    currency: value("currency").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 12),
    provider: value("provider").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40),
    product: value("product").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 190),
    search: value("search").slice(0, 120),
    sort: allowedSorts.has(value("sort")) ? value("sort") : "newest",
    page: Math.max(1, Math.min(100000, Number.parseInt(value("page") || "1", 10) || 1))
  }
}

function titleFromSlug(value: string | null | undefined) {
  return clean(value || "Course", 190)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function validVat(value: unknown, fallback: number) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : fallback
}

async function financialVatRates() {
  const settings = await getAdminSettingValues(["SITE_VAT_PERCENT", "INTL_VAT_PERCENT"])
  return {
    ngVat: validVat(settings.SITE_VAT_PERCENT, 7.5),
    internationalVat: validVat(settings.INTL_VAT_PERCENT, 20)
  }
}

export async function recordManualPaymentFinancialTransaction(paymentUuidInput: string) {
  const paymentUuid = clean(paymentUuidInput, 64)
  if (!paymentUuid) return 0
  const { ngVat, internationalVat } = await financialVatRates()

  return prisma.$executeRaw(Prisma.sql`
    INSERT IGNORE INTO tochukwu_financial_transactions
      (transaction_uuid, source_type, source_uuid, category, payment_type, product_slug, product_label,
       customer_name, customer_email, currency, sales_amount_minor, discount_minor, vat_minor,
       processing_fee_minor, shipping_minor, total_collected_minor, provider, payment_reference,
       paid_at, source_created_at, breakdown_quality, created_at, updated_at)
    SELECT
      CONCAT('fin_course_manual_', m.payment_uuid), 'course_manual', m.payment_uuid,
      'course', 'Manual Transfer', m.course_slug, COALESCE(NULLIF(m.course_slug, ''), 'Course'),
      m.first_name, m.email, UPPER(COALESCE(m.currency, 'NGN')),
      COALESCE(m.course_amount_minor,
        ROUND(COALESCE(m.base_amount_minor, m.amount_minor, 0) /
          (1 + (CASE WHEN UPPER(COALESCE(m.currency, 'NGN')) = 'NGN' THEN ${ngVat} ELSE ${internationalVat} END / 100)))),
      COALESCE(m.discount_minor, 0),
      COALESCE(m.vat_amount_minor,
        COALESCE(m.base_amount_minor, m.amount_minor, 0) -
        ROUND(COALESCE(m.base_amount_minor, m.amount_minor, 0) /
          (1 + (CASE WHEN UPPER(COALESCE(m.currency, 'NGN')) = 'NGN' THEN ${ngVat} ELSE ${internationalVat} END / 100)))),
      COALESCE(m.processing_fee_minor, 0), 0,
      COALESCE(m.final_amount_minor, m.amount_minor, 0), 'bank_transfer', m.transfer_reference,
      COALESCE(m.updated_at, m.created_at), m.created_at,
      CASE WHEN m.course_amount_minor IS NULL OR m.vat_amount_minor IS NULL OR m.processing_fee_minor IS NULL
        THEN 'estimated' ELSE 'exact' END,
      NOW(), NOW()
    FROM course_manual_payments m
    WHERE BINARY m.payment_uuid = BINARY ${paymentUuid}
      AND m.status IN ('approved', 'refunded')
      AND COALESCE(m.updated_at, m.created_at) IS NOT NULL
    LIMIT 1
  `)
}

export async function reconcileFinancialTransactions() {
  await ensureCourseRefundTable()
  const { ngVat, internationalVat } = await financialVatRates()
  const now = new Date()

  await prisma.$executeRawUnsafe(`
    INSERT IGNORE INTO tochukwu_financial_transactions
      (transaction_uuid, source_type, source_uuid, category, payment_type, product_slug, product_label,
       customer_name, customer_email, currency, sales_amount_minor, discount_minor, vat_minor,
       processing_fee_minor, shipping_minor, total_collected_minor, provider, payment_reference,
       paid_at, source_created_at, breakdown_quality, created_at, updated_at)
    SELECT
      CONCAT('fin_course_online_', COALESCE(o.order_uuid, CAST(o.id AS CHAR))),
      'course_online', COALESCE(o.order_uuid, CAST(o.id AS CHAR)), 'course', 'Online',
      o.course_slug, COALESCE(NULLIF(o.course_slug, ''), 'Course'),
      o.first_name, o.email, UPPER(COALESCE(o.currency, 'NGN')),
      COALESCE(o.course_amount_minor,
        ROUND(COALESCE(o.base_amount_minor, o.amount_minor, 0) /
          (1 + (CASE WHEN UPPER(COALESCE(o.currency, 'NGN')) = 'NGN' THEN ${ngVat} ELSE ${internationalVat} END / 100)))),
      COALESCE(o.discount_minor, 0),
      COALESCE(o.vat_amount_minor,
        COALESCE(o.base_amount_minor, o.amount_minor, 0) -
        ROUND(COALESCE(o.base_amount_minor, o.amount_minor, 0) /
          (1 + (CASE WHEN UPPER(COALESCE(o.currency, 'NGN')) = 'NGN' THEN ${ngVat} ELSE ${internationalVat} END / 100)))),
      COALESCE(o.processing_fee_minor,
        GREATEST(0, COALESCE(o.final_amount_minor, o.amount_minor, 0) -
          GREATEST(0, COALESCE(o.base_amount_minor, o.amount_minor, 0) - COALESCE(o.discount_minor, 0)))),
      0, COALESCE(o.final_amount_minor, o.amount_minor, 0), o.provider,
      COALESCE(o.provider_reference, o.provider_order_id),
      COALESCE(o.paid_at, o.updated_at, o.created_at), o.created_at,
      CASE WHEN o.course_amount_minor IS NULL OR o.vat_amount_minor IS NULL OR o.processing_fee_minor IS NULL
        THEN 'estimated' ELSE 'exact' END,
      NOW(), NOW()
    FROM course_orders o
    WHERE o.status IN ('paid', 'refunded')
      AND COALESCE(o.provider, '') <> 'wallet'
      AND COALESCE(o.paid_at, o.updated_at, o.created_at) IS NOT NULL
  `)

  await prisma.$executeRawUnsafe(`
    INSERT IGNORE INTO tochukwu_financial_transactions
      (transaction_uuid, source_type, source_uuid, category, payment_type, product_slug, product_label,
       customer_name, customer_email, currency, sales_amount_minor, discount_minor, vat_minor,
       processing_fee_minor, shipping_minor, total_collected_minor, provider, payment_reference,
       paid_at, source_created_at, breakdown_quality, created_at, updated_at)
    SELECT
      CONCAT('fin_course_manual_', m.payment_uuid), 'course_manual', m.payment_uuid,
      'course', 'Manual Transfer', m.course_slug, COALESCE(NULLIF(m.course_slug, ''), 'Course'),
      m.first_name, m.email, UPPER(COALESCE(m.currency, 'NGN')),
      COALESCE(m.course_amount_minor,
        ROUND(COALESCE(m.base_amount_minor, m.amount_minor, 0) /
          (1 + (CASE WHEN UPPER(COALESCE(m.currency, 'NGN')) = 'NGN' THEN ${ngVat} ELSE ${internationalVat} END / 100)))),
      COALESCE(m.discount_minor, 0),
      COALESCE(m.vat_amount_minor,
        COALESCE(m.base_amount_minor, m.amount_minor, 0) -
        ROUND(COALESCE(m.base_amount_minor, m.amount_minor, 0) /
          (1 + (CASE WHEN UPPER(COALESCE(m.currency, 'NGN')) = 'NGN' THEN ${ngVat} ELSE ${internationalVat} END / 100)))),
      COALESCE(m.processing_fee_minor, 0), 0,
      COALESCE(m.final_amount_minor, m.amount_minor, 0), 'bank_transfer', m.transfer_reference,
      COALESCE(m.updated_at, m.created_at), m.created_at,
      CASE WHEN m.course_amount_minor IS NULL OR m.vat_amount_minor IS NULL OR m.processing_fee_minor IS NULL
        THEN 'estimated' ELSE 'exact' END,
      NOW(), NOW()
    FROM course_manual_payments m
    WHERE m.status IN ('approved', 'refunded')
      AND COALESCE(m.updated_at, m.created_at) IS NOT NULL
  `)

  await prisma.$executeRawUnsafe(`
    INSERT IGNORE INTO tochukwu_financial_transactions
      (transaction_uuid, source_type, source_uuid, source_parent_uuid, category, payment_type,
       product_slug, product_label, customer_name, customer_email, currency, sales_amount_minor,
       discount_minor, vat_minor, processing_fee_minor, shipping_minor, total_collected_minor,
       provider, payment_reference, paid_at, source_created_at, breakdown_quality, created_at, updated_at)
    SELECT
      CONCAT('fin_course_installment_', ip.payment_uuid), 'course_installment', ip.payment_uuid,
      pl.plan_uuid, 'course', 'Installment', pl.course_slug, COALESCE(NULLIF(pl.course_slug, ''), 'Course'),
      a.full_name, a.email, UPPER(COALESCE(ip.currency, pl.currency, 'NGN')),
      COALESCE(ip.amount_minor, 0), 0, 0, 0, 0, COALESCE(ip.amount_minor, 0),
      ip.provider, COALESCE(ip.provider_reference, ip.provider_order_id),
      COALESCE(ip.paid_at, ip.updated_at, ip.created_at), ip.created_at, 'exact', NOW(), NOW()
    FROM student_installment_payments ip
    JOIN student_installment_plans pl ON pl.id = ip.plan_id
    LEFT JOIN student_accounts a ON a.id = pl.account_id
    WHERE ip.status = 'paid'
      AND COALESCE(ip.paid_at, ip.updated_at, ip.created_at) IS NOT NULL
  `)

  await prisma.$executeRaw`
    INSERT IGNORE INTO tochukwu_financial_transactions
      (transaction_uuid, source_type, source_uuid, category, payment_type, product_slug, product_label,
       customer_name, customer_email, currency, sales_amount_minor, discount_minor, vat_minor,
       processing_fee_minor, shipping_minor, total_collected_minor, provider, payment_reference,
       paid_at, source_created_at, breakdown_quality, metadata_json, created_at, updated_at)
    SELECT
      CONCAT('fin_shop_', o.order_uuid), 'shop', o.order_uuid, 'shop', 'Shop Checkout',
      (SELECT i.product_slug_snapshot FROM tochukwu_shop_order_items i WHERE i.order_id = o.id ORDER BY i.id LIMIT 1),
      COALESCE(
        (SELECT GROUP_CONCAT(DISTINCT i.product_title_snapshot ORDER BY i.id SEPARATOR ', ')
         FROM tochukwu_shop_order_items i WHERE i.order_id = o.id),
        'Shop order'
      ),
      o.customer_name, o.customer_email, UPPER(o.currency), o.subtotal_minor, o.discount_minor,
      o.tax_minor, o.processing_fee_minor, o.shipping_minor, o.total_minor,
      o.payment_provider, COALESCE(o.provider_reference, o.provider_order_id),
      COALESCE(o.paid_at, o.updated_at), o.created_at, 'exact',
      JSON_OBJECT('orderNumber', o.order_number), ${now}, ${now}
    FROM tochukwu_shop_orders o
    WHERE o.payment_status = 'paid' AND COALESCE(o.paid_at, o.updated_at) IS NOT NULL
  `

  await prisma.$executeRaw`
    INSERT IGNORE INTO tochukwu_financial_transactions
      (transaction_uuid, source_type, source_uuid, source_parent_uuid, category, payment_type,
       product_slug, product_label, customer_name, customer_email, currency, sales_amount_minor,
       discount_minor, vat_minor, processing_fee_minor, shipping_minor, total_collected_minor,
       provider, payment_reference, paid_at, source_created_at, breakdown_quality, metadata_json,
       created_at, updated_at)
    SELECT
      CONCAT('fin_course_refund_', r.refund_uuid), 'course_refund', r.refund_uuid, r.payment_uuid,
      'course', 'Refund', r.course_slug, CONCAT(COALESCE(NULLIF(r.course_slug, ''), 'Course'), ' refund'),
      r.customer_name, r.customer_email, UPPER(r.currency), -r.amount_minor,
      0, 0, 0, 0, -r.amount_minor, r.refund_method, r.refund_reference,
      r.refunded_at, r.created_at, 'exact',
      JSON_OBJECT('reason', r.reason, 'recordedBy', r.recorded_by, 'accessRevoked', r.access_revoked),
      ${now}, ${now}
    FROM tochukwu_course_payment_refunds r
  `
}

function filterSql(filters: FinancialFilters) {
  const conditions: Prisma.Sql[] = []
  if (filters.from) conditions.push(Prisma.sql`paid_at >= ${new Date(`${filters.from}T00:00:00+01:00`)}`)
  if (filters.to) {
    const end = new Date(`${filters.to}T00:00:00+01:00`)
    end.setUTCDate(end.getUTCDate() + 1)
    conditions.push(Prisma.sql`paid_at < ${end}`)
  }
  if (filters.category) conditions.push(Prisma.sql`category = ${filters.category}`)
  if (filters.currency) conditions.push(Prisma.sql`currency = ${filters.currency}`)
  if (filters.provider) conditions.push(Prisma.sql`LOWER(COALESCE(provider, '')) = ${filters.provider}`)
  if (filters.product) conditions.push(Prisma.sql`product_slug = ${filters.product}`)
  if (filters.search) {
    const search = `%${filters.search}%`
    conditions.push(Prisma.sql`(
      customer_name LIKE ${search} OR customer_email LIKE ${search} OR
      product_label LIKE ${search} OR payment_reference LIKE ${search}
    )`)
  }
  return conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty
}

const selectSql = Prisma.sql`
  SELECT transaction_uuid AS transactionUuid, source_type AS sourceType, category, payment_type AS paymentType,
    product_slug AS productSlug, product_label AS productLabel, customer_name AS customerName,
    customer_email AS customerEmail, currency, sales_amount_minor AS salesAmountMinor,
    discount_minor AS discountMinor, vat_minor AS vatMinor, processing_fee_minor AS processingFeeMinor,
    shipping_minor AS shippingMinor, total_collected_minor AS totalCollectedMinor, provider,
    payment_reference AS paymentReference, paid_at AS paidAt, breakdown_quality AS breakdownQuality
  FROM tochukwu_financial_transactions
`

function normalizeRow(row: Record<string, unknown>): FinancialTransaction {
  return {
    transactionUuid: clean(row.transactionUuid, 100),
    sourceType: clean(row.sourceType, 40),
    category: clean(row.category, 30),
    paymentType: clean(row.paymentType, 50),
    productSlug: clean(row.productSlug, 190),
    productLabel: titleFromSlug(clean(row.productLabel, 255)),
    customerName: clean(row.customerName, 190),
    customerEmail: clean(row.customerEmail, 220),
    currency: clean(row.currency, 12).toUpperCase(),
    salesAmountMinor: Number(row.salesAmountMinor || 0),
    discountMinor: Number(row.discountMinor || 0),
    vatMinor: Number(row.vatMinor || 0),
    processingFeeMinor: Number(row.processingFeeMinor || 0),
    shippingMinor: Number(row.shippingMinor || 0),
    totalCollectedMinor: Number(row.totalCollectedMinor || 0),
    provider: clean(row.provider, 40),
    paymentReference: clean(row.paymentReference, 190),
    paidAt: new Date(String(row.paidAt)),
    breakdownQuality: row.breakdownQuality === "estimated" ? "estimated" : "exact"
  }
}

export async function listFinancialTransactions(filters: FinancialFilters, allRows = false) {
  const where = filterSql(filters)
  const order =
    filters.sort === "oldest" ? Prisma.sql`paid_at ASC, id ASC` :
    filters.sort === "amount_high" ? Prisma.sql`total_collected_minor DESC, paid_at DESC` :
    filters.sort === "amount_low" ? Prisma.sql`total_collected_minor ASC, paid_at DESC` :
    filters.sort === "product" ? Prisma.sql`product_label ASC, paid_at DESC` :
    Prisma.sql`paid_at DESC, id DESC`
  const limit = allRows ? Prisma.empty : Prisma.sql`LIMIT ${PAGE_SIZE} OFFSET ${(filters.page - 1) * PAGE_SIZE}`

  const [rows, countRows, summaryRows, options] = await Promise.all([
    prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`${selectSql} ${where} ORDER BY ${order} ${limit}`),
    prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`SELECT COUNT(*) AS total FROM tochukwu_financial_transactions ${where}`),
    prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      SELECT currency,
        SUM(sales_amount_minor) AS salesAmountMinor,
        SUM(CASE WHEN category = 'course' THEN total_collected_minor ELSE 0 END) AS courseRevenueMinor,
        SUM(CASE WHEN category = 'shop' THEN total_collected_minor ELSE 0 END) AS shopRevenueMinor,
        SUM(discount_minor) AS discountMinor, SUM(vat_minor) AS vatMinor,
        SUM(processing_fee_minor) AS processingFeeMinor, SUM(shipping_minor) AS shippingMinor,
        SUM(total_collected_minor) AS totalCollectedMinor, COUNT(*) AS transactionCount
      FROM tochukwu_financial_transactions ${where}
      GROUP BY currency ORDER BY currency
    `),
    prisma.$queryRaw<Array<{ currency: string; provider: string; productSlug: string; productLabel: string }>>`
      SELECT DISTINCT currency, COALESCE(provider, '') AS provider, COALESCE(product_slug, '') AS productSlug,
        COALESCE(product_label, '') AS productLabel
      FROM tochukwu_financial_transactions
      ORDER BY currency, provider, productLabel
    `
  ])

  return {
    rows: rows.map(normalizeRow),
    total: Number(countRows[0]?.total || 0),
    pageSize: PAGE_SIZE,
    summary: summaryRows.map((row) => ({
      currency: clean(row.currency, 12),
      salesAmountMinor: Number(row.salesAmountMinor || 0),
      courseRevenueMinor: Number(row.courseRevenueMinor || 0),
      shopRevenueMinor: Number(row.shopRevenueMinor || 0),
      discountMinor: Number(row.discountMinor || 0),
      vatMinor: Number(row.vatMinor || 0),
      processingFeeMinor: Number(row.processingFeeMinor || 0),
      shippingMinor: Number(row.shippingMinor || 0),
      totalCollectedMinor: Number(row.totalCollectedMinor || 0),
      transactionCount: Number(row.transactionCount || 0)
    })) satisfies CurrencySummary[],
    options
  }
}

export function formatFinancialMoney(currency: string, minor: number) {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 2 }).format(minor / 100)
  } catch {
    return `${currency} ${(minor / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`
  }
}

export async function recordFinancialExport(input: {
  adminUuid: string
  format: string
  filters: FinancialFilters
  rowCount: number
}) {
  const exportUuid = `fin_export_${randomUUID().replace(/-/g, "")}`
  await prisma.tochukwuFinancialExportAudit.create({
    data: {
      exportUuid,
      adminUuid: input.adminUuid,
      format: input.format,
      filtersJson: JSON.stringify(input.filters),
      rowCount: input.rowCount,
      createdAt: new Date()
    }
  })
}
