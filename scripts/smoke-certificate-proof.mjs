import crypto from "node:crypto"

import { PrismaClient } from "@prisma/client"


const prisma = new PrismaClient()
const rollbackMarker = "CERTIFICATE_PROOF_SMOKE_TEST_ROLLBACK"
const proofMarker = "[CERTIFICATE_PROOF_SMOKE_TEST]"

function clean(value, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function normalizeEmail(value) {
  return clean(value, 320).toLowerCase()
}

function normalizeCourseSlug(value) {
  return clean(value, 120).toLowerCase()
}

function maskEmail(email) {
  const [name, domain] = email.split("@")
  if (!name || !domain) return "(invalid email)"
  return `${name.slice(0, 2)}***@${domain}`
}

function newestEnrollment(rows) {
  return rows
    .sort((left, right) => {
      const leftTime = left.enrolledAt ? new Date(left.enrolledAt).getTime() : 0
      const rightTime = right.enrolledAt ? new Date(right.enrolledAt).getTime() : 0
      return rightTime - leftTime
    })[0]
}

async function enrollmentRows(database, accountId, email, courseSlug) {
  const [familyRows, orderRows, manualRows] = await Promise.all([
    database.$queryRaw`
      SELECT e.batch_key AS batchKey,
             COALESCE(e.paid_at, e.updated_at, e.created_at) AS enrolledAt
      FROM family_child_enrollments e
      JOIN family_children c ON c.id = e.child_id
      JOIN family_accounts f ON f.id = e.family_id
      WHERE c.account_id = ${accountId}
        AND c.status = 'active'
        AND f.status = 'active'
        AND e.status = 'active'
        AND e.course_slug = ${courseSlug}
      ORDER BY enrolledAt DESC
      LIMIT 1
    `,
    database.$queryRaw`
      SELECT o.batch_key AS batchKey,
             COALESCE(o.paid_at, o.updated_at, o.created_at) AS enrolledAt
      FROM course_orders o
      WHERE LOWER(o.email) = ${email}
        AND o.course_slug = ${courseSlug}
        AND o.status = 'paid'
        AND COALESCE(o.buyer_type, 'student') <> 'family'
      ORDER BY enrolledAt DESC
      LIMIT 1
    `,
    database.$queryRaw`
      SELECT m.batch_key AS batchKey,
             COALESCE(m.reviewed_at, m.updated_at, m.created_at) AS enrolledAt
      FROM course_manual_payments m
      WHERE LOWER(m.email) = ${email}
        AND m.course_slug = ${courseSlug}
        AND m.status = 'approved'
        AND COALESCE(m.buyer_type, 'student') <> 'family'
      ORDER BY enrolledAt DESC
      LIMIT 1
    `
  ])

  return [...familyRows, ...orderRows, ...manualRows]
}

async function main() {
  const email = normalizeEmail(process.argv[2] || process.env.SMOKE_STUDENT_EMAIL)
  const courseSlug = normalizeCourseSlug(process.argv[3] || process.env.SMOKE_COURSE_SLUG)
  if (!email || !courseSlug) {
    throw new Error(
      "Usage: npm run smoke:certificate-proof -- student@example.com course-slug"
    )
  }

  const accounts = await prisma.$queryRaw`
    SELECT id, full_name AS fullName
    FROM student_accounts
    WHERE LOWER(email) = ${email}
    LIMIT 1
  `
  const account = accounts[0]
  if (!account) throw new Error("The smoke-test student account was not found.")

  const rows = await enrollmentRows(prisma, account.id, email, courseSlug)
  const latest = newestEnrollment(rows)
  if (!latest) {
    throw new Error("No active enrollment was found for the supplied course.")
  }
  const batchKey = clean(latest.batchKey, 64).toLowerCase()

  const featureRows = await prisma.$queryRaw`
    SELECT certificate_proof_required AS certificateProofRequired,
           certificate_proof_type AS certificateProofType
    FROM tochukwu_learning_course_features
    WHERE course_slug = ${courseSlug}
    LIMIT 1
  `
  if (!featureRows.length || !Boolean(Number(featureRows[0].certificateProofRequired || 0))) {
    throw new Error("Certificate proof is not enabled for the supplied course.")
  }

  let rolledBack = false
  try {
    await prisma.$transaction(async (transaction) => {
      const transactionRows = await enrollmentRows(
        transaction,
        account.id,
        email,
        courseSlug
      )
      const transactionLatest = newestEnrollment(transactionRows)
      const transactionBatchKey = clean(transactionLatest?.batchKey, 64).toLowerCase()
      if (transactionBatchKey !== batchKey) {
        throw new Error("Batch resolution changed inside the smoke-test transaction.")
      }

      const now = new Date()
      const assignmentUuid = `smoke_${crypto.randomUUID().replaceAll("-", "")}`
      await transaction.$executeRaw`
        INSERT INTO tochukwu_learning_assignments
          (assignment_uuid, course_slug, account_id, student_email, student_name,
           submission_kind, submission_text, submission_link, status,
           certificate_batch_key, certificate_eligible_at_submission,
           certificate_eligibility_checked_at, certificate_eligibility_snapshot_json,
           created_at, updated_at)
        VALUES
          (${assignmentUuid}, ${courseSlug}, ${account.id}, ${email}, ${account.fullName},
           'link', ${proofMarker}, 'https://certificate-proof-smoke-test.invalid/',
           'submitted', ${batchKey}, 1, ${now},
           ${JSON.stringify({ eligible: true, source: "smoke_test" })}, ${now}, ${now})
      `

      const inserted = await transaction.$queryRaw`
        SELECT id, assignment_uuid AS assignmentUuid
        FROM tochukwu_learning_assignments
        WHERE assignment_uuid = ${assignmentUuid}
        LIMIT 1
      `
      if (!inserted.length) {
        throw new Error("The transaction could not read the temporary proof submission.")
      }
      const assignmentId = inserted[0].id

      await transaction.$executeRawUnsafe(`
        CREATE TEMPORARY TABLE tochukwu_learning_assignment_messages (
          id BIGINT NOT NULL AUTO_INCREMENT,
          message_uuid VARCHAR(64) NOT NULL,
          assignment_id BIGINT NOT NULL,
          course_slug VARCHAR(120) NOT NULL,
          account_id BIGINT NOT NULL,
          author_type VARCHAR(24) NOT NULL,
          author_ref VARCHAR(220) NULL,
          author_name VARCHAR(180) NULL,
          message_type VARCHAR(32) NOT NULL DEFAULT 'message',
          body TEXT NOT NULL,
          read_by_student_at DATETIME NULL,
          read_by_admin_at DATETIME NULL,
          created_at DATETIME NOT NULL,
          PRIMARY KEY (id),
          UNIQUE KEY uniq_tochukwu_learning_assignment_message_uuid (message_uuid),
          KEY idx_tochukwu_learning_assignment_message_thread (assignment_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)
      await transaction.$executeRaw`
        INSERT INTO tochukwu_learning_assignment_messages
          (message_uuid, assignment_id, course_slug, account_id, author_type,
           author_ref, author_name, message_type, body, read_by_student_at,
           read_by_admin_at, created_at)
        VALUES
          (${`smoke_admin_${crypto.randomUUID().replaceAll("-", "")}`}, ${assignmentId},
           ${courseSlug}, ${account.id}, 'admin', 'smoke-admin',
           'Learning Support', 'revision_requested', 'Please revise the project proof.',
           ${now}, NULL, ${now})
      `
      await transaction.$executeRaw`
        UPDATE tochukwu_learning_assignments
        SET status = 'needs_revision',
            admin_feedback = 'Please revise the project proof.',
            reviewed_at = ${now},
            updated_at = ${now}
        WHERE id = ${assignmentId}
        LIMIT 1
      `
      await transaction.$executeRaw`
        INSERT INTO tochukwu_learning_assignment_messages
          (message_uuid, assignment_id, course_slug, account_id, author_type,
           author_ref, author_name, message_type, body, read_by_student_at,
           read_by_admin_at, created_at)
        VALUES
          (${`smoke_student_${crypto.randomUUID().replaceAll("-", "")}`}, ${assignmentId},
           ${courseSlug}, ${account.id}, 'student', ${email},
           ${account.fullName}, 'student_message', 'I have made the requested changes.',
           NULL, ${now}, ${now})
      `
      await transaction.$executeRaw`
        UPDATE tochukwu_learning_assignments
        SET submission_link = 'https://certificate-proof-revision-smoke-test.invalid/',
            status = 'submitted',
            reviewed_by = NULL,
            reviewed_at = NULL,
            updated_at = ${now}
        WHERE id = ${assignmentId}
        LIMIT 1
      `
      const workflow = await transaction.$queryRaw`
        SELECT a.status, a.submission_link AS submissionLink,
          (SELECT COUNT(*) FROM tochukwu_learning_assignment_messages m WHERE m.assignment_id = a.id) AS messageCount
        FROM tochukwu_learning_assignments a
        WHERE a.id = ${assignmentId}
        LIMIT 1
      `
      if (
        workflow[0]?.status !== "submitted"
        || workflow[0]?.submissionLink !== "https://certificate-proof-revision-smoke-test.invalid/"
        || Number(workflow[0]?.messageCount || 0) !== 2
      ) {
        throw new Error("The revision conversation smoke workflow did not reach the expected state.")
      }
      await transaction.$executeRawUnsafe("DROP TEMPORARY TABLE tochukwu_learning_assignment_messages")

      throw new Error(rollbackMarker)
    })
  } catch (error) {
    if (error instanceof Error && error.message === rollbackMarker) {
      rolledBack = true
    } else {
      throw error
    }
  }
  if (!rolledBack) throw new Error("The smoke-test transaction did not roll back.")

  const leftovers = await prisma.$queryRaw`
    SELECT COUNT(*) AS total
    FROM tochukwu_learning_assignments
    WHERE submission_text = ${proofMarker}
  `
  if (Number(leftovers[0]?.total || 0) !== 0) {
    throw new Error("The smoke test left a temporary proof submission in the database.")
  }

  console.log("Certificate-proof smoke test passed.")
  console.log(`Student: ${maskEmail(email)}`)
  console.log(`Course: ${courseSlug}`)
  console.log(`Enrollment sources found: ${rows.length}`)
  console.log(`Resolved batch key: ${batchKey || "(empty legacy batch)"}`)
  console.log("Temporary proof insert: passed and rolled back")
  console.log("Revision thread and resubmission workflow: passed and rolled back")
  console.log("Database leftovers: 0")
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
