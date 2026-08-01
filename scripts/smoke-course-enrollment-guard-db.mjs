import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const migration = fs.readFileSync(
  new URL("../prisma/migrations/20260801120000_add_course_enrollment_claims/migration.sql", import.meta.url),
  "utf8"
)
const rollbackMarker = "ROLLBACK_ENROLLMENT_GUARD_SMOKE"
const token = crypto.randomUUID().replaceAll("-", "")
const email = `smoke-enrollment-${token}@example.invalid`
const courseSlug = `smoke-course-${token}`

try {
  await prisma.$executeRawUnsafe(migration)
  try {
    await prisma.$transaction(async (tx) => {
      const first = await tx.$executeRawUnsafe(
        `INSERT IGNORE INTO tochukwu_course_enrollment_claims
          (email_key, course_slug, source_type, source_uuid, batch_key, batch_label, created_at, updated_at)
         VALUES (?, ?, 'course_order', ?, 'batch-a', 'Batch A', NOW(), NOW())`,
        email,
        courseSlug,
        `order_${token}`
      )
      const second = await tx.$executeRawUnsafe(
        `INSERT IGNORE INTO tochukwu_course_enrollment_claims
          (email_key, course_slug, source_type, source_uuid, batch_key, batch_label, created_at, updated_at)
         VALUES (?, ?, 'manual_payment', ?, 'batch-b', 'Batch B', NOW(), NOW())`,
        email,
        courseSlug,
        `manual_${token}`
      )
      const group = await tx.$executeRawUnsafe(
        `INSERT IGNORE INTO tochukwu_course_enrollment_claims
          (email_key, course_slug, source_type, source_uuid, batch_key, batch_label, created_at, updated_at)
         VALUES (?, ?, 'family_child', ?, 'batch-c', 'Batch C', NOW(), NOW())`,
        email,
        courseSlug,
        `family_${token}`
      )
      assert.equal(Number(first), 1, "The first enrollment claim should be accepted.")
      assert.equal(Number(second), 0, "A second batch must not create another claim.")
      assert.equal(Number(group), 0, "A group seat must not bypass the email and course claim.")

      const rows = await tx.$queryRawUnsafe(
        "SELECT source_type AS sourceType, batch_key AS batchKey FROM tochukwu_course_enrollment_claims WHERE email_key = ? AND course_slug = ?",
        email,
        courseSlug
      )
      assert.equal(rows.length, 1)
      assert.equal(rows[0].sourceType, "course_order")
      assert.equal(rows[0].batchKey, "batch-a")
      throw new Error(rollbackMarker)
    })
  } catch (error) {
    if (!(error instanceof Error) || error.message !== rollbackMarker) throw error
  }

  const remaining = await prisma.$queryRawUnsafe(
    "SELECT COUNT(*) AS total FROM tochukwu_course_enrollment_claims WHERE email_key = ? AND course_slug = ?",
    email,
    courseSlug
  )
  assert.equal(Number(remaining[0]?.total || 0), 0, "Smoke test rows must be rolled back.")
  console.log("Course enrollment guard database smoke test passed.")
} finally {
  await prisma.$disconnect()
}
