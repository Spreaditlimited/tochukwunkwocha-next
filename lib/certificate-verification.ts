import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { addColumnIfMissing } from "@/lib/schema-guards"
import { absoluteUrl } from "@/lib/site-seo"
import { courseName } from "@/lib/student-dashboard"

const CERTIFICATE_PROOF_MARKER = "[CERTIFICATE_PROOF_WEBSITE]"

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function iso(value: unknown) {
  if (!value) return null
  const date = new Date(value as string)
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

function normalizeUrl(value: unknown) {
  const raw = clean(value, 1200)
  if (!raw) return ""
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    if (!["http:", "https:"].includes(url.protocol)) return ""
    return url.toString()
  } catch {
    return ""
  }
}

export type VerifiedCertificate = {
  source: "student" | "school"
  certificateNo: string
  issuedAt: string | null
  courseSlug: string
  courseName: string
  recipientName: string
  issuerName: string
  schoolName: string
  projectUrl: string
  projectVerifiedAt: string | null
  projectStatusAtIssue: string
  verificationUrl: string
  shareImageUrl: string
}

export async function ensureCertificateVerificationColumns() {
  await addColumnIfMissing("student_certificates", "project_url", "TEXT NULL").catch(() => null)
  await addColumnIfMissing("student_certificates", "project_verified_at", "DATETIME NULL").catch(() => null)
  await addColumnIfMissing("student_certificates", "project_status_at_issue", "VARCHAR(80) NULL").catch(() => null)
  await addColumnIfMissing("student_certificates", "share_image_url", "TEXT NULL").catch(() => null)

  await addColumnIfMissing("school_certificates", "project_url", "TEXT NULL").catch(() => null)
  await addColumnIfMissing("school_certificates", "project_verified_at", "DATETIME NULL").catch(() => null)
  await addColumnIfMissing("school_certificates", "project_status_at_issue", "VARCHAR(80) NULL").catch(() => null)
  await addColumnIfMissing("school_certificates", "share_image_url", "TEXT NULL").catch(() => null)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS student_certificate_issuance_keys (
      id BIGINT NOT NULL AUTO_INCREMENT,
      account_id BIGINT NOT NULL,
      course_slug VARCHAR(120) NOT NULL,
      batch_key VARCHAR(64) NOT NULL DEFAULT '',
      certificate_no VARCHAR(140) NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_student_certificate_account_course_batch (account_id, course_slug, batch_key),
      UNIQUE KEY uniq_student_certificate_issuance_no (certificate_no)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRaw(Prisma.sql`
    INSERT IGNORE INTO student_certificate_issuance_keys
      (account_id, course_slug, batch_key, certificate_no, created_at, updated_at)
    SELECT account_id, course_slug, '', certificate_no, COALESCE(issued_at, created_at), COALESCE(updated_at, issued_at, created_at)
    FROM student_certificates
    WHERE status = 'issued'
  `)
}

export async function getLatestApprovedStudentProject(input: { accountId: bigint | number; courseSlug: string; batchKey?: string }) {
  const batchFilter = input.batchKey === undefined
    ? Prisma.empty
    : Prisma.sql`AND COALESCE(certificate_batch_key, '') = ${clean(input.batchKey, 64).toLowerCase()}`
  const rows = await prisma.$queryRaw<Array<{ projectUrl: string | null; approvedAt: Date | null }>>(Prisma.sql`
    SELECT submission_link AS projectUrl, reviewed_at AS approvedAt
    FROM tochukwu_learning_assignments
    WHERE account_id = ${input.accountId}
      AND course_slug COLLATE utf8mb4_unicode_ci = ${input.courseSlug} COLLATE utf8mb4_unicode_ci
      AND submission_kind = 'link'
      AND submission_text = ${CERTIFICATE_PROOF_MARKER}
      AND status = 'approved'
      ${batchFilter}
      AND submission_link IS NOT NULL
      AND submission_link <> ''
    ORDER BY COALESCE(reviewed_at, updated_at, created_at) DESC
    LIMIT 1
  `).catch(() => [])
  const row = rows[0]
  return {
    projectUrl: normalizeUrl(row?.projectUrl),
    projectVerifiedAt: row?.approvedAt || null
  }
}

export async function getVerifiedCertificate(certificateNo: string): Promise<VerifiedCertificate | null> {
  await ensureCertificateVerificationColumns()
  const certNo = clean(certificateNo, 140).toUpperCase()
  if (!certNo) return null

  const studentRows = await prisma.$queryRaw<Array<{
    accountId: bigint
    certificateNo: string | null
    recipientName: string | null
    studentName: string | null
    issuedAt: Date | null
    courseSlug: string | null
    projectUrl: string | null
    projectVerifiedAt: Date | null
    projectStatusAtIssue: string | null
  }>>(Prisma.sql`
    SELECT c.account_id AS accountId, c.certificate_no AS certificateNo, c.recipient_name AS recipientName,
      a.full_name AS studentName, c.issued_at AS issuedAt, c.course_slug AS courseSlug,
      c.project_url AS projectUrl, c.project_verified_at AS projectVerifiedAt,
      c.project_status_at_issue AS projectStatusAtIssue
    FROM student_certificates c
    JOIN student_accounts a ON a.id = c.account_id
    WHERE c.certificate_no COLLATE utf8mb4_unicode_ci = ${certNo} COLLATE utf8mb4_unicode_ci
      AND c.status = 'issued'
    LIMIT 1
  `).catch(() => [])

  const student = studentRows[0]
  if (student) {
    const courseSlug = clean(student.courseSlug, 120)
    const fallbackProject = !student.projectUrl
      ? await getLatestApprovedStudentProject({ accountId: student.accountId, courseSlug })
      : { projectUrl: "", projectVerifiedAt: null }
    const projectUrl = normalizeUrl(student.projectUrl) || fallbackProject.projectUrl
    return {
      source: "student",
      certificateNo: clean(student.certificateNo, 140),
      issuedAt: iso(student.issuedAt),
      courseSlug,
      courseName: courseName(courseSlug),
      recipientName: clean(student.recipientName || student.studentName, 180),
      issuerName: "Tochukwu Tech and AI Academy",
      schoolName: "",
      projectUrl,
      projectVerifiedAt: iso(student.projectVerifiedAt || fallbackProject.projectVerifiedAt),
      projectStatusAtIssue: clean(student.projectStatusAtIssue, 80) || (projectUrl ? "live_at_issue" : ""),
      verificationUrl: absoluteUrl(`/certificates/verify/${encodeURIComponent(clean(student.certificateNo, 140))}`),
      shareImageUrl: absoluteUrl(`/api/certificates/${encodeURIComponent(clean(student.certificateNo, 140))}/image`)
    }
  }

  const schoolRows = await prisma.$queryRaw<Array<{
    certificateNo: string | null
    recipientName: string | null
    studentName: string | null
    issuedAt: Date | null
    courseSlug: string | null
    schoolName: string | null
    websiteUrl: string | null
    projectUrl: string | null
    projectVerifiedAt: Date | null
    projectStatusAtIssue: string | null
  }>>(Prisma.sql`
    SELECT c.certificate_no AS certificateNo, c.recipient_name AS recipientName,
      s.full_name AS studentName, c.issued_at AS issuedAt, c.course_slug AS courseSlug,
      sc.school_name AS schoolName, s.website_url AS websiteUrl,
      c.project_url AS projectUrl, c.project_verified_at AS projectVerifiedAt,
      c.project_status_at_issue AS projectStatusAtIssue
    FROM school_certificates c
    JOIN school_students s ON s.id = c.student_id
    JOIN school_accounts sc ON sc.id = c.school_id
    WHERE c.certificate_no COLLATE utf8mb4_unicode_ci = ${certNo} COLLATE utf8mb4_unicode_ci
      AND c.status = 'issued'
    LIMIT 1
  `).catch(() => [])

  const school = schoolRows[0]
  if (!school) return null
  const courseSlug = clean(school.courseSlug, 120)
  const projectUrl = normalizeUrl(school.projectUrl) || normalizeUrl(school.websiteUrl)
  return {
    source: "school",
    certificateNo: clean(school.certificateNo, 140),
    issuedAt: iso(school.issuedAt),
    courseSlug,
    courseName: courseName(courseSlug),
    recipientName: clean(school.recipientName || school.studentName, 180),
    issuerName: "Tochukwu Tech and AI Academy",
    schoolName: clean(school.schoolName, 220),
    projectUrl,
    projectVerifiedAt: iso(school.projectVerifiedAt || school.issuedAt),
    projectStatusAtIssue: clean(school.projectStatusAtIssue, 80) || (projectUrl ? "live_at_issue" : ""),
    verificationUrl: absoluteUrl(`/certificates/verify/${encodeURIComponent(clean(school.certificateNo, 140))}`),
    shareImageUrl: absoluteUrl(`/api/certificates/${encodeURIComponent(clean(school.certificateNo, 140))}/image`)
  }
}

export function certificateProjectNote() {
  return "This project link was reviewed and live at the time this certificate was issued. Current availability may depend on the student's hosting, domain, or third-party service."
}
