import crypto, { randomUUID } from "crypto"
import { Prisma } from "@prisma/client"

import { ensureAffiliateAdminTables } from "@/lib/admin-affiliates"
import { recordAffiliateAudit } from "@/lib/affiliate-alignment"
import { sendEmail } from "@/lib/email"
import { prisma } from "@/lib/prisma"
import { publicActionLinkVariants } from "@/lib/public-site-url"
import { addColumnIfMissing } from "@/lib/schema-guards"
import { normalizeStudentEmail } from "@/lib/student-auth"

export const PUBLIC_AFFILIATE_TERMS_VERSION = "2026-09-04"
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000
let onboardingSchemaPromise: Promise<void> | null = null

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function escapeHtml(value: unknown) {
  return String(value || "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character] || character)
}

function tokenHash(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex")
}

function missingOnboardingColumn(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2010") return false
  return /onboarding_source|email_verified_at|verification_token_hash|verification_expires_at/i.test(JSON.stringify(error.meta || {}))
}

function randomAffiliateCode(length = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let value = ""
  for (let index = 0; index < length; index += 1) value += chars[Math.floor(Math.random() * chars.length)]
  return value
}

function hashPassword(password: string, salt: string) {
  return crypto.scryptSync(password, salt, 64).toString("hex")
}

function normalizeNigeriaPhone(value: unknown) {
  const raw = clean(value, 40).replace(/[^\d+]/g, "")
  if (!raw) return ""
  const normalized = raw.startsWith("+234")
    ? raw
    : raw.startsWith("234")
      ? `+${raw}`
      : raw.startsWith("0")
        ? `+234${raw.slice(1)}`
        : `+234${raw}`
  return /^\+234\d{10}$/.test(normalized) ? normalized : ""
}

export async function ensurePublicAffiliateOnboardingSchema() {
  if (onboardingSchemaPromise) return onboardingSchemaPromise
  onboardingSchemaPromise = (async () => {
    await ensureAffiliateAdminTables()
    await addColumnIfMissing("tochukwu_affiliate_profiles", "onboarding_source", "VARCHAR(40) NOT NULL DEFAULT 'student_dashboard' AFTER blocked_at")
    await addColumnIfMissing("tochukwu_affiliate_profiles", "email_verified_at", "DATETIME NULL AFTER onboarding_source")
    await addColumnIfMissing("tochukwu_affiliate_profiles", "terms_accepted_at", "DATETIME NULL AFTER email_verified_at")
    await addColumnIfMissing("tochukwu_affiliate_profiles", "terms_version", "VARCHAR(40) NULL AFTER terms_accepted_at")
    await addColumnIfMissing("tochukwu_affiliate_profiles", "activated_at", "DATETIME NULL AFTER terms_version")
    await addColumnIfMissing("tochukwu_affiliate_profiles", "verification_token_hash", "VARCHAR(128) NULL AFTER activated_at")
    await addColumnIfMissing("tochukwu_affiliate_profiles", "verification_expires_at", "DATETIME NULL AFTER verification_token_hash")
    const indexes = await prisma.$queryRaw<Array<{ indexName: string }>>(Prisma.sql`
      SELECT DISTINCT INDEX_NAME AS indexName
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'tochukwu_affiliate_profiles'
        AND INDEX_NAME = 'uniq_tochukwu_affiliate_verification_token'
    `)
    if (!indexes.length) {
      await prisma.$executeRawUnsafe("ALTER TABLE tochukwu_affiliate_profiles ADD UNIQUE INDEX uniq_tochukwu_affiliate_verification_token (verification_token_hash)")
    }
  })().catch((error) => {
    onboardingSchemaPromise = null
    throw error
  })
  return onboardingSchemaPromise
}

async function schoolEligibility(accountId: bigint) {
  const rows = await prisma.$queryRaw<Array<{ id: bigint }>>(Prisma.sql`
    SELECT ss.id
    FROM school_students ss
    JOIN school_accounts sc ON sc.id = ss.school_id
    WHERE ss.account_id = ${accountId}
      AND ss.status = 'active'
      AND sc.status = 'active'
    LIMIT 1
  `).catch(() => [])
  return rows.length
    ? { status: "ineligible_school_student", reason: "School-linked students cannot be affiliates." }
    : { status: "eligible", reason: null }
}

async function createAccountIfMissing(input: { fullName: string; email: string; phone: string; password: string }) {
  const existing = await prisma.studentAccount.findUnique({ where: { email: input.email } })
  if (existing) return { account: existing, created: false }
  const salt = crypto.randomBytes(16).toString("hex")
  const now = new Date()
  try {
    const account = await prisma.studentAccount.create({
      data: {
        accountUuid: `sa_${randomUUID().replace(/-/g, "")}`,
        fullName: input.fullName,
        email: input.email,
        passwordHash: hashPassword(input.password, salt),
        passwordSalt: salt,
        mustResetPassword: false,
        phoneE164: input.phone,
        createdAt: now,
        updatedAt: now
      }
    })
    return { account, created: true }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const account = await prisma.studentAccount.findUnique({ where: { email: input.email } })
      if (account) return { account, created: false }
    }
    throw error
  }
}

export async function registerPublicAffiliate(input: {
  fullName: string
  email: string
  phone: string
  password: string
  acceptedTerms: boolean
}) {
  await ensurePublicAffiliateOnboardingSchema()
  const fullName = clean(input.fullName, 180)
  const email = normalizeStudentEmail(input.email)
  const phone = normalizeNigeriaPhone(input.phone)
  const password = String(input.password || "")
  if (fullName.length < 2) throw new Error("Enter your full name.")
  if (!email) throw new Error("Enter a valid email address.")
  if (!phone) throw new Error("Enter a valid Nigerian phone number.")
  if (password.length < 12) throw new Error("Password must be at least 12 characters.")
  if (!input.acceptedTerms) throw new Error("Accept the Affiliate Partner Agreement to continue.")

  const { account, created } = await createAccountIfMissing({ fullName, email, phone, password })
  if (!created && !account.phoneE164) {
    await prisma.studentAccount.updateMany({ where: { id: account.id, phoneE164: null }, data: { phoneE164: phone, updatedAt: new Date() } })
  }

  const existing = await prisma.$queryRaw<Array<{ id: bigint; status: string; onboardingSource: string | null }>>(Prisma.sql`
    SELECT id, status, onboarding_source AS onboardingSource
    FROM tochukwu_affiliate_profiles
    WHERE account_id = ${account.id}
    LIMIT 1
  `)
  if (existing[0] && existing[0].status !== "pending_verification") {
    await recordAffiliateAudit({
      eventType: "public_registration_existing_profile",
      actorType: "public",
      actorId: account.accountUuid,
      targetType: "affiliate_profile",
      targetId: String(existing[0].id),
      metadata: { onboardingSource: existing[0].onboardingSource, status: existing[0].status }
    })
    return { email, alreadyRegistered: true }
  }

  const rawToken = crypto.randomBytes(48).toString("base64url")
  const verificationHash = tokenHash(rawToken)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + VERIFICATION_TTL_MS)
  const eligibility = await schoolEligibility(account.id)
  let profileId = existing[0]?.id || null

  if (profileId) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE tochukwu_affiliate_profiles
      SET verification_token_hash = ${verificationHash}, verification_expires_at = ${expiresAt},
          terms_accepted_at = ${now}, terms_version = ${PUBLIC_AFFILIATE_TERMS_VERSION},
          eligibility_status = ${eligibility.status}, eligibility_reason = ${eligibility.reason}, updated_at = ${now}
      WHERE id = ${profileId}
      LIMIT 1
    `)
  } else {
    for (let attempt = 0; attempt < 10 && !profileId; attempt += 1) {
      const code = randomAffiliateCode()
      try {
        await prisma.$executeRaw(Prisma.sql`
          INSERT INTO tochukwu_affiliate_profiles
            (profile_uuid, account_id, affiliate_code, status, eligibility_status, eligibility_reason,
             country_code, payout_currency, payout_provider, onboarding_source, terms_accepted_at, terms_version,
             verification_token_hash, verification_expires_at, created_at, updated_at)
          VALUES
            (${`aff_${randomUUID().replace(/-/g, "")}`}, ${account.id}, ${code}, 'pending_verification',
             ${eligibility.status}, ${eligibility.reason}, 'NG', 'NGN', 'paystack', 'public_registration',
             ${now}, ${PUBLIC_AFFILIATE_TERMS_VERSION}, ${verificationHash}, ${expiresAt}, ${now}, ${now})
        `)
        const inserted = await prisma.$queryRaw<Array<{ id: bigint }>>(Prisma.sql`
          SELECT id FROM tochukwu_affiliate_profiles WHERE account_id = ${account.id} LIMIT 1
        `)
        profileId = inserted[0]?.id || null
      } catch (error) {
        const concurrent = await prisma.$queryRaw<Array<{ id: bigint }>>(Prisma.sql`
          SELECT id FROM tochukwu_affiliate_profiles WHERE account_id = ${account.id} LIMIT 1
        `).catch(() => [])
        if (concurrent[0]) profileId = concurrent[0].id
        else if (attempt === 9) throw error
      }
    }
  }
  if (!profileId) throw new Error("Your affiliate registration could not be prepared. Please try again.")

  await recordAffiliateAudit({
    eventType: "public_registration_submitted",
    actorType: "public",
    actorId: account.accountUuid,
    targetType: "affiliate_profile",
    targetId: String(profileId),
    metadata: { accountCreated: created, termsVersion: PUBLIC_AFFILIATE_TERMS_VERSION }
  })

  const links = publicActionLinkVariants(`/affiliate/activate?token=${encodeURIComponent(rawToken)}`)
  const greeting = escapeHtml(account.fullName || fullName)
  const primaryLink = escapeHtml(links.primary)
  const alternativeLink = escapeHtml(links.alternative)
  const delivery = await sendEmail({
    to: email,
    subject: "Confirm Your Affiliate Partner Account",
    html: [
      `<p>Hello ${greeting},</p>`,
      "<p>Confirm your email address to activate your affiliate partner account and referral code.</p>",
      `<p><a href="${primaryLink}" style="display:inline-block;border-radius:8px;background:#0d4f9a;color:#ffffff;padding:12px 18px;text-decoration:none;font-weight:700;">Activate affiliate account</a></p>`,
      `<p><strong>Alternative link:</strong><br/><a href="${alternativeLink}">${alternativeLink}</a></p>`,
      "<p>This secure link expires in 24 hours. If you did not request this account, you can ignore this email.</p>"
    ].join("\n"),
    text: [
      `Hello ${account.fullName || fullName},`, "", "Confirm your email address to activate your affiliate partner account:",
      links.primary, "", `Alternative link: ${links.alternative}`, "", "This secure link expires in 24 hours."
    ].join("\n")
  })
  if (!delivery.ok) throw new Error("The verification email could not be sent. Please try again shortly.")
  return { email, alreadyRegistered: false }
}

export async function getPublicAffiliateActivation(token: string) {
  const hash = tokenHash(clean(token, 500))
  if (!token) return null
  let rows: Array<{ profileId: bigint; fullName: string; email: string; expiresAt: Date }> = []
  try {
    rows = await prisma.$queryRaw(Prisma.sql`
      SELECT p.id AS profileId, a.full_name AS fullName, a.email, p.verification_expires_at AS expiresAt
      FROM tochukwu_affiliate_profiles p
      JOIN student_accounts a ON a.id = p.account_id
      WHERE p.verification_token_hash = ${hash}
        AND p.status = 'pending_verification'
        AND p.verification_expires_at > NOW()
      LIMIT 1
    `)
  } catch (error) {
    if (!missingOnboardingColumn(error)) throw error
  }
  return rows[0] || null
}

export async function activatePublicAffiliate(token: string) {
  await ensurePublicAffiliateOnboardingSchema()
  const hash = tokenHash(clean(token, 500))
  if (!token) throw new Error("This activation link is invalid or has expired.")
  const rows = await prisma.$queryRaw<Array<{ profileId: bigint; accountId: bigint }>>(Prisma.sql`
    SELECT id AS profileId, account_id AS accountId
    FROM tochukwu_affiliate_profiles
    WHERE verification_token_hash = ${hash}
      AND status = 'pending_verification'
      AND verification_expires_at > NOW()
    LIMIT 1
  `)
  const pending = rows[0]
  if (!pending) throw new Error("This activation link is invalid or has expired.")
  const eligibility = await schoolEligibility(pending.accountId)
  const now = new Date()
  const updated = await prisma.$executeRaw(Prisma.sql`
    UPDATE tochukwu_affiliate_profiles
    SET status = 'active', eligibility_status = ${eligibility.status}, eligibility_reason = ${eligibility.reason},
        email_verified_at = ${now}, activated_at = ${now}, verification_token_hash = NULL,
        verification_expires_at = NULL, updated_at = ${now}
    WHERE id = ${pending.profileId}
      AND verification_token_hash = ${hash}
      AND status = 'pending_verification'
    LIMIT 1
  `)
  if (!updated) throw new Error("This activation link has already been used.")
  const account = await prisma.studentAccount.findUnique({ where: { id: pending.accountId } })
  if (!account) throw new Error("The account connected to this activation link was not found.")
  await recordAffiliateAudit({
    eventType: "public_registration_activated",
    actorType: "affiliate",
    actorId: account.accountUuid,
    targetType: "affiliate_profile",
    targetId: String(pending.profileId),
    metadata: { eligibilityStatus: eligibility.status, termsVersion: PUBLIC_AFFILIATE_TERMS_VERSION }
  })
  return account
}

export async function listPublicAffiliateCourseRules() {
  const rows = await prisma.$queryRaw<Array<{
    courseSlug: string
    commissionType: string
    commissionValue: number | bigint
    commissionCurrency: string
    holdDays: number | bigint
  }>>(Prisma.sql`
    SELECT course_slug AS courseSlug, commission_type AS commissionType, commission_value AS commissionValue,
      commission_currency AS commissionCurrency, hold_days AS holdDays
    FROM tochukwu_affiliate_course_rules
    WHERE is_affiliate_eligible = 1
      AND (starts_at IS NULL OR starts_at <= NOW())
      AND (ends_at IS NULL OR ends_at >= NOW())
    ORDER BY course_slug ASC
  `).catch(() => [])
  return rows.map((row) => ({ ...row, commissionValue: Number(row.commissionValue || 0), holdDays: Number(row.holdDays || 0) }))
}

export async function isPublicAffiliateOnlyAccount(accountId: bigint) {
  let rows: Array<{ affiliateOnly: number | bigint | boolean }> = []
  try {
    rows = await prisma.$queryRaw(Prisma.sql`
      SELECT (
        EXISTS (
          SELECT 1 FROM tochukwu_affiliate_profiles p
          WHERE p.account_id = ${accountId} AND p.onboarding_source = 'public_registration'
        ) AND NOT EXISTS (
          SELECT 1 FROM course_orders co
          JOIN student_accounts sa
            ON LOWER(sa.email) COLLATE utf8mb4_unicode_ci = LOWER(co.email) COLLATE utf8mb4_unicode_ci
          WHERE sa.id = ${accountId} AND co.status = 'paid'
        ) AND NOT EXISTS (
          SELECT 1 FROM course_manual_payments cmp
          JOIN student_accounts sa
            ON LOWER(sa.email) COLLATE utf8mb4_unicode_ci = LOWER(cmp.email) COLLATE utf8mb4_unicode_ci
          WHERE sa.id = ${accountId} AND cmp.status IN ('approved', 'paid')
        ) AND NOT EXISTS (
          SELECT 1 FROM school_students ss WHERE ss.account_id = ${accountId} AND ss.status = 'active'
        ) AND NOT EXISTS (
          SELECT 1 FROM family_children fc WHERE fc.account_id = ${accountId} AND fc.status = 'active'
        )
      ) AS affiliateOnly
    `)
  } catch (error) {
    if (!missingOnboardingColumn(error)) throw error
  }
  return Boolean(Number(rows[0]?.affiliateOnly || 0))
}

export async function updateAffiliateProfileAccess(formData: FormData, actor: string) {
  await ensurePublicAffiliateOnboardingSchema()
  const profileId = BigInt(clean(formData.get("profileId"), 30) || "0")
  const status = clean(formData.get("status"), 30).toLowerCase()
  const eligibilityStatus = clean(formData.get("eligibilityStatus"), 40).toLowerCase()
  const reason = clean(formData.get("reason"), 190)
  if (profileId <= BigInt(0)) throw new Error("Affiliate profile is required.")
  if (!['active', 'suspended'].includes(status)) throw new Error("Select a valid affiliate status.")
  if (!['eligible', 'ineligible_manual'].includes(eligibilityStatus)) throw new Error("Select a valid eligibility status.")
  const profiles = await prisma.$queryRaw<Array<{ accountId: bigint }>>(Prisma.sql`
    SELECT account_id AS accountId FROM tochukwu_affiliate_profiles WHERE id = ${profileId} LIMIT 1
  `)
  if (!profiles[0]) throw new Error("Affiliate profile was not found.")
  const school = await schoolEligibility(profiles[0].accountId)
  const finalEligibility = school.status === "ineligible_school_student" ? school.status : eligibilityStatus
  const finalReason = school.reason || (eligibilityStatus === "ineligible_manual" ? reason || "Manually marked ineligible by an administrator." : null)
  const now = new Date()
  await prisma.$executeRaw(Prisma.sql`
    UPDATE tochukwu_affiliate_profiles
    SET status = ${status}, eligibility_status = ${finalEligibility}, eligibility_reason = ${finalReason},
        blocked_at = ${status === "suspended" ? now : null}, updated_at = ${now}
    WHERE id = ${profileId}
    LIMIT 1
  `)
  await recordAffiliateAudit({
    eventType: "affiliate_access_updated",
    actorType: "admin",
    actorId: actor,
    targetType: "affiliate_profile",
    targetId: String(profileId),
    metadata: { status, eligibilityStatus: finalEligibility, reason: finalReason }
  })
}
