import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

export function canonicalizeSchoolCourseSlug(value: unknown) {
  const slug = clean(value, 120).toLowerCase()
  if (slug === "prompt-to-profit-for-schools" || slug === "prompt-to-profit-school") {
    return "prompt-to-profit-schools"
  }
  return slug
}

export function schoolCourseSlugScope(value: unknown) {
  const slug = canonicalizeSchoolCourseSlug(value)
  if (!slug) return []
  if (slug === "prompt-to-profit" || slug === "prompt-to-profit-schools") {
    return ["prompt-to-profit", "prompt-to-profit-schools"]
  }
  return [slug]
}

export function visibleSchoolCourseSlug(value: unknown) {
  const slug = canonicalizeSchoolCourseSlug(value)
  if (slug === "prompt-to-profit" || slug === "prompt-to-profit-schools") {
    return "prompt-to-profit-schools"
  }
  return slug || "prompt-to-profit-schools"
}

export async function hasActiveSchoolCourseAccess(input: {
  accountId: bigint | number | null | undefined
  email: string
  courseSlug: string
}) {
  const email = clean(input.email, 220).toLowerCase()
  const courseSlugs = schoolCourseSlugScope(input.courseSlug)
  if (!email || !courseSlugs.length) return false

  const identity = input.accountId
    ? Prisma.sql`(LOWER(ss.email) COLLATE utf8mb4_general_ci = ${email} OR ss.account_id = ${input.accountId})`
    : Prisma.sql`LOWER(ss.email) COLLATE utf8mb4_general_ci = ${email}`

  const rows = await prisma.$queryRaw<Array<{ allowed: number | bigint }>>(Prisma.sql`
    SELECT 1 AS allowed
    WHERE EXISTS (
      SELECT 1
      FROM school_students ss
      JOIN school_accounts sc ON sc.id = ss.school_id
      WHERE ${identity}
        AND ss.status = 'active'
        AND sc.status = 'active'
        AND sc.course_slug COLLATE utf8mb4_general_ci IN (${Prisma.join(courseSlugs)})
        AND COALESCE(sc.access_starts_at, sc.paid_at, sc.created_at) IS NOT NULL
        AND (sc.access_starts_at IS NULL OR sc.access_starts_at <= NOW())
        AND (sc.access_expires_at IS NULL OR sc.access_expires_at >= NOW())
        AND DATE_ADD(COALESCE(sc.access_starts_at, sc.paid_at, sc.created_at), INTERVAL 1 YEAR) >= NOW()
    )
    OR EXISTS (
      SELECT 1
      FROM school_students ss
      JOIN school_accounts sc ON sc.id = ss.school_id
      JOIN school_student_course_access access
        ON access.student_id = ss.id
       AND access.status = 'active'
      WHERE ${identity}
        AND ss.status = 'active'
        AND sc.status = 'active'
        AND access.course_slug COLLATE utf8mb4_general_ci IN (${Prisma.join(courseSlugs)})
        AND (sc.access_starts_at IS NULL OR sc.access_starts_at <= NOW())
        AND (sc.access_expires_at IS NULL OR sc.access_expires_at >= NOW())
    )
    LIMIT 1
  `).catch(() => [])

  return rows.length > 0
}
