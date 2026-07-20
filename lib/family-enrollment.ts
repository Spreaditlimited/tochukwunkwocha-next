import crypto from "crypto"
import type { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { findOrCreateStudentAccount, normalizeEmail } from "@/lib/payments/course-checkout"

const FAMILY_CODE_LENGTH = 10
const FAMILY_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const MAX_CHILDREN = 500

export type FamilyChildInput = {
  fullName: string
  age?: string
  classLevel?: string
  email?: string
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

export function normalizeFamilyChildren(input: unknown): FamilyChildInput[] {
  const rows = Array.isArray(input) ? input : []
  return rows
    .map((row) => {
      const child = row && typeof row === "object" ? (row as Record<string, unknown>) : {}
      return {
        fullName: clean(child.fullName || child.full_name || child.name, 180),
        age: clean(child.age, 40),
        classLevel: clean(child.classLevel || child.class_level || child.className, 80),
        email: normalizeEmail(child.email)
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

async function assignFamilyChildCode(childId: bigint | number, client: Prisma.TransactionClient | typeof prisma = prisma) {
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
        (${childUuid}, ${child.fullName}, ${child.age || null}, ${child.classLevel || null}, ${child.email || null},
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
        (${childId}, ${courseSlug}, ${input.batchKey || null}, ${input.batchLabel || null}, ${sourceType}, ${sourceUuid},
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
  const batchLabel = clean(input.batchLabel, 120)
  if (!courseSlug || !children.length) throw new Error("Learner enrollment details are required.")

  const family = await upsertFamilyAccount(input)
  if (!family?.id) throw new Error("Enrollment account is required.")

  return prisma.$transaction(async (tx) => {
    const balances = await tx.$queryRaw<{ id: bigint; seats_purchased: number | bigint | null; seats_consumed: number | bigint | null }[]>`
      SELECT id, seats_purchased, seats_consumed
      FROM family_seat_balances
      WHERE family_id = ${family.id}
        AND course_slug = ${courseSlug}
        AND batch_key = ${batchKey}
      LIMIT 1
      FOR UPDATE
    `
    const balance = balances[0]
    const available = balance ? Math.max(0, Number(balance.seats_purchased || 0) - Number(balance.seats_consumed || 0)) : 0
    if (!balance || children.length > available) {
      throw new Error(`Only ${available} purchased seat${available === 1 ? "" : "s"} available for this programme.`)
    }

    const timestamp = now()
    const created: Array<{ childId: bigint; fullName: string }> = []
    for (const child of children) {
      const account = await findOrCreateStudentAccount({
        fullName: child.fullName,
        email: child.email || syntheticChildEmail()
      })
      const sourceUuid = `seat_${crypto.randomUUID().replace(/-/g, "")}`
      const childUuid = `fch_${crypto.randomUUID().replace(/-/g, "")}`
      await tx.$executeRaw`
        INSERT INTO family_children
          (child_uuid, family_id, parent_account_id, account_id, full_name, age, class_level, email, status, source_type, source_uuid, created_at, updated_at)
        VALUES
          (${childUuid}, ${family.id}, ${BigInt(input.parentAccountId)}, ${account.id}, ${child.fullName}, ${child.age || null},
           ${child.classLevel || null}, ${child.email || null}, 'active', 'family_seat', ${sourceUuid}, ${timestamp}, ${timestamp})
      `
      const childRows = await tx.$queryRaw<{ id: bigint }[]>`
        SELECT id
        FROM family_children
        WHERE child_uuid = ${childUuid}
        LIMIT 1
      `
      const childId = childRows[0]?.id
      if (!childId) continue
      created.push({ childId, fullName: child.fullName })
      await tx.$executeRaw`
        INSERT INTO family_child_enrollments
          (child_id, family_id, account_id, course_slug, batch_key, batch_label, source_type, source_uuid, status, paid_at, created_at, updated_at)
        VALUES
          (${childId}, ${family.id}, ${account.id}, ${courseSlug}, ${batchKey || null}, ${batchLabel || null},
           'family_seat', ${`family_seat_${childId.toString()}`}, 'active', ${timestamp}, ${timestamp}, ${timestamp})
      `
    }

    for (const child of created) {
      await assignFamilyChildCode(child.childId, tx)
    }

    await tx.$executeRaw`
      UPDATE family_seat_balances
      SET seats_consumed = ${Number(balance.seats_consumed || 0) + created.length}, updated_at = ${timestamp}
      WHERE id = ${balance.id}
      LIMIT 1
    `
    const ledgerUuid = `consume_${crypto.randomUUID().replace(/-/g, "")}`
    await tx.$executeRaw`
      INSERT INTO family_seat_ledger
        (family_id, course_slug, batch_key, entry_type, quantity, source_type, source_uuid, idempotency_key, metadata_json, created_at, updated_at)
      VALUES
        (${family.id}, ${courseSlug}, ${batchKey}, 'consume', ${created.length}, 'family_dashboard', ${ledgerUuid}, ${ledgerUuid},
         ${JSON.stringify({ children: created.map((child) => child.childId.toString()) })}, ${timestamp}, ${timestamp})
    `

    return {
      ok: true as const,
      familyId: Number(family.id),
      created: created.length,
      seatsPurchased: Number(balance.seats_purchased || 0),
      seatsUsed: Number(balance.seats_consumed || 0) + created.length
    }
  })
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
    }>
  >`
    SELECT c.id, c.full_name, c.email, c.account_id, e.id AS enrollment_id, e.status AS enrollment_status
    FROM family_children c
    JOIN family_child_enrollments e ON e.child_id = c.id
    WHERE c.source_type = ${input.sourceType}
      AND c.source_uuid = ${input.sourceUuid}
      AND e.source_type = ${input.sourceType}
      AND e.source_uuid = ${input.sourceUuid}
    ORDER BY c.id ASC
  `

  let provisioned = 0
  const timestamp = now()
  for (const child of children) {
    const wasActive = clean(child.enrollment_status, 40).toLowerCase() === "active"
    const account = child.account_id
      ? null
      : await findOrCreateStudentAccount({
          fullName: clean(child.full_name, 180) || "Student",
          email: normalizeEmail(child.email) || syntheticChildEmail()
        })
    const accountId = child.account_id || account?.id || null
    await assignFamilyChildCode(child.id)
    await prisma.$executeRaw`
      UPDATE family_children
      SET family_id = ${family.id},
          parent_account_id = ${BigInt(input.parentAccountId)},
          account_id = ${accountId},
          status = 'active',
          updated_at = ${timestamp}
      WHERE id = ${child.id}
    `
    await prisma.$executeRaw`
      UPDATE family_child_enrollments
      SET family_id = ${family.id},
          account_id = ${accountId},
          status = 'active',
          paid_at = COALESCE(paid_at, ${timestamp}),
          updated_at = ${timestamp}
      WHERE id = ${child.enrollment_id}
    `
    if (!wasActive) provisioned += 1
  }

  if (provisioned > 0) {
    await prisma.$executeRaw`
      UPDATE family_seat_balances
      SET seats_consumed = LEAST(seats_purchased, seats_consumed + ${provisioned}),
          batch_label = COALESCE(${clean(input.batchLabel, 120) || null}, batch_label),
          updated_at = ${timestamp}
      WHERE family_id = ${family.id}
        AND course_slug = ${clean(input.courseSlug, 120).toLowerCase()}
        AND batch_key = ${clean(input.batchKey, 64)}
      LIMIT 1
    `
    await prisma.$executeRaw`
      INSERT INTO family_seat_ledger
        (family_id, course_slug, batch_key, entry_type, quantity, source_type, source_uuid, idempotency_key, metadata_json, created_at, updated_at)
      VALUES
        (${family.id}, ${clean(input.courseSlug, 120).toLowerCase()}, ${clean(input.batchKey, 64)}, 'consume', ${provisioned},
         ${input.sourceType}, ${input.sourceUuid}, ${`${input.sourceType}:${input.sourceUuid}:consume`},
         ${JSON.stringify({ provisioned_from_pending_children: true })}, ${timestamp}, ${timestamp})
      ON DUPLICATE KEY UPDATE id = id
    `
  }

  return { ok: true as const, familyId: Number(family.id), credited: credited.credited, provisioned }
}
