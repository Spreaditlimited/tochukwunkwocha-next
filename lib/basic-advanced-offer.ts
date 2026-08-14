import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

export const BASIC_ADVANCED_COUPON_CODE = "BASIC50K"
export const BASIC_ADVANCED_DISCOUNT_NGN_MINOR = 5_000_000
export const BASIC_ADVANCED_PRICE_NGN_MINOR = 10_000_000
export const BASIC_ADVANCED_TARGET_COURSE = "prompt-to-production"
export const BASIC_ADVANCED_COHORT_START_WAT = "2026-10-05 19:00:00"

export const BASIC_COURSE_SLUGS = [
  "prompt-to-profit",
  "prompt-to-profit-holiday",
  "prompt-to-profit-job-seekers",
  "prompt-to-profit-children"
] as const

function clean(value: unknown, max = 320) {
  return String(value || "").trim().slice(0, max)
}

export function validCampaignEmail(value: unknown) {
  const email = clean(value).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return ""
  const domain = email.split("@")[1] || ""
  if (domain === "student-code.local" || domain === "localhost" || domain.endsWith(".local") || domain.endsWith(".localhost")) return ""
  return email
}

export async function emailHasBasicCourseAccess(value: unknown) {
  const email = validCampaignEmail(value)
  if (!email) return false
  const rows = await prisma.$queryRaw<Array<{ eligible: number | bigint }>>(Prisma.sql`
    SELECT EXISTS(
      SELECT 1 FROM course_orders o
      JOIN course_batches b
        ON b.course_slug COLLATE utf8mb4_unicode_ci = o.course_slug COLLATE utf8mb4_unicode_ci
       AND b.batch_key COLLATE utf8mb4_unicode_ci = o.batch_key COLLATE utf8mb4_unicode_ci
      WHERE LOWER(o.email) COLLATE utf8mb4_unicode_ci = ${email} COLLATE utf8mb4_unicode_ci
        AND o.course_slug IN (${Prisma.join(BASIC_COURSE_SLUGS)})
        AND o.status = 'paid'
        AND DATE_ADD(b.batch_start_at, INTERVAL 5 DAY) <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 HOUR)
      UNION ALL
      SELECT 1 FROM course_manual_payments m
      JOIN course_batches b
        ON b.course_slug COLLATE utf8mb4_unicode_ci = m.course_slug COLLATE utf8mb4_unicode_ci
       AND b.batch_key COLLATE utf8mb4_unicode_ci = m.batch_key COLLATE utf8mb4_unicode_ci
      WHERE LOWER(m.email) COLLATE utf8mb4_unicode_ci = ${email} COLLATE utf8mb4_unicode_ci
        AND m.course_slug IN (${Prisma.join(BASIC_COURSE_SLUGS)})
        AND m.status = 'approved'
        AND DATE_ADD(b.batch_start_at, INTERVAL 5 DAY) <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 HOUR)
      UNION ALL
      SELECT 1 FROM family_child_enrollments e
      JOIN family_accounts f ON f.id = e.family_id AND f.status = 'active'
      JOIN family_children c ON c.id = e.child_id AND c.family_id = e.family_id AND c.status = 'active'
      JOIN course_batches b
        ON b.course_slug COLLATE utf8mb4_unicode_ci = e.course_slug COLLATE utf8mb4_unicode_ci
       AND b.batch_key COLLATE utf8mb4_unicode_ci = e.batch_key COLLATE utf8mb4_unicode_ci
      WHERE LOWER(f.parent_email) COLLATE utf8mb4_unicode_ci = ${email} COLLATE utf8mb4_unicode_ci
        AND e.course_slug IN (${Prisma.join(BASIC_COURSE_SLUGS)})
        AND e.status = 'active'
        AND DATE_ADD(b.batch_start_at, INTERVAL 5 DAY) <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 HOUR)
      LIMIT 1
    ) AS eligible
  `)
  return Number(rows[0]?.eligible || 0) === 1
}

export async function emailHasAdvancedCourseHistory(value: unknown) {
  const email = validCampaignEmail(value)
  if (!email) return false
  const rows = await prisma.$queryRaw<Array<{ enrolled: number | bigint }>>(Prisma.sql`
    SELECT EXISTS(
      SELECT 1 FROM course_orders o
      WHERE LOWER(o.email) COLLATE utf8mb4_unicode_ci = ${email} COLLATE utf8mb4_unicode_ci
        AND o.course_slug COLLATE utf8mb4_unicode_ci = ${BASIC_ADVANCED_TARGET_COURSE} COLLATE utf8mb4_unicode_ci
        AND o.status IN ('paid', 'refunded')
      UNION ALL
      SELECT 1 FROM course_manual_payments m
      WHERE LOWER(m.email) COLLATE utf8mb4_unicode_ci = ${email} COLLATE utf8mb4_unicode_ci
        AND m.course_slug COLLATE utf8mb4_unicode_ci = ${BASIC_ADVANCED_TARGET_COURSE} COLLATE utf8mb4_unicode_ci
        AND m.status IN ('approved', 'refunded')
      UNION ALL
      SELECT 1 FROM family_child_enrollments e
      JOIN family_accounts f ON f.id = e.family_id
      WHERE LOWER(f.parent_email) COLLATE utf8mb4_unicode_ci = ${email} COLLATE utf8mb4_unicode_ci
        AND e.course_slug COLLATE utf8mb4_unicode_ci = ${BASIC_ADVANCED_TARGET_COURSE} COLLATE utf8mb4_unicode_ci
      LIMIT 1
    ) AS enrolled
  `)
  return Number(rows[0]?.enrolled || 0) === 1
}
