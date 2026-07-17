import { Prisma } from "@prisma/client"
import { randomUUID } from "crypto"

import { ensureAffiliateAlignment, matureAffiliateCommissions } from "@/lib/affiliate-alignment"
import { configuredLearningCourseSlugSql, dayLevelCourseSlugRegex } from "@/lib/learning-course-catalog"
import { listStudentLiveSessionsForPairs, type StudentLiveSession } from "@/lib/course-live-sessions"
import { prisma } from "@/lib/prisma"
import { addColumnIfMissing } from "@/lib/schema-guards"

function cleanText(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function parseSelectedServicesJson(value: string | null): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map((item) => cleanText(item, 64)).filter(Boolean) : []
  } catch {
    return []
  }
}

function randomAffiliateCode(length = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let out = ""
  for (let i = 0; i < length; i += 1) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

function affiliateBaseUrl() {
  return String(process.env.AFFILIATE_LINK_BASE_URL || process.env.SITE_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://tochukwunkwocha.com").trim().replace(/\/$/, "")
}

function defaultAffiliateHoldDays() {
  const raw = Number(process.env.AFFILIATE_DEFAULT_HOLD_DAYS || 30)
  return Number.isFinite(raw) ? Math.max(0, Math.min(120, Math.trunc(raw))) : 30
}

function affiliateMinPayoutMinor(currency: string) {
  const code = String(currency || "NGN").toUpperCase()
  if (code === "USD") {
    const raw = Number(process.env.AFFILIATE_MIN_PAYOUT_USD_MINOR || 2500)
    return Number.isFinite(raw) ? Math.max(0, Math.trunc(raw)) : 2500
  }
  const raw = Number(process.env.AFFILIATE_MIN_PAYOUT_NGN_MINOR || 100000)
  return Number.isFinite(raw) ? Math.max(0, Math.trunc(raw)) : 100000
}

function schoolMinSeats() {
  const raw = Number(process.env.SCHOOLS_MIN_SEATS || 50)
  return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : 50
}

function schoolsPricePerStudentMinor() {
  const raw = Number(process.env.SCHOOLS_PRICE_PER_STUDENT_NGN_MINOR || 850000)
  return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : 850000
}

function maskEmailAddress(value: string) {
  const email = String(value || "").trim().toLowerCase()
  const at = email.indexOf("@")
  if (at <= 1) return email ? `***${email.slice(at)}` : ""
  return `${email.slice(0, 2)}***${email.slice(at)}`
}

function formatSqlDate(date = new Date()) {
  return date.toISOString().slice(0, 19).replace("T", " ")
}

export interface StudentCourseAccessRow {
  source: string
  uuid: string
  courseSlug: string
  batchKey: string | null
  batchLabel: string | null
  batchStartAt: Date | null
  currency: string | null
  amountMinor: number
  status: string
  createdAt: Date | null
}

export interface StudentCourseItem extends StudentCourseAccessRow {
  courseName: string
  isActive: boolean
  paidAt: Date | null
  submittedAt: Date | null
  accessExpiresAt: Date | null
  courseStartAt: Date | null
  firstRecordedLessonAvailableAt: Date | null
  liveSessions: StudentLiveSession[]
}

export interface StudentOverviewPaymentRecord extends StudentCourseItem {
  isGroupPurchase: boolean
}

export interface FamilySeatRow {
  courseSlug: string
  batchKey: string | null
  batchLabel: string | null
  seatsPurchased: number
  seatsUsed: number
  seatsAvailable: number
  paymentProvider: string
  paymentCurrency: string
}

export interface FamilyChildRow {
  childId: number
  childUuid: string
  fullName: string
  age: string
  classLevel: string
  email: string
  accessCode: string
  status: string
  courseSlug: string
  batchKey: string | null
  batchLabel: string | null
  enrollmentStatus: string
  paidAt: Date | null
}

export interface FamilyDashboardData {
  family: {
    familyUuid: string
    parentName: string
    parentEmail: string
    parentPhone: string
    status: string
  } | null
  seats: FamilySeatRow[]
  children: FamilyChildRow[]
}

async function courseItemsFromAccessRows<T extends StudentCourseAccessRow>(rows: T[]): Promise<Array<T & StudentCourseItem>> {
  const map = new Map<string, T & StudentCourseItem>()

  for (const row of rows) {
    if (!row.courseSlug) continue
    if (!isPaidStatus(row.status) && !isPendingStatus(row.status)) continue

    const key = `${row.courseSlug}::${row.batchKey || ""}::${row.source}::${row.uuid}`
    const paidAt = isPaidStatus(row.status) ? row.createdAt : null
    const submittedAt = isPendingStatus(row.status) ? row.createdAt : null
    const item: T & StudentCourseItem = {
      ...row,
      courseName: courseName(row.courseSlug),
      isActive: isPaidStatus(row.status),
      paidAt,
      submittedAt,
      accessExpiresAt: addOneYear(paidAt),
      courseStartAt: validDate(row.batchStartAt),
      firstRecordedLessonAvailableAt: null,
      liveSessions: []
    }
    map.set(key, item)
  }

  const items = await Promise.all(Array.from(map.values()).map(async (item) => ({
    ...item,
    firstRecordedLessonAvailableAt: await firstRecordedLessonAvailableAt({
      courseSlug: item.courseSlug,
      batchKey: item.batchKey,
      batchStartAt: item.courseStartAt
    })
  })))
  const liveSessionMap = await listStudentLiveSessionsForPairs(items.map((item) => ({
    courseSlug: item.courseSlug,
    batchKey: item.batchKey
  }))).catch(() => new Map<string, StudentLiveSession[]>())
  items.forEach((item) => {
    item.liveSessions = liveSessionMap.get(`${item.courseSlug.toLowerCase()}::${String(item.batchKey || "").toLowerCase()}`) || []
  })

  return items.sort(
    (left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime()
  )
}

export interface LearningCourseOption {
  courseSlug: string
  courseTitle: string
  enrollmentMode: string
  batches: LearningCourseBatchOption[]
}

export interface LearningCourseBatchOption {
  batchKey: string
  batchLabel: string
  remainingSeats: number | null
  isActive: boolean
}

const batchlessLearningCourseSlugs = new Set(["ai-for-everyday-business-owners"])

export interface StudentDomainRow {
  domainName: string
  provider: string
  status: string
  years: number
  selectedServices: string[]
  autoRenewEnabled: boolean
  purchaseCurrency: string | null
  purchaseAmountMinor: number | null
  providerOrderId: string
  registeredAt: Date | null
  renewalDueAt: Date | null
  lastSyncedAt: Date | null
  createdAt: Date | null
}

export interface StudentDomainOrderRow {
  orderUuid: string
  domainName: string
  years: number
  provider: string
  status: string
  paymentProvider: string
  paymentStatus: string
  selectedServices: string[]
  autoRenewEnabled: boolean
  purchaseCurrency: string | null
  purchaseAmountMinor: number | null
  providerOrderId: string
  notes: string
  registeredAt: Date | null
  createdAt: Date | null
}

export interface StudentDomainNetlifyRow {
  domainName: string
  netlifyEmail: string
  netlifyWorkspace: string
  netlifySiteName: string
  connectionMethod: string
  status: string
  updatedAt: Date | null
}

export interface StudentProjectRow {
  jobUuid: string
  businessName: string
  status: string
  paymentStatus: string
  publishStatus: string
  createdAt: Date | null
  updatedAt: Date | null
  dashboardUrl: string
}

export interface StudentBusinessPlanRow {
  planUuid: string
  orderUuid: string
  businessName: string
  purpose: string
  currency: string
  planText: string
  verificationStatus: string
  verifiedAt: Date | null
  canDownload: boolean
  generatedAt: Date | null
}

export interface StudentCertificateRow {
  courseSlug: string
  certificateNo: string
  recipientName: string
  status: string
  issuedAt: Date | null
  certificateUrl: string
}

export interface StudentCertificatePublic {
  certificateNo: string
  issuedAt: string | null
  courseSlug: string
  courseName: string
  studentName: string
  studentEmail: string
  projectUrl: string
  projectVerifiedAt: string | null
  projectStatusAtIssue: string
}

export interface StudentAffiliateSummary {
  profile: {
    profileUuid: string
    affiliateCode: string
    status: string
    eligibilityStatus: string
    eligibilityReason: string | null
    countryCode: string
    payoutCurrency: string
    payoutProvider: string
    affiliateLink: string
    payoutAccount: {
      countryCode: string
      currency: string
      payoutProvider: string
      accountName: string
      bankCode: string
      bankName: string
      accountNumberMasked: string
      isVerified: boolean
    } | null
  } | null
  policy: {
    defaultHoldDays: number
    minPayoutMinor: number
    payoutCurrency: string
    antiAbuseSummary: string
    schoolReferralNote: string
    schoolProgram: {
      courseSlug: string
      minSeats: number
      pricePerStudentMinor: number
    }
  }
  earnings: {
    earnedMinor: number
    pendingMinor: number
    approvedMinor: number
    paidMinor: number
    blockedMinor: number
    currency: string
    totalCount: number
  }
  directCourseLinks: {
    courseSlug: string
    link: string
  }[]
  eligibleCourses: {
    courseSlug: string
    commissionType: string
    commissionValue: number
    commissionCurrency: string
    minOrderAmountMinor: number
    holdDays: number
    projectedMinCommissionMinor: number
    projectedMinSeats: number
  }[]
  referrals: {
    commissionUuid: string
    orderUuid: string
    courseSlug: string
    buyerEmail: string
    buyerEmailMasked: string
    currency: string
    orderAmountMinor: number
    commissionAmountMinor: number
    status: string
    createdAt: Date | null
  }[]
  payouts: {
    batchUuid: string
    periodStart: Date | null
    periodEnd: Date | null
    currency: string
    totalItems: number
    totalAmountMinor: number
    status: string
    createdAt: Date | null
    completedAt: Date | null
  }[]
}

export async function listStudentCourseAccess(email: string, accountId?: bigint | number | null): Promise<StudentCourseAccessRow[]> {
  const normalized = String(email || "").trim().toLowerCase()
  if (!normalized) return []

  const cardRows = await prisma.$queryRaw<StudentCourseAccessRow[]>(
    Prisma.sql`
      SELECT
        'card_checkout' AS source,
        COALESCE(o.order_uuid, CONCAT('order_', o.id)) AS uuid,
        COALESCE(o.course_slug, '') AS courseSlug,
        o.batch_key AS batchKey,
        o.batch_label AS batchLabel,
        b.batch_start_at AS batchStartAt,
        o.currency,
        COALESCE(o.amount_minor, o.final_amount_minor, 0) AS amountMinor,
        COALESCE(o.status, '') AS status,
        o.created_at AS createdAt
      FROM course_orders o
      LEFT JOIN course_batches b
        ON b.course_slug COLLATE utf8mb4_unicode_ci = o.course_slug COLLATE utf8mb4_unicode_ci
       AND b.batch_key COLLATE utf8mb4_unicode_ci = o.batch_key COLLATE utf8mb4_unicode_ci
      WHERE LOWER(o.email) = ${normalized}
        AND COALESCE(o.buyer_type, 'student') <> 'family'
    `
  )
  const manualRows = await prisma.$queryRaw<StudentCourseAccessRow[]>(
    Prisma.sql`
      SELECT
        'manual_payment' AS source,
        m.payment_uuid AS uuid,
        m.course_slug AS courseSlug,
        m.batch_key AS batchKey,
        m.batch_label AS batchLabel,
        b.batch_start_at AS batchStartAt,
        m.currency,
        m.amount_minor AS amountMinor,
        m.status,
        m.created_at AS createdAt
      FROM course_manual_payments m
      LEFT JOIN course_batches b
        ON b.course_slug COLLATE utf8mb4_unicode_ci = m.course_slug COLLATE utf8mb4_unicode_ci
       AND b.batch_key COLLATE utf8mb4_unicode_ci = m.batch_key COLLATE utf8mb4_unicode_ci
      WHERE LOWER(m.email) = ${normalized}
        AND COALESCE(m.buyer_type, 'student') <> 'family'
    `
  )
  const familyRows = accountId
    ? await prisma.$queryRaw<StudentCourseAccessRow[]>(
        Prisma.sql`
          SELECT
            'family_child' AS source,
            COALESCE(e.source_uuid, CONCAT('family_child_', e.id)) AS uuid,
            e.course_slug AS courseSlug,
            e.batch_key AS batchKey,
            COALESCE(e.batch_label, e.batch_key, 'Group access') AS batchLabel,
            b.batch_start_at AS batchStartAt,
            NULL AS currency,
            0 AS amountMinor,
            CASE WHEN e.status = 'active' THEN 'paid' ELSE COALESCE(e.status, '') END AS status,
            COALESCE(e.paid_at, e.updated_at, e.created_at) AS createdAt
          FROM family_child_enrollments e
          JOIN family_children c ON c.id = e.child_id
          JOIN family_accounts f ON f.id = e.family_id
          LEFT JOIN course_batches b
            ON b.course_slug COLLATE utf8mb4_unicode_ci = e.course_slug COLLATE utf8mb4_unicode_ci
           AND b.batch_key COLLATE utf8mb4_unicode_ci = e.batch_key COLLATE utf8mb4_unicode_ci
          WHERE c.account_id = ${accountId}
            AND c.status = 'active'
            AND f.status = 'active'
            AND e.status = 'active'
        `
      ).catch(() => [])
    : []

  return [...cardRows, ...manualRows, ...familyRows]
    .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())
    .slice(0, 50)
    .map((row) => ({
      ...row,
      amountMinor: Number(row.amountMinor || 0)
    }))
}

export async function listStudentPaymentRecords(email: string): Promise<StudentOverviewPaymentRecord[]> {
  const normalized = String(email || "").trim().toLowerCase()
  if (!normalized) return []

  const cardRows = await prisma.$queryRaw<Array<StudentCourseAccessRow & { isGroupPurchase: number | bigint | boolean | null }>>(
    Prisma.sql`
      SELECT
        CASE WHEN COALESCE(o.buyer_type, 'student') = 'family' THEN 'group_card_checkout' ELSE 'card_checkout' END AS source,
        COALESCE(o.order_uuid, CONCAT('order_', o.id)) AS uuid,
        COALESCE(o.course_slug, '') AS courseSlug,
        o.batch_key AS batchKey,
        o.batch_label AS batchLabel,
        b.batch_start_at AS batchStartAt,
        o.currency,
        COALESCE(o.amount_minor, o.final_amount_minor, 0) AS amountMinor,
        COALESCE(o.status, '') AS status,
        o.created_at AS createdAt,
        CASE WHEN COALESCE(o.buyer_type, 'student') = 'family' THEN 1 ELSE 0 END AS isGroupPurchase
      FROM course_orders o
      LEFT JOIN course_batches b
        ON b.course_slug COLLATE utf8mb4_unicode_ci = o.course_slug COLLATE utf8mb4_unicode_ci
       AND b.batch_key COLLATE utf8mb4_unicode_ci = o.batch_key COLLATE utf8mb4_unicode_ci
      WHERE LOWER(o.email) = ${normalized}
    `
  )
  const manualRows = await prisma.$queryRaw<Array<StudentCourseAccessRow & { isGroupPurchase: number | bigint | boolean | null }>>(
    Prisma.sql`
      SELECT
        CASE WHEN COALESCE(m.buyer_type, 'student') = 'family' THEN 'group_manual_payment' ELSE 'manual_payment' END AS source,
        m.payment_uuid AS uuid,
        m.course_slug AS courseSlug,
        m.batch_key AS batchKey,
        m.batch_label AS batchLabel,
        b.batch_start_at AS batchStartAt,
        m.currency,
        m.amount_minor AS amountMinor,
        m.status,
        m.created_at AS createdAt,
        CASE WHEN COALESCE(m.buyer_type, 'student') = 'family' THEN 1 ELSE 0 END AS isGroupPurchase
      FROM course_manual_payments m
      LEFT JOIN course_batches b
        ON b.course_slug COLLATE utf8mb4_unicode_ci = m.course_slug COLLATE utf8mb4_unicode_ci
       AND b.batch_key COLLATE utf8mb4_unicode_ci = m.batch_key COLLATE utf8mb4_unicode_ci
      WHERE LOWER(m.email) = ${normalized}
    `
  )

  const rows = [...cardRows, ...manualRows]
    .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())
    .slice(0, 50)
    .map((row) => ({
      ...row,
      amountMinor: Number(row.amountMinor || 0),
      isGroupPurchase: Boolean(row.isGroupPurchase)
    }))

  return courseItemsFromAccessRows(rows)
}

function isPaidStatus(status: string) {
  return ["paid", "approved", "success", "completed"].includes(String(status || "").toLowerCase())
}

function isPendingStatus(status: string) {
  return ["pending", "pending_verification"].includes(String(status || "").toLowerCase())
}

function addOneYear(value: Date | null) {
  if (!value) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  date.setFullYear(date.getFullYear() + 1)
  return date
}

function validDate(value: unknown): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isFinite(date.getTime()) ? date : null
}

function addSeconds(value: Date | null, seconds: number) {
  if (!value || !Number.isFinite(seconds)) return null
  return new Date(value.getTime() + Math.max(0, Math.round(seconds)) * 1000)
}

async function firstRecordedLessonAvailableAt(input: {
  courseSlug: string
  batchKey?: string | null
  batchStartAt?: Date | null
}) {
  const courseSlug = cleanText(input.courseSlug, 120).toLowerCase()
  const batchKey = cleanText(input.batchKey, 64).toLowerCase()
  if (!courseSlug) return null

  const rows = await prisma.$queryRaw<Array<{
    moduleId: bigint
    dripEnabled: number | bigint | boolean | null
    dripAt: Date | null
    dripBatchKey: string | null
    dripOffsetSeconds: number | bigint | null
    hasSchedules: number | bigint | null
  }>>(Prisma.sql`
    SELECT m.id AS moduleId,
      cm.drip_enabled AS dripEnabled,
      cm.drip_at AS dripAt,
      cm.drip_batch_key AS dripBatchKey,
      cm.drip_offset_seconds AS dripOffsetSeconds,
      (
        SELECT COUNT(*)
        FROM tochukwu_learning_module_batch_drips d
        WHERE d.module_id = m.id
      ) AS hasSchedules
    FROM tochukwu_learning_course_modules cm
    JOIN tochukwu_learning_modules m ON m.id = cm.module_id
    JOIN tochukwu_learning_lessons l ON l.module_id = m.id AND l.is_active = 1
    JOIN tochukwu_learning_video_assets a ON a.id = l.video_asset_id
    WHERE cm.course_slug COLLATE utf8mb4_unicode_ci = ${courseSlug} COLLATE utf8mb4_unicode_ci
      AND cm.is_active = 1
      AND a.ready_to_stream = 1
      AND a.source_deleted_at IS NULL
      AND COALESCE(TRIM(a.video_uid), '') <> ''
    ORDER BY cm.sort_order ASC, cm.id ASC, l.lesson_order ASC, l.id ASC
  `).catch(() => [])
  if (!rows.length) return null

  for (const first of rows) {
    const schedules = await prisma.$queryRaw<Array<{ accessMode: string | null; dripAt: Date | null }>>(Prisma.sql`
      SELECT access_mode AS accessMode, drip_at AS dripAt
      FROM tochukwu_learning_module_batch_drips
      WHERE module_id = ${first.moduleId}
        AND batch_key COLLATE utf8mb4_unicode_ci = ${batchKey} COLLATE utf8mb4_unicode_ci
      LIMIT 1
    `).catch(() => [])
    const schedule = schedules[0]
    if (schedule) {
      if (cleanText(schedule.accessMode, 24).toLowerCase() === "immediate") return null
      return validDate(schedule.dripAt)
    }
    if (Number(first.hasSchedules || 0) > 0) continue

    if (Number(first.dripEnabled || 0) === 1) {
      const targetBatch = cleanText(first.dripBatchKey, 64).toLowerCase()
      if (targetBatch && batchKey && targetBatch === batchKey) return validDate(first.dripAt)
      if (targetBatch && batchKey && targetBatch !== batchKey) continue
      const offset = first.dripOffsetSeconds === null || first.dripOffsetSeconds === undefined
        ? NaN
        : Number(first.dripOffsetSeconds)
      if (Number.isFinite(offset)) return addSeconds(validDate(input.batchStartAt), offset) || validDate(first.dripAt)
      const dripAt = validDate(first.dripAt)
      if (dripAt) return dripAt
    }
  }

  return null
}

export async function listStudentCourses(email: string, accountId?: bigint | number | null): Promise<StudentCourseItem[]> {
  const rows = await listStudentCourseAccess(email, accountId)
  const map = new Map<string, StudentCourseItem>()

  for (const row of rows) {
    if (!row.courseSlug) continue
    if (!isPaidStatus(row.status) && !isPendingStatus(row.status)) continue

    const key = `${row.courseSlug}::${row.batchKey || ""}`
    const paidAt = isPaidStatus(row.status) ? row.createdAt : null
    const submittedAt = isPendingStatus(row.status) ? row.createdAt : null
    const item: StudentCourseItem = {
      ...row,
      courseName: courseName(row.courseSlug),
      isActive: isPaidStatus(row.status),
      paidAt,
      submittedAt,
      accessExpiresAt: addOneYear(paidAt),
      courseStartAt: validDate(row.batchStartAt),
      firstRecordedLessonAvailableAt: null,
      liveSessions: []
    }
    const existing = map.get(key)
    if (!existing) {
      map.set(key, item)
      continue
    }
    if (item.isActive && !existing.isActive) {
      map.set(key, item)
      continue
    }
    const existingTime = existing.createdAt ? existing.createdAt.getTime() : 0
    const itemTime = item.createdAt ? item.createdAt.getTime() : 0
    if (itemTime > existingTime) map.set(key, item)
  }

  const items = await Promise.all(Array.from(map.values()).map(async (item) => ({
    ...item,
    firstRecordedLessonAvailableAt: await firstRecordedLessonAvailableAt({
      courseSlug: item.courseSlug,
      batchKey: item.batchKey,
      batchStartAt: item.courseStartAt
    })
  })))
  const liveSessionMap = await listStudentLiveSessionsForPairs(items.map((item) => ({
    courseSlug: item.courseSlug,
    batchKey: item.batchKey
  }))).catch(() => new Map<string, StudentLiveSession[]>())
  items.forEach((item) => {
    item.liveSessions = liveSessionMap.get(`${item.courseSlug.toLowerCase()}::${String(item.batchKey || "").toLowerCase()}`) || []
  })

  return items.sort(
    (left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime()
  )
}

export async function hasPendingManualPayment(email: string) {
  const normalized = String(email || "").trim().toLowerCase()
  if (!normalized) return false

  const rows = await prisma.$queryRaw<Array<{ total: bigint }>>`
    SELECT COUNT(*) AS total
    FROM course_manual_payments
    WHERE LOWER(email) = ${normalized}
      AND status IN ('pending', 'pending_verification', 'submitted', 'recovery_required')
  `

  return Number(rows[0]?.total || 0) > 0
}

export async function hasPendingGroupManualPayment(email: string) {
  const normalized = String(email || "").trim().toLowerCase()
  if (!normalized) return false

  const rows = await prisma.$queryRaw<Array<{ total: bigint }>>`
    SELECT COUNT(*) AS total
    FROM course_manual_payments
    WHERE LOWER(email) = ${normalized}
      AND COALESCE(buyer_type, 'student') = 'family'
      AND status IN ('pending', 'pending_verification', 'submitted', 'recovery_required')
  `

  return Number(rows[0]?.total || 0) > 0
}

export async function getStudentOverview(accountId: bigint, email: string) {
  const courses = await listStudentCourses(email, accountId)
  const paymentRecords = await listStudentPaymentRecords(email)
  const family = await getFamilyDashboard(accountId).catch(() => ({ family: null, seats: [], children: [] }))
  const domains = await listStudentDomains(accountId).catch(() => [])
  const projects = await listStudentProjects(email).catch(() => [])
  const businessPlans = await listStudentBusinessPlans(email).catch(() => [])

  return {
    courses,
    paymentRecords,
    family,
    domains,
    projects,
    businessPlans
  }
}

export async function getFamilyDashboard(parentAccountId: bigint): Promise<FamilyDashboardData> {
  const families = await prisma.$queryRaw<
    {
      id: bigint
      familyUuid: string | null
      parentName: string | null
      parentEmail: string | null
      parentPhone: string | null
      status: string | null
    }[]
  >(Prisma.sql`
    SELECT
      id,
      family_uuid AS familyUuid,
      parent_name AS parentName,
      parent_email AS parentEmail,
      parent_phone AS parentPhone,
      status
    FROM family_accounts
    WHERE parent_account_id = ${parentAccountId}
    LIMIT 1
  `)

  const family = families[0]
  if (!family) return { family: null, seats: [], children: [] }

  const children = await prisma.$queryRaw<FamilyChildRow[]>(Prisma.sql`
    SELECT
      CAST(c.id AS SIGNED) AS childId,
      COALESCE(c.child_uuid, '') AS childUuid,
      COALESCE(c.full_name, '') AS fullName,
      COALESCE(c.age, '') AS age,
      COALESCE(c.class_level, '') AS classLevel,
      COALESCE(c.email, '') AS email,
      COALESCE(c.access_code, '') AS accessCode,
      COALESCE(c.status, '') AS status,
      COALESCE(e.course_slug, '') AS courseSlug,
      e.batch_key AS batchKey,
      e.batch_label AS batchLabel,
      COALESCE(e.status, '') AS enrollmentStatus,
      e.paid_at AS paidAt
    FROM family_children c
    LEFT JOIN family_child_enrollments e ON e.child_id = c.id
    WHERE c.family_id = ${family.id}
      AND c.parent_account_id = ${parentAccountId}
    ORDER BY c.id ASC, e.id ASC
  `)
  const seats = await prisma.$queryRaw<FamilySeatRow[]>(Prisma.sql`
    SELECT
      COALESCE(course_slug, '') AS courseSlug,
      batch_key AS batchKey,
      batch_label AS batchLabel,
      CAST(COALESCE(seats_purchased, 0) AS SIGNED) AS seatsPurchased,
      CAST(COALESCE(seats_consumed, 0) AS SIGNED) AS seatsUsed,
      CAST(GREATEST(0, COALESCE(seats_purchased, 0) - COALESCE(seats_consumed, 0)) AS SIGNED) AS seatsAvailable,
      '' AS paymentProvider,
      '' AS paymentCurrency
    FROM family_seat_balances
    WHERE family_id = ${family.id}
    ORDER BY course_slug ASC, batch_label ASC, batch_key ASC
  `)

  return {
    family: {
      familyUuid: family.familyUuid || "",
      parentName: family.parentName || "",
      parentEmail: family.parentEmail || "",
      parentPhone: family.parentPhone || "",
      status: family.status || ""
    },
    seats: seats.map((seat) => ({
      ...seat,
      seatsPurchased: Number(seat.seatsPurchased || 0),
      seatsUsed: Number(seat.seatsUsed || 0),
      seatsAvailable: Number(seat.seatsAvailable || 0)
    })),
    children: children.map((child) => ({
      ...child,
      childId: Number(child.childId || 0)
    }))
  }
}

export async function listActiveLearningCourseOptions(): Promise<LearningCourseOption[]> {
  const rows = await prisma.$queryRaw<Omit<LearningCourseOption, "batches">[]>(Prisma.sql`
    SELECT
      course_slug AS courseSlug,
      course_title AS courseTitle,
      enrollment_mode AS enrollmentMode
    FROM tochukwu_learning_courses
    WHERE is_published = 1
      AND payment_methods IS NOT NULL
      AND TRIM(payment_methods) <> ''
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
      AND (
        COALESCE(price_ngn_minor, 0) > 0
        OR COALESCE(price_gbp_minor, 0) > 0
        OR COALESCE(price_usd_minor, 0) > 0
        OR COALESCE(price_eur_minor, 0) > 0
      )
    ORDER BY course_title ASC, course_slug ASC
  `)

  const courses = rows.map((row) => ({
    courseSlug: cleanText(row.courseSlug, 120),
    courseTitle: cleanText(row.courseTitle, 220) || courseName(row.courseSlug),
    enrollmentMode: cleanText(row.enrollmentMode, 40) || "batch",
    batches: []
  })).filter((row) => row.courseSlug)

  if (!courses.length) return []

  const batchRows = await prisma.$queryRaw<
    Array<{
      courseSlug: string
      batchKey: string
      batchLabel: string
      seatLimit: number | bigint | null
      isActive: number | bigint | boolean | null
      enrolledCount: number | bigint | null
    }>
  >(Prisma.sql`
    SELECT
      b.course_slug AS courseSlug,
      b.batch_key AS batchKey,
      b.batch_label AS batchLabel,
      b.seat_limit AS seatLimit,
      b.is_active AS isActive,
      (
        COALESCE((
          SELECT SUM(CASE WHEN seat_count IS NULL OR seat_count < 1 THEN 1 ELSE seat_count END)
          FROM course_orders
          WHERE course_slug COLLATE utf8mb4_unicode_ci = b.course_slug COLLATE utf8mb4_unicode_ci
            AND batch_key COLLATE utf8mb4_unicode_ci = b.batch_key COLLATE utf8mb4_unicode_ci
            AND status = 'paid'
        ), 0)
        +
        COALESCE((
          SELECT SUM(CASE WHEN seat_count IS NULL OR seat_count < 1 THEN 1 ELSE seat_count END)
          FROM course_manual_payments
          WHERE course_slug COLLATE utf8mb4_unicode_ci = b.course_slug COLLATE utf8mb4_unicode_ci
            AND batch_key COLLATE utf8mb4_unicode_ci = b.batch_key COLLATE utf8mb4_unicode_ci
            AND status = 'approved'
        ), 0)
      ) AS enrolledCount
    FROM course_batches b
    WHERE b.is_active = 1
      OR (b.course_slug COLLATE utf8mb4_unicode_ci = 'prompt-to-profit-holiday' COLLATE utf8mb4_unicode_ci AND b.status = 'open')
    ORDER BY b.course_slug ASC, b.is_active DESC, b.batch_start_at IS NULL ASC, b.batch_start_at ASC, b.created_at DESC
  `)

  const batchesByCourse = new Map<string, LearningCourseBatchOption[]>()
  const courseSlugSet = new Set(courses.map((course) => course.courseSlug))
  batchRows.forEach((row) => {
    const courseSlug = cleanText(row.courseSlug, 120)
    if (!courseSlugSet.has(courseSlug)) return
    if (batchlessLearningCourseSlugs.has(courseSlug)) return
    const seatLimit = row.seatLimit === null || row.seatLimit === undefined ? null : Number(row.seatLimit)
    const enrolledCount = Number(row.enrolledCount || 0)
    const batch: LearningCourseBatchOption = {
      batchKey: cleanText(row.batchKey, 64),
      batchLabel: cleanText(row.batchLabel, 120) || cleanText(row.batchKey, 64),
      remainingSeats: seatLimit === null ? null : Math.max(0, seatLimit - enrolledCount),
      isActive: Boolean(Number(row.isActive || 0))
    }
    if (!batch.batchKey) return
    const existing = batchesByCourse.get(courseSlug) || []
    existing.push(batch)
    batchesByCourse.set(courseSlug, existing)
  })

  return courses.map((course) => ({
    ...course,
    enrollmentMode: batchlessLearningCourseSlugs.has(course.courseSlug) ? "immediate" : course.enrollmentMode,
    batches: batchesByCourse.get(course.courseSlug) || []
  }))
}

export async function listStudentDomains(accountId: bigint): Promise<StudentDomainRow[]> {
  const rows = await prisma.$queryRaw<(Omit<StudentDomainRow, "selectedServices"> & { selectedServicesJson: string | null })[]>(Prisma.sql`
    SELECT
      domain_name AS domainName,
      COALESCE(provider, '') AS provider,
      COALESCE(status, '') AS status,
      CAST(COALESCE(years, 1) AS SIGNED) AS years,
      selected_services_json AS selectedServicesJson,
      COALESCE(auto_renew_enabled, 0) AS autoRenewEnabled,
      purchase_currency AS purchaseCurrency,
      purchase_amount_minor AS purchaseAmountMinor,
      COALESCE(provider_order_id, '') AS providerOrderId,
      registered_at AS registeredAt,
      renewal_due_at AS renewalDueAt,
      last_synced_at AS lastSyncedAt,
      created_at AS createdAt
    FROM user_domains
    WHERE account_id = ${accountId}
    ORDER BY created_at DESC
    LIMIT 200
  `)

  return rows.map((row) => ({
    ...row,
    years: Number(row.years || 1),
    selectedServices: parseSelectedServicesJson(row.selectedServicesJson),
    autoRenewEnabled: Boolean(row.autoRenewEnabled),
    purchaseAmountMinor: row.purchaseAmountMinor == null ? null : Number(row.purchaseAmountMinor)
  }))
}

export async function listStudentDomainOrders(accountId: bigint): Promise<StudentDomainOrderRow[]> {
  const rows = await prisma.$queryRaw<(Omit<StudentDomainOrderRow, "selectedServices"> & { selectedServicesJson: string | null })[]>(Prisma.sql`
    SELECT
      COALESCE(order_uuid, '') AS orderUuid,
      COALESCE(domain_name, '') AS domainName,
      CAST(COALESCE(years, 1) AS SIGNED) AS years,
      COALESCE(provider, '') AS provider,
      COALESCE(status, '') AS status,
      COALESCE(payment_provider, '') AS paymentProvider,
      COALESCE(payment_status, '') AS paymentStatus,
      selected_services_json AS selectedServicesJson,
      COALESCE(auto_renew_enabled, 0) AS autoRenewEnabled,
      purchase_currency AS purchaseCurrency,
      purchase_amount_minor AS purchaseAmountMinor,
      COALESCE(provider_order_id, '') AS providerOrderId,
      COALESCE(notes, '') AS notes,
      registered_at AS registeredAt,
      created_at AS createdAt
    FROM domain_orders
    WHERE account_id = ${accountId}
    ORDER BY created_at DESC
    LIMIT 60
  `)

  return rows.map((row) => ({
    ...row,
    years: Number(row.years || 1),
    selectedServices: parseSelectedServicesJson(row.selectedServicesJson),
    autoRenewEnabled: Boolean(row.autoRenewEnabled),
    purchaseAmountMinor: row.purchaseAmountMinor == null ? null : Number(row.purchaseAmountMinor)
  }))
}

export async function listStudentDomainNetlifyAccess(accountId: bigint): Promise<StudentDomainNetlifyRow[]> {
  return prisma.$queryRaw<StudentDomainNetlifyRow[]>(Prisma.sql`
    SELECT
      COALESCE(domain_name, '') AS domainName,
      COALESCE(netlify_email, '') AS netlifyEmail,
      COALESCE(netlify_workspace, '') AS netlifyWorkspace,
      COALESCE(netlify_site_name, '') AS netlifySiteName,
      COALESCE(connection_method, '') AS connectionMethod,
      COALESCE(status, '') AS status,
      updated_at AS updatedAt
    FROM tochukwu_user_domain_netlify_access
    WHERE account_id = ${accountId}
    ORDER BY updated_at DESC
    LIMIT 200
  `).catch(() => [])
}

export async function listStudentProjects(email: string): Promise<StudentProjectRow[]> {
  const normalized = String(email || "").trim().toLowerCase()
  if (!normalized) return []
  const rows = await prisma.$queryRaw<
    (Omit<StudentProjectRow, "dashboardUrl"> & { clientAccessToken: string | null })[]
  >(Prisma.sql`
    SELECT
      job_uuid AS jobUuid,
      COALESCE(business_name, '') AS businessName,
      COALESCE(status, '') AS status,
      COALESCE(payment_status, '') AS paymentStatus,
      COALESCE(publish_status, '') AS publishStatus,
      created_at AS createdAt,
      updated_at AS updatedAt,
      client_access_token AS clientAccessToken
    FROM leadpage_jobs
    WHERE LOWER(email) = ${normalized}
    ORDER BY created_at DESC
    LIMIT 50
  `)

  return rows.map((row) => ({
    ...row,
    dashboardUrl: row.clientAccessToken
      ? `/dashboard/project?job_uuid=${encodeURIComponent(row.jobUuid)}&access=${encodeURIComponent(row.clientAccessToken)}`
      : ""
  }))
}

export async function listStudentBusinessPlans(email: string): Promise<StudentBusinessPlanRow[]> {
  const normalized = String(email || "").trim().toLowerCase()
  if (!normalized) return []
  const rows = await prisma.$queryRaw<StudentBusinessPlanRow[]>(Prisma.sql`
    SELECT
      plan_uuid AS planUuid,
      COALESCE(order_uuid, '') AS orderUuid,
      COALESCE(business_name, '') AS businessName,
      COALESCE(purpose, '') AS purpose,
      COALESCE(currency, '') AS currency,
      COALESCE(CASE WHEN LOWER(COALESCE(verification_status, '')) = 'verified' THEN plan_text ELSE '' END, '') AS planText,
      COALESCE(verification_status, 'awaiting_verification') AS verificationStatus,
      verified_at AS verifiedAt,
      CASE WHEN LOWER(COALESCE(verification_status, '')) = 'verified' THEN 1 ELSE 0 END AS canDownload,
      COALESCE(generated_at, created_at) AS generatedAt
    FROM tochukwu_business_plan_orders
    WHERE LOWER(email) = ${normalized}
      AND payment_status = 'paid'
      AND plan_status = 'generated'
      AND plan_text IS NOT NULL
      AND plan_text != ''
    ORDER BY COALESCE(generated_at, created_at) DESC
  `)

  return rows.map((row) => ({
    ...row,
    canDownload: Boolean(row.canDownload)
  }))
}

export async function listStudentCertificates(accountId: bigint): Promise<StudentCertificateRow[]> {
  const individualRows = await prisma.$queryRaw<Array<Omit<StudentCertificateRow, "certificateUrl">>>(Prisma.sql`
    SELECT
      course_slug AS courseSlug,
      certificate_no AS certificateNo,
      COALESCE(recipient_name, '') AS recipientName,
      COALESCE(status, '') AS status,
      issued_at AS issuedAt
    FROM student_certificates
    WHERE account_id = ${accountId}
    ORDER BY issued_at DESC
  `)
  const schoolRows = await prisma.$queryRaw<Array<Omit<StudentCertificateRow, "certificateUrl">>>(Prisma.sql`
    SELECT
      c.course_slug AS courseSlug,
      c.certificate_no AS certificateNo,
      COALESCE(c.recipient_name, s.full_name, '') AS recipientName,
      COALESCE(c.status, '') AS status,
      c.issued_at AS issuedAt
    FROM school_certificates c
    JOIN school_students s ON s.id = c.student_id
    WHERE s.account_id = ${accountId}
      AND c.status = 'issued'
    ORDER BY c.issued_at DESC
  `).catch(() => [])

  return [...individualRows, ...schoolRows]
    .map((row) => {
      const certificateNo = String(row.certificateNo || "")
      const schoolIssued = schoolRows.some((schoolRow) => String(schoolRow.certificateNo || "") === certificateNo)
      return {
        ...row,
        certificateUrl: `${schoolIssued ? "/schools/certificate" : "/dashboard/certificate"}?certificate_no=${encodeURIComponent(certificateNo)}`
      }
    })
    .sort((a, b) => new Date(b.issuedAt || 0).getTime() - new Date(a.issuedAt || 0).getTime())
}

async function ensureStudentCertificateVerificationColumns() {
  await addColumnIfMissing("student_certificates", "project_url", "TEXT NULL").catch(() => null)
  await addColumnIfMissing("student_certificates", "project_verified_at", "DATETIME NULL").catch(() => null)
  await addColumnIfMissing("student_certificates", "project_status_at_issue", "VARCHAR(80) NULL").catch(() => null)
  await addColumnIfMissing("student_certificates", "share_image_url", "TEXT NULL").catch(() => null)
}

export async function getStudentCertificatePublic(certificateNo: string): Promise<StudentCertificatePublic | null> {
  await ensureStudentCertificateVerificationColumns()
  const certNo = cleanText(certificateNo, 140).toUpperCase()
  if (!certNo) return null
  const rows = await prisma.$queryRaw<
    Array<{
      certificateNo: string | null
      recipientName: string | null
      issuedAt: Date | null
      courseSlug: string | null
      studentName: string | null
      studentEmail: string | null
      projectUrl: string | null
      projectVerifiedAt: Date | null
      projectStatusAtIssue: string | null
    }>
  >(Prisma.sql`
    SELECT
      c.certificate_no AS certificateNo,
      c.recipient_name AS recipientName,
      c.issued_at AS issuedAt,
      c.course_slug AS courseSlug,
      c.project_url AS projectUrl,
      c.project_verified_at AS projectVerifiedAt,
      c.project_status_at_issue AS projectStatusAtIssue,
      a.full_name AS studentName,
      a.email AS studentEmail
    FROM student_certificates c
    JOIN student_accounts a ON a.id = c.account_id
    WHERE c.certificate_no COLLATE utf8mb4_unicode_ci = ${certNo} COLLATE utf8mb4_unicode_ci
      AND c.status = 'issued'
    LIMIT 1
  `)
  const row = rows[0]
  if (!row) return null
  const courseSlug = cleanText(row.courseSlug, 120)
  return {
    certificateNo: cleanText(row.certificateNo, 140),
    issuedAt: row.issuedAt ? row.issuedAt.toISOString() : null,
    courseSlug,
    courseName: courseName(courseSlug),
    studentName: cleanText(row.recipientName || row.studentName, 180),
    studentEmail: cleanText(row.studentEmail, 220),
    projectUrl: cleanText(row.projectUrl, 1200),
    projectVerifiedAt: row.projectVerifiedAt ? row.projectVerifiedAt.toISOString() : null,
    projectStatusAtIssue: cleanText(row.projectStatusAtIssue, 80)
  }
}

export async function getStudentAffiliateSummary(accountId: bigint): Promise<StudentAffiliateSummary> {
  await ensureAffiliateAlignment()
  await matureAffiliateCommissions().catch(() => 0)
  const defaultPolicy = {
    defaultHoldDays: defaultAffiliateHoldDays(),
    minPayoutMinor: affiliateMinPayoutMinor("NGN"),
    payoutCurrency: "NGN",
    antiAbuseSummary: "Self-referrals, duplicate/fake onboarding, suspicious patterns, and policy violations are blocked and may lead to withheld/reversed commissions.",
    schoolReferralNote: "School referrals remain tied to your affiliate profile, so you continue earning on each new student onboarded by that school while the rule stays active.",
    schoolProgram: {
      courseSlug: "prompt-to-profit-schools",
      minSeats: schoolMinSeats(),
      pricePerStudentMinor: schoolsPricePerStudentMinor()
    }
  }

  const schoolRows = await prisma.$queryRaw<{ id: bigint }[]>(Prisma.sql`
    SELECT ss.id
    FROM school_students ss
    JOIN school_accounts sc ON sc.id = ss.school_id
    WHERE ss.account_id = ${accountId}
      AND ss.status = 'active'
      AND sc.status = 'active'
    ORDER BY ss.id DESC
    LIMIT 1
  `).catch(() => [])
  const eligibilityStatus = schoolRows.length ? "ineligible_school_student" : "eligible"
  const eligibilityReason = schoolRows.length ? "School-linked students cannot be affiliates." : null

  let profiles = await prisma.$queryRaw<
    {
      id: bigint
      profileUuid: string | null
      affiliateCode: string | null
      status: string | null
      eligibilityStatus: string | null
      eligibilityReason: string | null
      countryCode: string | null
      payoutCurrency: string | null
      payoutProvider: string | null
    }[]
  >(Prisma.sql`
    SELECT
      id,
      profile_uuid AS profileUuid,
      affiliate_code AS affiliateCode,
      status,
      eligibility_status AS eligibilityStatus,
      eligibility_reason AS eligibilityReason,
      country_code AS countryCode,
      payout_currency AS payoutCurrency,
      payout_provider AS payoutProvider
    FROM tochukwu_affiliate_profiles
    WHERE account_id = ${accountId}
    LIMIT 1
  `)

  if (!profiles[0]) {
    const now = formatSqlDate()
    let code = ""
    for (let i = 0; i < 10; i += 1) {
      code = randomAffiliateCode(8)
      try {
        await prisma.$executeRaw(Prisma.sql`
          INSERT INTO tochukwu_affiliate_profiles
            (profile_uuid, account_id, affiliate_code, status, eligibility_status, eligibility_reason, country_code, payout_currency, payout_provider, created_at, updated_at)
          VALUES
            (${`aff_${randomUUID().replace(/-/g, "")}`}, ${accountId}, ${code}, 'active', ${eligibilityStatus}, ${eligibilityReason}, 'NG', 'NGN', 'paystack', ${now}, ${now})
        `)
        break
      } catch {
        code = ""
      }
    }
    if (code) {
      profiles = await prisma.$queryRaw(Prisma.sql`
        SELECT
          id,
          profile_uuid AS profileUuid,
          affiliate_code AS affiliateCode,
          status,
          eligibility_status AS eligibilityStatus,
          eligibility_reason AS eligibilityReason,
          country_code AS countryCode,
          payout_currency AS payoutCurrency,
          payout_provider AS payoutProvider
        FROM tochukwu_affiliate_profiles
        WHERE account_id = ${accountId}
        LIMIT 1
      `)
    }
  }

  const profile = profiles[0]
  if (!profile) {
    return {
      profile: null,
      policy: defaultPolicy,
      earnings: {
        earnedMinor: 0,
        pendingMinor: 0,
        approvedMinor: 0,
        paidMinor: 0,
        blockedMinor: 0,
        currency: "NGN",
        totalCount: 0
      },
      directCourseLinks: [],
      eligibleCourses: [],
      referrals: [],
      payouts: []
    }
  }

  if (profile.eligibilityStatus !== eligibilityStatus || String(profile.eligibilityReason || "") !== String(eligibilityReason || "")) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE tochukwu_affiliate_profiles
      SET eligibility_status = ${eligibilityStatus}, eligibility_reason = ${eligibilityReason}, updated_at = ${formatSqlDate()}
      WHERE id = ${profile.id}
      LIMIT 1
    `)
    profile.eligibilityStatus = eligibilityStatus
    profile.eligibilityReason = eligibilityReason
  }

  const payoutCurrency = profile.payoutCurrency || "NGN"
  const policy = {
    ...defaultPolicy,
    minPayoutMinor: affiliateMinPayoutMinor(payoutCurrency),
    payoutCurrency,
  }
  const minSeats = policy.schoolProgram.minSeats

  const earningsRows = await prisma.$queryRaw<
    {
      earnedMinor: number
      pendingMinor: number
      approvedMinor: number
      paidMinor: number
      blockedMinor: number
      currency: string | null
      totalCount: number
    }[]
  >(Prisma.sql`
    SELECT
      CAST(COALESCE(SUM(commission_amount_minor), 0) AS SIGNED) AS earnedMinor,
      CAST(COALESCE(SUM(CASE WHEN status = 'pending' THEN commission_amount_minor ELSE 0 END), 0) AS SIGNED) AS pendingMinor,
      CAST(COALESCE(SUM(CASE WHEN status = 'approved' THEN commission_amount_minor ELSE 0 END), 0) AS SIGNED) AS approvedMinor,
      CAST(COALESCE(SUM(CASE WHEN status = 'paid' THEN commission_amount_minor ELSE 0 END), 0) AS SIGNED) AS paidMinor,
      CAST(COALESCE(SUM(CASE WHEN status IN ('blocked','reversed') THEN commission_amount_minor ELSE 0 END), 0) AS SIGNED) AS blockedMinor,
      COALESCE(MAX(currency), 'NGN') AS currency,
      CAST(COUNT(*) AS SIGNED) AS totalCount
    FROM tochukwu_affiliate_commissions
    WHERE affiliate_profile_id = ${profile.id}
  `)
  const referrals = await prisma.$queryRaw<StudentAffiliateSummary["referrals"]>(Prisma.sql`
    SELECT
      commission_uuid AS commissionUuid,
      COALESCE(order_uuid, '') AS orderUuid,
      COALESCE(course_slug, '') AS courseSlug,
      COALESCE(buyer_email, '') AS buyerEmail,
      COALESCE(buyer_email, '') AS buyerEmailMasked,
      COALESCE(currency, 'NGN') AS currency,
      CAST(COALESCE(order_amount_minor, 0) AS SIGNED) AS orderAmountMinor,
      CAST(COALESCE(commission_amount_minor, 0) AS SIGNED) AS commissionAmountMinor,
      COALESCE(status, '') AS status,
      created_at AS createdAt
    FROM tochukwu_affiliate_commissions
    WHERE affiliate_profile_id = ${profile.id}
    ORDER BY created_at DESC
    LIMIT 100
  `)
  const payoutAccounts = await prisma.$queryRaw<NonNullable<StudentAffiliateSummary["profile"]>["payoutAccount"][]>(Prisma.sql`
    SELECT
      COALESCE(country_code, '') AS countryCode,
      COALESCE(currency, '') AS currency,
      COALESCE(payout_provider, '') AS payoutProvider,
      COALESCE(account_name, '') AS accountName,
      COALESCE(bank_code, '') AS bankCode,
      COALESCE(bank_name, '') AS bankName,
      COALESCE(account_number_masked, '') AS accountNumberMasked,
      COALESCE(is_verified, 0) AS isVerified
    FROM tochukwu_affiliate_payout_accounts
    WHERE affiliate_profile_id = ${profile.id}
      AND status = 'active'
    ORDER BY id DESC
    LIMIT 1
  `).catch(() => [])
  const payouts = await prisma.$queryRaw<StudentAffiliateSummary["payouts"]>(Prisma.sql`
    SELECT
      COALESCE(b.batch_uuid, '') AS batchUuid,
      b.period_start AS periodStart,
      b.period_end AS periodEnd,
      COALESCE(b.currency, 'NGN') AS currency,
      CAST(COALESCE(b.total_items, 0) AS SIGNED) AS totalItems,
      CAST(COALESCE(b.total_amount_minor, 0) AS SIGNED) AS totalAmountMinor,
      COALESCE(b.status, '') AS status,
      b.created_at AS createdAt,
      b.completed_at AS completedAt
    FROM tochukwu_affiliate_payout_batches b
    JOIN tochukwu_affiliate_payout_items i ON i.payout_batch_id = b.id
    WHERE i.affiliate_profile_id = ${profile.id}
    GROUP BY b.id
    ORDER BY b.id DESC
    LIMIT 30
  `).catch(() => [])
  const eligibleCourses = await prisma.$queryRaw<StudentAffiliateSummary["eligibleCourses"]>(Prisma.sql`
    SELECT
      COALESCE(course_slug, '') AS courseSlug,
      COALESCE(commission_type, '') AS commissionType,
      CAST(COALESCE(commission_value, 0) AS SIGNED) AS commissionValue,
      COALESCE(commission_currency, 'NGN') AS commissionCurrency,
      CAST(COALESCE(min_order_amount_minor, 0) AS SIGNED) AS minOrderAmountMinor,
      CAST(COALESCE(hold_days, ${policy.defaultHoldDays}) AS SIGNED) AS holdDays,
      CAST(0 AS SIGNED) AS projectedMinCommissionMinor,
      CAST(0 AS SIGNED) AS projectedMinSeats
    FROM tochukwu_affiliate_course_rules
    WHERE is_affiliate_eligible = 1
      AND (starts_at IS NULL OR starts_at <= NOW())
      AND (ends_at IS NULL OR ends_at >= NOW())
    ORDER BY course_slug ASC
  `).catch(() => [])

  const earnings = earningsRows[0]
  const affiliateCode = profile.affiliateCode || ""
  const base = affiliateBaseUrl()
  const encodedCode = encodeURIComponent(affiliateCode)
  const directCourseLinks = eligibleCourses
    .map((item) => ({
      courseSlug: item.courseSlug,
      link: base ? `${base}/courses/${item.courseSlug}/?ref=${encodedCode}` : `/courses/${item.courseSlug}/?ref=${encodedCode}`
    }))
    .filter((item) => item.courseSlug && affiliateCode)

  return {
    profile: {
      profileUuid: profile.profileUuid || "",
      affiliateCode,
      status: profile.status || "",
      eligibilityStatus: profile.eligibilityStatus || "",
      eligibilityReason: profile.eligibilityReason || null,
      countryCode: profile.countryCode || "NG",
      payoutCurrency,
      payoutProvider: profile.payoutProvider || "paystack",
      affiliateLink: affiliateCode ? (base ? `${base}/courses/?ref=${encodedCode}` : `/courses?ref=${encodedCode}`) : "",
      payoutAccount: payoutAccounts[0] ? {
        ...payoutAccounts[0],
        isVerified: Boolean(payoutAccounts[0].isVerified)
      } : null
    },
    policy,
    earnings: {
      earnedMinor: Number(earnings?.earnedMinor || 0),
      pendingMinor: Number(earnings?.pendingMinor || 0),
      approvedMinor: Number(earnings?.approvedMinor || 0),
      paidMinor: Number(earnings?.paidMinor || 0),
      blockedMinor: Number(earnings?.blockedMinor || 0),
      currency: earnings?.currency || payoutCurrency,
      totalCount: Number(earnings?.totalCount || 0)
    },
    directCourseLinks,
    eligibleCourses: eligibleCourses.map((row) => {
      const commissionType = String(row.commissionType || "").toLowerCase()
      const minOrderAmountMinor = Number(row.minOrderAmountMinor || 0)
      const commissionValue = Number(row.commissionValue || 0)
      let projectedMinCommissionMinor = 0
      if (row.courseSlug === "prompt-to-profit-schools") {
        projectedMinCommissionMinor = commissionType === "fixed"
          ? Math.max(0, commissionValue * minSeats)
          : Math.max(0, Math.floor((minOrderAmountMinor * Math.max(0, Math.min(commissionValue, 10000))) / 10000))
      }
      return {
        ...row,
        commissionValue,
        minOrderAmountMinor,
        holdDays: Number(row.holdDays || policy.defaultHoldDays),
        projectedMinCommissionMinor,
        projectedMinSeats: row.courseSlug === "prompt-to-profit-schools" ? minSeats : 0
      }
    }),
    referrals: referrals.map((row) => ({
      ...row,
      buyerEmailMasked: maskEmailAddress(row.buyerEmailMasked || row.buyerEmail),
      orderAmountMinor: Number(row.orderAmountMinor || 0),
      commissionAmountMinor: Number(row.commissionAmountMinor || 0)
    })),
    payouts: payouts.map((row) => ({
      ...row,
      totalItems: Number(row.totalItems || 0),
      totalAmountMinor: Number(row.totalAmountMinor || 0)
    }))
  }
}

export function courseName(slug: string) {
  const map: Record<string, string> = {
    "prompt-to-profit": "Prompt to Profit",
    "prompt-to-production": "Prompt to Profit Advanced",
    "prompt-to-profit-holiday": "Prompt to Profit Holiday",
    "prompt-to-profit-schools": "Prompt to Profit for Schools",
    "ai-for-everyday-business-owners": "AI for Everyday Business Owners"
  }
  return map[slug] || slug.split("-").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ")
}

export function formatMinorCurrency(currency: string | null, amountMinor: number) {
  const code = String(currency || "NGN").toUpperCase()
  const amount = Number(amountMinor || 0) / 100
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  } catch {
    return `${code} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
}

export function statusTone(status: string) {
  const value = String(status || "").toLowerCase()
  if (isPaidStatus(value)) return "student-status-paid"
  if (isPendingStatus(value)) return "student-status-pending"
  return "student-status-neutral"
}

export function statusLabel(status: string) {
  return String(status || "unknown").replace(/_/g, " ")
}
