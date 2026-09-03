import { randomUUID } from "crypto"

import { configuredLearningCourseSlugSql, dayLevelCourseSlugRegex } from "@/lib/learning-course-catalog"
import { reportPaymentProviderIssue } from "@/lib/payment-provider-alerts"
import { prisma } from "@/lib/prisma"
import { addColumnIfMissing } from "@/lib/schema-guards"

let affiliateCommissionSeatSchemaPromise: Promise<void> | null = null
let affiliatePayoutSchemaPromise: Promise<void> | null = null

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
  const production = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production"
  return clean(process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET || (production ? "" : process.env.PAYSTACK_SECRET_TEST_KEY), 1000)
}

type PaystackTransfer = {
  transferId: string
  transferCode: string
  reference: string
  status: string
  domain: string
  message: string
  amountMinor: number | null
  currency: string
}

type PaystackResponse = {
  status?: boolean
  message?: unknown
  code?: unknown
  data?: unknown
}

async function paystackRequest(path: string, init: RequestInit, operation: string, reference?: string): Promise<PaystackResponse> {
  const secret = paystackSecretKey()
  if (!secret) {
    await reportPaymentProviderIssue({ provider: "paystack", operation, summary: "PAYSTACK_SECRET_KEY is missing.", reference, errorCode: "missing_secret_key" })
    throw new Error("Paystack payout transfer is temporarily unavailable.")
  }
  if ((process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") && secret.includes("_test_")) {
    await reportPaymentProviderIssue({ provider: "paystack", operation, summary: "A Paystack test key cannot be used for a production affiliate payout.", reference, errorCode: "test_key_in_production" })
    throw new Error("Paystack live payout credentials are not configured.")
  }
  let response: Response
  try {
    response = await fetch(`https://api.paystack.co${path}`, {
      ...init,
      headers: { authorization: `Bearer ${secret}`, accept: "application/json", "content-type": "application/json" },
    })
  } catch (error) {
    await reportPaymentProviderIssue({ provider: "paystack", operation, summary: "The request to Paystack failed.", reference, errorType: "network_error", errorMessage: error instanceof Error ? error.message : String(error) })
    throw new Error("Paystack payout transfer is temporarily unavailable.")
  }
  const json = await response.json().catch(() => null)
  if (!response.ok || json?.status === false) {
    if (!(operation === "affiliate payout verification" && response.status === 404)) {
      await reportPaymentProviderIssue({ provider: "paystack", operation, summary: "Paystack rejected the payout request.", reference, status: response.status, requestId: response.headers.get("x-request-id") || response.headers.get("request-id"), errorCode: json?.code || null, errorMessage: json?.message || `Paystack request failed (${response.status})` })
    }
    const error = new Error(clean(json?.message, 255) || "Paystack payout transfer is temporarily unavailable.")
    ;(error as Error & { providerStatus?: number }).providerStatus = response.status
    throw error
  }
  return json
}

function normalizePaystackTransfer(json: PaystackResponse, fallbackReference = ""): PaystackTransfer {
  const data = json?.data && typeof json.data === "object" && !Array.isArray(json.data) ? json.data as Record<string, unknown> : {}
  return {
    transferId: clean(data.id, 190),
    transferCode: clean(data.transfer_code, 120),
    reference: clean(data.reference || fallbackReference, 190),
    status: clean(data.status || data.transfer_status || "pending", 40).toLowerCase(),
    domain: clean(data.domain, 20).toLowerCase(),
    message: clean(json?.message || data.message, 255),
    amountMinor: Number.isFinite(Number(data.amount)) ? Math.round(Number(data.amount)) : null,
    currency: clean(data.currency, 10).toUpperCase()
  }
}

async function paystackCreateTransfer(input: { amountMinor: number; recipient: string; reason: string; reference: string }) {
  const json = await paystackRequest("/transfer", {
    method: "POST",
    body: JSON.stringify({ source: "balance", amount: input.amountMinor, recipient: input.recipient, reason: input.reason, reference: input.reference })
  }, "affiliate payout transfer", input.reference)
  return normalizePaystackTransfer(json, input.reference)
}

async function paystackVerifyTransfer(reference: string) {
  const json = await paystackRequest(`/transfer/verify/${encodeURIComponent(reference)}`, { method: "GET" }, "affiliate payout verification", reference)
  return normalizePaystackTransfer(json, reference)
}

async function paystackFinalizeTransfer(transferCode: string, otp: string) {
  const json = await paystackRequest("/transfer/finalize_transfer", {
    method: "POST",
    body: JSON.stringify({ transfer_code: transferCode, otp })
  }, "affiliate payout OTP finalization", transferCode)
  return normalizePaystackTransfer(json)
}

async function paystackResendTransferOtp(transferCode: string) {
  const json = await paystackRequest("/transfer/resend_otp", {
    method: "POST",
    body: JSON.stringify({ transfer_code: transferCode, reason: "resend_otp" })
  }, "affiliate payout OTP resend", transferCode)
  return normalizePaystackTransfer(json)
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
      seat_number INT NOT NULL DEFAULT 1,
      seat_count INT NOT NULL DEFAULT 1,
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
      UNIQUE KEY uniq_tochukwu_aff_commission_order_seat (order_uuid, seat_number),
      KEY idx_tochukwu_aff_commission_profile (affiliate_profile_id, status, payable_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  if (!affiliateCommissionSeatSchemaPromise) {
    affiliateCommissionSeatSchemaPromise = (async () => {
      await addColumnIfMissing("tochukwu_affiliate_commissions", "seat_number", "INT NOT NULL DEFAULT 1 AFTER order_uuid")
      await addColumnIfMissing("tochukwu_affiliate_commissions", "seat_count", "INT NOT NULL DEFAULT 1 AFTER seat_number")
      const commissionIndexes = await prisma.$queryRaw<Array<{ indexName: string }>>`
        SELECT DISTINCT INDEX_NAME AS indexName
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'tochukwu_affiliate_commissions'
          AND INDEX_NAME IN ('uniq_tochukwu_aff_commission_order', 'uniq_tochukwu_aff_commission_order_seat')
      `
      const indexNames = new Set(commissionIndexes.map((row) => row.indexName))
      if (indexNames.has("uniq_tochukwu_aff_commission_order")) {
        await prisma.$executeRawUnsafe(
          "ALTER TABLE tochukwu_affiliate_commissions DROP INDEX uniq_tochukwu_aff_commission_order"
        )
      }
      if (!indexNames.has("uniq_tochukwu_aff_commission_order_seat")) {
        await prisma.$executeRawUnsafe(
          "ALTER TABLE tochukwu_affiliate_commissions ADD UNIQUE INDEX uniq_tochukwu_aff_commission_order_seat (order_uuid, seat_number)"
        )
      }
    })().catch((error) => {
      affiliateCommissionSeatSchemaPromise = null
      throw error
    })
  }
  await affiliateCommissionSeatSchemaPromise
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
  if (!affiliatePayoutSchemaPromise) {
    affiliatePayoutSchemaPromise = (async () => {
      await addColumnIfMissing("tochukwu_affiliate_payout_batches", "paid_amount_minor", "BIGINT NOT NULL DEFAULT 0 AFTER total_amount_minor")
      await addColumnIfMissing("tochukwu_affiliate_payout_batches", "pending_items", "INT NOT NULL DEFAULT 0 AFTER successful_items")
      await addColumnIfMissing("tochukwu_affiliate_payout_batches", "otp_items", "INT NOT NULL DEFAULT 0 AFTER pending_items")
      await addColumnIfMissing("tochukwu_affiliate_payout_items", "transfer_group_uuid", "VARCHAR(64) NULL AFTER item_uuid")
      await addColumnIfMissing("tochukwu_affiliate_payout_items", "provider_status", "VARCHAR(40) NULL AFTER provider_reference")
      await addColumnIfMissing("tochukwu_affiliate_payout_items", "provider_domain", "VARCHAR(20) NULL AFTER provider_status")
      await addColumnIfMissing("tochukwu_affiliate_payout_items", "provider_message", "VARCHAR(255) NULL AFTER provider_domain")
      await addColumnIfMissing("tochukwu_affiliate_payout_items", "initiated_at", "DATETIME NULL AFTER processed_at")
      await addColumnIfMissing("tochukwu_affiliate_payout_items", "settled_at", "DATETIME NULL AFTER initiated_at")
      await addColumnIfMissing("tochukwu_affiliate_payout_items", "last_verified_at", "DATETIME NULL AFTER settled_at")
      const indexes = await prisma.$queryRaw<Array<{ indexName: string }>>`
        SELECT DISTINCT INDEX_NAME AS indexName
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'tochukwu_affiliate_payout_items'
          AND INDEX_NAME IN ('uniq_tochukwu_aff_payout_item_commission', 'uniq_tochukwu_aff_payout_batch_commission', 'idx_tochukwu_aff_payout_reference')
      `
      const names = new Set(indexes.map((row) => row.indexName))
      if (names.has("uniq_tochukwu_aff_payout_item_commission")) {
        await prisma.$executeRawUnsafe("ALTER TABLE tochukwu_affiliate_payout_items DROP INDEX uniq_tochukwu_aff_payout_item_commission")
      }
      if (!names.has("uniq_tochukwu_aff_payout_batch_commission")) {
        await prisma.$executeRawUnsafe("ALTER TABLE tochukwu_affiliate_payout_items ADD UNIQUE INDEX uniq_tochukwu_aff_payout_batch_commission (payout_batch_id, commission_id)")
      }
      if (!names.has("idx_tochukwu_aff_payout_reference")) {
        await prisma.$executeRawUnsafe("ALTER TABLE tochukwu_affiliate_payout_items ADD INDEX idx_tochukwu_aff_payout_reference (provider_reference)")
      }
    })().catch((error) => {
      affiliatePayoutSchemaPromise = null
      throw error
    })
  }
  await affiliatePayoutSchemaPromise
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

export type AffiliateAdminOption = {
  code: string
  fullName: string
  email: string
}

export async function listEligibleAffiliateOptions(): Promise<AffiliateAdminOption[]> {
  const rows = await prisma.$queryRaw<Array<{
    code: string | null
    fullName: string | null
    email: string | null
  }>>`
    SELECT p.affiliate_code AS code, a.full_name AS fullName, a.email
    FROM tochukwu_affiliate_profiles p
    JOIN student_accounts a ON a.id = p.account_id
    LEFT JOIN school_students ss ON ss.account_id = p.account_id AND ss.status = 'active'
    WHERE p.status = 'active'
      AND p.eligibility_status = 'eligible'
      AND ss.id IS NULL
    ORDER BY a.full_name ASC, a.email ASC
  `
  return rows
    .map((row) => ({
      code: clean(row.code, 40).toUpperCase(),
      fullName: clean(row.fullName, 180) || "Affiliate",
      email: clean(row.email, 220).toLowerCase()
    }))
    .filter((row) => row.code)
}

export async function listAffiliateAdminData(sort = "latest_desc") {
  await ensureAffiliateAdminTables()
  const [rules, courses, audit, affiliates, payoutBatches, payoutTransfers] = await Promise.all([
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
    `,
    prisma.$queryRaw<Array<{
      id: bigint; batchUuid: string; periodStart: Date; periodEnd: Date; scheduledFor: Date | null; status: string; currency: string
      totalItems: number | bigint; totalAmountMinor: number | bigint; paidAmountMinor: number | bigint
      successfulItems: number | bigint; pendingItems: number | bigint; otpItems: number | bigint; failedItems: number | bigint
      initiatedBy: string | null; runNotes: string | null; createdAt: Date; completedAt: Date | null
    }>>`
      SELECT id, batch_uuid AS batchUuid, period_start AS periodStart, period_end AS periodEnd,
        scheduled_for AS scheduledFor, status, currency, total_items AS totalItems,
        total_amount_minor AS totalAmountMinor, paid_amount_minor AS paidAmountMinor,
        successful_items AS successfulItems, pending_items AS pendingItems, otp_items AS otpItems,
        failed_items AS failedItems, initiated_by AS initiatedBy, run_notes AS runNotes, created_at AS createdAt, completed_at AS completedAt
      FROM tochukwu_affiliate_payout_batches
      ORDER BY id DESC
      LIMIT 30
    `,
    prisma.$queryRaw<Array<{
      batchId: bigint; transferGroupUuid: string | null; providerReference: string | null; providerTransferCode: string | null
      providerTransferId: string | null; providerStatus: string | null; providerDomain: string | null; providerMessage: string | null
      errorMessage: string | null; status: string; currency: string; amountMinor: number | bigint; commissionCount: number | bigint
      affiliateName: string | null; affiliateCode: string | null; updatedAt: Date
    }>>`
      SELECT i.payout_batch_id AS batchId, i.transfer_group_uuid AS transferGroupUuid,
        i.provider_reference AS providerReference, MAX(i.provider_transfer_code) AS providerTransferCode,
        MAX(i.provider_transfer_id) AS providerTransferId, MAX(i.provider_status) AS providerStatus,
        MAX(i.provider_domain) AS providerDomain, MAX(i.provider_message) AS providerMessage, MAX(i.error_message) AS errorMessage,
        MAX(i.status) AS status, MAX(i.currency) AS currency, SUM(i.amount_minor) AS amountMinor,
        COUNT(*) AS commissionCount, MAX(a.full_name) AS affiliateName, MAX(p.affiliate_code) AS affiliateCode,
        MAX(i.updated_at) AS updatedAt
      FROM tochukwu_affiliate_payout_items i
      JOIN tochukwu_affiliate_profiles p ON p.id = i.affiliate_profile_id
      LEFT JOIN student_accounts a ON a.id = p.account_id
      GROUP BY i.payout_batch_id, i.transfer_group_uuid, i.provider_reference
      ORDER BY i.payout_batch_id DESC, MAX(i.id) DESC
      LIMIT 100
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
    payoutBatches: payoutBatches.map((row) => ({
      ...row,
      id: Number(row.id),
      totalItems: Number(row.totalItems || 0),
      totalAmountMinor: Number(row.totalAmountMinor || 0),
      paidAmountMinor: Number(row.paidAmountMinor || 0),
      successfulItems: Number(row.successfulItems || 0),
      pendingItems: Number(row.pendingItems || 0),
      otpItems: Number(row.otpItems || 0),
      failedItems: Number(row.failedItems || 0)
    })),
    payoutTransfers: payoutTransfers.map((row) => ({
      ...row,
      batchId: Number(row.batchId),
      amountMinor: Number(row.amountMinor || 0),
      commissionCount: Number(row.commissionCount || 0)
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

type PayoutCandidate = {
  commissionId: bigint
  affiliateProfileId: bigint
  commissionAmountMinor: number | bigint
  payoutAccountId: bigint | null
  paystackRecipientCode: string | null
  isVerified: number | bigint | null
}

function localTransferStatus(providerStatus: string) {
  const status = clean(providerStatus, 40).toLowerCase()
  if (status === "success") return "paid"
  if (status === "otp") return "otp"
  if (["failed", "abandoned"].includes(status)) return "failed"
  if (status === "reversed") return "reversed"
  return "pending"
}

async function recordPayoutAudit(input: { eventType: string; actorType?: string; actorId?: string | null; targetType: string; targetId: string; metadata?: Record<string, unknown> }) {
  await prisma.$executeRaw`
    INSERT INTO tochukwu_affiliate_audit
      (event_uuid, event_type, actor_type, actor_id, target_type, target_id, metadata_json, created_at)
    VALUES (${`afa_${randomUUID().replace(/-/g, "")}`}, ${input.eventType}, ${input.actorType || "system"}, ${input.actorId || null},
      ${input.targetType}, ${input.targetId}, ${JSON.stringify(input.metadata || {})}, ${new Date()})
  `
}

async function refreshPayoutBatch(batchId: number) {
  const rows = await prisma.$queryRaw<Array<{
    totalItems: bigint; totalAmountMinor: bigint; paidAmountMinor: bigint; successfulItems: bigint; pendingItems: bigint; otpItems: bigint; failedItems: bigint
  }>>`
    SELECT COUNT(*) AS totalItems, COALESCE(SUM(amount_minor), 0) AS totalAmountMinor,
      COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_minor ELSE 0 END), 0) AS paidAmountMinor,
      SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS successfulItems,
      SUM(CASE WHEN status IN ('scheduled','reserved','initiating','pending') THEN 1 ELSE 0 END) AS pendingItems,
      SUM(CASE WHEN status = 'otp' THEN 1 ELSE 0 END) AS otpItems,
      SUM(CASE WHEN status IN ('failed','reversed','review') THEN 1 ELSE 0 END) AS failedItems
    FROM tochukwu_affiliate_payout_items WHERE payout_batch_id = ${batchId}
  `
  const counts = rows[0]
  const totalItems = Number(counts?.totalItems || 0)
  const successfulItems = Number(counts?.successfulItems || 0)
  const pendingItems = Number(counts?.pendingItems || 0)
  const otpItems = Number(counts?.otpItems || 0)
  const failedItems = Number(counts?.failedItems || 0)
  const status = otpItems > 0 ? "otp_required"
    : pendingItems > 0 ? "processing"
      : failedItems > 0 && successfulItems > 0 ? "completed_with_errors"
        : failedItems > 0 ? "failed"
          : totalItems > 0 ? "completed" : "empty"
  const complete = pendingItems === 0 && otpItems === 0
  await prisma.$executeRaw`
    UPDATE tochukwu_affiliate_payout_batches SET total_items = ${totalItems}, total_amount_minor = ${Number(counts?.totalAmountMinor || 0)},
      paid_amount_minor = ${Number(counts?.paidAmountMinor || 0)}, successful_items = ${successfulItems}, pending_items = ${pendingItems},
      otp_items = ${otpItems}, failed_items = ${failedItems}, status = ${status}, completed_at = ${complete ? new Date() : null}, updated_at = ${new Date()}
    WHERE id = ${batchId}
  `
  return { totalItems, totalAmountMinor: Number(counts?.totalAmountMinor || 0), paidAmountMinor: Number(counts?.paidAmountMinor || 0), successfulItems, pendingItems, otpItems, failedItems, status }
}

async function applyTransferState(reference: string, transfer: PaystackTransfer, source: string) {
  await ensureAffiliateAdminTables()
  const rows = await prisma.$queryRaw<Array<{ batchId: bigint; amountMinor: bigint; currency: string; currentStatus: string; lastVerifiedAt: Date | null }>>`
    SELECT MIN(payout_batch_id) AS batchId, SUM(amount_minor) AS amountMinor, MAX(currency) AS currency,
      MAX(status) AS currentStatus, MAX(last_verified_at) AS lastVerifiedAt
    FROM tochukwu_affiliate_payout_items WHERE provider_reference = ${reference}
  `
  const row = rows[0]
  const batchId = Number(row?.batchId || 0)
  if (!batchId) return { found: false, status: "unknown" }
  const expectedAmount = Number(row.amountMinor || 0)
  const expectedCurrency = clean(row.currency, 10).toUpperCase()
  const productionDomainMismatch = (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") && transfer.domain === "test"
  const mismatch = productionDomainMismatch || (transfer.amountMinor !== null && transfer.amountMinor !== expectedAmount)
    || (Boolean(transfer.currency) && transfer.currency !== expectedCurrency)
  const status = mismatch ? "review" : localTransferStatus(transfer.status)
  if (row.currentStatus === "paid" && row.lastVerifiedAt && !["paid", "reversed"].includes(status)) {
    return { found: true, status: "paid", batchId, batch: await refreshPayoutBatch(batchId) }
  }
  const now = new Date()
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE tochukwu_affiliate_payout_items SET status = ${status}, provider_transfer_id = COALESCE(${transfer.transferId || null}, provider_transfer_id),
        provider_transfer_code = COALESCE(${transfer.transferCode || null}, provider_transfer_code), provider_status = ${transfer.status || null},
        provider_domain = COALESCE(${transfer.domain || null}, provider_domain), provider_message = ${transfer.message || null},
        error_message = ${productionDomainMismatch ? "Paystack returned a test-mode transfer in production." : mismatch ? "Provider amount or currency does not match this payout." : null},
        processed_at = ${now}, settled_at = ${status === "paid" ? now : null}, last_verified_at = ${now}, updated_at = ${now}
      WHERE provider_reference = ${reference}
    `
    if (status === "paid") {
      await tx.$executeRaw`
        UPDATE tochukwu_affiliate_commissions c
        JOIN tochukwu_affiliate_payout_items i ON i.commission_id = c.id
        SET c.status = 'paid', c.paid_at = ${now}, c.payout_batch_id = i.payout_batch_id, c.payout_item_id = i.id, c.updated_at = ${now}
        WHERE i.provider_reference = ${reference}
      `
    } else {
      await tx.$executeRaw`
        UPDATE tochukwu_affiliate_commissions c
        JOIN tochukwu_affiliate_payout_items i ON i.commission_id = c.id
        SET c.status = 'approved', c.paid_at = NULL, c.payout_batch_id = i.payout_batch_id, c.payout_item_id = i.id, c.updated_at = ${now}
        WHERE i.provider_reference = ${reference} AND c.status <> 'reversed'
      `
    }
  })
  if (mismatch) {
    await reportPaymentProviderIssue({ provider: "paystack", operation: "affiliate payout reconciliation", summary: productionDomainMismatch ? "Paystack returned a test-mode transfer in production." : "Provider amount or currency did not match the reserved affiliate payout.", reference, errorCode: productionDomainMismatch ? "production_domain_mismatch" : "payout_mismatch" })
  }
  await recordPayoutAudit({ eventType: `payout_transfer_${status}`, targetType: "payout_transfer", targetId: reference, metadata: { source, providerStatus: transfer.status, providerDomain: transfer.domain, expectedAmount, expectedCurrency, receivedAmount: transfer.amountMinor, receivedCurrency: transfer.currency } })
  const batch = await refreshPayoutBatch(batchId)
  return { found: true, status, batchId, batch }
}

async function paystackAvailableBalance(currency: string) {
  const json = await paystackRequest("/balance", { method: "GET" }, "affiliate payout balance preflight")
  const balances = Array.isArray(json?.data) ? json.data as Array<Record<string, unknown>> : []
  const match = balances.find((item) => clean(item.currency, 10).toUpperCase() === currency)
  return Number.isFinite(Number(match?.balance)) ? Math.round(Number(match?.balance)) : 0
}

async function executePayoutBatch(batchId: number, actor = "system") {
  const batchRows = await prisma.$queryRaw<Array<{ currency: string; payoutProvider: string }>>`
    SELECT currency, payout_provider AS payoutProvider FROM tochukwu_affiliate_payout_batches WHERE id = ${batchId} LIMIT 1
  `
  const batch = batchRows[0]
  if (!batch) throw new Error("Payout batch was not found.")
  if (batch.payoutProvider !== "paystack") throw new Error("Only Paystack automatic payouts are supported.")
  await prisma.$executeRaw`UPDATE tochukwu_affiliate_payout_batches SET status = 'processing', run_notes = NULL, completed_at = NULL, updated_at = ${new Date()} WHERE id = ${batchId}`
  const groups = await prisma.$queryRaw<Array<{
    transferGroupUuid: string; providerReference: string; affiliateProfileId: bigint; recipientCode: string; amountMinor: bigint
  }>>`
    SELECT i.transfer_group_uuid AS transferGroupUuid, MAX(i.provider_reference) AS providerReference,
      MIN(i.affiliate_profile_id) AS affiliateProfileId, MAX(pa.paystack_recipient_code) AS recipientCode,
      SUM(i.amount_minor) AS amountMinor
    FROM tochukwu_affiliate_payout_items i
    JOIN tochukwu_affiliate_payout_accounts pa ON pa.id = i.payout_account_id
    WHERE i.payout_batch_id = ${batchId} AND i.status IN ('scheduled','reserved')
    GROUP BY i.transfer_group_uuid
  `
  const required = groups.reduce((sum, group) => sum + Number(group.amountMinor || 0), 0)
  const available = await paystackAvailableBalance(clean(batch.currency, 10).toUpperCase())
  if (available < required) {
    await recordPayoutAudit({ eventType: "payout_batch_balance_failed", actorType: actor === "system" ? "system" : "admin", actorId: actor, targetType: "payout_batch", targetId: String(batchId), metadata: { required, available, currency: batch.currency } })
    await reportPaymentProviderIssue({ provider: "paystack", operation: "affiliate payout balance preflight", summary: `Insufficient ${batch.currency} balance for affiliate payout batch ${batchId}.`, reference: String(batchId), errorCode: "insufficient_balance" })
    const message = `Insufficient Paystack ${batch.currency} balance. Required ${(required / 100).toFixed(2)}, available ${(available / 100).toFixed(2)}.`
    await prisma.$executeRaw`UPDATE tochukwu_affiliate_payout_items SET status = 'failed', error_message = ${message}, updated_at = ${new Date()} WHERE payout_batch_id = ${batchId} AND status IN ('scheduled','reserved')`
    await prisma.$executeRaw`UPDATE tochukwu_affiliate_payout_batches SET run_notes = ${message}, updated_at = ${new Date()} WHERE id = ${batchId}`
    await refreshPayoutBatch(batchId)
    throw new Error(message)
  }
  for (const group of groups) {
    const reference = clean(group.providerReference, 190)
    await prisma.$executeRaw`UPDATE tochukwu_affiliate_payout_items SET status = 'initiating', initiated_at = ${new Date()}, updated_at = ${new Date()} WHERE payout_batch_id = ${batchId} AND transfer_group_uuid = ${group.transferGroupUuid} AND status IN ('scheduled','reserved')`
    try {
      const transfer = await paystackCreateTransfer({ amountMinor: Number(group.amountMinor), recipient: clean(group.recipientCode, 120), reason: `Affiliate payout batch ${batchId}`, reference })
      await applyTransferState(reference, transfer, "initiation")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Payout initiation could not be confirmed."
      await prisma.$executeRaw`UPDATE tochukwu_affiliate_payout_items SET status = 'pending', error_message = ${message}, updated_at = ${new Date()} WHERE payout_batch_id = ${batchId} AND transfer_group_uuid = ${group.transferGroupUuid}`
      await recordPayoutAudit({ eventType: "payout_transfer_unconfirmed", actorType: actor === "system" ? "system" : "admin", actorId: actor, targetType: "payout_transfer", targetId: reference, metadata: { message } })
    }
  }
  return refreshPayoutBatch(batchId)
}

export async function runAffiliatePayoutBatch(formData: FormData, initiatedBy: string) {
  await ensureAffiliateAdminTables()
  const now = new Date()
  await prisma.$executeRaw`UPDATE tochukwu_affiliate_commissions SET status = 'approved', updated_at = ${now} WHERE status = 'pending' AND payable_at IS NOT NULL AND payable_at <= ${now} AND risk_score < 90`
  const mode = clean(formData.get("periodMode"), 40).toLowerCase()
  const inferred = previousMonthPeriod()
  const periodStart = parseDateInput(formData.get("periodStart")) || (mode === "month_end" ? inferred.periodStart : null)
  const periodEnd = parseDateInput(formData.get("periodEnd")) || (mode === "month_end" ? inferred.periodEnd : null)
  if (!periodStart || !periodEnd || periodStart > periodEnd) throw new Error("A valid payout period is required.")
  const countryCode = clean(formData.get("countryCode") || "NG", 2).toUpperCase() || "NG"
  const currency = clean(formData.get("currency") || "NGN", 10).toUpperCase()
  const payoutProvider = clean(formData.get("payoutProvider") || "paystack", 40).toLowerCase()
  if (payoutProvider !== "paystack") throw new Error("Only Paystack automatic payouts are supported.")
  const scheduledInput = clean(formData.get("scheduledFor"), 30)
  const scheduledDate = parseDateInput(scheduledInput)
  if (scheduledInput && !scheduledDate) throw new Error("The scheduled execution date is invalid.")
  const isScheduled = Boolean(scheduledDate && scheduledDate.getTime() > now.getTime())
  const candidates = await prisma.$queryRaw<PayoutCandidate[]>`
    SELECT c.id AS commissionId, c.affiliate_profile_id AS affiliateProfileId,
      c.commission_amount_minor AS commissionAmountMinor, pa.id AS payoutAccountId,
      pa.paystack_recipient_code AS paystackRecipientCode, pa.is_verified AS isVerified
    FROM tochukwu_affiliate_commissions c
    JOIN tochukwu_affiliate_profiles p ON p.id = c.affiliate_profile_id
    LEFT JOIN tochukwu_affiliate_payout_accounts pa ON pa.affiliate_profile_id = c.affiliate_profile_id
      AND pa.currency = c.currency AND pa.country_code = p.country_code AND pa.status = 'active'
    WHERE c.status = 'approved' AND c.currency = ${currency} AND p.country_code = ${countryCode} AND c.paid_at IS NULL
      AND c.created_at >= ${periodStart} AND c.created_at <= ${periodEnd}
      AND NOT EXISTS (
        SELECT 1 FROM tochukwu_affiliate_payout_items existing
        WHERE existing.commission_id = c.id AND existing.status IN ('scheduled','reserved','initiating','pending','otp','paid','review')
      )
    ORDER BY c.id ASC
  `
  const sums = new Map<number, number>()
  for (const row of candidates) sums.set(Number(row.affiliateProfileId), (sums.get(Number(row.affiliateProfileId)) || 0) + Number(row.commissionAmountMinor || 0))
  const filtered = candidates.filter((row) => (sums.get(Number(row.affiliateProfileId)) || 0) >= minPayoutMinor(currency)
    && Boolean(clean(row.paystackRecipientCode, 120)) && Number(row.isVerified || 0) === 1)
  if (!filtered.length) return { ok: true, empty: true, scheduled: false, periodStart, periodEnd, countryCode, currency, payoutProvider, candidateCount: candidates.length, transferCount: 0, paidCount: 0, pendingCount: 0, otpCount: 0, failedCount: 0, totalAmountMinor: 0, paidAmountMinor: 0 }

  const batchUuid = `apb_${randomUUID().replace(/-/g, "")}`
  await prisma.$executeRaw`
    INSERT INTO tochukwu_affiliate_payout_batches
      (batch_uuid, country_code, currency, payout_provider, period_start, period_end, scheduled_for, status, total_items, total_amount_minor, initiated_by, created_at, updated_at)
    VALUES (${batchUuid}, ${countryCode}, ${currency}, ${payoutProvider}, ${periodStart}, ${periodEnd}, ${scheduledDate}, ${isScheduled ? "scheduled" : "processing"},
      ${filtered.length}, ${filtered.reduce((sum, row) => sum + Number(row.commissionAmountMinor || 0), 0)}, ${initiatedBy}, ${now}, ${now})
  `
  const batchRows = await prisma.$queryRaw<Array<{ id: bigint }>>`SELECT id FROM tochukwu_affiliate_payout_batches WHERE batch_uuid = ${batchUuid} LIMIT 1`
  const payoutBatchId = Number(batchRows[0]?.id || 0)
  const groups = new Map<number, { uuid: string; reference: string; rows: PayoutCandidate[] }>()
  for (const row of filtered) {
    const profileId = Number(row.affiliateProfileId)
    if (!groups.has(profileId)) {
      const uuid = `atg_${randomUUID().replace(/-/g, "")}`
      groups.set(profileId, { uuid, reference: `aff_${batchUuid}_${profileId}`.slice(0, 190), rows: [] })
    }
    groups.get(profileId)!.rows.push(row)
  }
  await prisma.$transaction(async (tx) => {
    for (const group of groups.values()) {
      for (const row of group.rows) {
        const itemUuid = `api_${randomUUID().replace(/-/g, "")}`
        await tx.$executeRaw`
          INSERT INTO tochukwu_affiliate_payout_items
            (item_uuid, transfer_group_uuid, payout_batch_id, commission_id, affiliate_profile_id, payout_account_id, amount_minor, currency, status, provider_reference, created_at, updated_at)
          VALUES (${itemUuid}, ${group.uuid}, ${payoutBatchId}, ${row.commissionId}, ${row.affiliateProfileId}, ${row.payoutAccountId},
            ${Number(row.commissionAmountMinor || 0)}, ${currency}, ${isScheduled ? "scheduled" : "reserved"}, ${group.reference}, ${now}, ${now})
        `
        const itemRows = await tx.$queryRaw<Array<{ id: bigint }>>`SELECT id FROM tochukwu_affiliate_payout_items WHERE item_uuid = ${itemUuid} LIMIT 1`
        await tx.$executeRaw`UPDATE tochukwu_affiliate_commissions SET payout_batch_id = ${payoutBatchId}, payout_item_id = ${Number(itemRows[0]?.id || 0)}, updated_at = ${now} WHERE id = ${row.commissionId}`
      }
    }
  })
  await recordPayoutAudit({ eventType: isScheduled ? "payout_batch_scheduled" : "payout_batch_reserved", actorType: "admin", actorId: initiatedBy, targetType: "payout_batch", targetId: String(payoutBatchId), metadata: { batchUuid, commissionCount: filtered.length, transferCount: groups.size, totalAmountMinor: filtered.reduce((sum, row) => sum + Number(row.commissionAmountMinor || 0), 0), currency, scheduledFor: scheduledDate?.toISOString() || null } })
  if (isScheduled) return { ok: true, empty: false, scheduled: true, payoutBatchId, periodStart, periodEnd, countryCode, currency, payoutProvider, candidateCount: candidates.length, transferCount: groups.size, paidCount: 0, pendingCount: filtered.length, otpCount: 0, failedCount: 0, totalAmountMinor: filtered.reduce((sum, row) => sum + Number(row.commissionAmountMinor || 0), 0), paidAmountMinor: 0 }
  const result = await executePayoutBatch(payoutBatchId, initiatedBy)
  return { ok: true, empty: false, scheduled: false, payoutBatchId, periodStart, periodEnd, countryCode, currency, payoutProvider, candidateCount: candidates.length, transferCount: groups.size, paidCount: result.successfulItems, pendingCount: result.pendingItems, otpCount: result.otpItems, failedCount: result.failedItems, totalAmountMinor: result.totalAmountMinor, paidAmountMinor: result.paidAmountMinor }
}

export async function finalizeAffiliatePayoutOtp(formData: FormData, actor: string) {
  await ensureAffiliateAdminTables()
  const reference = clean(formData.get("reference"), 190)
  const otp = clean(formData.get("otp"), 12)
  if (!reference || !/^\d{4,10}$/.test(otp)) throw new Error("Enter the valid Paystack OTP.")
  const rows = await prisma.$queryRaw<Array<{ transferCode: string | null }>>`SELECT provider_transfer_code AS transferCode FROM tochukwu_affiliate_payout_items WHERE provider_reference = ${reference} AND status = 'otp' LIMIT 1`
  const transferCode = clean(rows[0]?.transferCode, 120)
  if (!transferCode) throw new Error("This payout is not waiting for an OTP.")
  const transfer = await paystackFinalizeTransfer(transferCode, otp)
  const result = await applyTransferState(reference, { ...transfer, reference: transfer.reference || reference }, "otp_finalization")
  await recordPayoutAudit({ eventType: "payout_otp_submitted", actorType: "admin", actorId: actor, targetType: "payout_transfer", targetId: reference, metadata: { resultingStatus: result.status } })
  return result
}

export async function resendAffiliatePayoutOtp(formData: FormData, actor: string) {
  await ensureAffiliateAdminTables()
  const reference = clean(formData.get("reference"), 190)
  const rows = await prisma.$queryRaw<Array<{ transferCode: string | null }>>`SELECT provider_transfer_code AS transferCode FROM tochukwu_affiliate_payout_items WHERE provider_reference = ${reference} AND status = 'otp' LIMIT 1`
  const transferCode = clean(rows[0]?.transferCode, 120)
  if (!transferCode) throw new Error("This payout is not waiting for an OTP.")
  await paystackResendTransferOtp(transferCode)
  await recordPayoutAudit({ eventType: "payout_otp_resent", actorType: "admin", actorId: actor, targetType: "payout_transfer", targetId: reference })
  return { ok: true }
}

export async function retryAffiliatePayoutTransfer(formData: FormData, actor: string) {
  await ensureAffiliateAdminTables()
  const previousReference = clean(formData.get("reference"), 190)
  const rows = await prisma.$queryRaw<Array<{ batchId: bigint; transferGroupUuid: string; status: string }>>`
    SELECT payout_batch_id AS batchId, transfer_group_uuid AS transferGroupUuid, status
    FROM tochukwu_affiliate_payout_items WHERE provider_reference = ${previousReference} LIMIT 1
  `
  const row = rows[0]
  if (!row || !["failed", "reversed"].includes(clean(row.status, 40))) throw new Error("Only a failed or reversed payout can be retried.")
  let safeToUseNewReference = false
  try {
    const existing = await paystackVerifyTransfer(previousReference)
    const existingStatus = localTransferStatus(existing.status)
    const applied = await applyTransferState(previousReference, existing, "pre_retry_verification")
    if (!["failed", "reversed"].includes(existingStatus)) return applied
    safeToUseNewReference = true
  } catch (error) {
    if ((error as Error & { providerStatus?: number }).providerStatus !== 404) throw error
  }
  const reference = safeToUseNewReference ? `aff_retry_${randomUUID().replace(/-/g, "")}` : previousReference
  await prisma.$executeRaw`
    UPDATE tochukwu_affiliate_payout_items SET status = 'reserved', provider_reference = ${reference},
      provider_transfer_id = NULL, provider_transfer_code = NULL, provider_status = NULL, provider_message = NULL,
      error_message = NULL, initiated_at = NULL, settled_at = NULL, last_verified_at = NULL, updated_at = ${new Date()}
    WHERE payout_batch_id = ${row.batchId} AND transfer_group_uuid = ${row.transferGroupUuid}
  `
  await recordPayoutAudit({ eventType: "payout_transfer_retry_requested", actorType: "admin", actorId: actor, targetType: "payout_transfer", targetId: reference, metadata: { previousReference } })
  return executePayoutBatch(Number(row.batchId), actor)
}

export async function reconcileAffiliatePayouts(input?: { reference?: string; limit?: number; actor?: string }) {
  await ensureAffiliateAdminTables()
  const reference = clean(input?.reference, 190)
  const limit = Math.max(1, Math.min(100, toInt(input?.limit, 50)))
  const rows = await prisma.$queryRaw<Array<{ providerReference: string; updatedAt: Date; batchId: bigint }>>`
    SELECT provider_reference AS providerReference, MIN(updated_at) AS updatedAt, MIN(payout_batch_id) AS batchId FROM tochukwu_affiliate_payout_items
    WHERE provider_reference IS NOT NULL AND provider_reference <> '' AND (${reference} = '' OR provider_reference = ${reference})
      AND (status IN ('initiating','pending','otp','review') OR (status = 'paid' AND last_verified_at IS NULL))
    GROUP BY provider_reference ORDER BY MIN(updated_at) ASC LIMIT ${limit}
  `
  const result = { checked: 0, paid: 0, pending: 0, otp: 0, failed: 0, review: 0, notFound: 0 }
  for (const row of rows) {
    try {
      const transfer = await paystackVerifyTransfer(row.providerReference)
      const applied = await applyTransferState(row.providerReference, transfer, input?.actor || "reconciliation")
      result.checked += 1
      if (applied.status === "paid") result.paid += 1
      else if (applied.status === "pending") result.pending += 1
      else if (applied.status === "otp") result.otp += 1
      else if (applied.status === "failed" || applied.status === "reversed") result.failed += 1
      else if (applied.status === "review") result.review += 1
    } catch (error) {
      result.notFound += 1
      const providerStatus = (error as Error & { providerStatus?: number }).providerStatus
      if (providerStatus === 404 && Date.now() - new Date(row.updatedAt).getTime() >= 30 * 60 * 1000) {
        await prisma.$executeRaw`UPDATE tochukwu_affiliate_payout_items SET status = 'failed', provider_status = 'not_found', error_message = 'Paystack could not find this transfer after 30 minutes.', last_verified_at = ${new Date()}, updated_at = ${new Date()} WHERE provider_reference = ${row.providerReference} AND status IN ('initiating','pending')`
        await refreshPayoutBatch(Number(row.batchId))
        await recordPayoutAudit({ eventType: "payout_transfer_failed", targetType: "payout_transfer", targetId: row.providerReference, metadata: { source: "reconciliation", reason: "provider_not_found_after_30_minutes" } })
        result.failed += 1
      }
    }
  }
  return result
}

export async function reconcileAffiliatePayoutWebhook(input: { event: string; reference: string; transferId?: string; transferCode?: string; status?: string; domain?: string; amountMinor?: number | null; currency?: string; message?: string }) {
  const eventStatus = input.event.replace(/^transfer\./, "")
  return applyTransferState(input.reference, {
    transferId: clean(input.transferId, 190), transferCode: clean(input.transferCode, 120), reference: clean(input.reference, 190),
    status: clean(input.status || eventStatus, 40).toLowerCase(), domain: clean(input.domain, 20).toLowerCase(), message: clean(input.message, 255),
    amountMinor: Number.isFinite(Number(input.amountMinor)) ? Number(input.amountMinor) : null, currency: clean(input.currency, 10).toUpperCase()
  }, "webhook")
}

export async function processDueScheduledAffiliatePayoutBatches(limit = 10) {
  await ensureAffiliateAdminTables()
  const rows = await prisma.$queryRaw<Array<{ id: bigint }>>`
    SELECT id FROM tochukwu_affiliate_payout_batches WHERE status = 'scheduled' AND scheduled_for <= UTC_DATE() ORDER BY scheduled_for ASC, id ASC LIMIT ${Math.max(1, Math.min(25, toInt(limit, 10)))}
  `
  let processed = 0
  let failed = 0
  for (const row of rows) {
    try { await executePayoutBatch(Number(row.id)); processed += 1 } catch (error) {
      failed += 1
      await prisma.$executeRaw`UPDATE tochukwu_affiliate_payout_batches SET run_notes = ${clean(error instanceof Error ? error.message : error, 255)}, updated_at = ${new Date()} WHERE id = ${row.id}`
    }
  }
  return { due: rows.length, processed, failed }
}
