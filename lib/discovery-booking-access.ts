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

export async function markBuildDiscoveryPaymentPaid(
  referenceInput: string,
  providerOrderId?: string | null,
  verification?: { amountMinor?: number | null; currency?: string | null; leadUuid?: string | null; provider?: string | null }
) {
  const reference = clean(referenceInput, 180)
  if (!reference) throw new Error("Payment reference is required.")
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      SELECT id, lead_uuid, work_email, full_name, amount_minor, payment_provider, payment_status
      FROM tochukwu_build_discovery_payments
      WHERE payment_reference = ${reference}
      LIMIT 1
      FOR UPDATE
    `)
    const row = rows[0]
    if (!row) throw new Error("Build discovery payment not found.")
    const expectedAmount = Number(row.amount_minor || 0)
    const receivedAmount = verification?.amountMinor
    const receivedCurrency = clean(verification?.currency, 10).toUpperCase()
    const receivedLeadUuid = clean(verification?.leadUuid, 64)
    if (receivedAmount !== undefined && receivedAmount !== null && Math.round(Number(receivedAmount)) !== expectedAmount) {
      throw new Error("Paid amount does not match this build discovery payment.")
    }
    if (receivedCurrency && receivedCurrency !== "NGN") throw new Error("Paid currency does not match this build discovery payment.")
    if (receivedLeadUuid && receivedLeadUuid !== clean(row.lead_uuid, 64)) throw new Error("Payment metadata does not match this build lead.")
    if (clean(verification?.provider, 40).toLowerCase() && clean(row.payment_provider, 40).toLowerCase() !== clean(verification?.provider, 40).toLowerCase()) {
      throw new Error("Payment provider does not match this build discovery payment.")
    }
    const alreadyPaid = clean(row.payment_status, 40).toLowerCase() === "paid"
    if (!alreadyPaid) {
      await tx.$executeRaw`
        UPDATE tochukwu_build_discovery_payments
        SET payment_status = 'paid', payment_order_id = ${clean(providerOrderId, 180) || null},
            paid_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP()
        WHERE id = ${Number(row.id)} LIMIT 1
      `
    }
    return { leadUuid: clean(row.lead_uuid, 64), score: 100, alreadyPaid, email: clean(row.work_email, 220), fullName: clean(row.full_name, 180) }
  })
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

export async function markPrivateCoachingPaymentPaid(
  referenceInput: string,
  providerOrderId?: string | null,
  verification?: { amountMinor?: number | null; currency?: string | null; leadUuid?: string | null; provider?: string | null }
) {
  const reference = clean(referenceInput, 180)
  if (!reference) throw new Error("Payment reference is required.")
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      SELECT id, lead_uuid, work_email, full_name, payment_type, amount_minor, currency, payment_provider, payment_status
      FROM tochukwu_private_ai_coaching_payments
      WHERE payment_reference = ${reference}
      LIMIT 1
      FOR UPDATE
    `)
    const row = rows[0]
    if (!row) throw new Error("Private coaching payment not found.")
    const receivedAmount = verification?.amountMinor
    const receivedCurrency = clean(verification?.currency, 10).toUpperCase()
    const receivedLeadUuid = clean(verification?.leadUuid, 80)
    if (receivedAmount !== undefined && receivedAmount !== null && Math.round(Number(receivedAmount)) !== Number(row.amount_minor || 0)) {
      throw new Error("Paid amount does not match this private coaching payment.")
    }
    if (receivedCurrency && receivedCurrency !== clean(row.currency, 10).toUpperCase()) {
      throw new Error("Paid currency does not match this private coaching payment.")
    }
    if (receivedLeadUuid && receivedLeadUuid !== clean(row.lead_uuid, 80)) throw new Error("Payment metadata does not match this coaching lead.")
    if (clean(verification?.provider, 40).toLowerCase() && clean(row.payment_provider, 40).toLowerCase() !== clean(verification?.provider, 40).toLowerCase()) {
      throw new Error("Payment provider does not match this private coaching payment.")
    }
    const alreadyPaid = clean(row.payment_status, 40).toLowerCase() === "paid"
    if (!alreadyPaid) {
      await tx.$executeRaw`
        UPDATE tochukwu_private_ai_coaching_payments
        SET payment_status = 'paid', payment_order_id = ${clean(providerOrderId, 180) || null},
            paid_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP()
        WHERE id = ${Number(row.id)} LIMIT 1
      `
    }
    return {
      leadUuid: clean(row.lead_uuid, 80), paymentType: clean(row.payment_type, 40), alreadyPaid,
      email: clean(row.work_email, 220), fullName: clean(row.full_name, 180)
    }
  })
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
