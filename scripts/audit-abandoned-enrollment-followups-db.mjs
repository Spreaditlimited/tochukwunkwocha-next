import assert from "node:assert/strict"

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

try {
  const joinedRows = await prisma.$queryRawUnsafe(`
    SELECT co.order_uuid
    FROM course_orders co
    LEFT JOIN course_batches cb
      ON cb.course_slug COLLATE utf8mb4_unicode_ci = co.course_slug COLLATE utf8mb4_unicode_ci
     AND cb.batch_key COLLATE utf8mb4_unicode_ci = co.batch_key COLLATE utf8mb4_unicode_ci
    LEFT JOIN tochukwu_learning_courses lc
      ON lc.course_slug COLLATE utf8mb4_unicode_ci = co.course_slug COLLATE utf8mb4_unicode_ci
    WHERE COALESCE(co.order_uuid, '') <> ''
    LIMIT 50
  `)
  assert.ok(Array.isArray(joinedRows))

  const contactMatches = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) AS total
    FROM course_orders co
    WHERE EXISTS (
      SELECT 1
      FROM tochukwu_whatsapp_contacts wc
      WHERE wc.whatsapp_opted_in = 1
        AND (
          LOWER(wc.email) COLLATE utf8mb4_unicode_ci = LOWER(co.email) COLLATE utf8mb4_unicode_ci
          OR wc.phone_e164 COLLATE utf8mb4_unicode_ci = co.phone COLLATE utf8mb4_unicode_ci
        )
    )
  `)
  assert.ok(Array.isArray(contactMatches))

  const [followupState] = await prisma.$queryRawUnsafe(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status IN ('pending', 'retry') AND next_reminder_at <= NOW() THEN 1 ELSE 0 END) AS due,
      SUM(CASE WHEN reminder_count > 3 OR email_cycle_sent > 3 OR whatsapp_cycle_sent > 3 THEN 1 ELSE 0 END) AS over_limit
    FROM tochukwu_abandoned_enrollment_followups
  `)

  console.log(JSON.stringify({
    joinedOrdersChecked: joinedRows.length,
    optedInOrderMatches: Number(contactMatches[0]?.total || 0),
    followups: Number(followupState?.total || 0),
    due: Number(followupState?.due || 0),
    overLimit: Number(followupState?.over_limit || 0)
  }))
} finally {
  await prisma.$disconnect()
}
