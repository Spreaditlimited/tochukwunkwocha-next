import { randomUUID } from "crypto"

import { prisma } from "@/lib/prisma"

type AuditSource = "initialization" | "webhook" | "return" | "reconciliation"

export type PaystackAuditEvent = {
  orderUuid?: string | null
  providerReference?: string | null
  providerEventId?: string | null
  source: AuditSource
  eventType: string
  outcome: "initialized" | "received" | "verified" | "processing" | "not_paid" | "mismatch" | "failed" | "ignored" | "provisioned"
  providerStatus?: string | null
  expectedAmountMinor?: number | null
  receivedAmountMinor?: number | null
  expectedCurrency?: string | null
  receivedCurrency?: string | null
  httpStatus?: number | null
  errorCode?: string | null
  errorMessage?: string | null
}

type CourseOrderPaymentExpectation = {
  orderUuid: string
  providerReference: string | null
  expectedAmountMinor: number
  expectedCurrency: string
}

let auditTablePromise: Promise<void> | null = null

function clean(value: unknown, max = 190) {
  return String(value || "").trim().slice(0, max)
}

function nullableNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.round(number) : null
}

export function ensurePaystackAuditTable() {
  if (!auditTablePromise) {
    auditTablePromise = prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS tochukwu_paystack_payment_events (
        id BIGINT NOT NULL AUTO_INCREMENT,
        event_uuid VARCHAR(64) NOT NULL,
        order_uuid VARCHAR(64) NULL,
        provider_reference VARCHAR(190) NULL,
        provider_event_id VARCHAR(190) NULL,
        source VARCHAR(32) NOT NULL,
        event_type VARCHAR(80) NOT NULL,
        outcome VARCHAR(40) NOT NULL,
        provider_status VARCHAR(40) NULL,
        expected_amount_minor INT NULL,
        received_amount_minor INT NULL,
        expected_currency VARCHAR(12) NULL,
        received_currency VARCHAR(12) NULL,
        http_status INT NULL,
        error_code VARCHAR(120) NULL,
        error_message VARCHAR(1000) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uniq_tochukwu_paystack_event_uuid (event_uuid),
        KEY idx_tochukwu_paystack_event_order (order_uuid, created_at),
        KEY idx_tochukwu_paystack_event_reference (provider_reference, created_at),
        KEY idx_tochukwu_paystack_event_outcome (outcome, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).then(() => undefined).catch((error) => {
      auditTablePromise = null
      throw error
    })
  }
  return auditTablePromise
}

export async function recordPaystackAuditEvent(input: PaystackAuditEvent) {
  try {
    await ensurePaystackAuditTable()
    await prisma.$executeRaw`
      INSERT INTO tochukwu_paystack_payment_events
        (event_uuid, order_uuid, provider_reference, provider_event_id, source, event_type, outcome,
         provider_status, expected_amount_minor, received_amount_minor, expected_currency, received_currency,
         http_status, error_code, error_message, created_at)
      VALUES
        (${`pse_${randomUUID().replace(/-/g, "")}`}, ${clean(input.orderUuid, 64) || null},
         ${clean(input.providerReference) || null}, ${clean(input.providerEventId) || null},
         ${clean(input.source, 32)}, ${clean(input.eventType, 80)}, ${clean(input.outcome, 40)},
         ${clean(input.providerStatus, 40) || null}, ${nullableNumber(input.expectedAmountMinor)},
         ${nullableNumber(input.receivedAmountMinor)}, ${clean(input.expectedCurrency, 12).toUpperCase() || null},
         ${clean(input.receivedCurrency, 12).toUpperCase() || null}, ${nullableNumber(input.httpStatus)},
         ${clean(input.errorCode, 120) || null}, ${clean(input.errorMessage, 1000) || null}, ${new Date()})
    `
    return true
  } catch (error) {
    console.error("[paystack-audit] Could not persist payment event", {
      source: input.source,
      eventType: input.eventType,
      outcome: input.outcome,
      orderUuid: clean(input.orderUuid, 64) || null,
      error: error instanceof Error ? error.message : String(error)
    })
    return false
  }
}

export async function courseOrderPaymentExpectation(orderUuidInput: string): Promise<CourseOrderPaymentExpectation | null> {
  const orderUuid = clean(orderUuidInput, 64)
  if (!orderUuid) return null
  const rows = await prisma.$queryRaw<Array<{
    orderUuid: string | null
    providerReference: string | null
    expectedAmountMinor: number | bigint | null
    expectedCurrency: string | null
  }>>`
    SELECT order_uuid AS orderUuid,
           provider_reference AS providerReference,
           COALESCE(final_amount_minor, amount_minor, 0) AS expectedAmountMinor,
           UPPER(COALESCE(currency, '')) AS expectedCurrency
    FROM course_orders
    WHERE order_uuid = ${orderUuid}
    LIMIT 1
  `
  const row = rows[0]
  if (!row?.orderUuid) return null
  return {
    orderUuid: row.orderUuid,
    providerReference: row.providerReference || null,
    expectedAmountMinor: Number(row.expectedAmountMinor || 0),
    expectedCurrency: clean(row.expectedCurrency, 12).toUpperCase()
  }
}

export async function validateCourseOrderPaystackPayment(input: {
  orderUuid: string
  providerReference?: string | null
  receivedAmountMinor?: number | null
  receivedCurrency?: string | null
}) {
  const expected = await courseOrderPaymentExpectation(input.orderUuid)
  if (!expected) {
    return { ok: false as const, reason: "order_not_found", expected: null }
  }
  const receivedAmountMinor = nullableNumber(input.receivedAmountMinor)
  const receivedCurrency = clean(input.receivedCurrency, 12).toUpperCase()
  const receivedReference = clean(input.providerReference)
  if (expected.providerReference && receivedReference && receivedReference !== expected.providerReference) {
    return { ok: false as const, reason: "reference_mismatch", expected }
  }
  if (receivedAmountMinor === null || !receivedCurrency) {
    return { ok: false as const, reason: "missing_provider_amount", expected }
  }
  if (receivedAmountMinor !== expected.expectedAmountMinor) {
    return { ok: false as const, reason: "amount_mismatch", expected }
  }
  if (receivedCurrency !== expected.expectedCurrency) {
    return { ok: false as const, reason: "currency_mismatch", expected }
  }
  return { ok: true as const, reason: "verified", expected }
}

export function isPaystackProcessingStatus(statusInput: unknown) {
  const status = clean(statusInput, 40).toLowerCase()
  return ["pending", "ongoing", "processing", "queued"].includes(status)
}
