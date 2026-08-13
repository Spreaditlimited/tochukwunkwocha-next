import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const apply = process.argv.includes("--apply")

try {
  const [before] = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) AS total
    FROM tochukwu_abandoned_enrollment_followups f
    JOIN course_orders co
      ON co.order_uuid COLLATE utf8mb4_unicode_ci = f.order_uuid COLLATE utf8mb4_unicode_ci
    WHERE f.status IN ('pending', 'retry', 'processing')
      AND co.created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
      AND f.reminder_count = 0
      AND f.email_cycle_sent = 0
      AND f.whatsapp_cycle_sent = 0
      AND f.last_error = 'Paystack verification was unavailable; the reminder was deferred.'
  `)

  let stopped = 0
  if (apply) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS tochukwu_automation_leases (
        automation_key VARCHAR(120) NOT NULL,
        lease_token VARCHAR(64) NOT NULL,
        locked_until DATETIME NOT NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        PRIMARY KEY (automation_key),
        KEY idx_automation_lease_expiry (locked_until)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    stopped = Number(await prisma.$executeRawUnsafe(`
      UPDATE tochukwu_abandoned_enrollment_followups f
      JOIN course_orders co
        ON co.order_uuid COLLATE utf8mb4_unicode_ci = f.order_uuid COLLATE utf8mb4_unicode_ci
      SET f.status = 'stopped', f.stopped_at = NOW(), f.stopped_reason = 'historical_retry_suppressed',
          f.locked_at = NULL, f.last_error = NULL, f.updated_at = NOW()
      WHERE f.status IN ('pending', 'retry', 'processing')
        AND co.created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
        AND f.reminder_count = 0
        AND f.email_cycle_sent = 0
        AND f.whatsapp_cycle_sent = 0
        AND f.last_error = 'Paystack verification was unavailable; the reminder was deferred.'
    `) || 0)
  }

  const [after] = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) AS total
    FROM tochukwu_abandoned_enrollment_followups f
    JOIN course_orders co
      ON co.order_uuid COLLATE utf8mb4_unicode_ci = f.order_uuid COLLATE utf8mb4_unicode_ci
    WHERE f.status IN ('pending', 'retry', 'processing')
      AND co.created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
      AND f.reminder_count = 0
      AND f.email_cycle_sent = 0
      AND f.whatsapp_cycle_sent = 0
      AND f.last_error = 'Paystack verification was unavailable; the reminder was deferred.'
  `)

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    eligibleBefore: Number(before?.total || 0),
    stopped,
    eligibleAfter: Number(after?.total || 0)
  }))
} finally {
  await prisma.$disconnect()
}
