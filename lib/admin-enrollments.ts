import crypto from "crypto"

import { configuredLearningCourseSlugSql, dayLevelCourseSlugRegex } from "@/lib/learning-course-catalog"
import { prisma } from "@/lib/prisma"
import {
  checkoutContext,
  createManualPayment,
  findOrCreateStudentAccount,
  normalizeEmail,
  siteBaseUrl,
  upsertWhatsAppContact
} from "@/lib/payments/course-checkout"
import { reviewManualPayment } from "@/lib/payments/manual-payment-review"
import { createStudentPasswordResetToken } from "@/lib/student-auth"
import { sendEmail } from "@/lib/email"
import { addColumnIfMissing } from "@/lib/schema-guards"

export type EnrollmentPaymentRow = {
  paymentUuid: string
  courseSlug: string
  batchKey: string | null
  batchLabel: string | null
  firstName: string | null
  email: string | null
  phone: string | null
  country: string | null
  currency: string | null
  amountMinor: number
  baseAmountMinor: number
  discountMinor: number
  couponCode: string | null
  buyerType: string | null
  seatCount: number
  transferReference: string | null
  proofUrl: string | null
  proofPublicId: string | null
  status: string | null
  source: "manual" | "online"
  providerLabel: string
  reviewNote: string | null
  reviewedBy: string | null
  reviewedAt: Date | null
  metaPurchaseSent: boolean
  metaPurchaseSentAt: Date | null
  recoveryOrigin: boolean
  createdAt: Date | null
}

export type EnrollmentCourseOption = {
  slug: string
  label: string
  enrollmentMode: "batch" | "immediate"
}

export type EnrollmentBatchOption = {
  courseSlug: string
  batchKey: string
  batchLabel: string
  status: string
  isActive: boolean
  seatLimit: number | null
  enrolledCount: number
  remainingSeats: number | null
  batchStartAt: Date | null
}

export type HolidayWaitlistContact = {
  id: number
  email: string
  fullName: string
  phone: string
  optedIn: boolean
  createdAt: Date | null
  updatedAt: Date | null
}

export type WhatsAppContact = {
  id: number
  email: string | null
  fullName: string | null
  phone: string
  courseSlug: string | null
  source: string | null
  optedIn: boolean
  optedInAt: Date | null
  optedOutAt: Date | null
  updatedAt: Date | null
}

export type WhatsAppCampaignRow = {
  campaignUuid: string
  campaignName: string
  audienceCourseSlug: string | null
  messageText: string | null
  recipientCount: number
  n8nStatus: string | null
  n8nError: string | null
  createdBy: string | null
  createdAt: Date | null
}

export type OnboardingEmailResult = {
  total: number
  sent: number
  failed: number
  createdAccounts: number
  runId: string | null
  failures: Array<{ email: string; message: string }>
}

export type OnboardingEmailFailureRow = {
  runId: string
  courseSlug: string | null
  batchKey: string | null
  batchLabel: string | null
  email: string
  message: string
  createdAt: Date | null
}

export type EnrollmentProviderCounts = {
  manual: number
  paystack: number
  stripe: number
  paypal: number
  other: number
}

export type EnrollmentDashboardSummary = {
  courseSlug: string
  courseName: string
  batchKey: string
  batchLabel: string
  registrationStatus: string
  totalStudents: number
  totalRegistrations: number
  totalPayments: number
  actualEnrollments: number
  paidApprovedCount: number
  totalsByCurrency: Record<string, number>
  providerCounts: EnrollmentProviderCounts
  manualPendingCount: number
  availableBatches: EnrollmentBatchOption[]
}

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function normalizeCourse(value: unknown) {
  const slug = clean(value, 120).toLowerCase()
  if (slug === "prompt-to-profit-advanced") return "prompt-to-production"
  return slug
}

function toInt(value: unknown, fallback = 0) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? Math.round(numberValue) : fallback
}

async function ensureManualPaymentReviewColumns() {
  await addColumnIfMissing("course_manual_payments", "meta_purchase_sent", "TINYINT(1) NOT NULL DEFAULT 0")
  await addColumnIfMissing("course_manual_payments", "meta_purchase_sent_at", "DATETIME NULL")
  await addColumnIfMissing("course_manual_payments", "proof_public_id", "VARCHAR(255) NULL")
  await addColumnIfMissing("course_manual_payments", "base_amount_minor", "INT NULL")
  await addColumnIfMissing("course_manual_payments", "discount_minor", "INT NOT NULL DEFAULT 0")
  await addColumnIfMissing("course_manual_payments", "coupon_code", "VARCHAR(80) NULL")
  await addColumnIfMissing("course_manual_payments", "coupon_id", "BIGINT NULL")
  await addColumnIfMissing("course_manual_payments", "buyer_type", "VARCHAR(40) NOT NULL DEFAULT 'student'")
  await addColumnIfMissing("course_manual_payments", "seat_count", "INT NOT NULL DEFAULT 1")
  await addColumnIfMissing("course_manual_payments", "recovery_origin", "TINYINT(1) NOT NULL DEFAULT 0")
}

async function ensureWhatsAppMarketingTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_whatsapp_contacts (
      id BIGINT NOT NULL AUTO_INCREMENT,
      student_account_id BIGINT NULL,
      email VARCHAR(190) NULL,
      full_name VARCHAR(180) NULL,
      phone_e164 VARCHAR(20) NOT NULL,
      course_slug VARCHAR(120) NULL,
      source VARCHAR(80) NULL,
      whatsapp_opted_in TINYINT(1) NOT NULL DEFAULT 0,
      whatsapp_opted_in_at DATETIME NULL,
      whatsapp_opted_out_at DATETIME NULL,
      opt_in_version VARCHAR(80) NULL,
      opt_in_source_url VARCHAR(500) NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_whatsapp_phone (phone_e164),
      KEY idx_tochukwu_whatsapp_email (email),
      KEY idx_tochukwu_whatsapp_optin (whatsapp_opted_in, updated_at),
      KEY idx_tochukwu_whatsapp_course (course_slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_whatsapp_campaigns (
      id BIGINT NOT NULL AUTO_INCREMENT,
      campaign_uuid VARCHAR(64) NOT NULL,
      campaign_name VARCHAR(180) NOT NULL,
      audience_course_slug VARCHAR(120) NULL,
      message_text TEXT NOT NULL,
      recipient_count INT NOT NULL DEFAULT 0,
      n8n_status VARCHAR(30) NOT NULL DEFAULT 'pending',
      n8n_error VARCHAR(500) NULL,
      created_by VARCHAR(190) NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_whatsapp_campaign_uuid (campaign_uuid),
      KEY idx_tochukwu_whatsapp_campaign_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

async function ensureWhatsAppWaitlistTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_wa_waitlist_contacts (
      id BIGINT NOT NULL AUTO_INCREMENT,
      email VARCHAR(190) NOT NULL,
      full_name VARCHAR(180) NOT NULL,
      phone_e164 VARCHAR(20) NOT NULL,
      opted_in TINYINT(1) NOT NULL DEFAULT 1,
      opted_in_at DATETIME NULL,
      opted_out_at DATETIME NULL,
      opt_in_version VARCHAR(80) NULL,
      opt_in_source_url VARCHAR(500) NULL,
      opt_in_ip VARCHAR(80) NULL,
      opt_in_user_agent VARCHAR(255) NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_wa_waitlist_phone (phone_e164),
      KEY idx_tochukwu_wa_waitlist_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_wa_waitlist_queue (
      id BIGINT NOT NULL AUTO_INCREMENT,
      phone_e164 VARCHAR(20) NOT NULL,
      template_name VARCHAR(120) NOT NULL,
      template_language VARCHAR(20) NOT NULL DEFAULT 'en',
      template_params_json TEXT NULL,
      due_at DATETIME NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      attempts INT NOT NULL DEFAULT 0,
      sent_at DATETIME NULL,
      last_error VARCHAR(500) NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      KEY idx_tochukwu_wa_waitlist_queue_status_due (status, due_at),
      KEY idx_tochukwu_wa_waitlist_queue_phone (phone_e164)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

async function ensureOnboardingEmailRunTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_onboarding_email_runs (
      id BIGINT NOT NULL AUTO_INCREMENT,
      run_uuid VARCHAR(64) NOT NULL,
      mode VARCHAR(20) NOT NULL,
      course_slug VARCHAR(120) NULL,
      batch_key VARCHAR(80) NULL,
      batch_label VARCHAR(120) NULL,
      email_subject VARCHAR(220) NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'running',
      total_targets INT NOT NULL DEFAULT 0,
      processed_count INT NOT NULL DEFAULT 0,
      sent_count INT NOT NULL DEFAULT 0,
      failed_count INT NOT NULL DEFAULT 0,
      created_accounts INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      completed_at DATETIME NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_onboarding_email_run_uuid (run_uuid),
      KEY idx_onboarding_email_runs_scope (course_slug, batch_key, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_onboarding_email_run_items (
      id BIGINT NOT NULL AUTO_INCREMENT,
      run_uuid VARCHAR(64) NOT NULL,
      email VARCHAR(220) NOT NULL,
      full_name VARCHAR(180) NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      error_message VARCHAR(500) NULL,
      created_account TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      processed_at DATETIME NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_onboarding_email_run_item (run_uuid, email),
      KEY idx_onboarding_email_items_status (run_uuid, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

export async function listEnrollmentCourses(): Promise<EnrollmentCourseOption[]> {
  const rows = await prisma.$queryRaw<Array<{ slug: string; title: string | null; enrollmentMode: string | null }>>`
    SELECT course_slug AS slug, course_title AS title, enrollment_mode AS enrollmentMode
    FROM tochukwu_learning_courses
    WHERE (is_published = 1 OR status = 'published' OR status = 'active')
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
    ORDER BY course_title ASC
  `.catch(() => [])

  const fallback = [
    { slug: "prompt-to-profit", label: "Prompt to Profit", enrollmentMode: "batch" as const },
    { slug: "prompt-to-profit-holiday", label: "Prompt to Profit Holiday", enrollmentMode: "batch" as const },
    { slug: "prompt-to-production", label: "Prompt to Profit Advanced", enrollmentMode: "batch" as const },
    { slug: "ai-for-everyday-business-owners", label: "AI for Everyday Business Owners", enrollmentMode: "immediate" as const },
    { slug: "prompt-to-profit-schools", label: "Prompt to Profit for Schools", enrollmentMode: "batch" as const }
  ]
  const mapped = rows.map((row) => ({
    slug: normalizeCourse(row.slug),
    label: clean(row.title || row.slug, 180),
    enrollmentMode: clean(row.enrollmentMode, 40).toLowerCase() === "immediate" ? "immediate" as const : "batch" as const
  })).filter((row) => row.slug)
  const bySlug = new Map<string, EnrollmentCourseOption>()
  for (const item of [...mapped, ...fallback]) {
    if (!bySlug.has(item.slug)) bySlug.set(item.slug, item)
  }
  return Array.from(bySlug.values())
}

async function countEnrolledSeats(courseSlug: string, batchKey: string) {
  const rows = await prisma.$queryRaw<Array<{ total: number | bigint | null }>>`
    SELECT (
      COALESCE((SELECT SUM(CASE WHEN seat_count IS NULL OR seat_count < 1 THEN 1 ELSE seat_count END) FROM course_orders WHERE course_slug = ${courseSlug} AND batch_key = ${batchKey} AND status = 'paid'), 0)
      +
      COALESCE((SELECT SUM(CASE WHEN seat_count IS NULL OR seat_count < 1 THEN 1 ELSE seat_count END) FROM course_manual_payments WHERE course_slug = ${courseSlug} AND batch_key = ${batchKey} AND status = 'approved'), 0)
    ) AS total
  `.catch(() => [{ total: 0 }])
  return toInt(rows[0]?.total)
}

export async function listEnrollmentBatches(courseSlugInput?: string): Promise<EnrollmentBatchOption[]> {
  const courseSlug = normalizeCourse(courseSlugInput)
  const rows = courseSlug
    ? await prisma.$queryRaw<Array<{
        courseSlug: string
        batchKey: string
        batchLabel: string
        status: string | null
        isActive: number | bigint | boolean | null
        seatLimit: number | bigint | null
        batchStartAt: Date | null
      }>>`
        SELECT course_slug AS courseSlug, batch_key AS batchKey, batch_label AS batchLabel, status, is_active AS isActive, seat_limit AS seatLimit, batch_start_at AS batchStartAt
        FROM course_batches
        WHERE course_slug = ${courseSlug}
        ORDER BY is_active DESC, batch_start_at IS NULL ASC, batch_start_at ASC, created_at DESC
      `.catch(() => [])
    : await prisma.$queryRaw<Array<{
        courseSlug: string
        batchKey: string
        batchLabel: string
        status: string | null
        isActive: number | bigint | boolean | null
        seatLimit: number | bigint | null
        batchStartAt: Date | null
      }>>`
        SELECT course_slug AS courseSlug, batch_key AS batchKey, batch_label AS batchLabel, status, is_active AS isActive, seat_limit AS seatLimit, batch_start_at AS batchStartAt
        FROM course_batches
        ORDER BY course_slug ASC, is_active DESC, batch_start_at IS NULL ASC, batch_start_at ASC, created_at DESC
      `.catch(() => [])

  const out: EnrollmentBatchOption[] = []
  for (const row of rows) {
    const enrolledCount = await countEnrolledSeats(row.courseSlug, row.batchKey)
    const seatLimit = row.seatLimit === null || row.seatLimit === undefined ? null : Math.max(0, toInt(row.seatLimit))
    out.push({
      courseSlug: row.courseSlug,
      batchKey: row.batchKey,
      batchLabel: row.batchLabel,
      status: row.status || "open",
      isActive: Boolean(Number(row.isActive || 0)),
      seatLimit,
      enrolledCount,
      remainingSeats: seatLimit === null ? null : Math.max(0, seatLimit - enrolledCount),
      batchStartAt: row.batchStartAt
    })
  }
  return out
}

export async function listEnrollmentPayments(input: {
  courseSlug?: string
  status?: string
  batchKey?: string
  search?: string
  limit?: number
}) {
  await ensureManualPaymentReviewColumns()
  const courseSlug = normalizeCourse(input.courseSlug) || "all"
  const status = clean(input.status, 40) || "all"
  const batchKey = clean(input.batchKey, 80) || "all"
  const search = clean(input.search, 120)
  const searchPattern = `%${search}%`
  const limit = Math.max(20, Math.min(300, toInt(input.limit, 100)))

  const [manualRows, onlineRows] = await Promise.all([
    prisma.$queryRaw<EnrollmentPaymentRow[]>`
    SELECT
      payment_uuid AS paymentUuid,
      course_slug AS courseSlug,
      batch_key AS batchKey,
      batch_label AS batchLabel,
      first_name AS firstName,
      email,
      phone,
      country,
      currency,
      amount_minor AS amountMinor,
      COALESCE(base_amount_minor, amount_minor) AS baseAmountMinor,
      COALESCE(discount_minor, 0) AS discountMinor,
      coupon_code AS couponCode,
      buyer_type AS buyerType,
      COALESCE(seat_count, 1) AS seatCount,
      transfer_reference AS transferReference,
      proof_url AS proofUrl,
      proof_public_id AS proofPublicId,
      status,
      'manual' AS source,
      'Manual' AS providerLabel,
      review_note AS reviewNote,
      reviewed_by AS reviewedBy,
      reviewed_at AS reviewedAt,
      COALESCE(meta_purchase_sent, 0) AS metaPurchaseSent,
      meta_purchase_sent_at AS metaPurchaseSentAt,
      COALESCE(recovery_origin, 0) AS recoveryOrigin,
      created_at AS createdAt
    FROM course_manual_payments
    WHERE (
        ${status} = 'all'
        OR (${status} = 'pending_verification' AND status IN ('pending_verification', 'recovery_required'))
        OR status = ${status}
      )
      AND (status = 'recovery_required' OR COALESCE(recovery_origin, 0) = 1 OR ${courseSlug} = 'all' OR course_slug = ${courseSlug})
      AND (status = 'recovery_required' OR COALESCE(recovery_origin, 0) = 1 OR ${batchKey} = 'all' OR COALESCE(batch_key, '') = ${batchKey})
      AND (
        status = 'recovery_required'
        OR COALESCE(recovery_origin, 0) = 1
        OR ${search} = ''
        OR first_name LIKE ${searchPattern}
        OR email LIKE ${searchPattern}
        OR phone LIKE ${searchPattern}
        OR transfer_reference LIKE ${searchPattern}
        OR payment_uuid LIKE ${searchPattern}
      )
    ORDER BY created_at DESC
    LIMIT ${limit}
  `,
    prisma.$queryRaw<EnrollmentPaymentRow[]>`
      SELECT
        order_uuid AS paymentUuid,
        course_slug AS courseSlug,
        batch_key AS batchKey,
        batch_label AS batchLabel,
        first_name AS firstName,
        email,
        phone,
        country,
        currency,
        COALESCE(final_amount_minor, amount_minor, 0) AS amountMinor,
        COALESCE(base_amount_minor, amount_minor, 0) AS baseAmountMinor,
        COALESCE(discount_minor, 0) AS discountMinor,
        coupon_code AS couponCode,
        buyer_type AS buyerType,
        COALESCE(seat_count, 1) AS seatCount,
        provider_reference AS transferReference,
        NULL AS proofUrl,
        NULL AS proofPublicId,
        'approved' AS status,
        'online' AS source,
        UPPER(COALESCE(provider, 'Online')) AS providerLabel,
        'Automatically verified by payment provider' AS reviewNote,
        UPPER(COALESCE(provider, 'Online')) AS reviewedBy,
        COALESCE(paid_at, updated_at, created_at) AS reviewedAt,
        0 AS metaPurchaseSent,
        NULL AS metaPurchaseSentAt,
        0 AS recoveryOrigin,
        created_at AS createdAt
      FROM course_orders
      WHERE status = 'paid'
        AND (${courseSlug} = 'all' OR course_slug = ${courseSlug})
        AND (${status} IN ('all', 'approved', 'paid'))
        AND (${batchKey} = 'all' OR COALESCE(batch_key, '') = ${batchKey})
        AND (
          ${search} = ''
          OR first_name LIKE ${searchPattern}
          OR email LIKE ${searchPattern}
          OR phone LIKE ${searchPattern}
          OR provider_reference LIKE ${searchPattern}
          OR order_uuid LIKE ${searchPattern}
          OR provider LIKE ${searchPattern}
        )
      ORDER BY created_at DESC
      LIMIT ${limit}
    `
  ])

  return [...manualRows, ...onlineRows]
    .sort((left, right) => {
      const leftRecovery = left.status === "recovery_required"
        || Boolean(Number(left.recoveryOrigin || 0))
      const rightRecovery = right.status === "recovery_required"
        || Boolean(Number(right.recoveryOrigin || 0))
      if (leftRecovery !== rightRecovery) return leftRecovery ? -1 : 1
      return (right.createdAt?.getTime() || 0) - (left.createdAt?.getTime() || 0)
    })
    .slice(0, limit)
    .map((row) => ({
      ...row,
      amountMinor: toInt(row.amountMinor),
      baseAmountMinor: toInt(row.baseAmountMinor),
      discountMinor: toInt(row.discountMinor),
      seatCount: Math.max(1, toInt(row.seatCount, 1)),
      metaPurchaseSent: Boolean(Number(row.metaPurchaseSent || 0)),
      recoveryOrigin: Boolean(Number(row.recoveryOrigin || 0))
    }))
}

export async function enrollmentSummary(courseSlugInput?: string, batchKeyInput?: string) {
  await ensureManualPaymentReviewColumns()
  const courseSlug = normalizeCourse(courseSlugInput) || "all"
  const batchKey = clean(batchKeyInput, 80) || "all"
  const rows = await prisma.$queryRaw<Array<{ status: string | null; count: number | bigint | null; totalMinor: number | bigint | null; students: number | bigint | null }>>`
    SELECT
      status,
      COALESCE(SUM(records), 0) AS count,
      COALESCE(SUM(total_minor), 0) AS totalMinor,
      COALESCE(SUM(seats), 0) AS students
    FROM (
      SELECT
        status,
        1 AS records,
        CASE WHEN UPPER(COALESCE(currency, 'NGN')) = 'NGN' THEN amount_minor ELSE 0 END AS total_minor,
        CASE WHEN seat_count IS NULL OR seat_count < 1 THEN 1 ELSE seat_count END AS seats
      FROM course_manual_payments
      WHERE (${courseSlug} = 'all' OR course_slug = ${courseSlug})
        AND (${batchKey} = 'all' OR COALESCE(batch_key, '') = ${batchKey})

      UNION ALL

      SELECT
        'approved' AS status,
        1 AS records,
        CASE WHEN UPPER(COALESCE(currency, 'NGN')) = 'NGN' THEN COALESCE(final_amount_minor, amount_minor, 0) ELSE 0 END AS total_minor,
        CASE WHEN seat_count IS NULL OR seat_count < 1 THEN 1 ELSE seat_count END AS seats
      FROM course_orders
      WHERE status = 'paid'
        AND (${courseSlug} = 'all' OR course_slug = ${courseSlug})
        AND (${batchKey} = 'all' OR COALESCE(batch_key, '') = ${batchKey})
    ) enrollment_rows
    GROUP BY status
  `.catch(() => [])
  return rows.map((row) => ({
    status: row.status || "unknown",
    count: toInt(row.count),
    students: toInt(row.students),
    totalMinor: toInt(row.totalMinor)
  }))
}

export async function enrollmentDashboardSummary(courseSlugInput?: string, batchKeyInput?: string): Promise<EnrollmentDashboardSummary> {
  await ensureManualPaymentReviewColumns()
  const rawCourseSlug = normalizeCourse(courseSlugInput) || "all"
  const includeAllCourses = rawCourseSlug === "all"
  const courseSlug = includeAllCourses ? "all" : rawCourseSlug
  const desiredBatchKey = clean(batchKeyInput, 80) || "all"
  const scopedBatch = !includeAllCourses && desiredBatchKey !== "all" ? desiredBatchKey : ""

  const [courses, availableBatches, manualApprovedRows, manualPendingRows, manualAllRows, paidOrderRows] = await Promise.all([
    listEnrollmentCourses(),
    includeAllCourses ? Promise.resolve([]) : listEnrollmentBatches(courseSlug),
    prisma.$queryRaw<Array<{ currency: string | null; count: number | bigint | null; totalMinor: number | bigint | null; seats: number | bigint | null }>>`
      SELECT
        currency,
        COUNT(*) AS count,
        COALESCE(SUM(amount_minor), 0) AS totalMinor,
        COALESCE(SUM(CASE WHEN seat_count IS NULL OR seat_count < 1 THEN 1 ELSE seat_count END), 0) AS seats
      FROM course_manual_payments
      WHERE (${includeAllCourses ? 1 : 0} = 1 OR course_slug = ${courseSlug})
        AND status = 'approved'
        AND (${scopedBatch || "all"} = 'all' OR COALESCE(batch_key, '') = ${scopedBatch})
      GROUP BY currency
    `.catch(() => []),
    prisma.$queryRaw<Array<{ count: number | bigint | null }>>`
      SELECT COUNT(*) AS count
      FROM course_manual_payments
      WHERE (${includeAllCourses ? 1 : 0} = 1 OR course_slug = ${courseSlug})
        AND status IN ('pending_verification', 'recovery_required')
        AND (${scopedBatch || "all"} = 'all' OR COALESCE(batch_key, '') = ${scopedBatch})
    `.catch(() => [{ count: 0 }]),
    prisma.$queryRaw<Array<{ count: number | bigint | null }>>`
      SELECT COUNT(*) AS count
      FROM course_manual_payments
      WHERE (${includeAllCourses ? 1 : 0} = 1 OR course_slug = ${courseSlug})
        AND (${scopedBatch || "all"} = 'all' OR COALESCE(batch_key, '') = ${scopedBatch})
    `.catch(() => [{ count: 0 }]),
    prisma.$queryRaw<Array<{ currency: string | null; provider: string | null; count: number | bigint | null; totalMinor: number | bigint | null; seats: number | bigint | null }>>`
      SELECT
        currency,
        provider,
        COUNT(*) AS count,
        COALESCE(SUM(COALESCE(final_amount_minor, amount_minor, 0)), 0) AS totalMinor,
        COALESCE(SUM(CASE WHEN seat_count IS NULL OR seat_count < 1 THEN 1 ELSE seat_count END), 0) AS seats
      FROM course_orders
      WHERE status = 'paid'
        AND (${includeAllCourses ? 1 : 0} = 1 OR course_slug = ${courseSlug})
        AND (${scopedBatch || "all"} = 'all' OR COALESCE(batch_key, '') = ${scopedBatch})
        AND (provider IS NULL OR provider NOT IN ('wallet_installment', 'wallet'))
      GROUP BY currency, provider
    `.catch(() => [])
  ])

  const totalsByCurrency: Record<string, number> = {}
  const providerCounts: EnrollmentProviderCounts = { manual: 0, paystack: 0, stripe: 0, paypal: 0, other: 0 }
  let paidApprovedCount = 0
  let paidOrderCount = 0
  let actualEnrollments = 0

  for (const row of manualApprovedRows) {
    const currency = clean(row.currency || "NGN", 12).toUpperCase() || "NGN"
    const count = toInt(row.count)
    const totalMinor = toInt(row.totalMinor)
    const seats = toInt(row.seats, count)
    totalsByCurrency[currency] = (totalsByCurrency[currency] || 0) + totalMinor
    providerCounts.manual += count
    paidApprovedCount += count
    actualEnrollments += seats
  }

  for (const row of paidOrderRows) {
    const currency = clean(row.currency || "NGN", 12).toUpperCase() || "NGN"
    const provider = clean(row.provider, 40).toLowerCase()
    const count = toInt(row.count)
    const totalMinor = toInt(row.totalMinor)
    const seats = toInt(row.seats, count)
    totalsByCurrency[currency] = (totalsByCurrency[currency] || 0) + totalMinor
    if (provider === "paystack") providerCounts.paystack += count
    else if (provider === "stripe") providerCounts.stripe += count
    else if (provider === "paypal") providerCounts.paypal += count
    else providerCounts.other += count
    paidOrderCount += count
    paidApprovedCount += count
    actualEnrollments += seats
  }

  const selectedCourse = courses.find((course) => course.slug === courseSlug)
  const selectedBatch = availableBatches.find((batch) => batch.batchKey === scopedBatch)
  const manualPendingCount = toInt(manualPendingRows[0]?.count)
  const manualAllCount = toInt(manualAllRows[0]?.count)

  return {
    courseSlug,
    courseName: includeAllCourses ? "All Courses" : selectedCourse?.label || courseSlug,
    batchKey: includeAllCourses ? "all" : scopedBatch || "all",
    batchLabel: selectedBatch?.batchLabel || "All Batches",
    registrationStatus: includeAllCourses ? "Mixed" : selectedBatch ? (selectedBatch.status.toLowerCase() === "open" ? "Open" : "Closed") : "Mixed",
    totalStudents: actualEnrollments,
    totalRegistrations: manualAllCount + paidOrderCount,
    totalPayments: paidApprovedCount,
    actualEnrollments,
    paidApprovedCount,
    totalsByCurrency,
    providerCounts,
    manualPendingCount,
    availableBatches
  }
}

function normalizePhone(value: unknown) {
  const raw = clean(value, 60).replace(/[^\d+]/g, "")
  if (!raw) return ""
  if (raw.startsWith("+")) return raw
  if (raw.startsWith("0")) return `+234${raw.slice(1)}`
  return `+${raw}`
}

function escapeHtml(value: unknown) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function displayNameFallback(email: string) {
  const local = String(email || "").split("@")[0] || "Student"
  return (
    local
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || "Student"
  )
}

function firstNameFromFullName(fullName: string, email: string) {
  const first = clean(fullName, 180).split(/\s+/).filter(Boolean)[0]
  return first || displayNameFallback(email).split(/\s+/).filter(Boolean)[0] || "Student"
}

function applyActivationTemplate(template: string, vars: Record<string, string>) {
  return String(template || "").replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_all, key) => {
    const name = String(key || "").trim().toLowerCase()
    return Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] || "" : ""
  })
}

function activationEmailBody(input: {
  messageTemplate?: string
  fullName: string
  email: string
  resetLink: string
  vars: Record<string, string>
  createdAccount: boolean
}) {
  const messageTemplate = clean(input.messageTemplate, 8000)
  if (messageTemplate) {
    const text = applyActivationTemplate(messageTemplate, input.vars)
    return {
      text,
      html: `<div>${escapeHtml(text).replace(/\n/g, "<br/>")}</div>`
    }
  }
  if (input.createdAccount) {
    return {
      text: [
        `Hello ${input.fullName || "there"},`,
        "",
        "Your dashboard account has been created.",
        `Email: ${input.email}`,
        "",
        "Please set your password using the secure link below before signing in:",
        input.resetLink
      ].join("\n"),
      html: [
        `<p>Hello ${escapeHtml(input.fullName || "there")},</p>`,
        "<p>Your dashboard account has been created.</p>",
        `<p><strong>Email:</strong> ${escapeHtml(input.email)}</p>`,
        "<p>Please set your password using the secure link below before signing in:</p>",
        `<p><a href="${escapeHtml(input.resetLink)}">${escapeHtml(input.resetLink)}</a></p>`
      ].join("\n")
    }
  }
  return {
    text: [
      `Hello ${input.fullName || "there"},`,
      "",
      "Here is your dashboard password reset link:",
      input.resetLink,
      "",
      "If you can no longer access your email, contact support."
    ].join("\n"),
    html: [
      `<p>Hello ${escapeHtml(input.fullName || "there")},</p>`,
      "<p>Here is your dashboard password reset link:</p>",
      `<p><a href="${escapeHtml(input.resetLink)}">${escapeHtml(input.resetLink)}</a></p>`,
      "<p>If you can no longer access your email, contact support.</p>"
    ].join("\n")
  }
}

async function createOnboardingRun(input: { courseSlug: string; batchKey: string; batchLabel: string; subject: string }) {
  await ensureOnboardingEmailRunTables()
  const now = new Date()
  const runId = `ors_${crypto.randomUUID().replace(/-/g, "")}`
  await prisma.$executeRaw`
    INSERT INTO tochukwu_onboarding_email_runs
      (run_uuid, mode, course_slug, batch_key, batch_label, email_subject, status, created_at, updated_at)
    VALUES (${runId}, 'batch', ${input.courseSlug || null}, ${input.batchKey || null}, ${input.batchLabel || null}, ${input.subject || null}, 'running', ${now}, ${now})
  `
  return runId
}

async function logOnboardingRunItem(input: {
  runId: string
  email: string
  fullName: string
  status: "sent" | "failed"
  errorMessage?: string
  createdAccount?: boolean
}) {
  const now = new Date()
  await prisma.$executeRaw`
    INSERT INTO tochukwu_onboarding_email_run_items
      (run_uuid, email, full_name, status, error_message, created_account, created_at, updated_at, processed_at)
    VALUES (${input.runId}, ${input.email}, ${input.fullName || null}, ${input.status}, ${clean(input.errorMessage, 500) || null}, ${input.createdAccount ? 1 : 0}, ${now}, ${now}, ${now})
    ON DUPLICATE KEY UPDATE
      full_name = VALUES(full_name),
      status = VALUES(status),
      error_message = VALUES(error_message),
      created_account = VALUES(created_account),
      updated_at = VALUES(updated_at),
      processed_at = VALUES(processed_at)
  `
}

async function completeOnboardingRun(runId: string, result: OnboardingEmailResult) {
  const now = new Date()
  await prisma.$executeRaw`
    UPDATE tochukwu_onboarding_email_runs
    SET status = 'completed',
        total_targets = ${result.total},
        processed_count = ${result.sent + result.failed},
        sent_count = ${result.sent},
        failed_count = ${result.failed},
        created_accounts = ${result.createdAccounts},
        updated_at = ${now},
        completed_at = ${now}
    WHERE run_uuid = ${runId}
    LIMIT 1
  `
}

async function sendActivationEmailToStudent(input: {
  email: string
  fullName?: string | null
  courseSlug?: string | null
  batchKey?: string | null
  batchLabel?: string | null
  subject?: string
  messageTemplate?: string
  mode?: "single" | "batch"
}) {
  const email = normalizeEmail(input.email)
  if (!email) throw new Error("A valid student email is required.")
  const providedName = clean(input.fullName, 180)
  const existingAccount = await prisma.studentAccount.findUnique({ where: { email } }).catch(() => null)
  const fullName = providedName || clean(existingAccount?.fullName, 180) || displayNameFallback(email)
  await findOrCreateStudentAccount({ fullName, email })
  const createdAccount = !existingAccount
  const reset = await createStudentPasswordResetToken(email, { neverExpires: true })
  if (!reset?.token) throw new Error("Could not generate password reset token.")
  const resetLink = `${siteBaseUrl()}/dashboard/reset-password?token=${encodeURIComponent(reset.token)}`
  const batchLabel = clean(input.batchLabel, 120) || "Batch"
  const vars = {
    first_name: firstNameFromFullName(fullName, email),
    full_name: fullName,
    email,
    reset_link: resetLink,
    course_slug: clean(input.courseSlug, 120),
    batch_key: clean(input.batchKey, 80),
    batch_label: batchLabel,
    temp_password: ""
  }
  const subject = clean(input.subject, 220) || (
    input.mode === "batch"
      ? `Important: New Password Reset Link for ${batchLabel}`
      : createdAccount ? "Your Dashboard Access (Password Reset Required)" : "Your Dashboard Password Reset Link"
  )
  const body = activationEmailBody({
    messageTemplate: input.messageTemplate,
    fullName,
    email,
    resetLink,
    vars,
    createdAccount
  })
  await sendEmail({ to: email, subject, html: body.html, text: body.text })
  return { email, fullName, createdAccount }
}

export async function addExternalStudentPayment(input: {
  courseSlug: string
  batchKey?: string
  firstName: string
  email: string
  phone: string
  country?: string
  proofUrl?: string
  proofPublicId?: string
  transferReference?: string
  adminNote?: string
  couponCode?: string
  buyerType?: string
  seatCount?: number
  reviewedBy: string
}) {
  const courseSlug = normalizeCourse(input.courseSlug)
  const email = normalizeEmail(input.email)
  const firstName = clean(input.firstName, 180)
  const phone = normalizePhone(input.phone)
  const buyerType = clean(input.buyerType, 40).toLowerCase() === "family" ? "family" : "student"
  const seatCount = buyerType === "family" ? Math.max(2, toInt(input.seatCount, 2)) : 1
  if (!courseSlug || !firstName || !email || !phone) throw new Error("Course, name, valid email, and phone are required.")

  const context = await checkoutContext({
    courseSlug,
    country: input.country || "Nigeria",
    email,
    couponCode: clean(input.couponCode, 80),
    buyerType,
    seatCount,
    batchKey: input.batchKey,
    manualTransfer: true
  })
  const paymentUuid = await createManualPayment({
    courseSlug,
    firstName,
    email,
    phone,
    country: input.country || "Nigeria",
    pricing: context.pricing,
    transferReference: clean(input.transferReference, 120) || "Admin-added external payment",
    proofUrl: clean(input.proofUrl, 1200) || "admin-added-external-payment",
    proofPublicId: clean(input.proofPublicId, 255) || null,
    batch: context.batch,
    buyerType,
    seatCount
  })
  await reviewManualPayment({
    paymentUuid,
    action: "approve",
    reviewedBy: input.reviewedBy,
    reviewNote: `[ADMIN_ADD_STUDENT] Added by admin as external bank payment.${input.adminNote ? ` Note: ${clean(input.adminNote, 500)}` : ""}`
  })
  await upsertWhatsAppContact({ email, fullName: firstName, phone, courseSlug, source: "admin_add_student", optedIn: true }).catch(() => null)
  return { paymentUuid }
}

export async function updateManualPaymentEmail(input: { paymentUuid: string; newEmail: string; actor: string }) {
  const paymentUuid = clean(input.paymentUuid, 80)
  const newEmail = normalizeEmail(input.newEmail)
  if (!paymentUuid || !newEmail) throw new Error("Payment and valid new email are required.")
  const rows = await prisma.$queryRaw<Array<{ email: string | null; firstName: string | null }>>`
    SELECT email, first_name AS firstName
    FROM course_manual_payments
    WHERE payment_uuid = ${paymentUuid}
    LIMIT 1
  `
  const payment = rows[0]
  if (!payment) throw new Error("Manual payment not found.")
  const oldEmail = normalizeEmail(payment.email)
  if (oldEmail === newEmail) throw new Error("New email is the same as current email.")
  const existing = await prisma.studentAccount.findUnique({ where: { email: newEmail } }).catch(() => null)
  if (existing) throw new Error("Another student account already uses this email.")
  const oldAccount = oldEmail ? await prisma.studentAccount.findUnique({ where: { email: oldEmail } }).catch(() => null) : null
  const now = new Date()
  if (oldAccount) {
    await prisma.studentAccount.update({ where: { id: oldAccount.id }, data: { email: newEmail, updatedAt: now } })
    await prisma.$executeRaw`UPDATE school_students SET email = ${newEmail}, updated_at = ${now} WHERE account_id = ${oldAccount.id}`.catch(() => null)
  }
  await prisma.$executeRaw`
    UPDATE course_manual_payments
    SET email = ${newEmail},
        review_note = CONCAT(COALESCE(review_note, ''), ${`\n[EMAIL_UPDATE] ${oldEmail || "unknown"} -> ${newEmail} by ${clean(input.actor, 120)}`}),
        updated_at = ${now}
    WHERE payment_uuid = ${paymentUuid}
    LIMIT 1
  `
  const account = oldAccount || await prisma.studentAccount.findUnique({ where: { email: newEmail } }).catch(() => null)
  if (account) {
    const reset = await createStudentPasswordResetToken(newEmail, { neverExpires: true }).catch(() => null)
    if (reset?.token) {
      const link = `${siteBaseUrl()}/dashboard/reset-password?token=${encodeURIComponent(reset.token)}`
      await sendEmail({
        to: newEmail,
        subject: "Your Dashboard Password Reset Link",
        text: `Hello ${payment.firstName || "there"},\n\nHere is your dashboard password reset link:\n${link}`,
        html: `<p>Hello ${payment.firstName || "there"},</p><p>Here is your dashboard password reset link:</p><p><a href="${link}">${link}</a></p>`
      }).catch(() => null)
    }
  }
  return { paymentUuid, previousEmail: oldEmail, email: newEmail }
}

export async function completeManualPaymentRecovery(input: {
  paymentUuid: string
  firstName: string
  email: string
  phone: string
  transferReference?: string
  actor: string
}) {
  const paymentUuid = clean(input.paymentUuid, 80)
  const firstName = clean(input.firstName, 160)
  const email = normalizeEmail(input.email)
  const phone = clean(input.phone, 40)
  const transferReference = clean(input.transferReference, 190)
  if (!paymentUuid || !firstName || !email || !phone) {
    throw new Error("Name, valid email, and phone are required before this recovery can be reviewed.")
  }

  const rows = await prisma.$queryRaw<Array<{ status: string | null }>>`
    SELECT status
    FROM course_manual_payments
    WHERE payment_uuid = ${paymentUuid}
    LIMIT 1
  `
  if (!rows[0]) throw new Error("Recovered payment not found.")
  if (rows[0].status !== "recovery_required") throw new Error("This payment is no longer awaiting recovery details.")

  const now = new Date()
  await prisma.$executeRaw`
    UPDATE course_manual_payments
    SET first_name = ${firstName},
        email = ${email},
        phone = ${phone},
        transfer_reference = COALESCE(${transferReference || null}, transfer_reference),
        status = 'pending_verification',
        review_note = CONCAT(COALESCE(review_note, ''), ${`\n[RECOVERY_COMPLETED] Customer details supplied by ${clean(input.actor, 120) || "admin"}.`}),
        updated_at = ${now}
    WHERE payment_uuid = ${paymentUuid}
    LIMIT 1
  `
  return { paymentUuid }
}

export async function resendManualPaymentActivationEmail(input: {
  paymentUuid: string
  subject?: string
  messageTemplate?: string
}) {
  const paymentUuid = clean(input.paymentUuid, 80)
  if (!paymentUuid) throw new Error("Payment UUID is required.")
  const rows = await prisma.$queryRaw<Array<{
    email: string | null
    fullName: string | null
    courseSlug: string | null
    batchKey: string | null
    batchLabel: string | null
    status: string | null
  }>>`
    SELECT
      email,
      first_name AS fullName,
      course_slug AS courseSlug,
      batch_key AS batchKey,
      batch_label AS batchLabel,
      status
    FROM course_manual_payments
    WHERE payment_uuid = ${paymentUuid}
    LIMIT 1
  `
  const payment = rows[0]
  if (!payment) throw new Error("Manual payment not found.")
  if (clean(payment.status, 40).toLowerCase() !== "approved") {
    throw new Error("Only approved manual payments can receive activation emails.")
  }
  return sendActivationEmailToStudent({
    email: normalizeEmail(payment.email),
    fullName: payment.fullName,
    courseSlug: payment.courseSlug,
    batchKey: payment.batchKey,
    batchLabel: payment.batchLabel,
    subject: input.subject,
    messageTemplate: input.messageTemplate,
    mode: "single"
  })
}

export async function resendBatchActivationEmails(input: {
  courseSlug: string
  batchKey: string
  batchLabel?: string
  subject?: string
  messageTemplate?: string
  limit?: number
}): Promise<OnboardingEmailResult> {
  const courseSlug = normalizeCourse(input.courseSlug)
  const batchKey = clean(input.batchKey, 80)
  if (!courseSlug || !batchKey) throw new Error("Course and batch are required.")
  const batchLabel = clean(input.batchLabel, 120) || batchKey
  const subject = clean(input.subject, 220) || `Important: New Password Reset Link for ${batchLabel}`
  const limit = Math.max(1, Math.min(toInt(input.limit, 500), 1000))
  const manualRows = await prisma.$queryRaw<Array<{ email: string | null; fullName: string | null }>>`
    SELECT LOWER(email) AS email, MAX(COALESCE(first_name, '')) AS fullName
    FROM course_manual_payments
    WHERE course_slug = ${courseSlug}
      AND batch_key = ${batchKey}
      AND status = 'approved'
      AND reviewed_by = 'admin'
    GROUP BY LOWER(email)
    ORDER BY email ASC
    LIMIT ${limit}
  `
  const orderRows = await prisma.$queryRaw<Array<{ email: string | null; fullName: string | null }>>`
    SELECT LOWER(email) AS email, MAX(COALESCE(first_name, '')) AS fullName
    FROM course_orders
    WHERE course_slug = ${courseSlug}
      AND batch_key = ${batchKey}
      AND status = 'paid'
      AND (provider IS NULL OR provider NOT IN ('wallet_installment', 'wallet'))
    GROUP BY LOWER(email)
    ORDER BY email ASC
    LIMIT ${limit}
  `
  const byEmail = new Map<string, { email: string; fullName: string }>()
  for (const row of [...manualRows, ...orderRows]) {
    const email = normalizeEmail(row.email)
    if (!email || byEmail.has(email)) continue
    byEmail.set(email, { email, fullName: clean(row.fullName, 180) })
  }
  const targets = Array.from(byEmail.values()).slice(0, limit)
  const runId = await createOnboardingRun({ courseSlug, batchKey, batchLabel, subject })
  const result: OnboardingEmailResult = {
    total: targets.length,
    sent: 0,
    failed: 0,
    createdAccounts: 0,
    runId,
    failures: []
  }
  for (const target of targets) {
    try {
      const sent = await sendActivationEmailToStudent({
        email: target.email,
        fullName: target.fullName,
        courseSlug,
        batchKey,
        batchLabel,
        subject,
        messageTemplate: input.messageTemplate,
        mode: "batch"
      })
      result.sent += 1
      if (sent.createdAccount) result.createdAccounts += 1
      await logOnboardingRunItem({
        runId,
        email: target.email,
        fullName: sent.fullName,
        status: "sent",
        createdAccount: sent.createdAccount
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      result.failed += 1
      result.failures.push({ email: target.email, message })
      await logOnboardingRunItem({
        runId,
        email: target.email,
        fullName: target.fullName,
        status: "failed",
        errorMessage: message
      })
    }
  }
  await completeOnboardingRun(runId, result)
  return result
}

export async function listLatestOnboardingEmailFailures(input: {
  courseSlug?: string
  batchKey?: string
  limit?: number
}): Promise<OnboardingEmailFailureRow[]> {
  await ensureOnboardingEmailRunTables()
  const courseSlug = normalizeCourse(input.courseSlug) || "all"
  const batchKey = clean(input.batchKey, 80) || "all"
  const limit = Math.max(1, Math.min(toInt(input.limit, 20), 100))
  const runRows = await prisma.$queryRaw<Array<{
    runId: string
    courseSlug: string | null
    batchKey: string | null
    batchLabel: string | null
  }>>`
    SELECT run_uuid AS runId, course_slug AS courseSlug, batch_key AS batchKey, batch_label AS batchLabel
    FROM tochukwu_onboarding_email_runs
    WHERE (${courseSlug} = 'all' OR course_slug = ${courseSlug})
      AND (${batchKey} = 'all' OR batch_key = ${batchKey})
    ORDER BY created_at DESC
    LIMIT 1
  `
  const run = runRows[0]
  if (!run?.runId) return []
  const rows = await prisma.$queryRaw<Array<{ email: string | null; message: string | null; createdAt: Date | null }>>`
    SELECT email, error_message AS message, processed_at AS createdAt
    FROM tochukwu_onboarding_email_run_items
    WHERE run_uuid = ${run.runId}
      AND status = 'failed'
    ORDER BY email ASC
    LIMIT ${limit}
  `
  return rows.map((row) => ({
    runId: run.runId,
    courseSlug: clean(run.courseSlug, 120) || null,
    batchKey: clean(run.batchKey, 80) || null,
    batchLabel: clean(run.batchLabel, 120) || null,
    email: normalizeEmail(row.email),
    message: clean(row.message, 500) || "Unknown error",
    createdAt: row.createdAt
  })).filter((row) => row.email)
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex")
}

export async function sendManualPaymentMetaPurchase(input: {
  paymentUuid: string
  fbp?: string
  fbc?: string
  eventSourceUrl?: string
}) {
  const pixelId = clean(process.env.META_PIXEL_ID, 120)
  const accessToken = clean(process.env.META_PIXEL_ACCESS_TOKEN, 1000)
  if (!pixelId || !accessToken) throw new Error("Meta Pixel settings are not configured.")
  const paymentUuid = clean(input.paymentUuid, 80)
  const rows = await prisma.$queryRaw<Array<{
    courseSlug: string | null
    email: string | null
    amountMinor: number | bigint | null
    currency: string | null
    status: string | null
  }>>`
    SELECT course_slug AS courseSlug, email, amount_minor AS amountMinor, currency, status
    FROM course_manual_payments
    WHERE payment_uuid = ${paymentUuid}
    LIMIT 1
  `
  const payment = rows[0]
  if (!payment) throw new Error("Manual payment not found.")
  if (clean(payment.status, 40).toLowerCase() !== "approved") throw new Error("Only approved manual payments can send Meta purchase events.")
  const eventId = `ptp_manual_${paymentUuid}_${Date.now()}`
  const body = {
    data: [{
      event_name: "Purchase",
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: "website",
      event_source_url: clean(input.eventSourceUrl, 1200) || siteBaseUrl(),
      user_data: {
        em: normalizeEmail(payment.email) ? [sha256(normalizeEmail(payment.email))] : undefined,
        fbp: clean(input.fbp, 300) || undefined,
        fbc: clean(input.fbc, 300) || undefined
      },
      custom_data: {
        currency: clean(payment.currency, 10).toUpperCase() || "NGN",
        value: toInt(payment.amountMinor) / 100,
        content_name: clean(payment.courseSlug, 120) || "Course",
        content_ids: [clean(payment.courseSlug, 120) || "course"],
        content_type: "product"
      }
    }]
  }
  const response = await fetch(`https://graph.facebook.com/v20.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(accessToken)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  })
  const json = await response.json().catch(() => null)
  if (!response.ok || json?.error) throw new Error(json?.error?.message || `Meta CAPI failed (${response.status})`)
  await prisma.$executeRaw`
    UPDATE course_manual_payments
    SET meta_purchase_sent = 1,
        meta_purchase_sent_at = ${new Date()},
        updated_at = ${new Date()}
    WHERE payment_uuid = ${paymentUuid}
    LIMIT 1
  `
  return { eventId }
}

export async function listHolidayWaitlistContacts(limitInput = 200): Promise<{ contacts: HolidayWaitlistContact[]; total: number }> {
  await ensureWhatsAppWaitlistTables()
  const limit = Math.max(1, Math.min(toInt(limitInput, 200), 500))
  const [contacts, countRows] = await Promise.all([
    prisma.$queryRaw<Array<{
      id: number | bigint
      email: string | null
      fullName: string | null
      phone: string | null
      optedIn: number | bigint | boolean | null
      createdAt: Date | null
      updatedAt: Date | null
    }>>`
      SELECT
        id,
        email,
        full_name AS fullName,
        phone_e164 AS phone,
        opted_in AS optedIn,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM tochukwu_wa_waitlist_contacts
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `,
    prisma.$queryRaw<Array<{ total: number | bigint | null }>>`
      SELECT COUNT(*) AS total
      FROM tochukwu_wa_waitlist_contacts
    `
  ])
  return {
    total: toInt(countRows[0]?.total),
    contacts: contacts.map((row) => ({
      id: toInt(row.id),
      email: normalizeEmail(row.email),
      fullName: clean(row.fullName, 180),
      phone: clean(row.phone, 30),
      optedIn: Boolean(Number(row.optedIn || 0)),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }))
  }
}

export async function deleteHolidayWaitlistContact(idInput: unknown) {
  await ensureWhatsAppWaitlistTables()
  const id = toInt(idInput)
  if (id <= 0) throw new Error("Valid waitlist id is required.")
  const rows = await prisma.$queryRaw<Array<{ id: number | bigint; email: string | null; phone: string | null }>>`
    SELECT id, email, phone_e164 AS phone
    FROM tochukwu_wa_waitlist_contacts
    WHERE id = ${id}
    LIMIT 1
  `
  const row = rows[0]
  if (!row) throw new Error("Waitlist record not found.")
  const phone = clean(row.phone, 30)
  await prisma.$transaction([
    prisma.$executeRaw`DELETE FROM tochukwu_wa_waitlist_queue WHERE phone_e164 = ${phone}`,
    prisma.$executeRaw`DELETE FROM tochukwu_wa_waitlist_contacts WHERE id = ${id} LIMIT 1`
  ])
  return { id, email: normalizeEmail(row.email), phone }
}

export async function listWhatsAppMarketingContacts(input: {
  courseSlug?: string
  opted?: string
  search?: string
  limit?: number
}): Promise<WhatsAppContact[]> {
  await ensureWhatsAppMarketingTables()
  const courseSlug = normalizeCourse(input.courseSlug) || "all"
  const opted = clean(input.opted, 20).toLowerCase() || "in"
  const search = clean(input.search, 120).toLowerCase()
  const limit = Math.max(1, Math.min(toInt(input.limit, 500), 1000))
  const rows = await prisma.$queryRaw<Array<{
    id: number | bigint
    email: string | null
    fullName: string | null
    phone: string | null
    courseSlug: string | null
    source: string | null
    optedIn: number | bigint | boolean | null
    optedInAt: Date | null
    optedOutAt: Date | null
    updatedAt: Date | null
  }>>`
    SELECT
      id,
      email,
      full_name AS fullName,
      phone_e164 AS phone,
      course_slug AS courseSlug,
      source,
      whatsapp_opted_in AS optedIn,
      whatsapp_opted_in_at AS optedInAt,
      whatsapp_opted_out_at AS optedOutAt,
      updated_at AS updatedAt
    FROM tochukwu_whatsapp_contacts
    WHERE (${courseSlug} = 'all' OR course_slug = ${courseSlug})
      AND (${opted} = 'all' OR (${opted} = 'in' AND whatsapp_opted_in = 1) OR (${opted} = 'out' AND whatsapp_opted_in = 0))
      AND (
        ${search} = ''
        OR LOWER(COALESCE(email, '')) LIKE ${`%${search}%`}
        OR LOWER(COALESCE(full_name, '')) LIKE ${`%${search}%`}
        OR phone_e164 LIKE ${`%${search}%`}
      )
    ORDER BY updated_at DESC
    LIMIT ${limit}
  `
  return rows.map((row) => ({
    id: toInt(row.id),
    email: normalizeEmail(row.email) || null,
    fullName: clean(row.fullName, 180) || null,
    phone: clean(row.phone, 30),
    courseSlug: clean(row.courseSlug, 120) || null,
    source: clean(row.source, 80) || null,
    optedIn: Boolean(Number(row.optedIn || 0)),
    optedInAt: row.optedInAt,
    optedOutAt: row.optedOutAt,
    updatedAt: row.updatedAt
  }))
}

export async function listWhatsAppCampaigns(limitInput = 20): Promise<WhatsAppCampaignRow[]> {
  await ensureWhatsAppMarketingTables()
  const limit = Math.max(1, Math.min(toInt(limitInput, 20), 80))
  const rows = await prisma.$queryRaw<Array<{
    campaignUuid: string
    campaignName: string
    audienceCourseSlug: string | null
    messageText: string | null
    recipientCount: number | bigint | null
    n8nStatus: string | null
    n8nError: string | null
    createdBy: string | null
    createdAt: Date | null
  }>>`
    SELECT
      campaign_uuid AS campaignUuid,
      campaign_name AS campaignName,
      audience_course_slug AS audienceCourseSlug,
      message_text AS messageText,
      recipient_count AS recipientCount,
      n8n_status AS n8nStatus,
      n8n_error AS n8nError,
      created_by AS createdBy,
      created_at AS createdAt
    FROM tochukwu_whatsapp_campaigns
    ORDER BY created_at DESC
    LIMIT ${limit}
  `
  return rows.map((row) => ({
    ...row,
    recipientCount: toInt(row.recipientCount)
  }))
}

async function runtimeSetting(key: string) {
  const envValue = clean(process.env[key], 5000)
  const rows = await prisma.$queryRaw<Array<{ settingValue: string | null }>>`
    SELECT setting_value AS settingValue
    FROM tochukwu_admin_settings
    WHERE setting_key = ${key}
    LIMIT 1
  `.catch(() => [])
  return clean(rows[0]?.settingValue, 5000) || envValue
}

async function updateCampaignStatus(campaignUuid: string, status: string, errorMessage = "") {
  await prisma.$executeRaw`
    UPDATE tochukwu_whatsapp_campaigns
    SET n8n_status = ${clean(status, 30)},
        n8n_error = ${clean(errorMessage, 500) || null},
        updated_at = ${new Date()}
    WHERE campaign_uuid = ${clean(campaignUuid, 64)}
    LIMIT 1
  `
}

export async function sendWhatsAppCampaign(input: {
  campaignName: string
  templateName: string
  templateLanguage?: string
  variableMode?: string
  templatePreview: string
  courseSlug?: string
  testPhone?: string
  sendTest?: boolean
  createdBy: string
}) {
  await ensureWhatsAppMarketingTables()
  const campaignName = clean(input.campaignName, 180) || "WhatsApp Campaign"
  const templateName = clean(input.templateName, 120) || "holiday_waitlist_welcome"
  const templateLanguage = clean(input.templateLanguage, 20) || "en"
  const variableMode = clean(input.variableMode, 80) || "recipient_full_name"
  const templatePreview = clean(input.templatePreview, 4000)
  const courseSlug = normalizeCourse(input.courseSlug) || "all"
  const sendTest = input.sendTest === true
  if (!templateName) throw new Error("Template name is required.")
  if (!templatePreview) throw new Error("Template preview is required.")

  const recipients = sendTest
    ? [{ fullName: "Test Recipient", email: "", phone: normalizePhone(input.testPhone), courseSlug: "test" }]
    : (await listWhatsAppMarketingContacts({ courseSlug, opted: "in", limit: 1000 })).map((row) => ({
        fullName: row.fullName || "there",
        email: row.email || "",
        phone: row.phone,
        courseSlug: row.courseSlug || ""
      }))
  const validRecipients = recipients.filter((recipient) => clean(recipient.phone, 30))
  if (sendTest && !validRecipients.length) throw new Error("Test phone number is required.")
  if (!validRecipients.length) throw new Error("No opted-in WhatsApp contacts matched this audience.")

  const campaignUuid = `wc_${crypto.randomUUID().replace(/-/g, "")}`
  const now = new Date()
  await prisma.$executeRaw`
    INSERT INTO tochukwu_whatsapp_campaigns
      (campaign_uuid, campaign_name, audience_course_slug, message_text, recipient_count, n8n_status, created_by, created_at, updated_at)
    VALUES (${campaignUuid}, ${campaignName}, ${sendTest ? "test" : courseSlug}, ${templatePreview}, ${validRecipients.length}, 'pending', ${clean(input.createdBy, 190) || null}, ${now}, ${now})
  `

  const webhookUrl = await runtimeSetting("N8N_HOLIDAY_WAITLIST_WEBHOOK_URL")
  const secret = await runtimeSetting("N8N_HOLIDAY_WAITLIST_WEBHOOK_SECRET")
  if (!webhookUrl) {
    await updateCampaignStatus(campaignUuid, "failed", "N8N webhook URL is not configured.")
    throw new Error("N8N webhook URL is not configured.")
  }

  const payload = {
    source: sendTest ? "admin_whatsapp_campaign_test" : "admin_whatsapp_campaign",
    campaignId: campaignUuid,
    campaignName,
    templateName,
    templateLanguage,
    templatePreview,
    variableMode,
    variables: [{ index: 1, source: "recipient.fullName", fallback: "there" }],
    courseSlug: sendTest ? "test" : courseSlug,
    submittedAt: new Date().toISOString(),
    recipients: validRecipients.map((recipient) => ({
      ...recipient,
      templateVariables: [clean(recipient.fullName, 180) || "there"]
    }))
  }
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { "x-webhook-secret": secret } : {})
    },
    body: JSON.stringify(payload)
  })
  const responseBody = await response.text().catch(() => "")
  if (!response.ok) {
    const error = responseBody || `n8n webhook failed (${response.status})`
    await updateCampaignStatus(campaignUuid, "failed", error)
    throw new Error(error)
  }
  await updateCampaignStatus(campaignUuid, "sent_to_n8n")
  return { campaignUuid, recipientCount: validRecipients.length }
}
