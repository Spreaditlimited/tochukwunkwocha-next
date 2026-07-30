import assert from "node:assert/strict"
import crypto from "node:crypto"

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const email = String(process.argv[2] || "").trim().toLowerCase()
const courseSlug = String(process.argv[3] || "").trim().toLowerCase()
const apply = process.argv.includes("--apply")

function serialise(value) {
  return JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item, 2)
}

function matchKey(plan) {
  return [
    plan.course_slug,
    plan.batch_key || "",
    plan.currency,
    Number(plan.target_amount_minor || 0),
    Number(plan.base_amount_minor || 0),
    Number(plan.discount_minor || 0),
    Number(plan.coupon_id || 0),
    plan.buyer_type || "student",
    Number(plan.seat_count || 1)
  ].join("|")
}

async function loadPlans(client) {
  return client.$queryRawUnsafe(
    `SELECT pl.id, pl.plan_uuid, pl.account_id, pl.course_slug, pl.batch_key, pl.batch_label,
            pl.country, pl.provider, pl.currency, pl.target_amount_minor, pl.base_amount_minor,
            pl.discount_minor, pl.coupon_code, pl.coupon_id, pl.buyer_type, pl.seat_count,
            pl.family_account_id, pl.total_paid_minor, pl.status, pl.enrolled_order_uuid,
            pl.created_at, a.full_name, a.email, a.phone_e164,
            COALESCE(SUM(CASE WHEN ip.status = 'paid' THEN ip.amount_minor ELSE 0 END), 0) AS paid_sum,
            COUNT(CASE WHEN ip.status = 'paid' THEN 1 END) AS paid_count,
            COUNT(CASE WHEN ip.status = 'pending' THEN 1 END) AS pending_count
     FROM student_installment_plans pl
     JOIN student_accounts a ON a.id = pl.account_id
     LEFT JOIN student_installment_payments ip ON ip.plan_id = pl.id
     WHERE LOWER(a.email) = ? AND pl.course_slug = ?
     GROUP BY pl.id
     ORDER BY pl.created_at ASC, pl.id ASC`,
    email,
    courseSlug
  )
}

function eligibleGroups(plans) {
  const groups = new Map()
  for (const plan of plans.filter((item) => item.status === "open")) {
    const key = matchKey(plan)
    const current = groups.get(key) || []
    current.push(plan)
    groups.set(key, current)
  }
  return [...groups.values()]
    .map((members) => ({
      members,
      paidMinor: members.reduce((sum, plan) => sum + Number(plan.paid_sum || 0), 0),
      targetMinor: Number(members[0].target_amount_minor || 0)
    }))
    .filter((group) => group.targetMinor > 0 && group.paidMinor >= group.targetMinor)
}

async function main() {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !courseSlug) {
    throw new Error("Usage: node --env-file=.env scripts/reconcile-installment-student.mjs student@example.com course-slug [--apply]")
  }

  const preview = await loadPlans(prisma)
  if (!preview.length) throw new Error("No installment plans were found for this student and course.")
  const candidates = eligibleGroups(preview)
  console.log(serialise({
    mode: apply ? "apply" : "preview",
    email,
    courseSlug,
    plans: preview.map((plan) => ({
      id: plan.id,
      planUuid: plan.plan_uuid,
      batchKey: plan.batch_key,
      targetMinor: plan.target_amount_minor,
      recordedTotalMinor: plan.total_paid_minor,
      ledgerPaidMinor: plan.paid_sum,
      status: plan.status,
      paidPayments: plan.paid_count,
      pendingPayments: plan.pending_count
    })),
    eligibleGroups: candidates.map((group) => ({
      planIds: group.members.map((plan) => plan.id),
      paidMinor: group.paidMinor,
      targetMinor: group.targetMinor
    }))
  }))
  if (!apply) return
  assert.equal(candidates.length, 1, "Expected exactly one fully paid matching installment group.")
  assert.equal(candidates[0].paidMinor, candidates[0].targetMinor, "Automatic reconciliation refuses overpayments; review this account manually.")

  const result = await prisma.$transaction(async (tx) => {
    const accounts = await tx.$queryRawUnsafe(
      "SELECT id FROM student_accounts WHERE LOWER(email) = ? LIMIT 1 FOR UPDATE",
      email
    )
    assert.equal(accounts.length, 1, "Student account was not found or was duplicated.")

    const lockedPlans = await loadPlans(tx)
    const lockedCandidates = eligibleGroups(lockedPlans)
    assert.equal(lockedCandidates.length, 1, "The eligible installment group changed while it was being reconciled.")
    const group = lockedCandidates[0]
    assert.equal(group.paidMinor, group.targetMinor, "The paid amount changed while it was being reconciled.")

    const members = [...group.members].sort((left, right) => {
      const paidDifference = Number(right.paid_sum || 0) - Number(left.paid_sum || 0)
      if (paidDifference) return paidDifference
      return Number(left.id) - Number(right.id)
    })
    const canonical = members[0]
    const duplicateIds = members.slice(1).map((plan) => plan.id)
    const timestamp = new Date()

    for (const duplicateId of duplicateIds) {
      await tx.$executeRawUnsafe(
        "UPDATE student_installment_payments SET plan_id = ?, updated_at = ? WHERE plan_id = ?",
        canonical.id,
        timestamp,
        duplicateId
      )
      await tx.$executeRawUnsafe(
        "UPDATE student_installment_plans SET total_paid_minor = 0, status = 'merged', enrolled_order_uuid = NULL, updated_at = ? WHERE id = ? AND status = 'open'",
        timestamp,
        duplicateId
      )
    }
    await tx.$executeRawUnsafe(
      `UPDATE student_installment_plans
       SET total_paid_minor = (
         SELECT COALESCE(SUM(amount_minor), 0)
         FROM student_installment_payments
         WHERE plan_id = ? AND status = 'paid'
       ), updated_at = ?
       WHERE id = ?`,
      canonical.id,
      timestamp,
      canonical.id
    )

    const orderUuid = canonical.enrolled_order_uuid || crypto.randomUUID()
    const buyerType = canonical.buyer_type === "family" ? "family" : "student"
    const seatCount = buyerType === "family" ? Math.max(2, Number(canonical.seat_count || 2)) : 1
    let familyAccountId = canonical.family_account_id || null

    if (buyerType === "family") {
      await tx.$executeRawUnsafe(
        `INSERT INTO family_accounts
           (family_uuid, parent_account_id, parent_name, parent_email, parent_phone, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
         ON DUPLICATE KEY UPDATE
           parent_name = VALUES(parent_name), parent_email = VALUES(parent_email),
           parent_phone = COALESCE(VALUES(parent_phone), parent_phone),
           status = 'active', updated_at = VALUES(updated_at)`,
        `fam_${crypto.randomUUID().replaceAll("-", "")}`,
        canonical.account_id,
        canonical.full_name,
        canonical.email,
        canonical.phone_e164,
        timestamp,
        timestamp
      )
      const families = await tx.$queryRawUnsafe(
        "SELECT id FROM family_accounts WHERE parent_account_id = ? LIMIT 1 FOR UPDATE",
        canonical.account_id
      )
      assert.equal(families.length, 1, "Could not create the family account.")
      familyAccountId = families[0].id
      const idempotencyKey = `course_order:${orderUuid}:purchase`
      const ledger = await tx.$queryRawUnsafe(
        "SELECT id FROM family_seat_ledger WHERE idempotency_key = ? LIMIT 1 FOR UPDATE",
        idempotencyKey
      )
      if (!ledger.length) {
        const balances = await tx.$queryRawUnsafe(
          `SELECT id, seats_purchased FROM family_seat_balances
           WHERE family_id = ? AND course_slug = ? AND batch_key = ?
           LIMIT 1 FOR UPDATE`,
          familyAccountId,
          canonical.course_slug,
          canonical.batch_key || ""
        )
        if (balances[0]) {
          await tx.$executeRawUnsafe(
            "UPDATE family_seat_balances SET seats_purchased = ?, batch_label = COALESCE(?, batch_label), updated_at = ? WHERE id = ?",
            Number(balances[0].seats_purchased || 0) + seatCount,
            canonical.batch_label,
            timestamp,
            balances[0].id
          )
        } else {
          await tx.$executeRawUnsafe(
            `INSERT INTO family_seat_balances
               (family_id, course_slug, batch_key, batch_label, seats_purchased, seats_consumed, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
            familyAccountId,
            canonical.course_slug,
            canonical.batch_key || "",
            canonical.batch_label,
            seatCount,
            timestamp,
            timestamp
          )
        }
        await tx.$executeRawUnsafe(
          `INSERT INTO family_seat_ledger
             (family_id, course_slug, batch_key, entry_type, quantity, source_type, source_uuid,
              idempotency_key, metadata_json, created_at, updated_at)
           VALUES (?, ?, ?, 'purchase', ?, 'course_order', ?, ?, ?, ?, ?)`,
          familyAccountId,
          canonical.course_slug,
          canonical.batch_key || "",
          seatCount,
          orderUuid,
          idempotencyKey,
          JSON.stringify({ batch_label: canonical.batch_label || null, reconciliation: true }),
          timestamp,
          timestamp
        )
      }
    }

    await tx.$executeRawUnsafe(
      `INSERT INTO course_orders
         (order_uuid, course_slug, first_name, email, phone, country, currency, amount_minor,
          base_amount_minor, discount_minor, final_amount_minor, coupon_code, coupon_id, provider,
          buyer_type, seat_count, family_account_id, status, batch_key, batch_label, paid_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'wallet', ?, ?, ?, 'paid', ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         family_account_id = COALESCE(VALUES(family_account_id), family_account_id),
         status = 'paid', paid_at = COALESCE(paid_at, VALUES(paid_at)), updated_at = VALUES(updated_at)`,
      orderUuid,
      canonical.course_slug,
      canonical.full_name,
      canonical.email,
      canonical.phone_e164,
      canonical.country,
      canonical.currency,
      group.targetMinor,
      Number(canonical.base_amount_minor || group.targetMinor),
      Number(canonical.discount_minor || 0),
      group.targetMinor,
      canonical.coupon_code,
      canonical.coupon_id,
      buyerType,
      seatCount,
      familyAccountId,
      canonical.batch_key,
      canonical.batch_label,
      timestamp,
      timestamp,
      timestamp
    )
    await tx.$executeRawUnsafe(
      `UPDATE student_installment_plans
       SET status = 'enrolled', enrolled_order_uuid = ?, family_account_id = COALESCE(?, family_account_id), updated_at = ?
       WHERE id = ?`,
      orderUuid,
      familyAccountId,
      timestamp,
      canonical.id
    )
    return { canonicalPlanId: canonical.id, mergedPlanIds: duplicateIds, orderUuid, familyAccountId, seatCount }
  }, { timeout: 20_000 })

  console.log(serialise({ reconciled: true, ...result }))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
