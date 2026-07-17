import { randomUUID } from "crypto"

import { configuredLearningCourseSlugSql, dayLevelCourseSlugRegex } from "@/lib/learning-course-catalog"
import { reportPaymentProviderIssue } from "@/lib/payment-provider-alerts"
import { prisma } from "@/lib/prisma"

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function toInt(value: unknown, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function toMinor(value: unknown) {
  return Math.max(0, toInt(value, 0))
}

function nowSqlDate() {
  return new Date()
}

function parseDateInput(value: unknown) {
  const raw = clean(value, 30)
  if (!raw) return null
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw.replace(" ", "T")
  const date = new Date(normalized)
  return Number.isFinite(date.getTime()) ? date : null
}

function previousMonthPeriod() {
  const d = new Date()
  const year = d.getUTCFullYear()
  const month = d.getUTCMonth()
  return {
    periodStart: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)),
    periodEnd: new Date(Date.UTC(year, month, 0, 23, 59, 59))
  }
}

function defaultHoldDays() {
  return Math.max(0, Math.min(120, toInt(process.env.AFFILIATE_DEFAULT_HOLD_DAYS || 30, 30)))
}

function minPayoutMinor(currency: string) {
  if (currency.toUpperCase() === "USD") return Math.max(0, toInt(process.env.AFFILIATE_MIN_PAYOUT_USD_MINOR || 2500, 2500))
  return Math.max(0, toInt(process.env.AFFILIATE_MIN_PAYOUT_NGN_MINOR || 100000, 100000))
}

function paystackSecretKey() {
  return clean(process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET || process.env.PAYSTACK_SECRET_TEST_KEY, 1000)
}

async function paystackCreateTransfer(input: { amountMinor: number; recipient: string; reason: string; reference: string }) {
  const secret = paystackSecretKey()
  if (!secret) {
    await reportPaymentProviderIssue({ provider: "paystack", operation: "affiliate payout transfer", summary: "PAYSTACK_SECRET_KEY is missing.", reference: input.reference, errorCode: "missing_secret_key" })
    throw new Error("Paystack payout transfer is temporarily unavailable.")
  }
  let response: Response
  try {
    response = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({
        source: "balance",
        amount: input.amountMinor,
        recipient: input.recipient,
        reason: input.reason,
        reference: input.reference
      })
    })
  } catch (error) {
    await reportPaymentProviderIssue({ provider: "paystack", operation: "affiliate payout transfer", summary: "The transfer request to Paystack failed.", reference: input.reference, errorType: "network_error", errorMessage: error instanceof Error ? error.message : String(error) })
    throw new Error("Paystack payout transfer is temporarily unavailable.")
  }
  const json = await response.json().catch(() => null)
  if (!response.ok || json?.status === false) {
    await reportPaymentProviderIssue({ provider: "paystack", operation: "affiliate payout transfer", summary: "Paystack rejected the payout transfer.", reference: input.reference, status: response.status, requestId: response.headers.get("x-request-id") || response.headers.get("request-id"), errorCode: json?.code || null, errorMessage: json?.message || `Paystack transfer failed (${response.status})` })
    throw new Error("Paystack payout transfer is temporarily unavailable.")
  }
  return {
    transferId: clean(json?.data?.id, 190),
    transferCode: clean(json?.data?.transfer_code, 120),
    reference: clean(json?.data?.reference || input.reference, 190)
  }
}

export async function ensureAffiliateAdminTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_affiliate_profiles (
      id BIGINT NOT NULL AUTO_INCREMENT,
      profile_uuid VARCHAR(64) NOT NULL,
      account_id BIGINT NOT NULL,
      affiliate_code VARCHAR(40) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'active',
      eligibility_status VARCHAR(40) NOT NULL DEFAULT 'eligible',
      eligibility_reason VARCHAR(190) NULL,
      country_code VARCHAR(2) NOT NULL DEFAULT 'NG',
      payout_currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
      payout_provider VARCHAR(40) NOT NULL DEFAULT 'paystack',
      risk_level VARCHAR(20) NOT NULL DEFAULT 'normal',
      blocked_at DATETIME NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_affiliate_profile_uuid (profile_uuid),
      UNIQUE KEY uniq_tochukwu_affiliate_profile_account (account_id),
      UNIQUE KEY uniq_tochukwu_affiliate_code (affiliate_code),
      KEY idx_tochukwu_affiliate_profile_status (status, eligibility_status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_affiliate_course_rules (
      id BIGINT NOT NULL AUTO_INCREMENT,
      course_slug VARCHAR(120) NOT NULL,
      is_affiliate_eligible TINYINT(1) NOT NULL DEFAULT 0,
      commission_type VARCHAR(20) NOT NULL DEFAULT 'percentage',
      commission_value INT NOT NULL DEFAULT 0,
      commission_currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
      min_order_amount_minor INT NOT NULL DEFAULT 0,
      hold_days INT NOT NULL DEFAULT 30,
      starts_at DATETIME NULL,
      ends_at DATETIME NULL,
      updated_by VARCHAR(120) NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_aff_course_rule_slug (course_slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_affiliate_commissions (
      id BIGINT NOT NULL AUTO_INCREMENT,
      commission_uuid VARCHAR(64) NOT NULL,
      attribution_id BIGINT NOT NULL,
      order_uuid VARCHAR(64) NOT NULL,
      course_slug VARCHAR(120) NOT NULL,
      affiliate_profile_id BIGINT NOT NULL,
      affiliate_code VARCHAR(40) NOT NULL,
      buyer_email VARCHAR(220) NOT NULL,
      currency VARCHAR(10) NOT NULL,
      order_amount_minor INT NOT NULL DEFAULT 0,
      commission_type VARCHAR(20) NOT NULL,
      commission_rate_or_value INT NOT NULL DEFAULT 0,
      commission_amount_minor INT NOT NULL DEFAULT 0,
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      risk_score INT NOT NULL DEFAULT 0,
      risk_flags_json LONGTEXT NULL,
      payable_at DATETIME NULL,
      paid_at DATETIME NULL,
      reversed_at DATETIME NULL,
      reversal_reason VARCHAR(190) NULL,
      payout_batch_id BIGINT NULL,
      payout_item_id BIGINT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_aff_commission_uuid (commission_uuid),
      UNIQUE KEY uniq_tochukwu_aff_commission_order (order_uuid),
      KEY idx_tochukwu_aff_commission_profile (affiliate_profile_id, status, payable_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_affiliate_payout_accounts (
      id BIGINT NOT NULL AUTO_INCREMENT,
      account_uuid VARCHAR(64) NOT NULL,
      affiliate_profile_id BIGINT NOT NULL,
      country_code VARCHAR(2) NOT NULL,
      currency VARCHAR(10) NOT NULL,
      payout_provider VARCHAR(40) NOT NULL,
      account_name VARCHAR(180) NULL,
      bank_code VARCHAR(40) NULL,
      bank_name VARCHAR(120) NULL,
      account_number_masked VARCHAR(40) NULL,
      account_number_hash VARCHAR(128) NULL,
      paystack_recipient_code VARCHAR(120) NULL,
      payout_email VARCHAR(220) NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'active',
      is_verified TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_aff_payout_account_uuid (account_uuid),
      KEY idx_tochukwu_aff_payout_profile (affiliate_profile_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_affiliate_payout_batches (
      id BIGINT NOT NULL AUTO_INCREMENT,
      batch_uuid VARCHAR(64) NOT NULL,
      country_code VARCHAR(2) NOT NULL,
      currency VARCHAR(10) NOT NULL,
      payout_provider VARCHAR(40) NOT NULL,
      period_start DATETIME NOT NULL,
      period_end DATETIME NOT NULL,
      scheduled_for DATE NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'processing',
      total_items INT NOT NULL DEFAULT 0,
      total_amount_minor BIGINT NOT NULL DEFAULT 0,
      successful_items INT NOT NULL DEFAULT 0,
      failed_items INT NOT NULL DEFAULT 0,
      run_notes VARCHAR(255) NULL,
      initiated_by VARCHAR(120) NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      completed_at DATETIME NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_aff_payout_batch_uuid (batch_uuid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_affiliate_payout_items (
      id BIGINT NOT NULL AUTO_INCREMENT,
      item_uuid VARCHAR(64) NOT NULL,
      payout_batch_id BIGINT NOT NULL,
      commission_id BIGINT NOT NULL,
      affiliate_profile_id BIGINT NOT NULL,
      payout_account_id BIGINT NULL,
      amount_minor INT NOT NULL DEFAULT 0,
      currency VARCHAR(10) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'processing',
      provider_transfer_id VARCHAR(190) NULL,
      provider_transfer_code VARCHAR(120) NULL,
      provider_reference VARCHAR(190) NULL,
      error_message VARCHAR(255) NULL,
      processed_at DATETIME NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_aff_payout_item_uuid (item_uuid),
      UNIQUE KEY uniq_tochukwu_aff_payout_item_commission (commission_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_affiliate_audit (
      id BIGINT NOT NULL AUTO_INCREMENT,
      event_uuid VARCHAR(64) NOT NULL,
      event_type VARCHAR(80) NOT NULL,
      actor_type VARCHAR(40) NOT NULL DEFAULT 'system',
      actor_id VARCHAR(120) NULL,
      target_type VARCHAR(60) NULL,
      target_id VARCHAR(120) NULL,
      metadata_json LONGTEXT NULL,
      created_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_aff_audit_uuid (event_uuid),
      KEY idx_tochukwu_aff_audit_type_created (event_type, created_at),
      KEY idx_tochukwu_aff_audit_target (target_type, target_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

export async function listAffiliateAdminData(sort = "latest_desc") {
  await ensureAffiliateAdminTables()
  const [rules, courses, audit, affiliates] = await Promise.all([
    prisma.$queryRaw<Array<{
      id: bigint
      courseSlug: string
      isAffiliateEligible: number | bigint
      commissionType: string
      commissionValue: number | bigint
      commissionCurrency: string
      minOrderAmountMinor: number | bigint
      holdDays: number | bigint
      startsAt: Date | null
      endsAt: Date | null
      updatedBy: string | null
      createdAt: Date | null
      updatedAt: Date | null
    }>>`
      SELECT id, course_slug AS courseSlug, is_affiliate_eligible AS isAffiliateEligible,
        commission_type AS commissionType, commission_value AS commissionValue,
        commission_currency AS commissionCurrency, min_order_amount_minor AS minOrderAmountMinor,
        hold_days AS holdDays, starts_at AS startsAt, ends_at AS endsAt,
        updated_by AS updatedBy, created_at AS createdAt, updated_at AS updatedAt
      FROM tochukwu_affiliate_course_rules
      ORDER BY course_slug ASC
    `,
    prisma.$queryRaw<Array<{ slug: string; label: string }>>`
      SELECT course_slug AS slug, course_title AS label
      FROM tochukwu_learning_courses
      WHERE NOT EXISTS (
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
      ORDER BY course_title ASC
    `.catch(() => []),
    prisma.$queryRaw<Array<{
      id: bigint
      eventType: string
      actorType: string
      actorId: string | null
      targetType: string | null
      targetId: string | null
      metadataJson: string | null
      createdAt: Date | null
    }>>`
      SELECT id, event_type AS eventType, actor_type AS actorType, actor_id AS actorId,
        target_type AS targetType, target_id AS targetId, metadata_json AS metadataJson, created_at AS createdAt
      FROM tochukwu_affiliate_audit
      ORDER BY id DESC
      LIMIT 120
    `,
    prisma.$queryRaw<Array<{
      profileId: bigint
      accountId: bigint
      affiliateCode: string
      affiliateStatus: string
      eligibilityStatus: string
      payoutCurrency: string | null
      fullName: string | null
      email: string | null
      currency: string
      totalCount: bigint
      earnedMinor: bigint | number
      pendingMinor: bigint | number
      approvedMinor: bigint | number
      paidMinor: bigint | number
      blockedMinor: bigint | number
      firstCommissionAt: Date | null
      latestCommissionAt: Date | null
      latestPaidAt: Date | null
    }>>`
      SELECT p.id AS profileId, p.account_id AS accountId, p.affiliate_code AS affiliateCode,
        p.status AS affiliateStatus, p.eligibility_status AS eligibilityStatus,
        p.payout_currency AS payoutCurrency, a.full_name AS fullName, a.email,
        COALESCE(c.currency, p.payout_currency, 'NGN') AS currency,
        COUNT(c.id) AS totalCount,
        COALESCE(SUM(c.commission_amount_minor), 0) AS earnedMinor,
        COALESCE(SUM(CASE WHEN c.status = 'pending' THEN c.commission_amount_minor ELSE 0 END), 0) AS pendingMinor,
        COALESCE(SUM(CASE WHEN c.status = 'approved' THEN c.commission_amount_minor ELSE 0 END), 0) AS approvedMinor,
        COALESCE(SUM(CASE WHEN c.status = 'paid' THEN c.commission_amount_minor ELSE 0 END), 0) AS paidMinor,
        COALESCE(SUM(CASE WHEN c.status IN ('blocked','reversed') THEN c.commission_amount_minor ELSE 0 END), 0) AS blockedMinor,
        MIN(c.created_at) AS firstCommissionAt, MAX(c.created_at) AS latestCommissionAt, MAX(c.paid_at) AS latestPaidAt
      FROM tochukwu_affiliate_profiles p
      LEFT JOIN student_accounts a ON a.id = p.account_id
      LEFT JOIN tochukwu_affiliate_commissions c ON c.affiliate_profile_id = p.id
      GROUP BY p.id, p.account_id, p.affiliate_code, p.status, p.eligibility_status, p.payout_currency, a.full_name, a.email, COALESCE(c.currency, p.payout_currency, 'NGN')
      HAVING totalCount > 0
    `
  ])
  const normalizedAffiliates = affiliates.map((row) => ({
    ...row,
    profileId: Number(row.profileId || 0),
    accountId: Number(row.accountId || 0),
    totalCount: Number(row.totalCount || 0),
    earnedMinor: Number(row.earnedMinor || 0),
    pendingMinor: Number(row.pendingMinor || 0),
    approvedMinor: Number(row.approvedMinor || 0),
    paidMinor: Number(row.paidMinor || 0),
    blockedMinor: Number(row.blockedMinor || 0)
  })).sort((a, b) => {
    const at = a.latestCommissionAt ? a.latestCommissionAt.getTime() : 0
    const bt = b.latestCommissionAt ? b.latestCommissionAt.getTime() : 0
    if (sort === "latest_asc") return at - bt
    if (sort === "earned_desc") return b.earnedMinor - a.earnedMinor
    if (sort === "approved_desc") return b.approvedMinor - a.approvedMinor
    if (sort === "paid_desc") return b.paidMinor - a.paidMinor
    return bt - at
  })
  const totalsMap = new Map<string, { currency: string; totalCount: number; earnedMinor: number; pendingMinor: number; approvedMinor: number; paidMinor: number; blockedMinor: number }>()
  for (const row of normalizedAffiliates) {
    const currency = clean(row.currency || row.payoutCurrency || "NGN", 10).toUpperCase()
    const current = totalsMap.get(currency) || { currency, totalCount: 0, earnedMinor: 0, pendingMinor: 0, approvedMinor: 0, paidMinor: 0, blockedMinor: 0 }
    current.totalCount += row.totalCount
    current.earnedMinor += row.earnedMinor
    current.pendingMinor += row.pendingMinor
    current.approvedMinor += row.approvedMinor
    current.paidMinor += row.paidMinor
    current.blockedMinor += row.blockedMinor
    totalsMap.set(currency, current)
  }
  return {
    rules: rules.map((rule) => ({
      ...rule,
      id: Number(rule.id),
      isAffiliateEligible: Number(rule.isAffiliateEligible || 0),
      commissionValue: Number(rule.commissionValue || 0),
      minOrderAmountMinor: Number(rule.minOrderAmountMinor || 0),
      holdDays: Number(rule.holdDays || 0)
    })),
    courses: mergeCoursesWithRules(courses, rules.map((rule) => ({ slug: rule.courseSlug, label: rule.courseSlug }))),
    audit: audit.map((row) => ({
      ...row,
      id: Number(row.id),
      metadata: parseMetadata(row.metadataJson)
    })),
    commissionSummary: { totalsByCurrency: Array.from(totalsMap.values()).sort((a, b) => a.currency.localeCompare(b.currency)), affiliates: normalizedAffiliates }
  }
}

function mergeCoursesWithRules(courses: Array<{ slug: string; label: string }>, ruleCourses: Array<{ slug: string; label: string }>) {
  const map = new Map<string, { slug: string; label: string }>()
  for (const item of [...courses, ...ruleCourses]) {
    const slug = clean(item.slug, 120).toLowerCase()
    if (slug && !map.has(slug)) map.set(slug, { slug, label: clean(item.label, 220) || slug })
  }
  return Array.from(map.values()).sort((a, b) => a.slug.localeCompare(b.slug))
}

function parseMetadata(value: string | null) {
  try {
    const parsed = JSON.parse(String(value || "{}"))
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

export async function saveAffiliateCourseRule(formData: FormData, updatedBy: string) {
  await ensureAffiliateAdminTables()
  const courseSlug = clean(formData.get("courseSlug"), 120).toLowerCase()
  if (!courseSlug) throw new Error("courseSlug is required")
  const commissionType = clean(formData.get("commissionType") || "percentage", 20).toLowerCase()
  if (!["percentage", "fixed"].includes(commissionType)) throw new Error("commissionType must be percentage or fixed")
  const commissionValue = toInt(formData.get("commissionValue"), 0)
  if (commissionType === "percentage" && (commissionValue < 0 || commissionValue > 10000)) throw new Error("percentage commissionValue must be in basis points (0..10000)")
  if (commissionType === "fixed" && commissionValue < 0) throw new Error("fixed commissionValue cannot be negative")
  const now = nowSqlDate()
  await prisma.$executeRaw`
    INSERT INTO tochukwu_affiliate_course_rules
      (course_slug, is_affiliate_eligible, commission_type, commission_value, commission_currency,
       min_order_amount_minor, hold_days, starts_at, ends_at, updated_by, created_at, updated_at)
    VALUES (
      ${courseSlug}, ${clean(formData.get("isAffiliateEligible")) === "1" ? 1 : 0}, ${commissionType}, ${commissionValue},
      ${clean(formData.get("commissionCurrency") || "NGN", 10).toUpperCase()}, ${toMinor(formData.get("minOrderAmountMinor"))},
      ${Math.max(0, Math.min(120, toInt(formData.get("holdDays"), defaultHoldDays())))},
      ${parseDateInput(formData.get("startsAt"))}, ${parseDateInput(formData.get("endsAt"))}, ${updatedBy}, ${now}, ${now}
    )
    ON DUPLICATE KEY UPDATE
      is_affiliate_eligible = VALUES(is_affiliate_eligible),
      commission_type = VALUES(commission_type),
      commission_value = VALUES(commission_value),
      commission_currency = VALUES(commission_currency),
      min_order_amount_minor = VALUES(min_order_amount_minor),
      hold_days = VALUES(hold_days),
      starts_at = VALUES(starts_at),
      ends_at = VALUES(ends_at),
      updated_by = VALUES(updated_by),
      updated_at = VALUES(updated_at)
  `
  await prisma.$executeRaw`
    INSERT INTO tochukwu_affiliate_audit (event_uuid, event_type, actor_type, actor_id, target_type, target_id, metadata_json, created_at)
    VALUES (${`afa_${randomUUID().replace(/-/g, "")}`}, 'course_rule_saved', 'admin', ${updatedBy}, 'course', ${courseSlug}, ${JSON.stringify({ courseSlug })}, ${now})
  `
}

export async function runAffiliatePayoutBatch(formData: FormData, initiatedBy: string) {
  await ensureAffiliateAdminTables()
  await prisma.$executeRaw`UPDATE tochukwu_affiliate_commissions SET status = 'approved', updated_at = ${new Date()} WHERE status = 'pending' AND payable_at IS NOT NULL AND payable_at <= ${new Date()} AND risk_score < 90`
  const mode = clean(formData.get("periodMode"), 40).toLowerCase()
  const inferred = previousMonthPeriod()
  const periodStart = parseDateInput(formData.get("periodStart")) || (mode === "month_end" ? inferred.periodStart : null)
  const periodEnd = parseDateInput(formData.get("periodEnd")) || (mode === "month_end" ? inferred.periodEnd : null)
  if (!periodStart || !periodEnd) throw new Error("periodStart and periodEnd are required.")
  const countryCode = clean(formData.get("countryCode") || "NG", 2).toUpperCase() || "NG"
  const currency = clean(formData.get("currency") || "NGN", 10).toUpperCase()
  const payoutProvider = clean(formData.get("payoutProvider") || "paystack", 40).toLowerCase()
  const scheduledFor = clean(formData.get("scheduledFor"), 10) || null
  const candidates = await prisma.$queryRaw<Array<{
    commissionId: bigint
    affiliateProfileId: bigint
    currency: string
    commissionAmountMinor: number | bigint
    orderUuid: string
    payoutAccountId: bigint | null
    paystackRecipientCode: string | null
    isVerified: number | bigint | null
  }>>`
    SELECT c.id AS commissionId, c.affiliate_profile_id AS affiliateProfileId, c.currency,
      c.commission_amount_minor AS commissionAmountMinor, c.order_uuid AS orderUuid,
      pa.id AS payoutAccountId, pa.paystack_recipient_code AS paystackRecipientCode, pa.is_verified AS isVerified
    FROM tochukwu_affiliate_commissions c
    JOIN tochukwu_affiliate_profiles p ON p.id = c.affiliate_profile_id
    LEFT JOIN tochukwu_affiliate_payout_accounts pa
      ON pa.affiliate_profile_id = c.affiliate_profile_id
     AND pa.currency = c.currency
     AND pa.country_code = p.country_code
     AND pa.status = 'active'
    WHERE c.status = 'approved'
      AND c.currency = ${currency}
      AND p.country_code = ${countryCode}
      AND c.paid_at IS NULL
      AND c.created_at >= ${periodStart}
      AND c.created_at <= ${periodEnd}
    ORDER BY c.id ASC
  `
  const sums = new Map<number, number>()
  for (const row of candidates) {
    const profileId = Number(row.affiliateProfileId || 0)
    sums.set(profileId, (sums.get(profileId) || 0) + Number(row.commissionAmountMinor || 0))
  }
  const minMinor = minPayoutMinor(currency)
  const filtered = candidates.filter((row) => {
    const profileId = Number(row.affiliateProfileId || 0)
    if ((sums.get(profileId) || 0) < minMinor) return false
    if (payoutProvider === "paystack") return Boolean(clean(row.paystackRecipientCode, 120)) && Number(row.isVerified || 0) === 1
    return true
  })
  if (!filtered.length) {
    return { ok: true, empty: true, periodStart, periodEnd, countryCode, currency, payoutProvider, candidateCount: candidates.length, paidCount: 0, failedCount: 0, totalAmountMinor: 0 }
  }
  const now = new Date()
  const batchUuid = `apb_${randomUUID().replace(/-/g, "")}`
  await prisma.$executeRaw`
    INSERT INTO tochukwu_affiliate_payout_batches
      (batch_uuid, country_code, currency, payout_provider, period_start, period_end, scheduled_for, status, total_items, total_amount_minor, initiated_by, created_at, updated_at)
    VALUES (${batchUuid}, ${countryCode}, ${currency}, ${payoutProvider}, ${periodStart}, ${periodEnd}, ${scheduledFor}, 'processing', 0, 0, ${initiatedBy}, ${now}, ${now})
  `
  const batchRows = await prisma.$queryRaw<Array<{ id: bigint }>>`SELECT id FROM tochukwu_affiliate_payout_batches WHERE batch_uuid = ${batchUuid} LIMIT 1`
  const payoutBatchId = Number(batchRows[0]?.id || 0)
  let totalAmountMinor = 0
  let paidCount = 0
  let failedCount = 0
  for (const row of filtered) {
    const amountMinor = Number(row.commissionAmountMinor || 0)
    const itemUuid = `api_${randomUUID().replace(/-/g, "")}`
    await prisma.$executeRaw`
      INSERT INTO tochukwu_affiliate_payout_items
        (item_uuid, payout_batch_id, commission_id, affiliate_profile_id, payout_account_id, amount_minor, currency, status, created_at, updated_at)
      VALUES (${itemUuid}, ${payoutBatchId}, ${row.commissionId}, ${row.affiliateProfileId}, ${row.payoutAccountId}, ${amountMinor}, ${currency}, 'processing', ${new Date()}, ${new Date()})
    `
    const itemRows = await prisma.$queryRaw<Array<{ id: bigint }>>`SELECT id FROM tochukwu_affiliate_payout_items WHERE item_uuid = ${itemUuid} LIMIT 1`
    const itemId = Number(itemRows[0]?.id || 0)
    let status = "failed"
    let transferId = ""
    let transferCode = ""
    let reference = ""
    let errorMessage = ""
    try {
      if (payoutProvider !== "paystack") throw new Error("Unsupported payout provider for automatic transfer")
      const transfer = await paystackCreateTransfer({
        amountMinor,
        recipient: clean(row.paystackRecipientCode, 120),
        reason: `Affiliate payout for ${clean(row.orderUuid, 64)}`,
        reference: `aff_${clean(row.orderUuid, 64)}_${Date.now()}`
      })
      status = "paid"
      transferId = transfer.transferId
      transferCode = transfer.transferCode
      reference = transfer.reference
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Payout failed"
    }
    await prisma.$executeRaw`
      UPDATE tochukwu_affiliate_payout_items
      SET status = ${status}, provider_transfer_id = ${transferId || null}, provider_transfer_code = ${transferCode || null},
        provider_reference = ${reference || null}, error_message = ${errorMessage || null}, processed_at = ${new Date()}, updated_at = ${new Date()}
      WHERE id = ${itemId}
    `
    if (status === "paid") {
      await prisma.$executeRaw`
        UPDATE tochukwu_affiliate_commissions
        SET status = 'paid', paid_at = ${new Date()}, payout_batch_id = ${payoutBatchId}, payout_item_id = ${itemId}, updated_at = ${new Date()}
        WHERE id = ${row.commissionId}
      `
      totalAmountMinor += amountMinor
      paidCount += 1
    } else {
      await prisma.$executeRaw`
        UPDATE tochukwu_affiliate_commissions
        SET status = 'approved', payout_batch_id = ${payoutBatchId}, payout_item_id = ${itemId}, updated_at = ${new Date()}
        WHERE id = ${row.commissionId}
      `
      failedCount += 1
    }
  }
  await prisma.$executeRaw`
    UPDATE tochukwu_affiliate_payout_batches
    SET total_items = ${paidCount + failedCount}, total_amount_minor = ${totalAmountMinor},
      successful_items = ${paidCount}, failed_items = ${failedCount},
      status = ${failedCount > 0 ? "completed_with_errors" : "completed"},
      completed_at = ${new Date()}, updated_at = ${new Date()}
    WHERE id = ${payoutBatchId}
  `
  return { ok: true, empty: false, payoutBatchId, periodStart, periodEnd, countryCode, currency, payoutProvider, candidateCount: candidates.length, paidCount, failedCount, totalAmountMinor }
}
