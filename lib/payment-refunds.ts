import crypto from "crypto"
import { Prisma } from "@prisma/client"

import { reconcileFamilyOwnerBrevoLists } from "@/lib/enrollment-notifications"
import { prisma } from "@/lib/prisma"

type RefundSource = "manual" | "online"

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

export async function ensureCourseRefundTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_course_payment_refunds (
      id BIGINT NOT NULL AUTO_INCREMENT,
      refund_uuid VARCHAR(64) NOT NULL,
      source_type VARCHAR(24) NOT NULL,
      payment_uuid VARCHAR(100) NOT NULL,
      course_slug VARCHAR(120) NULL,
      batch_key VARCHAR(64) NULL,
      customer_name VARCHAR(190) NULL,
      customer_email VARCHAR(220) NOT NULL,
      currency VARCHAR(12) NOT NULL,
      amount_minor BIGINT NOT NULL,
      refund_method VARCHAR(40) NOT NULL,
      refund_reference VARCHAR(190) NOT NULL,
      reason VARCHAR(1000) NOT NULL,
      access_revoked TINYINT(1) NOT NULL DEFAULT 1,
      recorded_by VARCHAR(190) NOT NULL,
      refunded_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_course_refund_uuid (refund_uuid),
      UNIQUE KEY uniq_tochukwu_course_refund_payment (source_type, payment_uuid),
      KEY idx_tochukwu_course_refund_date (refunded_at),
      KEY idx_tochukwu_course_refund_email (customer_email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}

export async function recordCoursePaymentRefund(input: {
  source: RefundSource
  paymentUuid: string
  reason: string
  refundMethod: string
  refundReference: string
  recordedBy: string
  refundedAt?: Date
}) {
  await ensureCourseRefundTable()
  const source = input.source
  const paymentUuid = clean(input.paymentUuid, 100)
  const reason = clean(input.reason, 1000)
  const refundMethod = clean(input.refundMethod, 40).toLowerCase()
  const refundReference = clean(input.refundReference, 190)
  const recordedBy = clean(input.recordedBy, 190) || "admin"
  const refundedAt = input.refundedAt || new Date()
  if (!paymentUuid || !reason || !refundReference) throw new Error("Payment, refund reason, and refund reference are required.")
  if (!new Set(["bank_transfer", "paystack", "stripe", "paypal", "cash", "other"]).has(refundMethod)) {
    throw new Error("Choose a valid refund method.")
  }

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.$queryRaw<Array<{ refundUuid: string }>>(Prisma.sql`
      SELECT refund_uuid AS refundUuid
      FROM tochukwu_course_payment_refunds
      WHERE source_type = ${source} AND payment_uuid = ${paymentUuid}
      LIMIT 1 FOR UPDATE
    `)
    if (existing[0]) return { ok: true as const, alreadyRecorded: true, refundUuid: existing[0].refundUuid, familyContext: null }

    const rows = source === "manual"
      ? await tx.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          SELECT id, payment_uuid AS paymentUuid, course_slug AS courseSlug, batch_key AS batchKey,
                 first_name AS customerName, email AS customerEmail, currency,
                 COALESCE(final_amount_minor, amount_minor, 0) AS amountMinor,
                 status, COALESCE(buyer_type, 'student') AS buyerType, COALESCE(seat_count, 1) AS seatCount
          FROM course_manual_payments WHERE payment_uuid = ${paymentUuid} LIMIT 1 FOR UPDATE
        `)
      : await tx.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          SELECT id, order_uuid AS paymentUuid, course_slug AS courseSlug, batch_key AS batchKey,
                 first_name AS customerName, email AS customerEmail, currency,
                 COALESCE(final_amount_minor, amount_minor, 0) AS amountMinor,
                 status, COALESCE(buyer_type, 'student') AS buyerType, COALESCE(seat_count, 1) AS seatCount
          FROM course_orders WHERE order_uuid = ${paymentUuid} LIMIT 1 FOR UPDATE
        `)
    const payment = rows[0]
    if (!payment) throw new Error("Course payment not found.")
    const buyerType = clean(payment.buyerType, 40).toLowerCase()
    const status = clean(payment.status, 40).toLowerCase()
    const validStatuses = source === "manual" ? ["approved", "revoked", "refunded"] : ["paid", "refunded"]
    if (!validStatuses.includes(status)) throw new Error("Only a confirmed course payment can be refunded.")
    const amountMinor = Number(payment.amountMinor || 0)
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new Error("The refundable payment amount is invalid.")

    const enrollmentSourceType = source === "manual" ? "manual_payment" : "course_order"
    let familyContext: {
      familyId: bigint
      parentAccountId: bigint
      parentName: string
      parentEmail: string
      parentPhone: string
      courseSlug: string
      batchKey: string
      brevoListId: string | null
      childIds: bigint[]
      childAccountIds: bigint[]
      seatQuantity: number
    } | null = null

    if (buyerType === "family") {
      const purchases = await tx.$queryRaw<Array<{
        familyId: bigint
        parentAccountId: bigint
        parentName: string | null
        parentEmail: string | null
        parentPhone: string | null
        courseSlug: string
        batchKey: string | null
        quantity: number | bigint
        brevoListId: string | null
      }>>(Prisma.sql`
        SELECT ledger.family_id AS familyId, family.parent_account_id AS parentAccountId,
          family.parent_name AS parentName, family.parent_email AS parentEmail,
          family.parent_phone AS parentPhone, ledger.course_slug AS courseSlug,
          ledger.batch_key AS batchKey, ledger.quantity, batch.brevo_list_id AS brevoListId
        FROM family_seat_ledger ledger
        JOIN family_accounts family ON family.id = ledger.family_id
        LEFT JOIN course_batches batch
          ON batch.course_slug = ledger.course_slug AND batch.batch_key = ledger.batch_key
        WHERE ledger.source_type = ${enrollmentSourceType}
          AND ledger.source_uuid = ${paymentUuid}
          AND ledger.entry_type = 'purchase'
        LIMIT 1
        FOR UPDATE
      `)
      const purchase = purchases[0]
      if (!purchase) throw new Error("The group seat purchase ledger could not be found.")
      const seatQuantity = Number(purchase.quantity || payment.seatCount || 0)
      if (!Number.isSafeInteger(seatQuantity) || seatQuantity <= 0) throw new Error("The refundable group seat quantity is invalid.")

      const balances = await tx.$queryRaw<Array<{
        id: bigint
        seatsPurchased: number | bigint
        seatsConsumed: number | bigint
      }>>(Prisma.sql`
        SELECT id, seats_purchased AS seatsPurchased, seats_consumed AS seatsConsumed
        FROM family_seat_balances
        WHERE family_id = ${purchase.familyId}
          AND course_slug = ${purchase.courseSlug}
          AND batch_key = ${clean(purchase.batchKey, 64)}
        LIMIT 1
        FOR UPDATE
      `)
      const balance = balances[0]
      if (!balance || Number(balance.seatsPurchased || 0) < seatQuantity) {
        throw new Error("The group seat balance no longer matches the payment being refunded.")
      }

      const children = await tx.$queryRaw<Array<{ childId: bigint; accountId: bigint | null }>>(Prisma.sql`
        SELECT child.id AS childId, child.account_id AS accountId
        FROM family_children child
        JOIN family_child_enrollments enrollment
          ON enrollment.child_id = child.id AND enrollment.family_id = child.family_id
        WHERE child.family_id = ${purchase.familyId}
          AND enrollment.course_slug = ${purchase.courseSlug}
          AND enrollment.source_type = ${enrollmentSourceType}
          AND enrollment.source_uuid = ${paymentUuid}
          AND enrollment.status = 'active'
        ORDER BY child.id
        FOR UPDATE
      `)
      if (children.length > seatQuantity || Number(balance.seatsConsumed || 0) < children.length) {
        throw new Error("The active group learners no longer match the refunded seat allocation.")
      }

      familyContext = {
        familyId: purchase.familyId,
        parentAccountId: purchase.parentAccountId,
        parentName: clean(purchase.parentName, 180),
        parentEmail: clean(purchase.parentEmail, 220).toLowerCase(),
        parentPhone: clean(purchase.parentPhone, 80),
        courseSlug: clean(purchase.courseSlug, 120).toLowerCase(),
        batchKey: clean(purchase.batchKey, 64),
        brevoListId: purchase.brevoListId,
        childIds: children.map((child) => child.childId),
        childAccountIds: children.flatMap((child) => child.accountId ? [child.accountId] : []),
        seatQuantity
      }
    }

    const refundUuid = `refund_${crypto.randomUUID().replace(/-/g, "")}`
    const now = new Date()
    await tx.$executeRaw`
      INSERT INTO tochukwu_course_payment_refunds
        (refund_uuid, source_type, payment_uuid, course_slug, batch_key, customer_name, customer_email,
         currency, amount_minor, refund_method, refund_reference, reason, access_revoked,
         recorded_by, refunded_at, created_at, updated_at)
      VALUES
        (${refundUuid}, ${source}, ${paymentUuid}, ${clean(payment.courseSlug, 120) || null},
         ${clean(payment.batchKey, 64) || null}, ${clean(payment.customerName, 190) || null},
         ${clean(payment.customerEmail, 220).toLowerCase()}, ${clean(payment.currency, 12).toUpperCase() || "NGN"},
         ${amountMinor}, ${refundMethod}, ${refundReference}, ${reason}, 1,
         ${recordedBy}, ${refundedAt}, ${now}, ${now})
    `

    const auditNote = `\n[PAYMENT_REFUNDED] ${clean(payment.currency, 12).toUpperCase() || "NGN"} ${(amountMinor / 100).toFixed(2)} via ${refundMethod}; reference ${refundReference}; reason: ${reason}; recorded by ${recordedBy}.`
    if (source === "manual") {
      await tx.$executeRaw`
        UPDATE course_manual_payments
        SET status = 'refunded', review_note = CONCAT(COALESCE(review_note, ''), ${auditNote}), updated_at = ${now}
        WHERE payment_uuid = ${paymentUuid} LIMIT 1
      `
    } else {
      await tx.$executeRaw`
        UPDATE course_orders SET status = 'refunded', updated_at = ${now}
        WHERE order_uuid = ${paymentUuid} LIMIT 1
      `
    }
    await tx.$executeRaw`
      DELETE FROM tochukwu_course_enrollment_claims
      WHERE source_type = ${enrollmentSourceType}
        AND source_uuid = ${paymentUuid}
    `.catch(() => 0)
    const email = clean(payment.customerEmail, 220).toLowerCase()
    const account = email ? await tx.studentAccount.findUnique({ where: { email }, select: { id: true } }) : null
    let sessionsTerminated = account ? (await tx.studentSession.deleteMany({ where: { accountId: account.id } })).count : 0

    if (familyContext) {
      const now = new Date()
      await tx.$executeRaw`
        UPDATE family_child_enrollments
        SET status = 'refunded', updated_at = ${now}
        WHERE family_id = ${familyContext.familyId}
          AND course_slug = ${familyContext.courseSlug}
          AND source_type = ${enrollmentSourceType}
          AND source_uuid = ${paymentUuid}
          AND status = 'active'
      `
      await tx.$executeRaw`
        UPDATE family_children child
        SET child.status = 'refunded', child.updated_at = ${now}
        WHERE child.family_id = ${familyContext.familyId}
          AND child.source_type = ${enrollmentSourceType}
          AND child.source_uuid = ${paymentUuid}
          AND NOT EXISTS (
            SELECT 1 FROM family_child_enrollments active_enrollment
            WHERE active_enrollment.child_id = child.id AND active_enrollment.status = 'active'
          )
      `
      if (familyContext.childIds.length) {
        const claimSourceUuids = familyContext.childIds.map((childId) => `family_child_${childId.toString()}`)
        await tx.$executeRaw(Prisma.sql`
          DELETE FROM tochukwu_course_enrollment_claims
          WHERE source_type = 'family_child'
            AND source_uuid IN (${Prisma.join(claimSourceUuids)})
        `)
      }
      await tx.$executeRaw`
        UPDATE family_seat_balances
        SET seats_purchased = GREATEST(0, seats_purchased - ${familyContext.seatQuantity}),
            seats_consumed = GREATEST(0, seats_consumed - ${familyContext.childIds.length}),
            updated_at = ${now}
        WHERE family_id = ${familyContext.familyId}
          AND course_slug = ${familyContext.courseSlug}
          AND batch_key = ${familyContext.batchKey}
        LIMIT 1
      `
      await tx.$executeRaw`
        INSERT INTO family_seat_ledger
          (family_id, course_slug, batch_key, entry_type, quantity, source_type, source_uuid,
           idempotency_key, metadata_json, created_at, updated_at)
        VALUES
          (${familyContext.familyId}, ${familyContext.courseSlug}, ${familyContext.batchKey}, 'refund',
           ${familyContext.seatQuantity}, ${enrollmentSourceType}, ${paymentUuid},
           ${`${enrollmentSourceType}:${paymentUuid}:refund`},
           ${JSON.stringify({ revoked_child_ids: familyContext.childIds.map((id) => id.toString()), refund_uuid: refundUuid })},
           ${now}, ${now})
      `
      if (familyContext.childAccountIds.length) {
        sessionsTerminated += (await tx.studentSession.deleteMany({
          where: { accountId: { in: familyContext.childAccountIds } }
        })).count
        await tx.$executeRaw(Prisma.sql`
          UPDATE tochukwu_learning_followup_campaigns
          SET status = 'stopped', stopped_reason = 'payment_refunded', locked_at = NULL, updated_at = ${now}
          WHERE account_id IN (${Prisma.join(familyContext.childAccountIds)})
            AND course_slug = ${familyContext.courseSlug}
            AND status IN ('active', 'processing')
        `).catch(() => 0)
      }
      await tx.$executeRaw`
        UPDATE tochukwu_course_lifecycle_deliveries
        SET status = 'skipped', last_error = 'Enrollment refunded', updated_at = ${now}
        WHERE course_slug = ${familyContext.courseSlug}
          AND batch_key = ${familyContext.batchKey}
          AND recipient_key = ${`family:${familyContext.familyId.toString()}`}
          AND status NOT IN ('sent', 'skipped', 'failed_permanent')
      `.catch(() => 0)
    }

    return {
      ok: true as const,
      alreadyRecorded: false,
      refundUuid,
      amountMinor,
      currency: clean(payment.currency, 12).toUpperCase() || "NGN",
      sessionsTerminated,
      familyContext
    }
  })

  if (!result.alreadyRecorded && result.familyContext) {
    const family = result.familyContext
    const brevo = await reconcileFamilyOwnerBrevoLists({
      familyId: family.familyId,
      fullName: family.parentName,
      email: family.parentEmail,
      phone: family.parentPhone,
      courseSlug: family.courseSlug,
      previousListIds: [family.brevoListId],
      source: "group_payment_refund"
    }).catch((error) => ({ ok: false, error: error instanceof Error ? error.message : String(error) }))
    return { ...result, brevo }
  }

  return result
}
