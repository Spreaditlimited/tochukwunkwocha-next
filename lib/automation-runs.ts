import crypto from "crypto"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

function clean(value: unknown, max = 1000) {
  return String(value || "").trim().slice(0, max)
}

export async function ensureAutomationRunsTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_automation_runs (
      id BIGINT NOT NULL AUTO_INCREMENT,
      run_uuid VARCHAR(64) NOT NULL,
      automation_key VARCHAR(120) NOT NULL,
      status VARCHAR(24) NOT NULL,
      result_json LONGTEXT NULL,
      last_error VARCHAR(1000) NULL,
      started_at DATETIME NOT NULL,
      finished_at DATETIME NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_automation_run_uuid (run_uuid),
      KEY idx_automation_run_key_started (automation_key, started_at),
      KEY idx_automation_run_status (status, started_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}

export async function beginAutomationRun(automationKey: string) {
  await ensureAutomationRunsTable()
  const runUuid = `arun_${crypto.randomUUID().replace(/-/g, "")}`
  const now = new Date()
  await prisma.$executeRaw`
    INSERT INTO tochukwu_automation_runs
      (run_uuid, automation_key, status, started_at, created_at, updated_at)
    VALUES (${runUuid}, ${clean(automationKey, 120)}, 'running', ${now}, ${now}, ${now})
  `
  return runUuid
}

export async function finishAutomationRun(runUuid: string, input: { ok: boolean; result?: unknown; error?: unknown }) {
  const now = new Date()
  const resultJson = input.result === undefined ? null : clean(JSON.stringify(input.result), 20000)
  const error = input.error instanceof Error ? input.error.message : clean(input.error, 1000)
  await prisma.$executeRaw`
    UPDATE tochukwu_automation_runs
    SET status = ${input.ok ? "completed" : "failed"}, result_json = ${resultJson},
      last_error = ${input.ok ? null : clean(error, 1000) || "Automation failed."},
      finished_at = ${now}, updated_at = ${now}
    WHERE run_uuid = ${clean(runUuid, 64)} LIMIT 1
  `
}

export async function listAutomationRunHealth(keys: string[]) {
  await ensureAutomationRunsTable()
  if (!keys.length) return []
  return prisma.$queryRaw<Array<{
    automationKey: string
    status: string
    resultJson: string | null
    lastError: string | null
    startedAt: Date
    finishedAt: Date | null
  }>>(Prisma.sql`
    SELECT r.automation_key AS automationKey, r.status, r.result_json AS resultJson, r.last_error AS lastError,
      r.started_at AS startedAt, r.finished_at AS finishedAt
    FROM tochukwu_automation_runs r
    JOIN (
      SELECT automation_key, MAX(id) AS latest_id
      FROM tochukwu_automation_runs
      WHERE automation_key IN (${Prisma.join(keys)})
      GROUP BY automation_key
    ) latest ON latest.latest_id = r.id
    ORDER BY r.automation_key
  `)
}
