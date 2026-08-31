import { Prisma } from "@prisma/client"

import { listCheckoutBatches, type CheckoutBatch } from "@/lib/payments/course-checkout"
import { prisma } from "@/lib/prisma"

export type PublicCourseSettings = {
  courseSlug: string
  courseTitle: string
  courseDescription: string | null
  enrollmentMode: string
  isEnrollmentLocked: boolean
  paymentMethods: string[]
  priceNgnMinor: number | null
  priceGbpMinor: number | null
  priceUsdMinor: number | null
  priceEurMinor: number | null
  activeLessonCount: number
  openBatches: CheckoutBatch[]
}

type CourseSettingsRow = {
  courseSlug: string
  courseTitle: string
  courseDescription: string | null
  enrollmentMode: string | null
  isEnrollmentLocked: number | bigint | boolean | null
  paymentMethods: string | null
  priceNgnMinor: number | bigint | null
  priceGbpMinor: number | bigint | null
  priceUsdMinor: number | bigint | null
  priceEurMinor: number | bigint | null
  activeLessonCount: number | bigint | null
}

function toMinor(value: unknown) {
  if (value === null || value === undefined) return null
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue > 0 ? Math.round(numberValue) : null
}

function paymentMethods(value: string | null) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

export async function getPublicCourseSettings(courseSlug: string): Promise<PublicCourseSettings | null> {
  const rows = await prisma.$queryRaw<CourseSettingsRow[]>(Prisma.sql`
    SELECT
      course_slug AS courseSlug,
      course_title AS courseTitle,
      course_description AS courseDescription,
      enrollment_mode AS enrollmentMode,
      is_enrollment_locked AS isEnrollmentLocked,
      payment_methods AS paymentMethods,
      price_ngn_minor AS priceNgnMinor,
      price_gbp_minor AS priceGbpMinor,
      price_usd_minor AS priceUsdMinor,
      price_eur_minor AS priceEurMinor,
      (
        SELECT COUNT(DISTINCT lesson.id)
        FROM tochukwu_learning_course_modules course_module
        JOIN tochukwu_learning_modules module
          ON module.id = course_module.module_id
         AND module.is_active = 1
        JOIN tochukwu_learning_lessons lesson
          ON lesson.module_id = module.id
         AND lesson.is_active = 1
         AND lesson.video_asset_id IS NOT NULL
        WHERE course_module.course_slug COLLATE utf8mb4_unicode_ci = course.course_slug COLLATE utf8mb4_unicode_ci
          AND course_module.is_active = 1
          AND (
            NOT EXISTS (
              SELECT 1
              FROM tochukwu_learning_module_batch_drips any_schedule
              WHERE any_schedule.module_id = module.id
            )
            OR EXISTS (
              SELECT 1
              FROM tochukwu_learning_module_batch_drips current_schedule
              JOIN course_batches current_batch
                ON current_batch.batch_key COLLATE utf8mb4_unicode_ci = current_schedule.batch_key COLLATE utf8mb4_unicode_ci
               AND current_batch.course_slug COLLATE utf8mb4_unicode_ci = course.course_slug COLLATE utf8mb4_unicode_ci
              WHERE current_schedule.module_id = module.id
                AND current_batch.is_active = 1
                AND current_batch.status = 'open'
            )
          )
      ) AS activeLessonCount
    FROM tochukwu_learning_courses course
    WHERE course.course_slug COLLATE utf8mb4_unicode_ci = ${courseSlug} COLLATE utf8mb4_unicode_ci
    LIMIT 1
  `)

  const course = rows[0]
  if (!course) return null

  const batches = await listCheckoutBatches(course.courseSlug)
  const openBatches = batches.filter((batch) => batch.status.toLowerCase() === "open")

  return {
    courseSlug: course.courseSlug,
    courseTitle: course.courseTitle,
    courseDescription: course.courseDescription,
    enrollmentMode: course.enrollmentMode || "batch",
    isEnrollmentLocked: Boolean(Number(course.isEnrollmentLocked || 0)),
    paymentMethods: paymentMethods(course.paymentMethods),
    priceNgnMinor: toMinor(course.priceNgnMinor),
    priceGbpMinor: toMinor(course.priceGbpMinor),
    priceUsdMinor: toMinor(course.priceUsdMinor),
    priceEurMinor: toMinor(course.priceEurMinor),
    activeLessonCount: Math.max(0, Number(course.activeLessonCount || 0)),
    openBatches
  }
}

export async function getCurrentPromptToProfitSettings() {
  const holiday = await getPublicCourseSettings("prompt-to-profit-holiday")
  if (holiday?.openBatches.length) return holiday
  return getPublicCourseSettings("prompt-to-profit")
}
