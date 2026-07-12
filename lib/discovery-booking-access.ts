import crypto from "crypto"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function shaToken(token: string) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex")
}

function sqlDate(date: Date) {
  return date.toISOString().slice(0, 19).replace("T", " ")
}

export async function markBuildDiscoveryPaymentPaid(referenceInput: string, providerOrderId?: string | null) {
  const reference = clean(referenceInput, 180)
  if (!reference) throw new Error("Payment reference is required.")
  await prisma.$executeRaw`
    UPDATE tochukwu_build_discovery_payments
    SET payment_status = 'paid',
        payment_order_id = ${clean(providerOrderId, 180) || null},
        paid_at = UTC_TIMESTAMP(),
        updated_at = UTC_TIMESTAMP()
    WHERE payment_reference = ${reference}
    LIMIT 1
  `
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT lead_uuid, amount_minor, payment_provider, payment_status
    FROM tochukwu_build_discovery_payments
    WHERE payment_reference = ${reference}
    LIMIT 1
  `)
  const row = rows[0]
  if (!row || clean(row.payment_status, 40) !== "paid") throw new Error("Build discovery payment not found.")
  return {
    leadUuid: clean(row.lead_uuid, 64),
    score: 100
  }
}

export async function issueBuildBookingAccess(input: { leadUuid: string; score?: number; discoveryApproved?: boolean }) {
  const leadUuid = clean(input.leadUuid, 64)
  if (!leadUuid) throw new Error("Build lead UUID is required.")
  const token = `buildq_${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`
  const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  await prisma.$executeRaw`
    INSERT INTO tochukwu_build_booking_access
      (access_uuid, token_hash, score, discovery_approved, answers_json, source_path, expires_at, used_at, created_at, lead_uuid)
    VALUES
      (${`build_access_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`}, ${shaToken(token)}, ${Math.max(0, Math.min(100, Math.round(Number(input.score || 100))))},
       ${input.discoveryApproved === false ? 0 : 1}, ${"{}"}, ${"/build-scorecard/"}, ${sqlDate(expiresAt)}, NULL, UTC_TIMESTAMP(), ${leadUuid})
  `
  return { token, expiresAtIso: expiresAt.toISOString() }
}

export async function markPrivateCoachingPaymentPaid(referenceInput: string, providerOrderId?: string | null) {
  const reference = clean(referenceInput, 180)
  if (!reference) throw new Error("Payment reference is required.")
  await prisma.$executeRaw`
    UPDATE tochukwu_private_ai_coaching_payments
    SET payment_status = 'paid',
        payment_order_id = ${clean(providerOrderId, 180) || null},
        paid_at = UTC_TIMESTAMP(),
        updated_at = UTC_TIMESTAMP()
    WHERE payment_reference = ${reference}
    LIMIT 1
  `
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT lead_uuid, payment_type, payment_status
    FROM tochukwu_private_ai_coaching_payments
    WHERE payment_reference = ${reference}
    LIMIT 1
  `)
  const row = rows[0]
  if (!row || clean(row.payment_status, 40) !== "paid") throw new Error("Private coaching payment not found.")
  return {
    leadUuid: clean(row.lead_uuid, 80),
    paymentType: clean(row.payment_type, 40)
  }
}

export async function issuePrivateCoachingBookingAccess(leadUuidInput: string) {
  const leadUuid = clean(leadUuidInput, 80)
  if (!leadUuid) throw new Error("Private coaching lead UUID is required.")
  const token = `paic_${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`
  const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  await prisma.$executeRaw`
    INSERT INTO tochukwu_private_ai_coaching_booking_access
      (access_uuid, token_hash, lead_uuid, expires_at, used_at, created_at)
    VALUES
      (${`paic_access_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`}, ${shaToken(token)}, ${leadUuid}, ${sqlDate(expiresAt)}, NULL, UTC_TIMESTAMP())
  `
  return { token, expiresAtIso: expiresAt.toISOString() }
}
