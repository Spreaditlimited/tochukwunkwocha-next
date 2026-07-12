import crypto from "crypto"
import { Prisma } from "@prisma/client"

import { requireAdmin } from "@/lib/auth"
import { sendEmail } from "@/lib/email"
import { configuredLearningCourseSlugSql, dayLevelCourseSlugRegex } from "@/lib/learning-course-catalog"
import { prisma } from "@/lib/prisma"
import { createStudentPasswordResetToken } from "@/lib/student-auth"

export const CERTIFICATE_PROOF_MARKER = "[CERTIFICATE_PROOF_WEBSITE]"

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function normalizeCourseSlug(value: unknown) {
  return clean(value, 120).toLowerCase()
}

function normalizeAssignmentStatus(value: unknown) {
  const raw = clean(value, 32).toLowerCase()
  return ["submitted", "in_review", "needs_revision", "approved", "rejected"].includes(raw) ? raw : "submitted"
}

function normalizeAlumniMode(value: unknown) {
  const raw = clean(value, 24).toLowerCase()
  return ["none", "read_only", "full"].includes(raw) ? raw : "none"
}

function boolFlag(value: unknown) {
  return value === true || value === "on" || value === "1" || value === 1
}

function siteBaseUrl() {
  return clean(process.env.SITE_BASE_URL || "https://tochukwunkwocha.com", 240).replace(/\/$/, "")
}

function certificateNo() {
  return `TN-IND-${crypto.randomUUID().replace(/-/g, "").slice(0, 14).toUpperCase()}`
}

export async function ensureLearningSupportTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_learning_course_features (
      id BIGINT NOT NULL AUTO_INCREMENT,
      course_slug VARCHAR(120) NOT NULL,
      assignments_enabled TINYINT(1) NOT NULL DEFAULT 0,
      course_community_enabled TINYINT(1) NOT NULL DEFAULT 0,
      tutor_questions_enabled TINYINT(1) NOT NULL DEFAULT 0,
      alumni_participation_mode VARCHAR(24) NOT NULL DEFAULT 'none',
      certificate_proof_required TINYINT(1) NOT NULL DEFAULT 0,
      certificate_proof_type VARCHAR(24) NOT NULL DEFAULT 'website_link',
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_learning_course_feature_slug (course_slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_learning_assignments (
      id BIGINT NOT NULL AUTO_INCREMENT,
      assignment_uuid VARCHAR(64) NOT NULL,
      course_slug VARCHAR(120) NOT NULL,
      account_id BIGINT NOT NULL,
      student_email VARCHAR(220) NOT NULL,
      student_name VARCHAR(180) NULL,
      lesson_id BIGINT NULL,
      module_id BIGINT NULL,
      submission_kind VARCHAR(24) NOT NULL,
      submission_text TEXT NULL,
      submission_link VARCHAR(1500) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'submitted',
      admin_feedback TEXT NULL,
      reviewed_by VARCHAR(120) NULL,
      reviewed_at DATETIME NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_learning_assignment_uuid (assignment_uuid),
      KEY idx_learning_assignment_course_status (course_slug, status, created_at),
      KEY idx_learning_assignment_student (student_email, course_slug, created_at),
      KEY idx_learning_assignment_account (account_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_learning_assignment_attachments (
      id BIGINT NOT NULL AUTO_INCREMENT,
      assignment_id BIGINT NOT NULL,
      attachment_kind VARCHAR(24) NOT NULL,
      attachment_url VARCHAR(1500) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      KEY idx_learning_assignment_attachment (assignment_id, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_learning_assignment_events (
      id BIGINT NOT NULL AUTO_INCREMENT,
      assignment_id BIGINT NOT NULL,
      actor_type VARCHAR(24) NOT NULL,
      actor_ref VARCHAR(220) NULL,
      event_type VARCHAR(32) NOT NULL,
      event_note VARCHAR(800) NULL,
      metadata_json TEXT NULL,
      created_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      KEY idx_learning_assignment_event (assignment_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_transcript_access (
      id BIGINT NOT NULL AUTO_INCREMENT,
      account_id BIGINT NOT NULL,
      course_slug VARCHAR(120) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      request_reason TEXT NULL,
      notes TEXT NULL,
      requested_at DATETIME NULL,
      approved_at DATETIME NULL,
      approved_by VARCHAR(120) NULL,
      expires_at DATETIME NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_transcript_access_account_course (account_id, course_slug),
      KEY idx_transcript_access_status (status, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_transcript_access_audit (
      id BIGINT NOT NULL AUTO_INCREMENT,
      account_id BIGINT NOT NULL,
      course_slug VARCHAR(120) NOT NULL,
      lesson_id BIGINT NULL,
      event_type VARCHAR(40) NOT NULL,
      status VARCHAR(32) NULL,
      detail_json TEXT NULL,
      created_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      KEY idx_transcript_access_audit (account_id, course_slug, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

export async function listLearningSupportData(filters?: { courseSlug?: string; status?: string; search?: string }) {
  await ensureLearningSupportTables()
  const courseSlug = normalizeCourseSlug(filters?.courseSlug || "all")
  const status = clean(filters?.status || "all", 32).toLowerCase()
  const search = clean(filters?.search || "", 220).toLowerCase()
  const courses = await prisma.$queryRaw<Array<{ courseSlug: string; courseTitle: string }>>`
    SELECT course_slug AS courseSlug, course_title AS courseTitle
    FROM tochukwu_learning_courses
    WHERE NOT EXISTS (
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
  const features = await prisma.$queryRaw<Array<{
    courseSlug: string
    assignmentsEnabled: number | bigint | boolean
    courseCommunityEnabled: number | bigint | boolean
    tutorQuestionsEnabled: number | bigint | boolean
    alumniParticipationMode: string
    certificateProofRequired: number | bigint | boolean
    certificateProofType: string
  }>>`
    SELECT course_slug AS courseSlug, assignments_enabled AS assignmentsEnabled,
      course_community_enabled AS courseCommunityEnabled, tutor_questions_enabled AS tutorQuestionsEnabled,
      alumni_participation_mode AS alumniParticipationMode, certificate_proof_required AS certificateProofRequired,
      certificate_proof_type AS certificateProofType
    FROM tochukwu_learning_course_features
    ORDER BY course_slug ASC
  `
  const allAssignments = await prisma.$queryRaw<Array<{
    id: bigint
    courseSlug: string
    accountId: bigint
    studentEmail: string
    studentName: string | null
    submissionKind: string
    submissionText: string | null
    submissionLink: string | null
    status: string
    adminFeedback: string | null
    reviewedBy: string | null
    reviewedAt: Date | null
    createdAt: Date | null
    certificateNo: string | null
  }>>`
    SELECT a.id, a.course_slug AS courseSlug, a.account_id AS accountId,
      a.student_email AS studentEmail, a.student_name AS studentName,
      a.submission_kind AS submissionKind, a.submission_text AS submissionText,
      a.submission_link AS submissionLink, a.status, a.admin_feedback AS adminFeedback,
      a.reviewed_by AS reviewedBy, a.reviewed_at AS reviewedAt, a.created_at AS createdAt,
      c.certificate_no AS certificateNo
    FROM tochukwu_learning_assignments a
    LEFT JOIN student_certificates c
      ON c.account_id = a.account_id
     AND c.course_slug = a.course_slug
     AND c.status = 'issued'
    ORDER BY a.id DESC
    LIMIT 250
  `.catch(() => [])
  const filtered = allAssignments.filter((item) => {
    if (courseSlug && courseSlug !== "all" && item.courseSlug !== courseSlug) return false
    if (status && status !== "all" && item.status !== status) return false
    if (search) {
      const haystack = `${item.studentEmail} ${item.studentName || ""} ${item.submissionText || ""} ${item.submissionLink || ""}`.toLowerCase()
      if (!haystack.includes(search)) return false
    }
    return true
  })
  const ids = filtered.map((item) => item.id)
  const attachments = ids.length ? await prisma.$queryRaw<Array<{ assignmentId: bigint; kind: string; url: string }>>(Prisma.sql`
    SELECT assignment_id AS assignmentId, attachment_kind AS kind, attachment_url AS url
    FROM tochukwu_learning_assignment_attachments
    WHERE assignment_id IN (${Prisma.join(ids)})
    ORDER BY assignment_id ASC, sort_order ASC, id ASC
  `).catch(() => []) : []
  const transcriptRequests = await prisma.$queryRaw<Array<{
    id: bigint
    accountId: bigint
    courseSlug: string
    status: string
    requestReason: string | null
    notes: string | null
    requestedAt: Date | null
    approvedAt: Date | null
    fullName: string | null
    email: string | null
  }>>`
    SELECT ta.id, ta.account_id AS accountId, ta.course_slug AS courseSlug, ta.status,
      ta.request_reason AS requestReason, ta.notes, ta.requested_at AS requestedAt, ta.approved_at AS approvedAt,
      sa.full_name AS fullName, sa.email
    FROM tochukwu_transcript_access ta
    LEFT JOIN student_accounts sa ON sa.id = ta.account_id
    ORDER BY COALESCE(ta.requested_at, ta.updated_at) DESC, ta.id DESC
    LIMIT 100
  `.catch(() => [])
  const students = await prisma.$queryRaw<Array<{
    id: bigint
    fullName: string
    email: string
    lastLoginAt: Date | null
    activeSessions: bigint
    trustedDevices: bigint
  }>>`
    SELECT sa.id, sa.full_name AS fullName, sa.email, sa.last_login_at AS lastLoginAt,
      (SELECT COUNT(*) FROM student_sessions ss WHERE ss.account_id = sa.id) AS activeSessions,
      (SELECT COUNT(*) FROM student_account_devices sd WHERE sd.account_id = sa.id) AS trustedDevices
    FROM student_accounts sa
    ORDER BY sa.updated_at DESC
    LIMIT 80
  `.catch(() => [])
  return { courses, features, assignments: filtered, attachments, transcriptRequests, students }
}

export async function saveCourseFeatures(input: {
  courseSlug: string
  assignmentsEnabled?: boolean
  courseCommunityEnabled?: boolean
  tutorQuestionsEnabled?: boolean
  alumniParticipationMode?: string
  certificateProofRequired?: boolean
}) {
  await ensureLearningSupportTables()
  const courseSlug = normalizeCourseSlug(input.courseSlug)
  if (!courseSlug) throw new Error("course_slug is required.")
  const now = new Date()
  await prisma.$executeRaw`
    INSERT INTO tochukwu_learning_course_features
      (course_slug, assignments_enabled, course_community_enabled, tutor_questions_enabled, alumni_participation_mode, certificate_proof_required, certificate_proof_type, created_at, updated_at)
    VALUES
      (${courseSlug}, ${input.assignmentsEnabled ? 1 : 0}, ${input.courseCommunityEnabled ? 1 : 0}, ${input.tutorQuestionsEnabled ? 1 : 0},
       ${normalizeAlumniMode(input.alumniParticipationMode)}, ${input.certificateProofRequired ? 1 : 0}, 'website_link', ${now}, ${now})
    ON DUPLICATE KEY UPDATE
      assignments_enabled = VALUES(assignments_enabled),
      course_community_enabled = VALUES(course_community_enabled),
      tutor_questions_enabled = VALUES(tutor_questions_enabled),
      alumni_participation_mode = VALUES(alumni_participation_mode),
      certificate_proof_required = VALUES(certificate_proof_required),
      certificate_proof_type = VALUES(certificate_proof_type),
      updated_at = VALUES(updated_at)
  `
}

async function issueCertificateIfEligible(assignmentId: bigint) {
  const rows = await prisma.$queryRaw<Array<{
    accountId: bigint
    courseSlug: string
    studentEmail: string
    studentName: string | null
    certificateNameConfirmedAt: Date | null
    fullName: string | null
    certificateNo: string | null
  }>>`
    SELECT a.account_id AS accountId, a.course_slug AS courseSlug, a.student_email AS studentEmail,
      a.student_name AS studentName, sa.certificate_name_confirmed_at AS certificateNameConfirmedAt,
      sa.full_name AS fullName, c.certificate_no AS certificateNo
    FROM tochukwu_learning_assignments a
    LEFT JOIN student_accounts sa ON sa.id = a.account_id
    LEFT JOIN student_certificates c ON c.account_id = a.account_id AND c.course_slug = a.course_slug AND c.status = 'issued'
    WHERE a.id = ${assignmentId}
    LIMIT 1
  `.catch(() => [])
  const item = rows[0]
  if (!item) return ""
  if (item.certificateNo) return `${siteBaseUrl()}/dashboard/certificate?certificate_no=${encodeURIComponent(item.certificateNo)}`
  if (!item.certificateNameConfirmedAt || !clean(item.fullName, 180)) return ""
  const now = new Date()
  const certNo = certificateNo()
  await prisma.$executeRaw`
    INSERT INTO student_certificates
      (account_id, course_slug, certificate_no, recipient_name, status, issued_at, created_at, updated_at)
    VALUES
      (${item.accountId}, ${item.courseSlug}, ${certNo}, ${clean(item.fullName, 180)}, 'issued', ${now}, ${now}, ${now})
    ON DUPLICATE KEY UPDATE
      status = 'issued',
      updated_at = VALUES(updated_at)
  `.catch(() => null)
  return `${siteBaseUrl()}/dashboard/certificate?certificate_no=${encodeURIComponent(certNo)}`
}

export async function reviewAssignment(input: { assignmentId: string; status: string; feedback?: string; sendApprovalEmail?: boolean }) {
  await ensureLearningSupportTables()
  const admin = await requireAdmin()
  const assignmentId = BigInt(String(input.assignmentId || "0"))
  if (assignmentId <= BigInt(0)) throw new Error("assignment_id is required.")
  const before = await prisma.$queryRaw<Array<{ status: string; studentEmail: string; studentName: string | null; courseSlug: string; submissionKind: string; submissionText: string | null; submissionLink: string | null }>>`
    SELECT status, student_email AS studentEmail, student_name AS studentName, course_slug AS courseSlug,
      submission_kind AS submissionKind, submission_text AS submissionText, submission_link AS submissionLink
    FROM tochukwu_learning_assignments
    WHERE id = ${assignmentId}
    LIMIT 1
  `
  if (!before.length) throw new Error("Assignment not found.")
  const status = normalizeAssignmentStatus(input.status)
  const feedback = clean(input.feedback, 8000)
  const now = new Date()
  await prisma.$executeRaw`
    UPDATE tochukwu_learning_assignments
    SET status = ${status},
        admin_feedback = ${feedback || null},
        reviewed_by = ${admin.email || admin.adminUuid},
        reviewed_at = ${now},
        updated_at = ${now}
    WHERE id = ${assignmentId}
    LIMIT 1
  `
  await prisma.$executeRaw`
    INSERT INTO tochukwu_learning_assignment_events
      (assignment_id, actor_type, actor_ref, event_type, event_note, metadata_json, created_at)
    VALUES
      (${assignmentId}, 'admin', ${admin.email || admin.adminUuid}, 'status_updated', ${feedback || "Status updated"}, ${JSON.stringify({ status })}, ${now})
  `.catch(() => null)
  const item = before[0]
  const certificateProof = item.submissionKind === "link" && item.submissionText === CERTIFICATE_PROOF_MARKER
  if ((input.sendApprovalEmail || (item.status !== status && status === "approved")) && item.studentEmail) {
    const certificateUrl = status === "approved" && certificateProof ? await issueCertificateIfEligible(assignmentId) : ""
    await sendEmail({
      to: item.studentEmail,
      subject: certificateUrl ? "Your Website Proof Was Approved - Certificate Ready" : `Your learning support status changed to ${status.replace(/_/g, " ")}`,
      html: `<p>Hello ${item.studentName || "Student"},</p><p>Your submission for ${item.courseSlug} is now <strong>${status}</strong>.</p>${item.submissionLink ? `<p>Approved website: <a href="${item.submissionLink}">${item.submissionLink}</a></p>` : ""}${feedback ? `<p>Feedback: ${feedback}</p>` : ""}${certificateUrl ? `<p><a href="${certificateUrl}">Download your certificate</a></p>` : ""}<p>Tochukwu Tech and AI Academy</p>`,
      text: `Hello ${item.studentName || "Student"},\n\nYour submission for ${item.courseSlug} is now ${status}.\n${item.submissionLink ? `Approved website: ${item.submissionLink}\n` : ""}${feedback ? `Feedback: ${feedback}\n` : ""}${certificateUrl ? `Certificate: ${certificateUrl}\n` : ""}\nTochukwu Tech and AI Academy`
    })
  }
}

export async function reviewTranscriptAccess(input: { accountId: string; courseSlug: string; status: string; notes?: string; expiresAt?: string }) {
  await ensureLearningSupportTables()
  const admin = await requireAdmin()
  const accountId = BigInt(String(input.accountId || "0"))
  const courseSlug = normalizeCourseSlug(input.courseSlug)
  const status = clean(input.status, 32).toLowerCase() === "approved" ? "approved" : clean(input.status, 32).toLowerCase() === "denied" ? "denied" : "pending"
  if (accountId <= BigInt(0) || !courseSlug) throw new Error("Account and course are required.")
  const now = new Date()
  const expiresAt = clean(input.expiresAt, 80) ? new Date(clean(input.expiresAt, 80)) : null
  await prisma.$executeRaw`
    INSERT INTO tochukwu_transcript_access
      (account_id, course_slug, status, notes, requested_at, approved_at, approved_by, expires_at, created_at, updated_at)
    VALUES
      (${accountId}, ${courseSlug}, ${status}, ${clean(input.notes, 4000) || null}, ${now}, ${status === "approved" ? now : null}, ${admin.email || admin.adminUuid}, ${expiresAt}, ${now}, ${now})
    ON DUPLICATE KEY UPDATE
      status = VALUES(status),
      notes = VALUES(notes),
      approved_at = VALUES(approved_at),
      approved_by = VALUES(approved_by),
      expires_at = VALUES(expires_at),
      updated_at = VALUES(updated_at)
  `
  await prisma.$executeRaw`
    INSERT INTO tochukwu_transcript_access_audit
      (account_id, course_slug, lesson_id, event_type, status, detail_json, created_at)
    VALUES
      (${accountId}, ${courseSlug}, NULL, 'admin_update', ${status}, ${JSON.stringify({ notes: clean(input.notes, 4000), updatedBy: admin.email })}, ${now})
  `.catch(() => null)
}

export async function resetStudentDevices(input: { accountId?: string; email?: string }) {
  await ensureLearningSupportTables()
  const admin = await requireAdmin()
  const accountId = BigInt(String(input.accountId || "0"))
  const email = clean(input.email, 220).toLowerCase()
  const students = accountId > BigInt(0)
    ? await prisma.$queryRaw<Array<{ id: bigint; email: string; fullName: string | null }>>`SELECT id, email, full_name AS fullName FROM student_accounts WHERE id = ${accountId} LIMIT 1`
    : await prisma.$queryRaw<Array<{ id: bigint; email: string; fullName: string | null }>>`SELECT id, email, full_name AS fullName FROM student_accounts WHERE email = ${email} LIMIT 1`
  const student = students[0]
  if (!student) throw new Error("Student account not found.")
  await prisma.$executeRaw`DELETE FROM student_account_devices WHERE account_id = ${student.id}`.catch(() => null)
  await prisma.$executeRaw`DELETE FROM student_sessions WHERE account_id = ${student.id}`.catch(() => null)
  await prisma.$executeRaw`
    UPDATE student_security_alerts
    SET status = 'resolved', updated_at = ${new Date()}
    WHERE account_id = ${student.id}
      AND status = 'open'
  `.catch(() => null)
  await prisma.$executeRaw`
    INSERT INTO student_security_alerts
      (alert_uuid, account_id, school_id, alert_type, severity, alert_key, title, details_json, status, occurrences, created_at, last_seen_at, updated_at)
    VALUES
      (${`ssa_${crypto.randomUUID().replace(/-/g, "")}`}, ${student.id}, NULL, 'admin_device_reset', 'low',
       ${`admin_reset:${student.id}:${Date.now()}`}, 'Admin reset trusted devices',
       ${JSON.stringify({ by: admin.email || admin.adminUuid })}, 'resolved', 1, ${new Date()}, ${new Date()}, ${new Date()})
  `.catch(() => null)
}

export async function resendStudentResetLink(input: { accountId?: string; email?: string }) {
  const accountId = BigInt(String(input.accountId || "0"))
  const emailInput = clean(input.email, 220).toLowerCase()
  const rows = accountId > BigInt(0)
    ? await prisma.$queryRaw<Array<{ email: string; fullName: string | null }>>`SELECT email, full_name AS fullName FROM student_accounts WHERE id = ${accountId} LIMIT 1`
    : await prisma.$queryRaw<Array<{ email: string; fullName: string | null }>>`SELECT email, full_name AS fullName FROM student_accounts WHERE email = ${emailInput} LIMIT 1`
  const student = rows[0]
  if (!student?.email) throw new Error("Student account not found.")
  const reset = await createStudentPasswordResetToken(student.email)
  if (!reset?.token) throw new Error("Could not create password reset token.")
  const link = `${siteBaseUrl()}/dashboard/reset-password?token=${encodeURIComponent(reset.token)}`
  await sendEmail({
    to: student.email,
    subject: "Your Dashboard Password Reset Link",
    html: `<p>Hello ${student.fullName || "there"},</p><p>Use the link below to reset your dashboard password:</p><p><a href="${link}">${link}</a></p><p>This link expires in 1 hour.</p>`,
    text: `Hello ${student.fullName || "there"},\n\nUse the link below to reset your dashboard password:\n${link}\n\nThis link expires in 1 hour.`
  })
}

export function formBool(value: FormDataEntryValue | null) {
  return boolFlag(value)
}
