import crypto from "crypto"
import { Prisma } from "@prisma/client"

import {
  CourseEnrollmentConflictError,
  claimIndividualCourseEnrollment,
  ensureEnrollmentClaimTable
} from "@/lib/enrollment-guard"
import { reconcileFamilyOwnerBrevoLists, sendBatchSwitchConfirmationEmail } from "@/lib/enrollment-notifications"
import { prisma } from "@/lib/prisma"
import { courseUsesImmediateAccess, findOrCreateStudentAccount, normalizeEmail } from "@/lib/payments/course-checkout"
import { batchHasNotStarted } from "@/lib/utils"

const FAMILY_CODE_LENGTH = 10
const FAMILY_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const MAX_CHILDREN = 500

export type FamilyChildInput = {
  fullName: string
  age?: string
  classLevel?: string
  batchKey?: string
  batchLabel?: string
}

type FamilyAccountRow = {
  id: bigint
  family_uuid: string | null
  parent_account_id: bigint
  parent_name: string | null
  parent_email: string | null
  parent_phone: string | null
}

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function now() {
  return new Date()
}

function syntheticChildEmail() {
  return `family-child-${crypto.randomUUID().replace(/-/g, "")}@student-code.local`
}

function makeFamilyCode() {
  const bytes = crypto.randomBytes(FAMILY_CODE_LENGTH)
  let out = ""
  for (let i = 0; i < FAMILY_CODE_LENGTH; i += 1) {
    out += FAMILY_CODE_ALPHABET[bytes[i] % FAMILY_CODE_ALPHABET.length]
  }
  return out
}

async function ensureFamilyChildCodeResetTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS family_child_code_resets (
      id BIGINT NOT NULL AUTO_INCREMENT,
      family_id BIGINT NOT NULL,
      child_id BIGINT NOT NULL,
      parent_account_id BIGINT NOT NULL,
      previous_code VARCHAR(20) NULL,
      new_code VARCHAR(20) NOT NULL,
      reset_by_account_id BIGINT NOT NULL,
      created_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      KEY idx_family_code_reset_family (family_id, created_at),
      KEY idx_family_code_reset_child (child_id, created_at),
      KEY idx_family_code_reset_parent (parent_account_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

async function ensureGroupLearnerBatchChangeTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_group_learner_batch_changes (
      id BIGINT NOT NULL AUTO_INCREMENT,
      family_id BIGINT NOT NULL,
      child_id BIGINT NOT NULL,
      parent_account_id BIGINT NOT NULL,
      course_slug VARCHAR(120) NOT NULL,
      old_batch_key VARCHAR(64) NOT NULL,
      old_batch_label VARCHAR(120) NULL,
      new_batch_key VARCHAR(64) NOT NULL,
      new_batch_label VARCHAR(120) NULL,
      created_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      KEY idx_tochukwu_group_batch_change_parent (parent_account_id, created_at),
      KEY idx_tochukwu_group_batch_change_child (child_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}

export function normalizeFamilyChildren(input: unknown): FamilyChildInput[] {
  const rows = Array.isArray(input) ? input : []
  return rows
    .map((row) => {
      const child = row && typeof row === "object" ? (row as Record<string, unknown>) : {}
      return {
        fullName: clean(child.fullName || child.full_name || child.name, 180),
        age: clean(child.age, 40),
        classLevel: clean(child.classLevel || child.class_level || child.className, 80),
        batchKey: clean(child.batchKey || child.batch_key, 64),
        batchLabel: clean(child.batchLabel || child.batch_label, 120)
      }
    })
    .filter((child) => Boolean(child.fullName))
    .slice(0, MAX_CHILDREN)
}

export async function hasPurchasedFamilySeats(parentAccountId: bigint | number) {
  const accountId = BigInt(parentAccountId)
  if (accountId <= BigInt(0)) return false
  const rows = await prisma.$queryRaw<Array<{ total: bigint }>>`
    SELECT COUNT(*) AS total
    FROM family_seat_balances b
    JOIN family_accounts f ON f.id = b.family_id
    WHERE f.parent_account_id = ${accountId}
      AND b.seats_purchased > 0
  `
  return Number(rows[0]?.total || 0) > 0
}

async function familyCourseSeatRows(
  client: Prisma.TransactionClient | typeof prisma,
  familyId: bigint,
  courseSlug: string,
  batchKey?: string | null,
  lock = false
) {
  const query = Prisma.sql`
    SELECT id, seats_purchased AS seatsPurchased, seats_consumed AS seatsConsumed
    FROM family_seat_balances
    WHERE family_id = ${familyId}
      AND course_slug = ${courseSlug}
      ${batchKey !== undefined ? Prisma.sql`AND batch_key = ${clean(batchKey, 64)}` : Prisma.empty}
    ORDER BY id ASC
    ${lock ? Prisma.sql`FOR UPDATE` : Prisma.empty}
  `
  return client.$queryRaw<Array<{ id: bigint; seatsPurchased: number | bigint | null; seatsConsumed: number | bigint | null }>>(query)
}

async function consumeCourseSeatPool(
  tx: Prisma.TransactionClient,
  rows: Array<{ id: bigint; seatsPurchased: number | bigint | null; seatsConsumed: number | bigint | null }>,
  quantity: number,
  timestamp: Date
) {
  let remaining = Math.max(0, Math.round(quantity))
  for (const row of rows) {
    if (remaining <= 0) break
    const available = Math.max(0, Number(row.seatsPurchased || 0) - Number(row.seatsConsumed || 0))
    const used = Math.min(available, remaining)
    if (!used) continue
    await tx.$executeRaw`
      UPDATE family_seat_balances
      SET seats_consumed = seats_consumed + ${used}, updated_at = ${timestamp}
      WHERE id = ${row.id}
      LIMIT 1
    `
    remaining -= used
  }
  if (remaining > 0) throw new Error("The group seat balance changed before the assignment completed. Please try again.")
}

async function validatedFamilyLearnerBatches(
  client: Prisma.TransactionClient | typeof prisma,
  childrenInput: unknown,
  courseSlugInput: string,
  lock = false,
  checkCapacity = true
) {
  const courseSlug = clean(courseSlugInput, 120).toLowerCase()
  const children = normalizeFamilyChildren(childrenInput)
  if (await courseUsesImmediateAccess(courseSlug)) {
    return children.map((child) => ({ ...child, batchKey: "", batchLabel: "Immediate access" }))
  }
  const requestedKeys = Array.from(new Set(children.map((child) => clean(child.batchKey, 64)).filter(Boolean)))
  const rows = await client.$queryRaw<Array<{
    batchKey: string
    batchLabel: string
    status: string | null
    isActive: number | bigint | boolean | null
    seatLimit: number | bigint | null
    batchStartAt: Date | null
  }>>(Prisma.sql`
    SELECT batch_key AS batchKey, batch_label AS batchLabel, status, is_active AS isActive,
           seat_limit AS seatLimit, batch_start_at AS batchStartAt
    FROM course_batches
    WHERE course_slug = ${courseSlug}
      ${requestedKeys.length ? Prisma.sql`AND batch_key IN (${Prisma.join(requestedKeys)})` : Prisma.empty}
    ${lock ? Prisma.sql`FOR UPDATE` : Prisma.empty}
  `)

  if (!rows.length) {
    if (requestedKeys.length) throw new Error("The selected batch does not belong to this course.")
    return children.map((child) => ({ ...child, batchKey: "", batchLabel: "Immediate access" }))
  }
  if (!requestedKeys.length || children.some((child) => !clean(child.batchKey, 64))) {
    throw new Error("Choose a batch for every learner.")
  }

  const batches = new Map(rows.map((row) => [clean(row.batchKey, 64), row]))
  const requestedByBatch = new Map<string, number>()
  for (const child of children) {
    const batchKey = clean(child.batchKey, 64)
    const batch = batches.get(batchKey)
    if (!batch) throw new Error("The selected batch does not belong to this course.")
    const open = Boolean(Number(batch.isActive || 0)) || clean(batch.status, 40).toLowerCase() === "open"
    if (!open) throw new Error(`${batch.batchLabel || batchKey} is not open for learner assignment.`)
    if (!batchHasNotStarted(batch.batchStartAt)) {
      throw new Error(`${batch.batchLabel || batchKey} has already started and is no longer available for enrollment.`)
    }
    requestedByBatch.set(batchKey, (requestedByBatch.get(batchKey) || 0) + 1)
  }

  for (const [batchKey, requested] of requestedByBatch) {
    if (!checkCapacity) continue
    const batch = batches.get(batchKey)!
    if (batch.seatLimit === null || batch.seatLimit === undefined) continue
    const counts = await client.$queryRaw<Array<{ total: number | bigint | null }>>(Prisma.sql`
      SELECT (
        COALESCE((SELECT COUNT(*) FROM course_orders
          WHERE course_slug = ${courseSlug} AND batch_key = ${batchKey} AND status = 'paid'
            AND COALESCE(buyer_type, 'student') <> 'family'), 0)
        + COALESCE((SELECT COUNT(*) FROM course_manual_payments
          WHERE course_slug = ${courseSlug} AND batch_key = ${batchKey} AND status = 'approved'
            AND COALESCE(buyer_type, 'student') <> 'family'), 0)
        + COALESCE((SELECT COUNT(*) FROM family_child_enrollments
          WHERE course_slug = ${courseSlug} AND batch_key = ${batchKey} AND status = 'active'), 0)
        + COALESCE((SELECT SUM(GREATEST(0, seats_purchased - seats_consumed)) FROM family_seat_balances
          WHERE course_slug = ${courseSlug} AND batch_key = ${batchKey}), 0)
      ) AS total
    `)
    const remaining = Math.max(0, Number(batch.seatLimit || 0) - Number(counts[0]?.total || 0))
    if (requested > remaining) throw new Error(`Only ${remaining} learner seat${remaining === 1 ? "" : "s"} remain in ${batch.batchLabel || batchKey}.`)
  }

  return children.map((child) => {
    const batch = batches.get(clean(child.batchKey, 64))
    return { ...child, batchKey: clean(batch?.batchKey, 64), batchLabel: clean(batch?.batchLabel, 120) }
  })
}

export async function prepareFamilyLearnerAssignments(childrenInput: unknown, courseSlugInput: string) {
  return validatedFamilyLearnerBatches(prisma, childrenInput, courseSlugInput)
}

export async function assignFamilyChildCode(childId: bigint | number, client: Prisma.TransactionClient | typeof prisma = prisma) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = makeFamilyCode()
    try {
      const result = await client.$executeRaw`
        UPDATE family_children
        SET access_code = ${code}, updated_at = ${now()}
        WHERE id = ${childId}
          AND (access_code IS NULL OR access_code = '')
        LIMIT 1
      `
      if (Number(result || 0) > 0) return code
      break
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : ""
      if (message.includes("duplicate")) continue
      throw error
    }
  }

  const rows = await client.$queryRaw<{ access_code: string | null }[]>`
    SELECT access_code
    FROM family_children
    WHERE id = ${childId}
    LIMIT 1
  `
  return clean(rows[0]?.access_code, 20).toUpperCase()
}

export async function resetFamilyChildAccessCode(input: {
  parentAccountId: bigint | number
  childId: bigint | number
}) {
  const parentAccountId = BigInt(input.parentAccountId)
  const childId = BigInt(input.childId)
  if (parentAccountId <= BigInt(0) || childId <= BigInt(0)) throw new Error("Learner not found.")

  await ensureFamilyChildCodeResetTable()
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{
      id: bigint
      familyId: bigint
      accountId: bigint | null
      previousCode: string | null
    }>>`
      SELECT c.id,
             c.family_id AS familyId,
             c.account_id AS accountId,
             c.access_code AS previousCode
      FROM family_children c
      JOIN family_accounts f ON f.id = c.family_id
      WHERE c.id = ${childId}
        AND c.parent_account_id = ${parentAccountId}
        AND f.parent_account_id = ${parentAccountId}
        AND f.status = 'active'
      LIMIT 1
      FOR UPDATE
    `
    const child = rows[0]
    if (!child) throw new Error("Learner not found in this group enrollment.")

    let newCode = ""
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = makeFamilyCode()
      const collision = await tx.$queryRaw<Array<{ id: bigint }>>`
        SELECT id FROM family_children WHERE access_code = ${candidate} LIMIT 1
      `
      if (!collision.length) {
        newCode = candidate
        break
      }
    }
    if (!newCode) throw new Error("Could not generate a unique learner code. Try again.")

    await tx.$executeRaw`
      UPDATE family_children
      SET access_code = ${newCode}, updated_at = ${now()}
      WHERE id = ${childId}
        AND parent_account_id = ${parentAccountId}
      LIMIT 1
    `
    await tx.$executeRaw`
      INSERT INTO family_child_code_resets
        (family_id, child_id, parent_account_id, previous_code, new_code, reset_by_account_id, created_at)
      VALUES
        (${child.familyId}, ${childId}, ${parentAccountId}, ${clean(child.previousCode, 20) || null},
         ${newCode}, ${parentAccountId}, ${now()})
    `
    if (child.accountId) {
      await tx.studentSession.deleteMany({ where: { accountId: child.accountId } })
    }
    return { newCode }
  })
}

function familyBatchDateText(value: Date | string | null) {
  if (!value) return ""
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return ""
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(date)
}

export async function moveFamilyLearnerBatch(input: {
  parentAccountId: bigint | number
  childId: bigint | number
  targetBatchKey: string
}) {
  const parentAccountId = BigInt(input.parentAccountId)
  const childId = BigInt(input.childId)
  const targetBatchKey = clean(input.targetBatchKey, 64)
  if (parentAccountId <= BigInt(0) || childId <= BigInt(0) || !targetBatchKey) {
    throw new Error("Learner batch details are incomplete.")
  }

  await Promise.all([ensureEnrollmentClaimTable(), ensureGroupLearnerBatchChangeTable()])
  const changed = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{
      familyId: bigint
      childId: bigint
      accountId: bigint | null
      fullName: string
      accountEmail: string | null
      parentEmail: string
      parentName: string
      parentPhone: string | null
      courseSlug: string
      oldBatchKey: string
      oldBatchLabel: string | null
      oldBatchStartAt: Date | null
      oldBrevoListId: string | null
    }>>(Prisma.sql`
      SELECT f.id AS familyId, c.id AS childId, c.account_id AS accountId, c.full_name AS fullName,
             a.email AS accountEmail, f.parent_email AS parentEmail, f.parent_name AS parentName,
             f.parent_phone AS parentPhone,
             e.course_slug AS courseSlug, e.batch_key AS oldBatchKey, e.batch_label AS oldBatchLabel,
             old_batch.batch_start_at AS oldBatchStartAt, old_batch.brevo_list_id AS oldBrevoListId
      FROM family_children c
      JOIN family_accounts f ON f.id = c.family_id
      JOIN family_child_enrollments e ON e.child_id = c.id
      LEFT JOIN student_accounts a ON a.id = c.account_id
      LEFT JOIN course_batches old_batch
        ON old_batch.course_slug = e.course_slug AND old_batch.batch_key = e.batch_key
      WHERE c.id = ${childId}
        AND c.parent_account_id = ${parentAccountId}
        AND f.parent_account_id = ${parentAccountId}
        AND c.status = 'active'
        AND e.status = 'active'
      LIMIT 1
      FOR UPDATE
    `)
    const learner = rows[0]
    if (!learner) throw new Error("Learner enrollment not found.")
    if (!learner.oldBatchKey || !batchHasNotStarted(learner.oldBatchStartAt)) {
      throw new Error("This learner's current batch has already started and cannot be changed.")
    }
    if (learner.oldBatchKey === targetBatchKey) throw new Error("Choose a different batch.")

    const targets = await tx.$queryRaw<Array<{
      batchKey: string
      batchLabel: string
      batchStartAt: Date | null
      status: string
      isActive: number | bigint | boolean | null
      seatLimit: number | bigint | null
      brevoListId: string | null
    }>>(Prisma.sql`
      SELECT batch_key AS batchKey, batch_label AS batchLabel, batch_start_at AS batchStartAt,
             status, is_active AS isActive, seat_limit AS seatLimit, brevo_list_id AS brevoListId
      FROM course_batches
      WHERE course_slug = ${learner.courseSlug}
        AND batch_key = ${targetBatchKey}
      LIMIT 1
      FOR UPDATE
    `)
    const target = targets[0]
    if (!target) throw new Error("The selected batch does not belong to this learner's course.")
    const targetOpen = Boolean(Number(target.isActive || 0)) || clean(target.status, 40).toLowerCase() === "open"
    if (!targetOpen) throw new Error("The selected batch is not open.")
    if (!batchHasNotStarted(target.batchStartAt)) {
      throw new Error("The selected batch has already started.")
    }

    if (target.seatLimit !== null && target.seatLimit !== undefined) {
      const counts = await tx.$queryRaw<Array<{ total: number | bigint | null }>>(Prisma.sql`
        SELECT (
          COALESCE((SELECT COUNT(*) FROM course_orders
            WHERE course_slug = ${learner.courseSlug} AND batch_key = ${targetBatchKey} AND status = 'paid'
              AND COALESCE(buyer_type, 'student') <> 'family'), 0)
          + COALESCE((SELECT COUNT(*) FROM course_manual_payments
            WHERE course_slug = ${learner.courseSlug} AND batch_key = ${targetBatchKey} AND status = 'approved'
              AND COALESCE(buyer_type, 'student') <> 'family'), 0)
          + COALESCE((SELECT COUNT(*) FROM family_child_enrollments
            WHERE course_slug = ${learner.courseSlug} AND batch_key = ${targetBatchKey} AND status = 'active'), 0)
          + COALESCE((SELECT SUM(GREATEST(0, seats_purchased - seats_consumed)) FROM family_seat_balances
            WHERE course_slug = ${learner.courseSlug} AND batch_key = ${targetBatchKey}), 0)
        ) AS total
      `)
      if (Number(counts[0]?.total || 0) >= Number(target.seatLimit)) {
        throw new Error("The selected batch has no available learner seats.")
      }
    }

    const timestamp = now()
    await tx.$executeRaw`
      UPDATE family_child_enrollments
      SET batch_key = ${target.batchKey}, batch_label = ${target.batchLabel}, updated_at = ${timestamp}
      WHERE child_id = ${childId}
        AND family_id = ${learner.familyId}
        AND course_slug = ${learner.courseSlug}
        AND status = 'active'
      LIMIT 1
    `
    await tx.$executeRaw`
      UPDATE tochukwu_course_enrollment_claims
      SET batch_key = ${target.batchKey}, batch_label = ${target.batchLabel}, updated_at = ${timestamp}
      WHERE source_type = 'family_child'
        AND source_uuid = ${`family_child_${childId.toString()}`}
      LIMIT 1
    `
    await tx.$executeRaw`
      INSERT INTO tochukwu_group_learner_batch_changes
        (family_id, child_id, parent_account_id, course_slug, old_batch_key, old_batch_label,
         new_batch_key, new_batch_label, created_at)
      VALUES
        (${learner.familyId}, ${childId}, ${parentAccountId}, ${learner.courseSlug}, ${learner.oldBatchKey},
         ${learner.oldBatchLabel || null}, ${target.batchKey}, ${target.batchLabel || null}, ${timestamp})
    `
    return { learner, target }
  })

  const notificationEmail = normalizeEmail(changed.learner.parentEmail)
  const brevo = await reconcileFamilyOwnerBrevoLists({
    familyId: changed.learner.familyId,
    fullName: changed.learner.parentName,
    email: notificationEmail,
    phone: changed.learner.parentPhone,
    courseSlug: changed.learner.courseSlug,
    previousListIds: [changed.learner.oldBrevoListId],
    source: "group_learner_batch_switch"
  }).catch((error) => ({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  if (!brevo.ok) {
    console.warn("group_learner_batch_switch_brevo_failed", {
      familyId: changed.learner.familyId.toString(),
      courseSlug: changed.learner.courseSlug,
      error: brevo.error || "Brevo reconciliation failed"
    })
  }
  await sendBatchSwitchConfirmationEmail({
    email: notificationEmail,
    fullName: changed.learner.parentName,
    courseName: changed.learner.courseSlug,
    oldBatchLabel: changed.learner.oldBatchLabel || changed.learner.oldBatchKey,
    oldBatchStartText: familyBatchDateText(changed.learner.oldBatchStartAt),
    newBatchLabel: changed.target.batchLabel,
    newBatchStartText: familyBatchDateText(changed.target.batchStartAt)
  }).catch(() => null)

  return {
    childId: Number(childId),
    courseSlug: changed.learner.courseSlug,
    batchKey: changed.target.batchKey,
    batchLabel: changed.target.batchLabel,
    brevo
  }
}

export async function upsertFamilyAccount(input: {
  parentAccountId: bigint | number
  parentName: string
  parentEmail: string
  parentPhone?: string | null
}) {
  const parentAccountId = BigInt(input.parentAccountId)
  const parentName = clean(input.parentName, 180)
  const parentEmail = normalizeEmail(input.parentEmail)
  const parentPhone = clean(input.parentPhone, 80)
  if (!parentName || !parentEmail) throw new Error("Enrollment account details are required.")

  await prisma.$executeRaw`
    INSERT INTO family_accounts
      (family_uuid, parent_account_id, parent_name, parent_email, parent_phone, status, created_at, updated_at)
    VALUES
      (${`fam_${crypto.randomUUID().replace(/-/g, "")}`}, ${parentAccountId}, ${parentName}, ${parentEmail}, ${parentPhone || null}, 'active', ${now()}, ${now()})
    ON DUPLICATE KEY UPDATE
      parent_name = VALUES(parent_name),
      parent_email = VALUES(parent_email),
      parent_phone = COALESCE(VALUES(parent_phone), parent_phone),
      status = 'active',
      updated_at = VALUES(updated_at)
  `

  const rows = await prisma.$queryRaw<FamilyAccountRow[]>`
    SELECT id, family_uuid, parent_account_id, parent_name, parent_email, parent_phone
    FROM family_accounts
    WHERE parent_account_id = ${parentAccountId}
    LIMIT 1
  `
  return rows[0] || null
}

export async function savePendingFamilyChildren(input: {
  sourceType: string
  sourceUuid: string
  courseSlug: string
  batchKey?: string | null
  batchLabel?: string | null
  children: FamilyChildInput[]
}) {
  const sourceType = clean(input.sourceType, 40)
  const sourceUuid = clean(input.sourceUuid, 64)
  const courseSlug = clean(input.courseSlug, 120).toLowerCase()
  const children = normalizeFamilyChildren(input.children)
  if (!sourceType || !sourceUuid || !courseSlug || !children.length) return []

  const timestamp = now()
  const created: Array<FamilyChildInput & { childId: bigint }> = []
  for (const child of children) {
    const childUuid = `fch_${crypto.randomUUID().replace(/-/g, "")}`
    await prisma.$executeRaw`
      INSERT INTO family_children
        (child_uuid, full_name, age, class_level, email, status, source_type, source_uuid, created_at, updated_at)
      VALUES
        (${childUuid}, ${child.fullName}, ${child.age || null}, ${child.classLevel || null}, NULL,
         'pending_payment', ${sourceType}, ${sourceUuid}, ${timestamp}, ${timestamp})
    `
    const rows = await prisma.$queryRaw<{ id: bigint }[]>`
      SELECT id
      FROM family_children
      WHERE child_uuid = ${childUuid}
      LIMIT 1
    `
    const childId = rows[0]?.id
    if (!childId) continue
    await prisma.$executeRaw`
      INSERT INTO family_child_enrollments
        (child_id, course_slug, batch_key, batch_label, source_type, source_uuid, status, created_at, updated_at)
      VALUES
        (${childId}, ${courseSlug}, ${input.batchKey || child.batchKey || null}, ${input.batchLabel || child.batchLabel || null}, ${sourceType}, ${sourceUuid},
         'pending_payment', ${timestamp}, ${timestamp})
    `
    created.push({ ...child, childId })
  }
  return created
}

export async function creditFamilySeats(input: {
  sourceType: string
  sourceUuid: string
  parentAccountId: bigint | number
  parentName: string
  parentEmail: string
  parentPhone?: string | null
  courseSlug: string
  batchKey?: string | null
  batchLabel?: string | null
  quantity: number
}) {
  const sourceType = clean(input.sourceType, 40)
  const sourceUuid = clean(input.sourceUuid, 64)
  const courseSlug = clean(input.courseSlug, 120).toLowerCase()
  const batchKey = clean(input.batchKey, 64)
  const batchLabel = clean(input.batchLabel, 120)
  const quantity = Math.max(0, Math.round(Number(input.quantity || 0)))
  if (!sourceType || !sourceUuid || !courseSlug || quantity <= 0) {
    return { ok: false as const, error: "Seat credit details are incomplete." }
  }

  const family = await upsertFamilyAccount(input)
  if (!family?.id) return { ok: false as const, error: "Could not create enrollment account." }

  return prisma.$transaction(async (tx) => {
    const idempotencyKey = `${sourceType}:${sourceUuid}:purchase`
    const existing = await tx.$queryRaw<{ id: bigint }[]>`
      SELECT id
      FROM family_seat_ledger
      WHERE idempotency_key = ${idempotencyKey}
      LIMIT 1
      FOR UPDATE
    `
    if (existing.length) return { ok: true as const, familyId: Number(family.id), credited: 0, duplicate: true }

    const timestamp = now()
    const balances = await tx.$queryRaw<{ id: bigint; seats_purchased: number | bigint | null }[]>`
      SELECT id, seats_purchased
      FROM family_seat_balances
      WHERE family_id = ${family.id}
        AND course_slug = ${courseSlug}
        AND batch_key = ${batchKey}
      LIMIT 1
      FOR UPDATE
    `

    if (balances[0]) {
      await tx.$executeRaw`
        UPDATE family_seat_balances
        SET seats_purchased = ${Number(balances[0].seats_purchased || 0) + quantity},
            batch_label = COALESCE(${batchLabel || null}, batch_label),
            updated_at = ${timestamp}
        WHERE id = ${balances[0].id}
        LIMIT 1
      `
    } else {
      await tx.$executeRaw`
        INSERT INTO family_seat_balances
          (family_id, course_slug, batch_key, batch_label, seats_purchased, seats_consumed, created_at, updated_at)
        VALUES
          (${family.id}, ${courseSlug}, ${batchKey}, ${batchLabel || null}, ${quantity}, 0, ${timestamp}, ${timestamp})
      `
    }

    await tx.$executeRaw`
      INSERT INTO family_seat_ledger
        (family_id, course_slug, batch_key, entry_type, quantity, source_type, source_uuid, idempotency_key, metadata_json, created_at, updated_at)
      VALUES
        (${family.id}, ${courseSlug}, ${batchKey}, 'purchase', ${quantity}, ${sourceType}, ${sourceUuid}, ${idempotencyKey},
         ${JSON.stringify({ batch_label: batchLabel || null })}, ${timestamp}, ${timestamp})
    `
    return { ok: true as const, familyId: Number(family.id), credited: quantity }
  })
}

export async function consumeFamilySeatsForChildren(input: {
  parentAccountId: bigint | number
  parentName: string
  parentEmail: string
  parentPhone?: string | null
  courseSlug: string
  batchKey?: string | null
  batchLabel?: string | null
  children: FamilyChildInput[]
}) {
  const children = normalizeFamilyChildren(input.children)
  const courseSlug = clean(input.courseSlug, 120).toLowerCase()
  const batchKey = clean(input.batchKey, 64)
  if (!courseSlug || !children.length) throw new Error("Learner enrollment details are required.")

  const family = await upsertFamilyAccount(input)
  if (!family?.id) throw new Error("Enrollment account is required.")

  await ensureEnrollmentClaimTable()
  const consumed = await prisma.$transaction(async (tx) => {
    const balances = await familyCourseSeatRows(tx, family.id, courseSlug, batchKey, true)
    const seatsPurchased = balances.reduce((total, row) => total + Number(row.seatsPurchased || 0), 0)
    const seatsConsumed = balances.reduce((total, row) => total + Number(row.seatsConsumed || 0), 0)
    const available = Math.max(0, seatsPurchased - seatsConsumed)
    if (!balances.length || children.length > available) {
      throw new Error(`Only ${available} purchased seat${available === 1 ? "" : "s"} available for this programme.`)
    }

    const assignedChildren = await validatedFamilyLearnerBatches(
      tx,
      children.map((child) => ({ ...child, batchKey })),
      courseSlug,
      true,
      false
    )

    const timestamp = now()
    const created: Array<{ childId: bigint; fullName: string }> = []
    for (const child of assignedChildren) {
      const account = await findOrCreateStudentAccount({
        fullName: child.fullName,
        email: syntheticChildEmail()
      })
      const sourceUuid = `seat_${crypto.randomUUID().replace(/-/g, "")}`
      const childUuid = `fch_${crypto.randomUUID().replace(/-/g, "")}`
      await tx.$executeRaw`
        INSERT INTO family_children
          (child_uuid, family_id, parent_account_id, account_id, full_name, age, class_level, email, status, source_type, source_uuid, created_at, updated_at)
        VALUES
          (${childUuid}, ${family.id}, ${BigInt(input.parentAccountId)}, ${account.id}, ${child.fullName}, ${child.age || null},
           ${child.classLevel || null}, NULL, 'active', 'family_seat', ${sourceUuid}, ${timestamp}, ${timestamp})
      `
      const childRows = await tx.$queryRaw<{ id: bigint }[]>`
        SELECT id
        FROM family_children
        WHERE child_uuid = ${childUuid}
        LIMIT 1
      `
      const childId = childRows[0]?.id
      if (!childId) continue
      await claimIndividualCourseEnrollment(tx, {
        email: account.email,
        courseSlug,
          sourceType: "family_child",
          sourceUuid: `family_child_${childId.toString()}`,
          batchKey: child.batchKey,
          batchLabel: child.batchLabel
      })
      created.push({ childId, fullName: child.fullName })
      await tx.$executeRaw`
        INSERT INTO family_child_enrollments
          (child_id, family_id, account_id, course_slug, batch_key, batch_label, source_type, source_uuid, status, paid_at, created_at, updated_at)
        VALUES
          (${childId}, ${family.id}, ${account.id}, ${courseSlug}, ${child.batchKey || null}, ${child.batchLabel || null},
           'family_seat', ${`family_seat_${childId.toString()}`}, 'active', ${timestamp}, ${timestamp}, ${timestamp})
      `
    }

    for (const child of created) {
      await assignFamilyChildCode(child.childId, tx)
    }

    await consumeCourseSeatPool(tx, balances, created.length, timestamp)
    const ledgerUuid = `consume_${crypto.randomUUID().replace(/-/g, "")}`
    await tx.$executeRaw`
      INSERT INTO family_seat_ledger
        (family_id, course_slug, batch_key, entry_type, quantity, source_type, source_uuid, idempotency_key, metadata_json, created_at, updated_at)
      VALUES
        (${family.id}, ${courseSlug}, ${batchKey}, 'consume', ${created.length}, 'family_dashboard', ${ledgerUuid}, ${ledgerUuid},
         ${JSON.stringify({ children: created.map((child) => child.childId.toString()), assignments: assignedChildren.map((child) => ({ batch_key: child.batchKey })) })}, ${timestamp}, ${timestamp})
    `

    return {
      ok: true as const,
      familyId: Number(family.id),
      created: created.length,
      seatsPurchased,
      seatsUsed: seatsConsumed + created.length
    }
  })

  const brevo = await reconcileFamilyOwnerBrevoLists({
    familyId: family.id,
    fullName: input.parentName,
    email: input.parentEmail,
    phone: input.parentPhone,
    courseSlug,
    source: "group_learner_assignment"
  }).catch((error) => ({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  if (!brevo.ok) {
    console.warn("group_learner_assignment_brevo_failed", {
      familyId: family.id.toString(),
      courseSlug,
      error: brevo.error || "Brevo reconciliation failed"
    })
  }
  return consumed
}

export async function provisionFamilyOrder(input: {
  sourceType: string
  sourceUuid: string
  parentAccountId: bigint | number
  parentName: string
  parentEmail: string
  parentPhone?: string | null
  courseSlug: string
  batchKey?: string | null
  batchLabel?: string | null
  quantity: number
}) {
  await ensureEnrollmentClaimTable()
  const credited = await creditFamilySeats(input)
  if (!credited.ok) return credited

  const family = await upsertFamilyAccount(input)
  if (!family?.id) return { ok: false as const, error: "Could not create enrollment account." }

  const children = await prisma.$queryRaw<
    Array<{
      id: bigint
      full_name: string | null
      email: string | null
      account_id: bigint | null
      enrollment_id: bigint
      enrollment_status: string | null
      course_slug: string
      batch_key: string | null
      batch_label: string | null
    }>
  >`
    SELECT c.id, c.full_name, c.email, c.account_id, e.id AS enrollment_id, e.status AS enrollment_status,
           e.course_slug, e.batch_key, e.batch_label
    FROM family_children c
    JOIN family_child_enrollments e ON e.child_id = c.id
    WHERE c.source_type = ${input.sourceType}
      AND c.source_uuid = ${input.sourceUuid}
      AND e.source_type = ${input.sourceType}
      AND e.source_uuid = ${input.sourceUuid}
    ORDER BY c.id ASC
  `

  let provisioned = 0
  let duplicateLearners = 0
  const timestamp = now()
  const preparedAssignments = children.length
    ? await validatedFamilyLearnerBatches(
        prisma,
        children.map((child) => ({
          fullName: clean(child.full_name, 180) || "Student",
          email: normalizeEmail(child.email),
          batchKey: clean(input.batchKey, 64),
          batchLabel: clean(input.batchLabel, 120)
        })),
        clean(input.courseSlug, 120).toLowerCase(),
        false,
        false
      )
    : []
  for (const [childIndex, child] of children.entries()) {
    const wasActive = clean(child.enrollment_status, 40).toLowerCase() === "active"
    if (wasActive) continue
    const account = child.account_id
      ? null
      : await findOrCreateStudentAccount({
          fullName: clean(child.full_name, 180) || "Student",
          email: normalizeEmail(child.email) || syntheticChildEmail()
        })
    const accountId = child.account_id || account?.id || null
    if (!accountId) continue
    const assignment = preparedAssignments[childIndex]
    if (!assignment) continue
    try {
      await prisma.$transaction(async (tx) => {
        const lockedAssignments = await validatedFamilyLearnerBatches(
          tx,
          [assignment],
          clean(input.courseSlug, 120).toLowerCase(),
          true,
          false
        )
        const lockedAssignment = lockedAssignments[0]
        if (!lockedAssignment) throw new Error("The learner batch assignment could not be confirmed.")
        await claimIndividualCourseEnrollment(tx, {
          email: account?.email || normalizeEmail(child.email),
          courseSlug: clean(input.courseSlug, 120).toLowerCase(),
          sourceType: "family_child",
          sourceUuid: `family_child_${child.id.toString()}`,
          batchKey: lockedAssignment.batchKey,
          batchLabel: lockedAssignment.batchLabel
        })
        await assignFamilyChildCode(child.id, tx)
        await tx.$executeRaw`
          UPDATE family_children
          SET family_id = ${family.id},
              parent_account_id = ${BigInt(input.parentAccountId)},
              account_id = ${accountId},
              status = 'active',
              updated_at = ${timestamp}
          WHERE id = ${child.id}
        `
        await tx.$executeRaw`
          UPDATE family_child_enrollments
          SET family_id = ${family.id},
              account_id = ${accountId},
              batch_key = ${lockedAssignment.batchKey || null},
              batch_label = ${lockedAssignment.batchLabel || null},
              status = 'active',
              paid_at = COALESCE(paid_at, ${timestamp}),
              updated_at = ${timestamp}
          WHERE id = ${child.enrollment_id}
        `
      })
      provisioned += 1
    } catch (error) {
      if (!(error instanceof CourseEnrollmentConflictError)) throw error
      duplicateLearners += 1
      await prisma.$executeRaw`
        UPDATE family_children
        SET family_id = ${family.id}, parent_account_id = ${BigInt(input.parentAccountId)},
            account_id = ${accountId}, status = 'duplicate_blocked', updated_at = ${timestamp}
        WHERE id = ${child.id}
      `
      await prisma.$executeRaw`
        UPDATE family_child_enrollments
        SET family_id = ${family.id}, account_id = ${accountId}, status = 'duplicate_blocked', updated_at = ${timestamp}
        WHERE id = ${child.enrollment_id}
      `
    }
  }

  if (provisioned > 0) {
    await prisma.$transaction(async (tx) => {
      const balanceRows = await familyCourseSeatRows(
        tx,
        family.id,
        clean(input.courseSlug, 120).toLowerCase(),
        clean(input.batchKey, 64),
        true
      )
      await consumeCourseSeatPool(tx, balanceRows, provisioned, timestamp)
    })
    await prisma.$executeRaw`
      INSERT INTO family_seat_ledger
        (family_id, course_slug, batch_key, entry_type, quantity, source_type, source_uuid, idempotency_key, metadata_json, created_at, updated_at)
      VALUES
        (${family.id}, ${clean(input.courseSlug, 120).toLowerCase()}, ${clean(input.batchKey, 64)}, 'consume', ${provisioned},
         ${input.sourceType}, ${input.sourceUuid}, ${`${input.sourceType}:${input.sourceUuid}:consume`},
         ${JSON.stringify({ provisioned_from_pending_children: true, assignments: preparedAssignments.map((child) => ({ batch_key: child.batchKey })) })}, ${timestamp}, ${timestamp})
      ON DUPLICATE KEY UPDATE id = id
    `
  }

  const brevo = await reconcileFamilyOwnerBrevoLists({
    familyId: family.id,
    fullName: input.parentName,
    email: input.parentEmail,
    phone: input.parentPhone,
    courseSlug: clean(input.courseSlug, 120).toLowerCase(),
    source: "group_enrollment_provisioned"
  }).catch((error) => ({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  if (!brevo.ok) {
    console.warn("group_enrollment_brevo_failed", {
      familyId: family.id.toString(),
      courseSlug: clean(input.courseSlug, 120).toLowerCase(),
      error: brevo.error || "Brevo reconciliation failed"
    })
  }

  return { ok: true as const, familyId: Number(family.id), credited: credited.credited, provisioned, duplicateLearners }
}
