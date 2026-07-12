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
      price_eur_minor AS priceEurMinor
    FROM tochukwu_learning_courses
    WHERE course_slug COLLATE utf8mb4_unicode_ci = ${courseSlug} COLLATE utf8mb4_unicode_ci
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
    openBatches
  }
}
