import crypto from "crypto"

import { prisma } from "@/lib/prisma"

let tablePromise: Promise<void> | null = null

function clean(value: unknown, max = 120) {
  return String(value || "").trim().slice(0, max)
}

export function ensureAutomationLeaseTable() {
  if (!tablePromise) {
    tablePromise = prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS tochukwu_automation_leases (
        automation_key VARCHAR(120) NOT NULL,
        lease_token VARCHAR(64) NOT NULL,
        locked_until DATETIME NOT NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        PRIMARY KEY (automation_key),
        KEY idx_automation_lease_expiry (locked_until)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).then(() => undefined).catch((error) => {
      tablePromise = null
      throw error
    })
  }
  return tablePromise
}

export async function acquireAutomationLease(automationKeyInput: string, leaseSeconds = 540) {
  await ensureAutomationLeaseTable()
  const automationKey = clean(automationKeyInput)
  if (!automationKey) throw new Error("Automation lease key is required.")
  const leaseToken = `lease_${crypto.randomUUID().replace(/-/g, "")}`
  const safeLeaseSeconds = Math.max(30, Math.min(900, Math.round(leaseSeconds)))
  await prisma.$executeRaw`
    INSERT INTO tochukwu_automation_leases
      (automation_key, lease_token, locked_until, created_at, updated_at)
    VALUES
      (${automationKey}, ${leaseToken}, DATE_ADD(NOW(), INTERVAL ${safeLeaseSeconds} SECOND), NOW(), NOW())
    ON DUPLICATE KEY UPDATE
      lease_token = IF(locked_until <= NOW(), VALUES(lease_token), lease_token),
      locked_until = IF(locked_until <= NOW(), VALUES(locked_until), locked_until),
      updated_at = IF(locked_until <= NOW(), NOW(), updated_at)
  `
  const rows = await prisma.$queryRaw<Array<{ acquired: number | bigint }>>`
    SELECT COUNT(*) AS acquired
    FROM tochukwu_automation_leases
    WHERE automation_key = ${automationKey} AND lease_token = ${leaseToken}
  `
  return Number(rows[0]?.acquired || 0) === 1 ? leaseToken : null
}

export async function releaseAutomationLease(automationKeyInput: string, leaseTokenInput: string) {
  const automationKey = clean(automationKeyInput)
  const leaseToken = clean(leaseTokenInput, 64)
  if (!automationKey || !leaseToken) return false
  const released = await prisma.$executeRaw`
    DELETE FROM tochukwu_automation_leases
    WHERE automation_key = ${automationKey} AND lease_token = ${leaseToken}
    LIMIT 1
  `
  return Number(released || 0) === 1
}
