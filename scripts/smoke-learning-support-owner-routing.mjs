import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { PrismaClient } from "@prisma/client"

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")
const prisma = new PrismaClient()
const rollback = new Error("ROLLBACK_LEARNING_SUPPORT_SMOKE")

function assertImplementationWiring() {
  const notifications = read("lib/learning-support-notifications.ts")
  const admin = read("lib/admin-learning-support.ts")
  const player = read("components/student-dashboard/player/CoursePlayer.tsx")
  const learnerRoute = read("app/api/student/learning/assignment/message/route.ts")
  const proofRoute = read("app/api/student/certificate/proof/route.ts")
  const proofMessageRoute = read("app/api/student/certificate/proof/message/route.ts")
  const adminPage = read("app/(internal)/internal/(admin)/learning/page.tsx")
  const migration = read("prisma/migrations/20260808120000_learning_support_owner_notifications/migration.sql")

  assert.match(notifications, /role: "group_owner"/)
  assert.match(notifications, /role: "school_owner"/)
  assert.match(notifications, /domain\.endsWith\("\.local"\)/)
  assert.match(notifications, /INSERT IGNORE INTO tochukwu_learning_support_notifications/)
  assert.match(admin, /sendLearningSupportNotification/)
  assert.doesNotMatch(admin, /to:\s*item\.studentEmail/)
  assert.match(player, /\/api\/student\/learning\/assignment\/message/)
  assert.match(learnerRoute, /account_id = \$\{session\.account\.id\}/)
  assert.doesNotMatch(proofRoute, /LOWER\(student_email\)[\s\S]{0,100}= \$\{email\}/)
  assert.doesNotMatch(proofMessageRoute, /LOWER\(student_email\)/)
  assert.match(adminPage, /Assignment Conversation/)
  assert.match(migration, /UNIQUE KEY `uniq_learning_support_notification_idempotency`/)
}

async function managedLearners() {
  const family = await prisma.$queryRawUnsafe(`
    SELECT c.account_id AS accountId, c.full_name AS learnerName, sa.email AS learnerEmail,
      f.parent_email AS ownerEmail
    FROM family_children c
    JOIN family_accounts f ON f.id = c.family_id
    JOIN student_accounts sa ON sa.id = c.account_id
    WHERE c.account_id IS NOT NULL AND c.status = 'active' AND f.status = 'active'
      AND f.parent_email IS NOT NULL AND f.parent_email <> ''
    ORDER BY c.id DESC LIMIT 1
  `)
  const school = await prisma.$queryRawUnsafe(`
    SELECT ss.account_id AS accountId, ss.full_name AS learnerName, ss.email AS learnerEmail,
      sa.email AS ownerEmail
    FROM school_students ss
    JOIN school_accounts sc ON sc.id = ss.school_id
    JOIN school_admins sa ON sa.school_id = sc.id AND sa.is_active = 1
    WHERE ss.account_id IS NOT NULL AND ss.status = 'active' AND sc.status = 'active'
      AND sa.email IS NOT NULL AND sa.email <> ''
    ORDER BY ss.id DESC, sa.id ASC LIMIT 1
  `)
  assert.ok(family[0], "No active family learner with an owner email was available for the smoke test.")
  assert.ok(school[0], "No active school learner with an owner email was available for the smoke test.")
  for (const [role, row] of [["group_owner", family[0]], ["school_owner", school[0]]]) {
    assert.match(String(row.ownerEmail), /^[^\s@]+@[^\s@]+\.[^\s@]+$/)
    assert.ok(!String(row.ownerEmail).toLowerCase().endsWith(".local"), `${role} resolved to a local-only address.`)
    assert.notEqual(String(row.ownerEmail).toLowerCase(), String(row.learnerEmail).toLowerCase(), `${role} did not resolve away from the learner placeholder.`)
  }
  return [family[0], school[0]]
}

async function exercisePrivateThreads(learners) {
  try {
    await prisma.$transaction(async (tx) => {
      for (const learner of learners) {
        const token = crypto.randomUUID().replaceAll("-", "")
        const courseSlug = `smoke-support-${token.slice(0, 12)}`
        const assignmentUuid = `assn_smoke_${token}`
        const now = new Date()
        await tx.$executeRawUnsafe(
          `INSERT INTO tochukwu_learning_assignments
            (assignment_uuid, course_slug, account_id, student_email, student_name, lesson_id, submission_kind,
             submission_text, status, admin_feedback, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 1, 'text', 'Smoke assignment', 'needs_revision', 'Smoke feedback', ?, ?)`,
          assignmentUuid, courseSlug, learner.accountId, learner.learnerEmail, learner.learnerName, now, now
        )
        const assignments = await tx.$queryRawUnsafe(
          `SELECT id FROM tochukwu_learning_assignments WHERE assignment_uuid = ? AND account_id = ? LIMIT 1`,
          assignmentUuid, learner.accountId
        )
        assert.ok(assignments[0]?.id, "Account-owned assignment could not be reloaded.")
        const assignmentId = assignments[0].id
        for (const [authorType, body] of [["admin", "Owner-routed feedback"], ["student", "Learner dashboard reply"]]) {
          await tx.$executeRawUnsafe(
            `INSERT INTO tochukwu_learning_assignment_messages
              (message_uuid, assignment_id, course_slug, account_id, author_type, author_name, message_type, body,
               read_by_student_at, read_by_admin_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 'message', ?, ?, ?, ?)`,
            `apm_smoke_${crypto.randomUUID().replaceAll("-", "")}`, assignmentId, courseSlug, learner.accountId,
            authorType, authorType === "admin" ? "Learning Support" : learner.learnerName, body,
            authorType === "admin" ? now : null, authorType === "student" ? now : null, now
          )
        }
        const thread = await tx.$queryRawUnsafe(
          `SELECT author_type AS authorType, body FROM tochukwu_learning_assignment_messages
           WHERE assignment_id = ? AND account_id = ? ORDER BY id ASC`,
          assignmentId, learner.accountId
        )
        assert.deepEqual(thread.map((row) => row.authorType), ["admin", "student"])
        assert.equal(thread[0].body, "Owner-routed feedback")
        assert.equal(thread[1].body, "Learner dashboard reply")
      }
      throw rollback
    }, { timeout: 30000 })
  } catch (error) {
    if (error !== rollback && error?.message !== rollback.message) throw error
  }
}

try {
  assertImplementationWiring()
  const learners = await managedLearners()
  await exercisePrivateThreads(learners)
  console.log("Learning Support owner-routing end-to-end smoke test passed (family + school; email delivery disabled).")
} finally {
  await prisma.$disconnect()
}
