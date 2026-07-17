import crypto, { randomUUID } from "crypto"
import { Prisma } from "@prisma/client"

import { ensureAffiliateAdminTables } from "@/lib/admin-affiliates"
import { prisma } from "@/lib/prisma"
import { addColumnIfMissing } from "@/lib/schema-guards"

let alignmentPromise: Promise<void> | null = null

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function normalizeEmail(value: unknown) {
  const email = clean(value, 220).toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ""
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

function defaultHoldDays() {
  const value = Number(process.env.AFFILIATE_DEFAULT_HOLD_DAYS || 30)
  return Number.isFinite(value) ? Math.max(0, Math.min(120, Math.trunc(value))) : 30
}

export function maskAffiliateEmail(value: unknown) {
  const email = normalizeEmail(value)
  if (!email) return ""
  const at = email.indexOf("@")
  return at <= 1 ? `***${email.slice(at)}` : `${email.slice(0, 2)}***${email.slice(at)}`
}

export async function ensureAffiliateAlignment() {
  if (alignmentPromise) return alignmentPromise
  alignmentPromise = (async () => {
    await ensureAffiliateAdminTables()
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS tochukwu_affiliate_attributions (
        id BIGINT NOT NULL AUTO_INCREMENT,
        attribution_uuid VARCHAR(64) NOT NULL,
        order_uuid VARCHAR(64) NOT NULL,
        course_slug VARCHAR(120) NOT NULL,
        affiliate_profile_id BIGINT NULL,
        affiliate_code VARCHAR(40) NULL,
        buyer_email VARCHAR(220) NOT NULL,
        buyer_account_id BIGINT NULL,
        buyer_country VARCHAR(120) NULL,
        buyer_currency VARCHAR(10) NULL,
        order_amount_minor INT NOT NULL DEFAULT 0,
        ip_hash VARCHAR(128) NULL,
        user_agent_hash VARCHAR(128) NULL,
        click_referrer VARCHAR(255) NULL,
        attribution_status VARCHAR(40) NOT NULL DEFAULT 'accepted',
        rejection_reason VARCHAR(190) NULL,
        risk_score INT NOT NULL DEFAULT 0,
        risk_flags_json LONGTEXT NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_tochukwu_aff_attr_uuid (attribution_uuid),
        UNIQUE KEY uniq_tochukwu_aff_attr_order (order_uuid),
        KEY idx_tochukwu_aff_attr_profile (affiliate_profile_id, created_at),
        KEY idx_tochukwu_aff_attr_buyer_email (buyer_email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS tochukwu_affiliate_school_referrals (
        id BIGINT NOT NULL AUTO_INCREMENT,
        referral_uuid VARCHAR(64) NOT NULL,
        school_id BIGINT NOT NULL,
        affiliate_profile_id BIGINT NOT NULL,
        affiliate_code VARCHAR(40) NOT NULL,
        first_order_uuid VARCHAR(64) NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'active',
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_tochukwu_aff_school_ref_uuid (referral_uuid),
        UNIQUE KEY uniq_tochukwu_aff_school_ref_school (school_id),
        KEY idx_tochukwu_aff_school_ref_affiliate (affiliate_profile_id, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    await Promise.all([
      addColumnIfMissing("tochukwu_affiliate_attributions", "buyer_account_id", "BIGINT NULL"),
      addColumnIfMissing("tochukwu_affiliate_attributions", "ip_hash", "VARCHAR(128) NULL"),
      addColumnIfMissing("tochukwu_affiliate_attributions", "user_agent_hash", "VARCHAR(128) NULL"),
      addColumnIfMissing("tochukwu_affiliate_attributions", "click_referrer", "VARCHAR(255) NULL"),
      addColumnIfMissing("course_orders", "affiliate_code", "VARCHAR(40) NULL"),
      addColumnIfMissing("course_orders", "affiliate_profile_id", "BIGINT NULL"),
      addColumnIfMissing("course_orders", "affiliate_attribution_status", "VARCHAR(40) NULL"),
      addColumnIfMissing("course_manual_payments", "affiliate_code", "VARCHAR(40) NULL"),
      addColumnIfMissing("course_manual_payments", "affiliate_profile_id", "BIGINT NULL"),
      addColumnIfMissing("course_manual_payments", "affiliate_attribution_status", "VARCHAR(40) NULL"),
      addColumnIfMissing("school_orders", "affiliate_code", "VARCHAR(40) NULL"),
      addColumnIfMissing("school_orders", "affiliate_profile_id", "BIGINT NULL"),
      addColumnIfMissing("school_orders", "affiliate_attribution_status", "VARCHAR(40) NULL")
    ])
    const now = new Date()
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO tochukwu_affiliate_course_rules
        (course_slug, is_affiliate_eligible, commission_type, commission_value, commission_currency, min_order_amount_minor, hold_days, created_at, updated_at)
      VALUES ('prompt-to-profit-schools', 1, 'percentage', 1000, 'NGN', 0, ${defaultHoldDays()}, ${now}, ${now})
      ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at)
    `).catch(() => null)
  })().catch((error) => {
    alignmentPromise = null
    throw error
  })
  return alignmentPromise
}

export async function recordAffiliateAudit(input: {
  eventType: string
  actorType?: string
  actorId?: string | null
  targetType?: string | null
  targetId?: string | null
  metadata?: Record<string, unknown>
}) {
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO tochukwu_affiliate_audit
      (event_uuid, event_type, actor_type, actor_id, target_type, target_id, metadata_json, created_at)
    VALUES
      (${`afa_${randomUUID().replace(/-/g, "")}`}, ${clean(input.eventType, 80) || "unknown"}, ${clean(input.actorType, 40) || "system"},
       ${clean(input.actorId, 120) || null}, ${clean(input.targetType, 60) || null}, ${clean(input.targetId, 120) || null},
       ${JSON.stringify(input.metadata || {})}, ${new Date()})
  `).catch(() => null)
}

export function affiliateRequestMetadata(headers?: Headers) {
  if (!headers) return { ipHash: "", userAgentHash: "", clickReferrer: "" }
  const forwarded = headers.get("x-forwarded-for") || headers.get("client-ip") || headers.get("x-nf-client-connection-ip") || headers.get("cf-connecting-ip") || ""
  const ip = clean(forwarded.split(",")[0], 90)
  const userAgent = clean(headers.get("user-agent"), 255)
  return {
    ipHash: ip ? sha256(`ip:${ip}`) : "",
    userAgentHash: userAgent ? sha256(`ua:${userAgent}`) : "",
    clickReferrer: clean(headers.get("referer") || headers.get("referrer"), 255)
  }
}

export async function captureSchoolOrderReferral(input: { orderUuid: string; affiliateCode?: string }) {
  await ensureAffiliateAlignment()
  const orderUuid = clean(input.orderUuid, 64)
  const affiliateCode = clean(input.affiliateCode, 40).toUpperCase()
  if (!orderUuid || !affiliateCode || String(process.env.AFFILIATE_ENABLED || "1").trim() === "0") {
    return { ok: false, status: "invalid" }
  }
  const rows = await prisma.$queryRaw<Array<{ id: bigint; affiliateCode: string }>>(Prisma.sql`
    SELECT p.id, p.affiliate_code AS affiliateCode
    FROM tochukwu_affiliate_profiles p
    LEFT JOIN school_students ss ON ss.account_id = p.account_id AND ss.status = 'active'
    WHERE p.affiliate_code COLLATE utf8mb4_unicode_ci = ${affiliateCode} COLLATE utf8mb4_unicode_ci
      AND p.status = 'active'
      AND p.eligibility_status = 'eligible'
      AND ss.id IS NULL
    LIMIT 1
  `).catch(() => [])
  const profile = rows[0]
  const status = profile ? "accepted" : "rejected"
  await prisma.$executeRaw(Prisma.sql`
    UPDATE school_orders
    SET affiliate_code = ${profile?.affiliateCode || null}, affiliate_profile_id = ${profile?.id || null},
      affiliate_attribution_status = ${status}, updated_at = ${new Date()}
    WHERE order_uuid = ${orderUuid}
    LIMIT 1
  `)
  await recordAffiliateAudit({
    eventType: profile ? "school_attribution_accepted" : "school_attribution_rejected",
    targetType: "school_order",
    targetId: orderUuid,
    metadata: { affiliateCodeInput: affiliateCode, affiliateProfileId: profile ? String(profile.id) : null }
  })
  return { ok: Boolean(profile), status, affiliateProfileId: profile?.id || null, affiliateCode: profile?.affiliateCode || null }
}

export async function bindSchoolReferralAfterPayment(input: { schoolId: number; schoolOrderUuid: string }) {
  await ensureAffiliateAlignment()
  const schoolId = Math.trunc(Number(input.schoolId || 0))
  const orderUuid = clean(input.schoolOrderUuid, 64)
  if (schoolId <= 0 || !orderUuid) return { ok: false, skipped: true }
  const existing = await prisma.$queryRaw<Array<{ affiliateProfileId: bigint; affiliateCode: string }>>(Prisma.sql`
    SELECT affiliate_profile_id AS affiliateProfileId, affiliate_code AS affiliateCode
    FROM tochukwu_affiliate_school_referrals
    WHERE school_id = ${schoolId} AND status = 'active'
    LIMIT 1
  `)
  if (existing[0]) return { ok: true, ...existing[0] }
  const orders = await prisma.$queryRaw<Array<{ affiliateProfileId: bigint | null; affiliateCode: string | null }>>(Prisma.sql`
    SELECT affiliate_profile_id AS affiliateProfileId, affiliate_code AS affiliateCode
    FROM school_orders
    WHERE order_uuid = ${orderUuid} AND affiliate_attribution_status = 'accepted'
    LIMIT 1
  `)
  const order = orders[0]
  if (!order?.affiliateProfileId || !order.affiliateCode) return { ok: false, skipped: true }
  const now = new Date()
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO tochukwu_affiliate_school_referrals
      (referral_uuid, school_id, affiliate_profile_id, affiliate_code, first_order_uuid, status, created_at, updated_at)
    VALUES
      (${`asr_${randomUUID().replace(/-/g, "")}`}, ${schoolId}, ${order.affiliateProfileId}, ${order.affiliateCode}, ${orderUuid}, 'active', ${now}, ${now})
    ON DUPLICATE KEY UPDATE affiliate_profile_id = VALUES(affiliate_profile_id), affiliate_code = VALUES(affiliate_code), updated_at = VALUES(updated_at)
  `)
  await recordAffiliateAudit({
    eventType: "school_referral_bound",
    targetType: "school",
    targetId: String(schoolId),
    metadata: { orderUuid, affiliateProfileId: String(order.affiliateProfileId), affiliateCode: order.affiliateCode }
  })
  return { ok: true, affiliateProfileId: order.affiliateProfileId, affiliateCode: order.affiliateCode }
}

export async function matureAffiliateCommissions(now = new Date()) {
  await ensureAffiliateAlignment()
  const matured = await prisma.$executeRaw(Prisma.sql`
    UPDATE tochukwu_affiliate_commissions
    SET status = 'approved', updated_at = ${now}
    WHERE status = 'pending'
      AND payable_at IS NOT NULL
      AND payable_at <= ${now}
      AND risk_score < 90
  `)
  return Number(matured || 0)
}

export async function createSchoolStudentAffiliateCommission(schoolStudentId: number) {
  await ensureAffiliateAlignment()
  if (String(process.env.AFFILIATE_ENABLED || "1").trim() === "0" || schoolStudentId <= 0) return null
  const orderUuid = `school_student_onboard_${schoolStudentId}`
  const rows = await prisma.$queryRaw<Array<{
    schoolId: bigint
    email: string | null
    courseSlug: string | null
    currency: string | null
    pricePerStudentMinor: number | bigint | null
    affiliateProfileId: bigint
    affiliateCode: string
    commissionType: string
    commissionValue: number | bigint
    commissionCurrency: string | null
    minOrderAmountMinor: number | bigint | null
    holdDays: number | bigint | null
  }>>(Prisma.sql`
    SELECT ss.school_id AS schoolId, ss.email, sc.course_slug AS courseSlug, sc.currency,
      sc.price_per_student_minor AS pricePerStudentMinor, sr.affiliate_profile_id AS affiliateProfileId,
      sr.affiliate_code AS affiliateCode, r.commission_type AS commissionType,
      r.commission_value AS commissionValue, r.commission_currency AS commissionCurrency,
      r.min_order_amount_minor AS minOrderAmountMinor, r.hold_days AS holdDays
    FROM school_students ss
    JOIN school_accounts sc ON sc.id = ss.school_id AND sc.status = 'active'
    JOIN tochukwu_affiliate_school_referrals sr ON sr.school_id = ss.school_id AND sr.status = 'active'
    JOIN tochukwu_affiliate_profiles p ON p.id = sr.affiliate_profile_id AND p.status = 'active' AND p.eligibility_status = 'eligible'
    JOIN tochukwu_affiliate_course_rules r ON r.course_slug COLLATE utf8mb4_unicode_ci = sc.course_slug COLLATE utf8mb4_unicode_ci
      AND r.is_affiliate_eligible = 1 AND (r.starts_at IS NULL OR r.starts_at <= NOW()) AND (r.ends_at IS NULL OR r.ends_at >= NOW())
    WHERE ss.id = ${schoolStudentId} AND ss.status = 'active'
    LIMIT 1
  `).catch(() => [])
  const row = rows[0]
  if (!row) return null
  const baseMinor = Math.max(0, Number(row.pricePerStudentMinor || 0))
  if (baseMinor < Number(row.minOrderAmountMinor || 0)) return null
  const value = Math.max(0, Number(row.commissionValue || 0))
  const amountMinor = row.commissionType === "fixed" ? value : Math.floor((baseMinor * Math.min(value, 10000)) / 10000)
  if (!amountMinor) return null
  const holdDays = Math.max(0, Math.min(120, Number(row.holdDays ?? defaultHoldDays())))
  const now = new Date()
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO tochukwu_affiliate_commissions
      (commission_uuid, attribution_id, order_uuid, course_slug, affiliate_profile_id, affiliate_code, buyer_email,
       currency, order_amount_minor, commission_type, commission_rate_or_value, commission_amount_minor, status,
       risk_score, risk_flags_json, payable_at, created_at, updated_at)
    VALUES
      (${`acm_${randomUUID().replace(/-/g, "")}`}, 0, ${orderUuid}, ${clean(row.courseSlug, 120)}, ${row.affiliateProfileId},
       ${clean(row.affiliateCode, 40)}, ${normalizeEmail(row.email)}, ${clean(row.commissionCurrency || row.currency || "NGN", 10).toUpperCase()},
       ${baseMinor}, ${clean(row.commissionType, 20)}, ${value}, ${amountMinor}, 'pending', 0, '[]',
       ${new Date(now.getTime() + holdDays * 86400000)}, ${now}, ${now})
    ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at)
  `)
  return amountMinor
}
