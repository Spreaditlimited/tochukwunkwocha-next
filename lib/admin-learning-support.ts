import crypto from "crypto"
import { Prisma } from "@prisma/client"

import { requireAdmin } from "@/lib/auth"
import {
  CERTIFICATE_PROOF_MARKER,
  ensureCertificateEligibilityColumns,
  getCertificateCourseCompletion
} from "@/lib/certificate-eligibility"
import { ensureCertificateVerificationColumns, getLatestApprovedStudentProject } from "@/lib/certificate-verification"
import { sendEmail } from "@/lib/email"
import {
  addCertificateProofMessage,
  ensureCertificateProofConversationTable
} from "@/lib/certificate-proof-conversation"
import { ensureLearningSupportNotificationTable, sendLearningSupportNotification } from "@/lib/learning-support-notifications"
import { configuredLearningCourseSlugSql, dayLevelCourseSlugRegex } from "@/lib/learning-course-catalog"
import { prisma } from "@/lib/prisma"
import { publicActionLinkVariants, publicSiteUrl } from "@/lib/public-site-url"
import { addColumnIfMissing } from "@/lib/schema-guards"
import { createStudentPasswordResetToken } from "@/lib/student-auth"
import { ensureStudentProjectLinkTables } from "@/lib/student-project-links"

export { CERTIFICATE_PROOF_MARKER }

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
  return publicSiteUrl()
}

function certificateNo() {
  return `TN-IND-${crypto.randomUUID().replace(/-/g, "").slice(0, 14).toUpperCase()}`
}

export async function ensureLearningSupportTables() {
  await addColumnIfMissing("student_accounts", "public_project_learner_type", "VARCHAR(24) NULL")
  await ensureLearningSupportNotificationTable()
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
  await ensureCertificateEligibilityColumns()
  await ensureCertificateVerificationColumns()
  await ensureCertificateProofConversationTable()
  await ensureStudentProjectLinkTables()
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
    publicProjectLearnerType: string | null
    isGroupLearner: number | bigint | boolean
  }>>`
    SELECT a.id, a.course_slug AS courseSlug, a.account_id AS accountId,
      a.student_email AS studentEmail, a.student_name AS studentName,
      a.submission_kind AS submissionKind, a.submission_text AS submissionText,
      a.submission_link AS submissionLink, a.status, a.admin_feedback AS adminFeedback,
      a.reviewed_by AS reviewedBy, a.reviewed_at AS reviewedAt, a.created_at AS createdAt,
      c.certificate_no AS certificateNo,
      sa.public_project_learner_type AS publicProjectLearnerType,
      EXISTS (
        SELECT 1
        FROM family_children child
        JOIN family_accounts family ON family.id = child.family_id
        WHERE child.account_id = a.account_id
          AND child.status = 'active'
          AND family.status = 'active'
      ) AS isGroupLearner
    FROM tochukwu_learning_assignments a
    LEFT JOIN student_accounts sa ON sa.id = a.account_id
    LEFT JOIN student_certificate_issuance_keys k
      ON k.account_id = a.account_id
     AND k.course_slug = a.course_slug
     AND k.batch_key = COALESCE(a.certificate_batch_key, '')
    LEFT JOIN student_certificates c ON c.certificate_no = k.certificate_no AND c.status = 'issued'
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
  const assignmentMessages = ids.length
    ? await prisma.$queryRaw<Array<{
        id: bigint
        messageUuid: string
        assignmentId: bigint
        authorType: string
        authorName: string | null
        messageType: string
        body: string
        readByAdminAt: Date | null
        createdAt: Date | null
      }>>(Prisma.sql`
        SELECT id, message_uuid AS messageUuid, assignment_id AS assignmentId,
          author_type AS authorType, author_name AS authorName,
          message_type AS messageType, body, read_by_admin_at AS readByAdminAt,
          created_at AS createdAt
        FROM tochukwu_learning_assignment_messages
        WHERE assignment_id IN (${Prisma.join(ids)})
        ORDER BY assignment_id ASC, id ASC
      `).catch(() => [])
    : []
  if (ids.length) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE tochukwu_learning_assignment_messages
      SET read_by_admin_at = COALESCE(read_by_admin_at, ${new Date()})
      WHERE assignment_id IN (${Prisma.join(ids)})
        AND author_type = 'student'
    `).catch(() => null)
  }
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
  const additionalProjectLinks = await prisma.$queryRaw<Array<{
    linkUuid: string
    accountId: bigint
    studentName: string | null
    studentEmail: string | null
    responsibleName: string | null
    responsibleEmail: string | null
    learnerType: string
    title: string
    projectUrl: string
    host: string
    description: string | null
    courseSlug: string | null
    certificateNo: string | null
    isPublic: number | bigint | boolean
    status: string
    reviewStatus: string
    reviewNote: string | null
    reviewedBy: string | null
    reviewedAt: Date | null
    declarationAcceptedAt: Date | null
    createdAt: Date | null
  }>>`
    SELECT l.link_uuid AS linkUuid, l.account_id AS accountId,
      sa.full_name AS studentName, sa.email AS studentEmail,
      COALESCE(f.parent_name, school.school_name) AS responsibleName,
      COALESCE(f.parent_email, school_admin.email) AS responsibleEmail,
      CASE
        WHEN child.id IS NOT NULL THEN 'group'
        WHEN school_student.id IS NOT NULL THEN 'school'
        WHEN sa.public_project_learner_type = 'young' THEN 'young'
        ELSE 'direct'
      END AS learnerType,
      l.title, l.project_url AS projectUrl, l.host, l.description,
      l.course_slug AS courseSlug, l.certificate_no AS certificateNo,
      l.is_public AS isPublic, l.status, l.review_status AS reviewStatus,
      l.review_note AS reviewNote, l.reviewed_by AS reviewedBy,
      l.reviewed_at AS reviewedAt, l.declaration_accepted_at AS declarationAcceptedAt,
      l.created_at AS createdAt
    FROM student_project_links l
    JOIN student_accounts sa ON sa.id = l.account_id
    LEFT JOIN family_children child ON child.account_id = l.account_id AND child.status = 'active'
    LEFT JOIN family_accounts f ON f.id = child.family_id AND f.status = 'active'
    LEFT JOIN school_students school_student ON school_student.account_id = l.account_id AND school_student.status = 'active'
    LEFT JOIN school_accounts school ON school.id = school_student.school_id AND school.status = 'active'
    LEFT JOIN school_admins school_admin
      ON school_admin.id = (
        SELECT MIN(sa2.id)
        FROM school_admins sa2
        WHERE sa2.school_id = school.id AND sa2.is_active = 1
      )
    WHERE l.status <> 'deleted'
    ORDER BY
      CASE l.review_status WHEN 'pending' THEN 0 WHEN 'rejected' THEN 1 ELSE 2 END,
      l.created_at DESC,
      l.id DESC
    LIMIT 250
  `.catch(() => [])
  return { courses, features, assignments: filtered, attachments, assignmentMessages, transcriptRequests, students, additionalProjectLinks }
}

export async function setPublicProjectLearnerType(input: { accountId: string; learnerType: string }) {
  await ensureLearningSupportTables()
  await requireAdmin("/internal/learning")
  const accountId = BigInt(String(input.accountId || "0"))
  const learnerType = clean(input.learnerType, 24).toLowerCase()
  if (accountId <= BigInt(0)) throw new Error("A learner account is required.")
  if (!["standard", "young"].includes(learnerType)) throw new Error("Select a valid public project label.")

  const updated = await prisma.$executeRaw`
    UPDATE student_accounts
    SET public_project_learner_type = ${learnerType === "young" ? "young" : null},
        updated_at = ${new Date()}
    WHERE id = ${accountId}
    LIMIT 1
  `
  if (!updated) throw new Error("Learner account not found.")
  return { learnerType }
}

export async function reviewAdditionalProjectLink(input: { linkUuid: string; reviewStatus: string; reviewNote?: string }) {
  await ensureLearningSupportTables()
  const admin = await requireAdmin("/internal/learning")
  const linkUuid = clean(input.linkUuid, 80)
  const reviewStatus = clean(input.reviewStatus, 24).toLowerCase()
  const reviewNote = clean(input.reviewNote, 2000)
  if (!linkUuid) throw new Error("Project link is required.")
  if (!["pending", "approved", "rejected"].includes(reviewStatus)) {
    throw new Error("Select a valid project-link review status.")
  }
  const now = new Date()
  const updated = await prisma.$executeRaw`
    UPDATE student_project_links
    SET review_status = ${reviewStatus},
        review_note = ${reviewNote || null},
        reviewed_by = ${admin.email || admin.adminUuid},
        reviewed_at = ${now},
        is_public = ${reviewStatus === "approved" ? 1 : 0},
        updated_at = ${now}
    WHERE link_uuid = ${linkUuid}
      AND status <> 'deleted'
    LIMIT 1
  `
  if (!updated) throw new Error("Project link was not found.")
  return { linkUuid, reviewStatus, isPublic: reviewStatus === "approved" }
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
  await ensureCertificateVerificationColumns()
  const rows = await prisma.$queryRaw<Array<{
    accountId: bigint
    courseSlug: string
    studentEmail: string
    studentName: string | null
    certificateNameConfirmedAt: Date | null
    certificateEligibleAtSubmission: number | bigint | boolean | null
    certificateBatchKey: string | null
    fullName: string | null
    certificateNo: string | null
  }>>`
    SELECT a.account_id AS accountId, a.course_slug AS courseSlug, a.student_email AS studentEmail,
      a.student_name AS studentName, sa.certificate_name_confirmed_at AS certificateNameConfirmedAt,
      sa.full_name AS fullName, a.certificate_eligible_at_submission AS certificateEligibleAtSubmission,
      a.certificate_batch_key AS certificateBatchKey,
      c.certificate_no AS certificateNo
    FROM tochukwu_learning_assignments a
    LEFT JOIN student_accounts sa ON sa.id = a.account_id
    LEFT JOIN student_certificate_issuance_keys k
      ON k.account_id = a.account_id
     AND k.course_slug = a.course_slug
     AND k.batch_key = COALESCE(a.certificate_batch_key, '')
    LEFT JOIN student_certificates c ON c.certificate_no = k.certificate_no AND c.status = 'issued'
    WHERE a.id = ${assignmentId}
    LIMIT 1
  `
  const item = rows[0]
  if (!item) return { issued: false, certificateNo: "", certificateUrl: "", reason: "assignment_not_found" }
  const project = await getLatestApprovedStudentProject({
    accountId: item.accountId,
    courseSlug: item.courseSlug,
    batchKey: clean(item.certificateBatchKey, 64).toLowerCase()
  })
  if (item.certificateNo) {
    if (project.projectUrl) {
      await prisma.$executeRaw`
        UPDATE student_certificates
        SET project_url = ${project.projectUrl},
            project_verified_at = ${project.projectVerifiedAt || new Date()},
            project_status_at_issue = 'live_at_issue',
            updated_at = ${new Date()}
        WHERE certificate_no = ${item.certificateNo}
          AND status = 'issued'
      `
    }
    return {
      issued: true,
      certificateNo: item.certificateNo,
      certificateUrl: `${siteBaseUrl()}/dashboard/certificate?certificate_no=${encodeURIComponent(item.certificateNo)}`,
      reason: ""
    }
  }
  if (!item.certificateNameConfirmedAt) {
    return { issued: false, certificateNo: "", certificateUrl: "", reason: "certificate_name_unconfirmed" }
  }
  if (!clean(item.fullName, 180)) {
    return { issued: false, certificateNo: "", certificateUrl: "", reason: "recipient_name_missing" }
  }
  if (Number(item.certificateEligibleAtSubmission || 0) !== 1) {
    const completion = await getCertificateCourseCompletion(
      item.accountId,
      item.studentEmail,
      item.courseSlug
    )
    if (completion.totalLessons <= 0 || completion.completedLessons < completion.totalLessons) {
      return { issued: false, certificateNo: "", certificateUrl: "", reason: "course_incomplete" }
    }
  }
  const now = new Date()
  const batchKey = clean(item.certificateBatchKey, 64).toLowerCase()
  const issuedCertificateNo = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO student_certificate_issuance_keys
        (account_id, course_slug, batch_key, certificate_no, created_at, updated_at)
      VALUES
        (${item.accountId}, ${item.courseSlug}, ${batchKey}, NULL, ${now}, ${now})
      ON DUPLICATE KEY UPDATE updated_at = updated_at
    `
    const keys = await tx.$queryRaw<Array<{ certificateNo: string | null }>>`
      SELECT certificate_no AS certificateNo
      FROM student_certificate_issuance_keys
      WHERE account_id = ${item.accountId}
        AND course_slug = ${item.courseSlug}
        AND batch_key = ${batchKey}
      LIMIT 1
      FOR UPDATE
    `
    const existingCertificateNo = clean(keys[0]?.certificateNo, 140)
    if (existingCertificateNo) {
      if (project.projectUrl) {
        await tx.$executeRaw`
          UPDATE student_certificates
          SET project_url = COALESCE(project_url, ${project.projectUrl}),
              project_verified_at = COALESCE(project_verified_at, ${project.projectVerifiedAt || now}),
              project_status_at_issue = COALESCE(project_status_at_issue, 'live_at_issue'),
              updated_at = ${now}
          WHERE certificate_no = ${existingCertificateNo}
            AND status = 'issued'
        `
      }
      return existingCertificateNo
    }

    const nextCertificateNo = certificateNo()
    await tx.$executeRaw`
      INSERT INTO student_certificates
        (account_id, course_slug, certificate_no, recipient_name, status, issued_at, project_url, project_verified_at, project_status_at_issue, created_at, updated_at)
      VALUES
        (${item.accountId}, ${item.courseSlug}, ${nextCertificateNo}, ${clean(item.fullName, 180)}, 'issued', ${now},
         ${project.projectUrl || null}, ${project.projectVerifiedAt || now}, ${project.projectUrl ? "live_at_issue" : null}, ${now}, ${now})
    `
    await tx.$executeRaw`
      UPDATE student_certificate_issuance_keys
      SET certificate_no = ${nextCertificateNo}, updated_at = ${now}
      WHERE account_id = ${item.accountId}
        AND course_slug = ${item.courseSlug}
        AND batch_key = ${batchKey}
    `
    return nextCertificateNo
  })
  if (!issuedCertificateNo) {
    return { issued: false, certificateNo: "", certificateUrl: "", reason: "certificate_not_found_after_upsert" }
  }
  return {
    issued: true,
    certificateNo: issuedCertificateNo,
    certificateUrl: `${siteBaseUrl()}/dashboard/certificate?certificate_no=${encodeURIComponent(issuedCertificateNo)}`,
    reason: ""
  }
}

function certificateBlockReason(reason: string) {
  if (reason === "certificate_name_unconfirmed") return "the student has not confirmed their certificate name"
  if (reason === "recipient_name_missing") return "the student profile name is missing"
  if (reason === "course_incomplete") return "the student is not currently at 100% course completion"
  if (reason === "certificate_not_found_after_upsert") return "the certificate record could not be loaded after issuance"
  return reason.replace(/_/g, " ") || "an unknown certificate requirement"
}

export async function reviewAssignment(input: { assignmentId: string; status: string; feedback?: string; sendApprovalEmail?: boolean }) {
  await ensureLearningSupportTables()
  const admin = await requireAdmin("/internal/learning")
  const assignmentId = BigInt(String(input.assignmentId || "0"))
  if (assignmentId <= BigInt(0)) throw new Error("assignment_id is required.")
  const before = await prisma.$queryRaw<Array<{ status: string; studentEmail: string; studentName: string | null; courseSlug: string; submissionKind: string; submissionText: string | null; submissionLink: string | null; accountId: bigint; adminFeedback: string | null }>>`
    SELECT status, student_email AS studentEmail, student_name AS studentName, course_slug AS courseSlug,
      submission_kind AS submissionKind, submission_text AS submissionText, submission_link AS submissionLink,
      account_id AS accountId, admin_feedback AS adminFeedback
    FROM tochukwu_learning_assignments
    WHERE id = ${assignmentId}
    LIMIT 1
  `
  if (!before.length) throw new Error("Assignment not found.")
  const status = normalizeAssignmentStatus(input.status)
  const feedback = clean(input.feedback, 8000)
  const statusChanged = before[0].status !== status
  const previousFeedback = clean(before[0].adminFeedback, 8000)
  if (statusChanged && (!feedback || feedback === previousFeedback)) {
    throw new Error("New or updated admin feedback is required whenever the submission status changes.")
  }
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
  const feedbackChanged = previousFeedback !== feedback
  const becameApproved = statusChanged && status === "approved"
  let reviewMessageUuid = ""
  if (statusChanged || feedbackChanged) {
    const recordsFeedback = Boolean(feedback) && (feedbackChanged || status === "needs_revision")
    reviewMessageUuid = await addCertificateProofMessage({
      assignmentId,
      courseSlug: item.courseSlug,
      accountId: item.accountId,
      authorType: "admin",
      authorRef: admin.email || admin.adminUuid,
      authorName: admin.fullName,
      messageType: recordsFeedback
        ? status === "needs_revision"
          ? "revision_requested"
          : "admin_feedback"
        : "status_update",
      body: recordsFeedback ? feedback : `The proof status was updated to ${status.replace(/_/g, " ")}.`
    })
  }
  let certificate = { issued: false, certificateNo: "", certificateUrl: "", reason: "", error: "" }
  if (status === "approved" && certificateProof && (becameApproved || input.sendApprovalEmail)) {
    try {
      certificate = { ...(await issueCertificateIfEligible(assignmentId)), error: "" }
    } catch (error) {
      certificate = {
        issued: false,
        certificateNo: "",
        certificateUrl: "",
        reason: "certificate_issue_failed",
        error: error instanceof Error ? error.message : "Certificate issuance failed."
      }
      console.warn("student_certificate_issue_failed", { assignmentId: assignmentId.toString(), error: certificate.error })
    }
  }
  let email: { attempted: boolean; sent: boolean; role: string | null; error: string } = { attempted: false, sent: false, role: null, error: "" }
  if (input.sendApprovalEmail || statusChanged || feedbackChanged) {
    const certificateUrl = certificate.certificateUrl
    const notificationMessage = [
      `The submission status is now ${status.replace(/_/g, " ")}.`,
      feedback ? `Feedback: ${feedback}` : "",
      item.submissionLink ? `Submitted link: ${item.submissionLink}` : "",
      status === "needs_revision" ? "Please review the feedback, make the requested changes, and reply from the learner dashboard." : "",
      certificateUrl ? `Certificate: ${certificateUrl}` : ""
    ].filter(Boolean).join("\n\n")
    email = await sendLearningSupportNotification({
      assignmentId,
      accountId: item.accountId,
      courseSlug: item.courseSlug,
      eventType: input.sendApprovalEmail ? "review_resent" : "review_updated",
      idempotencyKey: input.sendApprovalEmail
        ? `review-resend:${assignmentId.toString()}:${crypto.randomUUID()}`
        : `review:${reviewMessageUuid || `${assignmentId.toString()}:${status}:${now.getTime()}`}`,
      subject: certificateUrl
        ? "Website Proof Approved - Certificate Ready"
        : status === "needs_revision"
          ? "Learning Support Revision Required"
          : `Learning Support update: ${status.replace(/_/g, " ")}`,
      message: notificationMessage,
      learnerDashboardPath: certificateProof
        ? `/dashboard/certificate?course=${encodeURIComponent(item.courseSlug)}#proof-review`
        : "/dashboard/courses"
    })
  }
  return {
    status,
    becameApproved,
    publicProjectPublished: status === "approved" && certificateProof && Boolean(item.submissionLink),
    certificate: {
      ...certificate,
      message: certificate.issued
        ? "Certificate ready."
        : certificate.error
          ? `Certificate issuance failed: ${certificate.error}`
          : certificate.reason
            ? `Certificate not issued because ${certificateBlockReason(certificate.reason)}.`
            : ""
    },
    email
  }
}

export async function replyToCertificateProof(input: { assignmentId: string; message: string }) {
  await ensureLearningSupportTables()
  const admin = await requireAdmin("/internal/learning")
  const assignmentId = BigInt(String(input.assignmentId || "0"))
  const message = clean(input.message, 8000)
  if (assignmentId <= BigInt(0)) throw new Error("assignment_id is required.")
  if (message.length < 2) throw new Error("Reply is too short.")
  const rows = await prisma.$queryRaw<Array<{
    accountId: bigint
    courseSlug: string
    studentEmail: string
    studentName: string | null
    submissionKind: string
    submissionText: string | null
  }>>`
    SELECT account_id AS accountId, course_slug AS courseSlug,
      student_email AS studentEmail, student_name AS studentName,
      submission_kind AS submissionKind, submission_text AS submissionText
    FROM tochukwu_learning_assignments
    WHERE id = ${assignmentId}
    LIMIT 1
  `
  const assignment = rows[0]
  if (!assignment) throw new Error("Assignment not found.")
  const messageUuid = await addCertificateProofMessage({
    assignmentId,
    courseSlug: assignment.courseSlug,
    accountId: assignment.accountId,
    authorType: "admin",
    authorRef: admin.email || admin.adminUuid,
    authorName: admin.fullName,
    messageType: "admin_reply",
    body: message
  })
  await prisma.$executeRaw`
    INSERT INTO tochukwu_learning_assignment_events
      (assignment_id, actor_type, actor_ref, event_type, event_note, metadata_json, created_at)
    VALUES
      (${assignmentId}, 'admin', ${admin.email || admin.adminUuid}, 'message_sent',
       ${message.slice(0, 800)}, ${JSON.stringify({ source: "learning_support_review" })}, ${new Date()})
  `.catch(() => null)
  const certificateProof = assignment.submissionKind === "link" && assignment.submissionText === CERTIFICATE_PROOF_MARKER
  const delivery = await sendLearningSupportNotification({
    assignmentId,
    accountId: assignment.accountId,
    courseSlug: assignment.courseSlug,
    eventType: "admin_reply",
    idempotencyKey: `reply:${messageUuid}`,
    subject: certificateProof ? "New Reply About Your Certificate Proof" : "New Private Learning Support Reply",
    message,
    learnerDashboardPath: certificateProof
      ? `/dashboard/certificate?course=${encodeURIComponent(assignment.courseSlug)}#proof-review`
      : "/dashboard/courses"
  }).catch((error) => ({
    attempted: true,
    sent: false,
    role: null,
    error: error instanceof Error ? error.message : "Email delivery failed."
  }))
  return {
    email: {
      sent: delivery.sent,
      role: delivery.role,
      error: delivery.sent ? "" : delivery.error || "Email provider did not send the message."
    }
  }
}

export async function resendCertificateApprovalEmail(assignmentIdInput: string) {
  const assignmentId = BigInt(String(assignmentIdInput || "0"))
  if (assignmentId <= BigInt(0)) throw new Error("assignment_id is required.")
  const rows = await prisma.$queryRaw<Array<{
    status: string
    submissionKind: string
    submissionText: string | null
    adminFeedback: string | null
  }>>`
    SELECT status, submission_kind AS submissionKind, submission_text AS submissionText,
      admin_feedback AS adminFeedback
    FROM tochukwu_learning_assignments
    WHERE id = ${assignmentId}
    LIMIT 1
  `
  const item = rows[0]
  if (!item) throw new Error("Assignment not found.")
  if (item.status !== "approved" || item.submissionKind !== "link" || item.submissionText !== CERTIFICATE_PROOF_MARKER) {
    throw new Error("Only approved certificate proof submissions can send a certificate approval email.")
  }
  return reviewAssignment({
    assignmentId: assignmentId.toString(),
    status: "approved",
    feedback: item.adminFeedback || "",
    sendApprovalEmail: true
  })
}

export async function reviewTranscriptAccess(input: { accountId: string; courseSlug: string; status: string; notes?: string; expiresAt?: string }) {
  await ensureLearningSupportTables()
  const admin = await requireAdmin("/internal/learning")
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
  const admin = await requireAdmin("/internal/security")
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
  const links = publicActionLinkVariants(`/dashboard/reset-password?token=${encodeURIComponent(reset.token)}`)
  await sendEmail({
    to: student.email,
    subject: "Your Dashboard Password Reset Link",
    html: `<p>Hello ${student.fullName || "there"},</p><p>Use either link below to reset your dashboard password:</p><p><strong>Primary link:</strong><br/><a href="${links.primary}">${links.primary}</a></p><p><strong>Alternative link:</strong> Use this if the primary website does not open.<br/><a href="${links.alternative}">${links.alternative}</a></p><p>Both links perform the same secure action. This link expires in 1 hour.</p>`,
    text: `Hello ${student.fullName || "there"},\n\nUse either link below to reset your dashboard password:\nPrimary link: ${links.primary}\nAlternative link (if the primary website does not open): ${links.alternative}\n\nBoth links perform the same secure action. This link expires in 1 hour.`
  })
}

export function formBool(value: FormDataEntryValue | null) {
  return boolFlag(value)
}
