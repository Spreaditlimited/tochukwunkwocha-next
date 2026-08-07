import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const migration = fs.readFileSync(new URL("../prisma/migrations/20260806100000_add_learning_inactivity_followups/migration.sql", import.meta.url), "utf8")
const token = crypto.randomUUID().replaceAll("-", "")
const campaignUuid = `lfc_smoke_${token}`
const rollbackMarker = "ROLLBACK_LEARNING_FOLLOWUP_SMOKE"

try {
  for (const statement of migration.split(/;\s*(?:\n|$)/).map((value) => value.trim()).filter(Boolean)) {
    await prisma.$executeRawUnsafe(statement)
  }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `INSERT INTO tochukwu_learning_followup_campaigns
          (campaign_uuid, account_id, course_slug, batch_key, batch_label, learner_name,
           recipient_name, recipient_email, enrollment_source, batch_start_at,
           campaign_started_at, campaign_ends_at, next_reminder_at, status, created_at, updated_at)
         VALUES (?, 999999999, 'smoke-course', 'smoke-batch', 'Smoke Batch', 'Smoke Learner',
           'Smoke Parent', ?, 'group', NOW(), NOW(), DATE_ADD(NOW(), INTERVAL 3 MONTH),
           DATE_ADD(NOW(), INTERVAL 7 DAY), 'active', NOW(), NOW())`,
        campaignUuid,
        `smoke-${token}@example.invalid`
      )
      const campaigns = await tx.$queryRawUnsafe("SELECT id FROM tochukwu_learning_followup_campaigns WHERE campaign_uuid = ?", campaignUuid)
      assert.equal(campaigns.length, 1)
      const campaignId = campaigns[0].id
      const first = await tx.$executeRawUnsafe(
        `INSERT IGNORE INTO tochukwu_learning_followup_deliveries
          (delivery_uuid, delivery_group_uuid, campaign_id, reminder_number, recipient_email,
           status, attempts, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, 'processing', 1, NOW(), NOW())`,
        `lfd_${token}`,
        `lfg_${token}`,
        campaignId,
        `smoke-${token}@example.invalid`
      )
      const duplicate = await tx.$executeRawUnsafe(
        `INSERT IGNORE INTO tochukwu_learning_followup_deliveries
          (delivery_uuid, delivery_group_uuid, campaign_id, reminder_number, recipient_email,
           status, attempts, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, 'processing', 1, NOW(), NOW())`,
        `lfd_duplicate_${token}`,
        `lfg_duplicate_${token}`,
        campaignId,
        `smoke-${token}@example.invalid`
      )
      assert.equal(Number(first), 1)
      assert.equal(Number(duplicate), 0, "One campaign cycle must not create two delivery records")
      throw new Error(rollbackMarker)
    })
  } catch (error) {
    assert.equal(error instanceof Error ? error.message : "", rollbackMarker)
  }
  const leftovers = await prisma.$queryRawUnsafe("SELECT id FROM tochukwu_learning_followup_campaigns WHERE campaign_uuid = ?", campaignUuid)
  assert.equal(leftovers.length, 0, "Smoke fixtures must be rolled back")
  console.log("Learning inactivity follow-up database smoke test passed.")
} finally {
  await prisma.$disconnect()
}
