import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { provisionStudentForPaidOrder } from "@/lib/payments/post-payment-student"

type PaidGroupOrder = {
  order_uuid: string
  course_slug: string | null
  first_name: string | null
  email: string | null
  phone: string | null
  buyer_type: string | null
  seat_count: number | bigint | null
  batch_key: string | null
  batch_label: string | null
  provider: string | null
}

export type GroupOrderReconciliationResult = {
  candidateCount: number
  claimed: number
  recovered: number
  skipped: number
  failed: number
}

function clean(value: unknown, max = 190) {
  return String(value || "").trim().slice(0, max)
}

let stateTablePromise: Promise<void> | null = null

export function ensureGroupOrderProvisioningStateTable() {
  if (stateTablePromise) return stateTablePromise
  stateTablePromise = prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_group_order_provisioning_state (
      order_uuid VARCHAR(64) NOT NULL,
      provider VARCHAR(40) NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'pending',
      attempts INT NOT NULL DEFAULT 0,
      first_detected_at DATETIME NOT NULL,
      locked_at DATETIME NULL,
      completed_at DATETIME NULL,
      last_error VARCHAR(1000) NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (order_uuid),
      KEY idx_group_order_provisioning_status (status, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).then(() => undefined).catch((error) => {
    stateTablePromise = null
    throw error
  })
  return stateTablePromise
}

function incompletePaidGroupOrderCondition() {
  return Prisma.sql`
    (
      NOT EXISTS (
        SELECT 1
        FROM family_seat_ledger ledger
        WHERE ledger.source_type = 'course_order'
          AND ledger.entry_type = 'purchase'
          AND ledger.source_uuid COLLATE utf8mb4_unicode_ci = co.order_uuid COLLATE utf8mb4_unicode_ci
      )
      OR EXISTS (
        SELECT 1
        FROM family_children child
        JOIN family_child_enrollments enrollment ON enrollment.child_id = child.id
        WHERE child.source_type = 'course_order'
          AND enrollment.source_type = 'course_order'
          AND child.source_uuid COLLATE utf8mb4_unicode_ci = co.order_uuid COLLATE utf8mb4_unicode_ci
          AND enrollment.source_uuid COLLATE utf8mb4_unicode_ci = co.order_uuid COLLATE utf8mb4_unicode_ci
          AND (child.status = 'pending_payment' OR enrollment.status = 'pending_payment')
      )
    )
  `
}

export async function countIncompletePaidGroupOrders(minimumAgeMinutes = 5) {
  const cutoff = new Date(Date.now() - Math.max(0, minimumAgeMinutes) * 60_000)
  const rows = await prisma.$queryRaw<Array<{ total: bigint | number }>>(Prisma.sql`
    SELECT COUNT(*) AS total
    FROM course_orders co
    WHERE co.status = 'paid'
      AND COALESCE(co.buyer_type, 'student') = 'family'
      AND co.created_at <= ${cutoff}
      AND ${incompletePaidGroupOrderCondition()}
  `)
  return Number(rows[0]?.total || 0)
}

async function orderStillIncomplete(orderUuid: string) {
  const rows = await prisma.$queryRaw<Array<{ total: bigint | number }>>(Prisma.sql`
    SELECT COUNT(*) AS total
    FROM course_orders co
    WHERE co.order_uuid = ${orderUuid}
      AND co.status = 'paid'
      AND COALESCE(co.buyer_type, 'student') = 'family'
      AND ${incompletePaidGroupOrderCondition()}
  `)
  return Number(rows[0]?.total || 0) > 0
}

export async function reconcilePaidGroupOrders(input?: {
  orderUuid?: string
  limit?: number
  minimumAgeMinutes?: number
}): Promise<GroupOrderReconciliationResult> {
  await ensureGroupOrderProvisioningStateTable()
  const orderUuid = clean(input?.orderUuid, 64)
  const limit = Math.max(1, Math.min(Math.round(Number(input?.limit || 100)), 300))
  const minimumAgeMinutes = orderUuid ? 0 : Math.max(0, Math.round(Number(input?.minimumAgeMinutes ?? 5)))
  const cutoff = new Date(Date.now() - minimumAgeMinutes * 60_000)
  const candidates = await prisma.$queryRaw<PaidGroupOrder[]>(Prisma.sql`
    SELECT co.order_uuid, co.course_slug, co.first_name, co.email, co.phone, co.buyer_type,
           co.seat_count, co.batch_key, co.batch_label, co.provider
    FROM course_orders co
    WHERE co.status = 'paid'
      AND COALESCE(co.buyer_type, 'student') = 'family'
      AND co.created_at <= ${cutoff}
      AND (${orderUuid} = '' OR co.order_uuid = ${orderUuid})
      AND ${incompletePaidGroupOrderCondition()}
    ORDER BY COALESCE(co.paid_at, co.updated_at, co.created_at) ASC
    LIMIT ${limit}
  `)
  const result: GroupOrderReconciliationResult = {
    candidateCount: candidates.length,
    claimed: 0,
    recovered: 0,
    skipped: 0,
    failed: 0
  }

  for (const order of candidates) {
    const candidateUuid = clean(order.order_uuid, 64)
    const timestamp = new Date()
    await prisma.$executeRaw`
      INSERT IGNORE INTO tochukwu_group_order_provisioning_state
        (order_uuid, provider, status, attempts, first_detected_at, created_at, updated_at)
      VALUES
        (${candidateUuid}, ${clean(order.provider, 40) || null}, 'pending', 0, ${timestamp}, ${timestamp}, ${timestamp})
    `
    const claimed = await prisma.$executeRaw`
      UPDATE tochukwu_group_order_provisioning_state
      SET status = 'processing', attempts = attempts + 1, locked_at = ${timestamp},
          last_error = NULL, updated_at = ${timestamp}
      WHERE order_uuid = ${candidateUuid}
        AND (status <> 'processing' OR locked_at IS NULL OR locked_at < ${new Date(timestamp.getTime() - 10 * 60_000)})
    `
    if (!Number(claimed || 0)) {
      result.skipped += 1
      continue
    }
    result.claimed += 1

    try {
      const provisioned = await provisionStudentForPaidOrder(order, {
        createSession: false,
        sendNotifications: false
      })
      if (!provisioned?.account) throw new Error("The paid group owner account could not be provisioned.")
      if (await orderStillIncomplete(candidateUuid)) {
        throw new Error("The paid group order remains incomplete after provisioning.")
      }
      await prisma.$executeRaw`
        UPDATE tochukwu_group_order_provisioning_state
        SET status = 'completed', completed_at = ${new Date()}, locked_at = NULL,
            last_error = NULL, updated_at = ${new Date()}
        WHERE order_uuid = ${candidateUuid}
      `
      result.recovered += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await prisma.$executeRaw`
        UPDATE tochukwu_group_order_provisioning_state
        SET status = 'failed', locked_at = NULL, last_error = ${clean(message, 1000)}, updated_at = ${new Date()}
        WHERE order_uuid = ${candidateUuid}
      `
      console.error("[group-order-reconciliation] paid group order recovery failed", {
        orderUuid: candidateUuid,
        provider: clean(order.provider, 40) || null,
        error: message
      })
      result.failed += 1
    }
  }

  return result
}
