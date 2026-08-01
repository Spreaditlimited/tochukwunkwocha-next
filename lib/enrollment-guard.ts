import { Prisma, type PrismaClient } from "@prisma/client"

import { prisma } from "@/lib/prisma"

type DatabaseClient = Prisma.TransactionClient | PrismaClient

export type EnrollmentSourceType = "course_order" | "manual_payment" | "family_child"

export type ExistingCourseEnrollment = {
  sourceType: EnrollmentSourceType
  sourceUuid: string
  email: string
  courseSlug: string
  batchKey: string
  batchLabel: string
}

type EnrollmentClaimInput = {
  email: string
  courseSlug: string
  sourceType: EnrollmentSourceType
  sourceUuid: string
  batchKey?: string | null
  batchLabel?: string | null
}

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

export function enrollmentEmailKey(value: unknown) {
  return clean(value, 190).toLowerCase()
}

export function enrollmentCourseKey(value: unknown) {
  return clean(value, 120).toLowerCase()
}

export class CourseEnrollmentConflictError extends Error {
  readonly code = "course_already_enrolled"
  readonly enrollment: ExistingCourseEnrollment

  constructor(enrollment: ExistingCourseEnrollment) {
    const batch = enrollment.batchLabel || enrollment.batchKey
    super(
      batch
        ? `This email already has access to this course in ${batch}. A batch change is available only when both the current batch and the target batch are still in the future. Sign in to check eligibility or contact support instead of paying again.`
        : "This email already has access to this course. Sign in to the student dashboard or contact support instead of paying again."
    )
    this.name = "CourseEnrollmentConflictError"
    this.enrollment = enrollment
  }
}

export function isCourseEnrollmentConflict(error: unknown): error is CourseEnrollmentConflictError {
  return error instanceof CourseEnrollmentConflictError
}

let enrollmentClaimTablePromise: Promise<void> | null = null

export function ensureEnrollmentClaimTable() {
  if (enrollmentClaimTablePromise) return enrollmentClaimTablePromise
  enrollmentClaimTablePromise = prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_course_enrollment_claims (
      id BIGINT NOT NULL AUTO_INCREMENT,
      email_key VARCHAR(190) NOT NULL,
      course_slug VARCHAR(120) NOT NULL,
      source_type VARCHAR(40) NOT NULL,
      source_uuid VARCHAR(80) NOT NULL,
      batch_key VARCHAR(64) NULL,
      batch_label VARCHAR(120) NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_enrollment_claim_email_course (email_key, course_slug),
      UNIQUE KEY uniq_tochukwu_enrollment_claim_source (source_type, source_uuid),
      KEY idx_tochukwu_enrollment_claim_course (course_slug, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).then(() => undefined).catch((error) => {
    enrollmentClaimTablePromise = null
    throw error
  })
  return enrollmentClaimTablePromise
}

async function findActiveIndividualEnrollment(
  client: DatabaseClient,
  input: {
    email: string
    courseSlug: string
    excludeSourceType?: EnrollmentSourceType
    excludeSourceUuid?: string
  }
): Promise<ExistingCourseEnrollment | null> {
  const email = enrollmentEmailKey(input.email)
  const courseSlug = enrollmentCourseKey(input.courseSlug)
  if (!email || !courseSlug) return null

  const excludedType = input.excludeSourceType || ""
  const excludedUuid = clean(input.excludeSourceUuid, 80)
  const [orders, manuals, family] = await Promise.all([
    client.$queryRaw<Array<{ sourceUuid: string; batchKey: string | null; batchLabel: string | null; grantedAt: Date | null }>>(Prisma.sql`
      SELECT COALESCE(order_uuid, CONCAT('order_', id)) AS sourceUuid,
             batch_key AS batchKey, batch_label AS batchLabel, COALESCE(paid_at, updated_at, created_at) AS grantedAt
      FROM course_orders
      WHERE LOWER(TRIM(email)) COLLATE utf8mb4_unicode_ci = ${email} COLLATE utf8mb4_unicode_ci
        AND LOWER(TRIM(course_slug)) COLLATE utf8mb4_unicode_ci = ${courseSlug} COLLATE utf8mb4_unicode_ci
        AND status = 'paid'
        AND COALESCE(buyer_type, 'student') <> 'family'
        AND NOT (${excludedType} = 'course_order' AND COALESCE(order_uuid, CONCAT('order_', id)) = ${excludedUuid})
      ORDER BY COALESCE(paid_at, updated_at, created_at) DESC
      LIMIT 1
    `),
    client.$queryRaw<Array<{ sourceUuid: string; batchKey: string | null; batchLabel: string | null; grantedAt: Date | null }>>(Prisma.sql`
      SELECT payment_uuid AS sourceUuid, batch_key AS batchKey, batch_label AS batchLabel,
             COALESCE(reviewed_at, updated_at, created_at) AS grantedAt
      FROM course_manual_payments
      WHERE LOWER(TRIM(email)) COLLATE utf8mb4_unicode_ci = ${email} COLLATE utf8mb4_unicode_ci
        AND LOWER(TRIM(course_slug)) COLLATE utf8mb4_unicode_ci = ${courseSlug} COLLATE utf8mb4_unicode_ci
        AND status = 'approved'
        AND COALESCE(buyer_type, 'student') <> 'family'
        AND NOT (${excludedType} = 'manual_payment' AND payment_uuid = ${excludedUuid})
      ORDER BY COALESCE(reviewed_at, updated_at, created_at) DESC
      LIMIT 1
    `),
    client.$queryRaw<Array<{ sourceUuid: string; batchKey: string | null; batchLabel: string | null; grantedAt: Date | null }>>(Prisma.sql`
      SELECT COALESCE(e.source_uuid, CONCAT('family_child_', e.id)) AS sourceUuid,
             e.batch_key AS batchKey, e.batch_label AS batchLabel,
             COALESCE(e.paid_at, e.updated_at, e.created_at) AS grantedAt
      FROM family_child_enrollments e
      JOIN family_children c ON c.id = e.child_id
      LEFT JOIN student_accounts a ON a.id = e.account_id
      WHERE LOWER(TRIM(COALESCE(a.email, c.email, ''))) COLLATE utf8mb4_unicode_ci = ${email} COLLATE utf8mb4_unicode_ci
        AND LOWER(TRIM(e.course_slug)) COLLATE utf8mb4_unicode_ci = ${courseSlug} COLLATE utf8mb4_unicode_ci
        AND e.status = 'active'
        AND c.status = 'active'
        AND NOT (${excludedType} = 'family_child' AND COALESCE(e.source_uuid, CONCAT('family_child_', e.id)) = ${excludedUuid})
      ORDER BY COALESCE(e.paid_at, e.updated_at, e.created_at) DESC
      LIMIT 1
    `).catch(() => [])
  ])

  const candidates = [
    orders[0] ? { sourceType: "course_order" as const, ...orders[0] } : null,
    manuals[0] ? { sourceType: "manual_payment" as const, ...manuals[0] } : null,
    family[0] ? { sourceType: "family_child" as const, ...family[0] } : null
  ].filter(Boolean) as Array<{
    sourceType: EnrollmentSourceType
    sourceUuid: string
    batchKey: string | null
    batchLabel: string | null
    grantedAt: Date | null
  }>
  candidates.sort((left, right) => new Date(right.grantedAt || 0).getTime() - new Date(left.grantedAt || 0).getTime())
  const existing = candidates[0]
  if (!existing) return null
  return {
    sourceType: existing.sourceType,
    sourceUuid: clean(existing.sourceUuid, 80),
    email,
    courseSlug,
    batchKey: clean(existing.batchKey, 64),
    batchLabel: clean(existing.batchLabel, 120)
  }
}

export async function assertNoActiveIndividualEnrollment(input: { email: string; courseSlug: string }) {
  const existing = await findActiveIndividualEnrollment(prisma, input)
  if (existing) throw new CourseEnrollmentConflictError(existing)
  return true
}

async function insertClaim(client: DatabaseClient, input: EnrollmentClaimInput) {
  const timestamp = new Date()
  await client.$executeRaw(Prisma.sql`
    INSERT IGNORE INTO tochukwu_course_enrollment_claims
      (email_key, course_slug, source_type, source_uuid, batch_key, batch_label, created_at, updated_at)
    VALUES
      (${enrollmentEmailKey(input.email)}, ${enrollmentCourseKey(input.courseSlug)}, ${input.sourceType},
       ${clean(input.sourceUuid, 80)}, ${clean(input.batchKey, 64) || null}, ${clean(input.batchLabel, 120) || null},
       ${timestamp}, ${timestamp})
  `)
}

export async function claimIndividualCourseEnrollment(client: DatabaseClient, input: EnrollmentClaimInput) {
  const email = enrollmentEmailKey(input.email)
  const courseSlug = enrollmentCourseKey(input.courseSlug)
  const sourceUuid = clean(input.sourceUuid, 80)
  if (!email || !courseSlug || !sourceUuid) throw new Error("Enrollment claim details are incomplete.")

  const existing = await findActiveIndividualEnrollment(client, {
    email,
    courseSlug,
    excludeSourceType: input.sourceType,
    excludeSourceUuid: sourceUuid
  })
  if (existing) {
    await insertClaim(client, existing)
    throw new CourseEnrollmentConflictError(existing)
  }

  await insertClaim(client, { ...input, email, courseSlug, sourceUuid })
  const owners = await client.$queryRaw<Array<{
    sourceType: EnrollmentSourceType
    sourceUuid: string
    batchKey: string | null
    batchLabel: string | null
  }>>(Prisma.sql`
    SELECT source_type AS sourceType, source_uuid AS sourceUuid, batch_key AS batchKey, batch_label AS batchLabel
    FROM tochukwu_course_enrollment_claims
    WHERE email_key = ${email} AND course_slug = ${courseSlug}
    LIMIT 1
    FOR UPDATE
  `)
  const owner = owners[0]
  if (!owner || owner.sourceType !== input.sourceType || owner.sourceUuid !== sourceUuid) {
    throw new CourseEnrollmentConflictError({
      sourceType: owner?.sourceType || "course_order",
      sourceUuid: clean(owner?.sourceUuid, 80),
      email,
      courseSlug,
      batchKey: clean(owner?.batchKey, 64),
      batchLabel: clean(owner?.batchLabel, 120)
    })
  }
  return true
}

export async function releaseIndividualCourseEnrollmentClaim(input: {
  sourceType: EnrollmentSourceType
  sourceUuid: string
}) {
  await ensureEnrollmentClaimTable()
  await prisma.$executeRaw`
    DELETE FROM tochukwu_course_enrollment_claims
    WHERE source_type = ${input.sourceType}
      AND source_uuid = ${clean(input.sourceUuid, 80)}
    LIMIT 1
  `
}

export function enrollmentConflictPayload(error: CourseEnrollmentConflictError) {
  return {
    ok: false as const,
    code: error.code,
    error: error.message,
    existingEnrollment: {
      courseSlug: error.enrollment.courseSlug,
      batchKey: error.enrollment.batchKey || null,
      batchLabel: error.enrollment.batchLabel || null
    },
    action: {
      label: "Open My Courses",
      href: "/dashboard/courses"
    }
  }
}
