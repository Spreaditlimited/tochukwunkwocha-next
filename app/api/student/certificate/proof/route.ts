import { NextResponse } from "next/server"
import crypto from "crypto"

import {
  certificateEligibilitySnapshot,
  ensureCertificateEligibilityColumns,
  getCertificateCourseCompletion,
  getLearnerCertificateBatchKey
} from "@/lib/certificate-eligibility"
import { configuredLearningCourseSlugSql, dayLevelCourseSlugRegex } from "@/lib/learning-course-catalog"
import { prisma } from "@/lib/prisma"
import { requireStudent } from "@/lib/student-auth"

const CERTIFICATE_PROOF_MARKER = "[CERTIFICATE_PROOF_WEBSITE]"

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function normalizeCourseSlug(value: unknown) {
  return clean(value, 120).toLowerCase()
}

function normalizeUrl(value: unknown) {
  const raw = clean(value, 1500)
  try {
    const parsed = new URL(raw)
    if (!["http:", "https:"].includes(parsed.protocol)) return ""
    return parsed.toString()
  } catch {
    return ""
  }
}

async function hasCourseAccess(accountId: bigint, email: string, courseSlug: string) {
  const rows = await prisma.$queryRaw<{ id: bigint }[]>`
    SELECT id
    FROM course_orders
    WHERE LOWER(email) COLLATE utf8mb4_general_ci = ${email}
      AND course_slug = ${courseSlug}
      AND status = 'paid'
      AND COALESCE(buyer_type, 'student') <> 'family'
    LIMIT 1
  `
  if (rows.length) return true

  const manualRows = await prisma.$queryRaw<{ id: bigint }[]>`
    SELECT id
    FROM course_manual_payments
    WHERE LOWER(email) COLLATE utf8mb4_general_ci = ${email}
      AND course_slug = ${courseSlug}
      AND status = 'approved'
      AND COALESCE(buyer_type, 'student') <> 'family'
    LIMIT 1
  `
  if (manualRows.length) return true

  const familyRows = await prisma.$queryRaw<{ id: bigint }[]>`
    SELECT e.id
    FROM family_child_enrollments e
    JOIN family_children c ON c.id = e.child_id
    JOIN family_accounts f ON f.id = e.family_id
    WHERE c.account_id = ${accountId}
      AND c.status = 'active'
      AND f.status = 'active'
      AND e.status = 'active'
      AND e.course_slug = ${courseSlug}
    LIMIT 1
  `.catch(() => [])
  if (familyRows.length) return true

  const overrideRows = await prisma.$queryRaw<{ id: bigint }[]>`
    SELECT id
    FROM tochukwu_learning_access_overrides
    WHERE LOWER(email) COLLATE utf8mb4_general_ci = ${email}
      AND course_slug = ${courseSlug}
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
    LIMIT 1
  `.catch(() => [])
  return overrideRows.length > 0
}

async function courseFeatures(courseSlug: string) {
  const rows = await prisma.$queryRaw<
    Array<{ certificateProofRequired: number | bigint | boolean | null; certificateProofType: string | null }>
  >`
    SELECT f.certificate_proof_required AS certificateProofRequired,
           f.certificate_proof_type AS certificateProofType
    FROM tochukwu_learning_course_features f
    JOIN tochukwu_learning_courses c
      ON c.course_slug COLLATE utf8mb4_unicode_ci = f.course_slug COLLATE utf8mb4_unicode_ci
    WHERE f.course_slug = ${courseSlug}
      AND NOT EXISTS (
        SELECT 1
        FROM tochukwu_learning_modules lm
        WHERE lm.module_slug COLLATE utf8mb4_unicode_ci = c.course_slug COLLATE utf8mb4_unicode_ci
           OR lm.module_title COLLATE utf8mb4_unicode_ci = c.course_title COLLATE utf8mb4_unicode_ci
      )
      AND c.course_slug NOT REGEXP ${dayLevelCourseSlugRegex}
      AND (
        c.course_slug IN (${configuredLearningCourseSlugSql()})
        OR EXISTS (
          SELECT 1
          FROM course_batches cb
          WHERE cb.course_slug COLLATE utf8mb4_unicode_ci = c.course_slug COLLATE utf8mb4_unicode_ci
        )
      )
    LIMIT 1
  `
  return rows[0] || null
}

async function latestProofStatus(accountId: bigint, email: string, courseSlug: string, batchKey: string) {
  const rows = await prisma.$queryRaw<{ status: string | null }[]>`
    SELECT status
    FROM tochukwu_learning_assignments
    WHERE account_id = ${accountId}
      AND LOWER(student_email) COLLATE utf8mb4_general_ci = ${email}
      AND course_slug = ${courseSlug}
      AND submission_kind = 'link'
      AND submission_text = ${CERTIFICATE_PROOF_MARKER}
      AND COALESCE(certificate_batch_key, '') = ${batchKey}
    ORDER BY id DESC
    LIMIT 1
  `
  return clean(rows[0]?.status, 32).toLowerCase()
}

export async function POST(request: Request) {
  try {
    const session = await requireStudent()
    const body = await request.json()
    const courseSlug = normalizeCourseSlug(body.courseSlug || body.course_slug)
    const websiteUrl = normalizeUrl(body.websiteUrl || body.website_url)
    const email = session.account.email.toLowerCase()

    if (!courseSlug) return NextResponse.json({ ok: false, error: "Course is required." }, { status: 400 })
    if (!websiteUrl) return NextResponse.json({ ok: false, error: "Valid website URL is required." }, { status: 400 })
    if (!session.account.certificateNameConfirmedAt) {
      return NextResponse.json({ ok: false, error: "Confirm your profile name before submitting certificate proof." }, { status: 400 })
    }
    if (!(await hasCourseAccess(session.account.id, email, courseSlug))) {
      return NextResponse.json({ ok: false, error: "You do not have active access to this course." }, { status: 403 })
    }

    const features = await courseFeatures(courseSlug)
    if (!features || !Boolean(Number(features.certificateProofRequired || 0))) {
      return NextResponse.json({ ok: false, error: "Certificate proof is not required for this course." }, { status: 400 })
    }

    const completion = await getCertificateCourseCompletion(session.account.id, courseSlug)
    if (completion.totalLessons <= 0 || completion.completedLessons < completion.totalLessons) {
      return NextResponse.json({ ok: false, error: "Complete all lessons before submitting certificate proof." }, { status: 400 })
    }

    await ensureCertificateEligibilityColumns()
    const batchKey = await getLearnerCertificateBatchKey(session.account.id, email, courseSlug)
    const previousStatus = await latestProofStatus(session.account.id, email, courseSlug, batchKey)
    if (previousStatus === "approved") {
      return NextResponse.json({ ok: false, error: "Your certificate proof is already approved." }, { status: 400 })
    }
    if (["submitted", "pending"].includes(previousStatus)) {
      return NextResponse.json({ ok: false, error: "Your submitted proof is pending admin review." }, { status: 400 })
    }

    const now = new Date()
    const assignmentUuid = `asg_${crypto.randomUUID().replace(/-/g, "")}`
    const eligibilitySnapshot = certificateEligibilitySnapshot({
      ...completion,
      source: "student_certificate_proof_submission"
    })
    await prisma.$executeRaw`
      INSERT INTO tochukwu_learning_assignments
        (assignment_uuid, course_slug, account_id, student_email, student_name, submission_kind, submission_text,
         submission_link, status, certificate_batch_key, certificate_eligible_at_submission, certificate_eligibility_checked_at,
         certificate_eligibility_snapshot_json, created_at, updated_at)
      VALUES
        (${assignmentUuid}, ${courseSlug}, ${session.account.id}, ${email}, ${session.account.fullName},
         'link', ${CERTIFICATE_PROOF_MARKER}, ${websiteUrl}, 'submitted', ${batchKey}, 1, ${now},
         ${eligibilitySnapshot}, ${now}, ${now})
    `

    return NextResponse.json({
      ok: true,
      proof: {
        status: "submitted",
        submittedAt: now.toISOString(),
        websiteUrl
      },
      course: {
        courseSlug,
        certificateProofRequired: true,
        certificateProofType: clean(features.certificateProofType, 24) || "website_link"
      }
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not submit certificate proof." },
      { status: 500 }
    )
  }
}
