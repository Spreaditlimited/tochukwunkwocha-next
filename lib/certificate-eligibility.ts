import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { addColumnIfMissing } from "@/lib/schema-guards"

export const CERTIFICATE_PROOF_MARKER = "[CERTIFICATE_PROOF_WEBSITE]"

export async function ensureCertificateEligibilityColumns() {
  await addColumnIfMissing(
    "tochukwu_learning_assignments",
    "certificate_eligible_at_submission",
    "TINYINT(1) NULL"
  )
  await addColumnIfMissing(
    "tochukwu_learning_assignments",
    "certificate_eligibility_checked_at",
    "DATETIME NULL"
  )
  await addColumnIfMissing(
    "tochukwu_learning_assignments",
    "certificate_eligibility_snapshot_json",
    "TEXT NULL"
  )
  await prisma.$executeRaw(Prisma.sql`
    UPDATE tochukwu_learning_assignments
    SET certificate_eligible_at_submission = 1,
        certificate_eligibility_checked_at = COALESCE(certificate_eligibility_checked_at, created_at),
        certificate_eligibility_snapshot_json = COALESCE(
          certificate_eligibility_snapshot_json,
          ${JSON.stringify({
            eligible: true,
            source: "legacy_guarded_certificate_proof_submission",
            note: "Backfilled because certificate proof submission endpoints required eligibility before acceptance."
          })}
        )
    WHERE certificate_eligible_at_submission IS NULL
      AND submission_kind = 'link'
      AND submission_text = ${CERTIFICATE_PROOF_MARKER}
  `)
}

export async function getCertificateCourseCompletion(accountId: bigint, courseSlug: string) {
  const rows = await prisma.$queryRaw<Array<{
    totalLessons: number | bigint | null
    completedLessons: number | bigint | null
  }>>(Prisma.sql`
    SELECT
      COUNT(l.id) AS totalLessons,
      SUM(CASE WHEN p.is_completed = 1 THEN 1 ELSE 0 END) AS completedLessons
    FROM tochukwu_learning_lessons l
    JOIN tochukwu_learning_modules m ON m.id = l.module_id
    JOIN tochukwu_learning_course_modules cm ON cm.module_id = m.id
    LEFT JOIN tochukwu_learning_lesson_progress p
      ON p.lesson_id = l.id
     AND p.account_id = ${accountId}
    WHERE cm.course_slug = ${courseSlug}
      AND l.is_active = 1
      AND cm.is_active = 1
  `)
  return {
    totalLessons: Number(rows[0]?.totalLessons || 0),
    completedLessons: Number(rows[0]?.completedLessons || 0)
  }
}

export function certificateEligibilitySnapshot(input: {
  totalLessons: number
  completedLessons: number
  source: string
}) {
  return JSON.stringify({
    eligible: input.totalLessons > 0 && input.completedLessons >= input.totalLessons,
    totalLessons: input.totalLessons,
    completedLessons: input.completedLessons,
    source: input.source,
    checkedAt: new Date().toISOString()
  })
}
