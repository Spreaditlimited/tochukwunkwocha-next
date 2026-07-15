import { Prisma } from "@prisma/client"

import { moveEnrollmentBrevoList, sendBatchSwitchConfirmationEmail } from "@/lib/enrollment-notifications"
import { prisma } from "@/lib/prisma"
import { watWallDateTimeMs } from "@/lib/utils"

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function courseName(slug: string) {
  const names: Record<string, string> = {
    "prompt-to-profit": "Prompt to Profit",
    "prompt-to-production": "Prompt to Profit Advanced",
    "prompt-to-profit-holiday": "Prompt to Profit Holiday",
    "ai-for-everyday-business-owners": "AI for Everyday Business Owners"
  }
  return names[slug] || slug
}

function normalizeSlug(value: unknown) {
  return clean(value, 120).toLowerCase()
}

function normalizeBatchKey(value: unknown) {
  return clean(value, 64)
}

function displayBatchDate(value: Date | string | null) {
  if (!value) return ""
  const raw = value instanceof Date
    ? [
        value.getUTCFullYear(),
        String(value.getUTCMonth() + 1).padStart(2, "0"),
        String(value.getUTCDate()).padStart(2, "0")
      ].join("-") + `T${String(value.getUTCHours()).padStart(2, "0")}:${String(value.getUTCMinutes()).padStart(2, "0")}:00`
    : clean(value, 80)
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/)
  const date = match
    ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5])))
    : new Date(raw)
  if (!Number.isFinite(date.getTime())) return clean(value, 40)
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: match ? "UTC" : "Africa/Lagos",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(date)
}

function isFuture(value: Date | string | null) {
  const ms = watWallDateTimeMs(value)
  return Number.isFinite(ms) && ms > Date.now()
}

type SwitchItem = {
  sourceType: "order" | "manual_payment" | "family"
  id?: bigint
  uuid?: string
  familyId?: bigint
  courseSlug: string
  courseName: string
  batchKey: string
  batchLabel: string
  batchStartAt: Date | null
  brevoListId: string
  seatCount: number
  seatsUsed?: number
  displayName: string
  email: string
  phone: string
}

function sourceIdFor(item: SwitchItem) {
  if (item.sourceType === "family") return `${String(item.familyId || "")}:${item.batchKey}`
  return clean(item.id || item.uuid, 120)
}

async function ensureAuditTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS student_batch_changes (
      id BIGINT NOT NULL AUTO_INCREMENT,
      account_id BIGINT NULL,
      email VARCHAR(220) NOT NULL,
      course_slug VARCHAR(120) NOT NULL,
      source_type VARCHAR(40) NOT NULL,
      source_id VARCHAR(120) NOT NULL,
      old_batch_key VARCHAR(64) NULL,
      old_batch_label VARCHAR(120) NULL,
      old_batch_start_at DATETIME NULL,
      new_batch_key VARCHAR(64) NOT NULL,
      new_batch_label VARCHAR(120) NOT NULL,
      new_batch_start_at DATETIME NULL,
      seat_count INT NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      KEY idx_student_batch_changes_email (email, course_slug, created_at),
      KEY idx_student_batch_changes_account (account_id, course_slug, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

async function countEnrolledSeats(courseSlug: string, batchKey: string) {
  const rows = await prisma.$queryRaw<Array<{ total: bigint | number | null }>>(Prisma.sql`
    SELECT (
      COALESCE((
        SELECT SUM(CASE WHEN seat_count IS NULL OR seat_count < 1 THEN 1 ELSE seat_count END)
        FROM course_orders
        WHERE course_slug COLLATE utf8mb4_unicode_ci = ${courseSlug} COLLATE utf8mb4_unicode_ci
          AND batch_key COLLATE utf8mb4_unicode_ci = ${batchKey} COLLATE utf8mb4_unicode_ci
          AND status = 'paid'
      ), 0)
      +
      COALESCE((
        SELECT SUM(CASE WHEN seat_count IS NULL OR seat_count < 1 THEN 1 ELSE seat_count END)
        FROM course_manual_payments
        WHERE course_slug COLLATE utf8mb4_unicode_ci = ${courseSlug} COLLATE utf8mb4_unicode_ci
          AND batch_key COLLATE utf8mb4_unicode_ci = ${batchKey} COLLATE utf8mb4_unicode_ci
          AND status = 'approved'
      ), 0)
    ) AS total
  `)
  return Number(rows[0]?.total || 0)
}

async function loadSwitchableEnrollments(account: { id: bigint; email: string; fullName: string }): Promise<SwitchItem[]> {
  const email = clean(account.email, 220).toLowerCase()
  const orders = await prisma.$queryRaw<Array<{
    id: bigint
    orderUuid: string | null
    courseSlug: string
    batchKey: string
    batchLabel: string | null
    firstName: string | null
    email: string
    phone: string | null
    seatCount: bigint | number | null
    brevoListId: string | null
    batchStartAt: Date | null
  }>>(Prisma.sql`
    SELECT o.id, o.order_uuid AS orderUuid, o.course_slug AS courseSlug, o.batch_key AS batchKey,
           o.batch_label AS batchLabel, o.first_name AS firstName, o.email, o.phone,
           COALESCE(o.seat_count, 1) AS seatCount, b.brevo_list_id AS brevoListId, b.batch_start_at AS batchStartAt
    FROM course_orders o
    LEFT JOIN course_batches b
      ON b.course_slug COLLATE utf8mb4_unicode_ci = o.course_slug COLLATE utf8mb4_unicode_ci
     AND b.batch_key COLLATE utf8mb4_unicode_ci = o.batch_key COLLATE utf8mb4_unicode_ci
    WHERE LOWER(o.email) COLLATE utf8mb4_unicode_ci = ${email} COLLATE utf8mb4_unicode_ci
      AND o.status = 'paid'
      AND COALESCE(o.buyer_type, 'student') <> 'family'
      AND COALESCE(TRIM(o.batch_key), '') <> ''
  `)
  const manuals = await prisma.$queryRaw<Array<{
    id: bigint
    paymentUuid: string | null
    courseSlug: string
    batchKey: string
    batchLabel: string | null
    firstName: string | null
    email: string
    phone: string | null
    seatCount: bigint | number | null
    brevoListId: string | null
    batchStartAt: Date | null
  }>>(Prisma.sql`
    SELECT m.id, m.payment_uuid AS paymentUuid, m.course_slug AS courseSlug, m.batch_key AS batchKey,
           m.batch_label AS batchLabel, m.first_name AS firstName, m.email, m.phone,
           COALESCE(m.seat_count, 1) AS seatCount, b.brevo_list_id AS brevoListId, b.batch_start_at AS batchStartAt
    FROM course_manual_payments m
    LEFT JOIN course_batches b
      ON b.course_slug COLLATE utf8mb4_unicode_ci = m.course_slug COLLATE utf8mb4_unicode_ci
     AND b.batch_key COLLATE utf8mb4_unicode_ci = m.batch_key COLLATE utf8mb4_unicode_ci
    WHERE LOWER(m.email) COLLATE utf8mb4_unicode_ci = ${email} COLLATE utf8mb4_unicode_ci
      AND m.status = 'approved'
      AND COALESCE(m.buyer_type, 'student') <> 'family'
      AND COALESCE(TRIM(m.batch_key), '') <> ''
  `)
  const families = await prisma.$queryRaw<Array<{
    familyId: bigint
    courseSlug: string
    batchKey: string
    batchLabel: string | null
    seatsPurchased: bigint | number
    seatsConsumed: bigint | number
    brevoListId: string | null
    batchStartAt: Date | null
    parentName: string | null
    parentEmail: string | null
    parentPhone: string | null
  }>>(Prisma.sql`
    SELECT f.id AS familyId, s.course_slug AS courseSlug, s.batch_key AS batchKey, s.batch_label AS batchLabel,
           s.seats_purchased AS seatsPurchased, s.seats_consumed AS seatsConsumed,
           b.brevo_list_id AS brevoListId, b.batch_start_at AS batchStartAt,
           f.parent_name AS parentName, f.parent_email AS parentEmail, f.parent_phone AS parentPhone
    FROM family_accounts f
    JOIN family_seat_balances s ON s.family_id = f.id
    LEFT JOIN course_batches b
      ON b.course_slug COLLATE utf8mb4_unicode_ci = s.course_slug COLLATE utf8mb4_unicode_ci
     AND b.batch_key COLLATE utf8mb4_unicode_ci = s.batch_key COLLATE utf8mb4_unicode_ci
    WHERE f.parent_account_id = ${account.id}
      AND f.status = 'active'
      AND COALESCE(TRIM(s.batch_key), '') <> ''
      AND COALESCE(s.seats_purchased, 0) > 0
  `).catch(() => [])

  return [
    ...orders.map((row): SwitchItem => ({
      sourceType: "order",
      id: row.id,
      uuid: row.orderUuid || "",
      courseSlug: normalizeSlug(row.courseSlug),
      courseName: courseName(normalizeSlug(row.courseSlug)),
      batchKey: normalizeBatchKey(row.batchKey),
      batchLabel: clean(row.batchLabel || row.batchKey, 120),
      batchStartAt: row.batchStartAt,
      brevoListId: clean(row.brevoListId, 64),
      seatCount: Math.max(1, Number(row.seatCount || 1)),
      displayName: clean(row.firstName || account.fullName, 180),
      email: clean(row.email, 220).toLowerCase(),
      phone: clean(row.phone, 40)
    })),
    ...manuals.map((row): SwitchItem => ({
      sourceType: "manual_payment",
      id: row.id,
      uuid: row.paymentUuid || "",
      courseSlug: normalizeSlug(row.courseSlug),
      courseName: courseName(normalizeSlug(row.courseSlug)),
      batchKey: normalizeBatchKey(row.batchKey),
      batchLabel: clean(row.batchLabel || row.batchKey, 120),
      batchStartAt: row.batchStartAt,
      brevoListId: clean(row.brevoListId, 64),
      seatCount: Math.max(1, Number(row.seatCount || 1)),
      displayName: clean(row.firstName || account.fullName, 180),
      email: clean(row.email, 220).toLowerCase(),
      phone: clean(row.phone, 40)
    })),
    ...families.map((row): SwitchItem => ({
      sourceType: "family",
      familyId: row.familyId,
      courseSlug: normalizeSlug(row.courseSlug),
      courseName: courseName(normalizeSlug(row.courseSlug)),
      batchKey: normalizeBatchKey(row.batchKey),
      batchLabel: clean(row.batchLabel || row.batchKey, 120),
      batchStartAt: row.batchStartAt,
      brevoListId: clean(row.brevoListId, 64),
      seatCount: Math.max(1, Number(row.seatsPurchased || 1)),
      seatsUsed: Math.max(0, Number(row.seatsConsumed || 0)),
      displayName: clean(row.parentName || account.fullName, 180),
      email: clean(row.parentEmail || account.email, 220).toLowerCase(),
      phone: clean(row.parentPhone, 40)
    }))
  ].filter((item) => item.batchKey)
}

async function targetOptionsForEnrollment(item: SwitchItem) {
  if (!isFuture(item.batchStartAt)) return []
  const rows = await prisma.$queryRaw<Array<{
    batchKey: string
    batchLabel: string
    batchStartAt: Date
    seatLimit: bigint | number | null
    brevoListId: string | null
  }>>(Prisma.sql`
    SELECT batch_key AS batchKey, batch_label AS batchLabel, batch_start_at AS batchStartAt,
           seat_limit AS seatLimit, brevo_list_id AS brevoListId
    FROM course_batches
    WHERE course_slug COLLATE utf8mb4_unicode_ci = ${item.courseSlug} COLLATE utf8mb4_unicode_ci
      AND status = 'open'
      AND COALESCE(TRIM(batch_key), '') <> ''
      AND batch_key COLLATE utf8mb4_unicode_ci <> ${item.batchKey} COLLATE utf8mb4_unicode_ci
      AND batch_start_at IS NOT NULL
      AND batch_start_at > NOW()
    ORDER BY batch_start_at ASC, batch_label ASC
  `)

  const options = []
  for (const row of rows) {
    const enrolled = await countEnrolledSeats(item.courseSlug, row.batchKey)
    const seatLimit = row.seatLimit === null || row.seatLimit === undefined ? null : Number(row.seatLimit)
    const remainingSeats = seatLimit === null ? null : Math.max(0, seatLimit - enrolled)
    if (remainingSeats !== null && remainingSeats < item.seatCount) continue
    options.push({
      batchKey: clean(row.batchKey, 64),
      batchLabel: clean(row.batchLabel, 120),
      batchStartAt: row.batchStartAt,
      batchStartText: displayBatchDate(row.batchStartAt),
      remainingSeats,
      seatLimit,
      brevoListId: clean(row.brevoListId, 64)
    })
  }
  return options
}

export async function getBatchSwitchOptions(account: { id: bigint; email: string; fullName: string }) {
  const items = await loadSwitchableEnrollments(account)
  const enrollments = []
  for (const item of items) {
    const options = await targetOptionsForEnrollment(item)
    const canCurrentSwitch = isFuture(item.batchStartAt)
    enrollments.push({
      sourceType: item.sourceType,
      sourceId: sourceIdFor(item),
      courseSlug: item.courseSlug,
      courseName: item.courseName,
      batchKey: item.batchKey,
      batchLabel: item.batchLabel,
      batchStartAt: item.batchStartAt,
      batchStartText: displayBatchDate(item.batchStartAt),
      currentBatchIsFuture: canCurrentSwitch,
      seatCount: item.seatCount,
      seatsUsed: item.seatsUsed,
      canSwitch: canCurrentSwitch && options.length > 0,
      lockedReason: canCurrentSwitch ? (options.length ? "" : "No future open batch is currently available.") : "This batch has already started or has no start date.",
      options
    })
  }
  return enrollments
}

export async function switchEnrollmentBatch(account: { id: bigint; email: string; fullName: string }, input: { sourceType: string; sourceId: string; targetBatchKey: string }) {
  const sourceType = clean(input.sourceType, 40).toLowerCase()
  const sourceId = clean(input.sourceId, 120)
  const targetBatchKey = normalizeBatchKey(input.targetBatchKey)
  if (!sourceType || !sourceId || !targetBatchKey) throw new Error("Batch switch details are incomplete.")

  const items = await loadSwitchableEnrollments(account)
  const item = items.find((entry) => entry.sourceType === sourceType && sourceIdFor(entry) === sourceId)
  if (!item) throw new Error("Enrollment not found.")
  if (!isFuture(item.batchStartAt)) throw new Error("This batch can no longer be changed.")
  if (targetBatchKey === item.batchKey) throw new Error("Choose a different batch.")

  const targetRows = await prisma.$queryRaw<Array<{ batchKey: string; batchLabel: string; batchStartAt: Date | null; status: string; brevoListId: string | null }>>(Prisma.sql`
    SELECT batch_key AS batchKey, batch_label AS batchLabel, batch_start_at AS batchStartAt, status, brevo_list_id AS brevoListId
    FROM course_batches
    WHERE course_slug COLLATE utf8mb4_unicode_ci = ${item.courseSlug} COLLATE utf8mb4_unicode_ci
      AND batch_key COLLATE utf8mb4_unicode_ci = ${targetBatchKey} COLLATE utf8mb4_unicode_ci
    LIMIT 1
  `)
  const target = targetRows[0]
  if (!target) throw new Error("Target batch not found.")
  if (clean(target.status, 32).toLowerCase() !== "open") throw new Error("Target batch is not open.")
  if (!isFuture(target.batchStartAt)) throw new Error("Target batch has already started.")

  const options = await targetOptionsForEnrollment(item)
  if (!options.some((option) => option.batchKey === targetBatchKey)) {
    throw new Error("Target batch does not have enough available seats.")
  }

  await ensureAuditTable()
  const now = new Date()
  await prisma.$transaction(async (tx) => {
    if (item.sourceType === "order") {
      const result = await tx.$executeRaw(Prisma.sql`
        UPDATE course_orders
        SET batch_key = ${target.batchKey}, batch_label = ${target.batchLabel}, updated_at = ${now}
        WHERE id = ${item.id}
          AND LOWER(email) COLLATE utf8mb4_unicode_ci = ${account.email.toLowerCase()} COLLATE utf8mb4_unicode_ci
          AND status = 'paid'
          AND COALESCE(buyer_type, 'student') <> 'family'
          AND batch_key COLLATE utf8mb4_unicode_ci = ${item.batchKey} COLLATE utf8mb4_unicode_ci
        LIMIT 1
      `)
      if (Number(result || 0) !== 1) throw new Error("Could not update enrollment batch.")
    } else if (item.sourceType === "manual_payment") {
      const result = await tx.$executeRaw(Prisma.sql`
        UPDATE course_manual_payments
        SET batch_key = ${target.batchKey}, batch_label = ${target.batchLabel}, updated_at = ${now}
        WHERE id = ${item.id}
          AND LOWER(email) COLLATE utf8mb4_unicode_ci = ${account.email.toLowerCase()} COLLATE utf8mb4_unicode_ci
          AND status = 'approved'
          AND COALESCE(buyer_type, 'student') <> 'family'
          AND batch_key COLLATE utf8mb4_unicode_ci = ${item.batchKey} COLLATE utf8mb4_unicode_ci
        LIMIT 1
      `)
      if (Number(result || 0) !== 1) throw new Error("Could not update manual enrollment batch.")
    } else if (item.sourceType === "family") {
      await tx.$executeRaw(Prisma.sql`
        UPDATE family_seat_balances
        SET batch_key = ${target.batchKey}, batch_label = ${target.batchLabel}, updated_at = ${now}
        WHERE family_id = ${item.familyId}
          AND course_slug COLLATE utf8mb4_unicode_ci = ${item.courseSlug} COLLATE utf8mb4_unicode_ci
          AND batch_key COLLATE utf8mb4_unicode_ci = ${item.batchKey} COLLATE utf8mb4_unicode_ci
      `)
      await tx.$executeRaw(Prisma.sql`
        UPDATE family_child_enrollments e
        JOIN family_children c ON c.id = e.child_id
        SET e.batch_key = ${target.batchKey}, e.batch_label = ${target.batchLabel}, e.updated_at = ${now}
        WHERE e.family_id = ${item.familyId}
          AND c.parent_account_id = ${account.id}
          AND e.course_slug COLLATE utf8mb4_unicode_ci = ${item.courseSlug} COLLATE utf8mb4_unicode_ci
          AND e.batch_key COLLATE utf8mb4_unicode_ci = ${item.batchKey} COLLATE utf8mb4_unicode_ci
          AND e.status IN ('active', 'pending_payment')
      `)
      await tx.$executeRaw(Prisma.sql`
        UPDATE course_orders
        SET batch_key = ${target.batchKey}, batch_label = ${target.batchLabel}, updated_at = ${now}
        WHERE (family_account_id = ${item.familyId} OR LOWER(email) COLLATE utf8mb4_unicode_ci = ${account.email.toLowerCase()} COLLATE utf8mb4_unicode_ci)
          AND course_slug COLLATE utf8mb4_unicode_ci = ${item.courseSlug} COLLATE utf8mb4_unicode_ci
          AND batch_key COLLATE utf8mb4_unicode_ci = ${item.batchKey} COLLATE utf8mb4_unicode_ci
          AND status = 'paid'
          AND COALESCE(buyer_type, 'student') = 'family'
      `).catch(() => 0)
      await tx.$executeRaw(Prisma.sql`
        UPDATE course_manual_payments
        SET batch_key = ${target.batchKey}, batch_label = ${target.batchLabel}, updated_at = ${now}
        WHERE (family_account_id = ${item.familyId} OR LOWER(email) COLLATE utf8mb4_unicode_ci = ${account.email.toLowerCase()} COLLATE utf8mb4_unicode_ci)
          AND course_slug COLLATE utf8mb4_unicode_ci = ${item.courseSlug} COLLATE utf8mb4_unicode_ci
          AND batch_key COLLATE utf8mb4_unicode_ci = ${item.batchKey} COLLATE utf8mb4_unicode_ci
          AND status = 'approved'
          AND COALESCE(buyer_type, 'student') = 'family'
      `).catch(() => 0)
    }

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO student_batch_changes
        (account_id, email, course_slug, source_type, source_id, old_batch_key, old_batch_label, old_batch_start_at,
         new_batch_key, new_batch_label, new_batch_start_at, seat_count, created_at)
      VALUES
        (${account.id}, ${account.email.toLowerCase()}, ${item.courseSlug}, ${item.sourceType}, ${sourceIdFor(item)},
         ${item.batchKey || null}, ${item.batchLabel || null}, ${item.batchStartAt || null},
         ${target.batchKey}, ${target.batchLabel}, ${target.batchStartAt || null}, ${item.seatCount}, ${now})
    `)
  })

  await moveEnrollmentBrevoList({
    fullName: item.displayName,
    email: item.email || account.email,
    phone: item.phone,
    courseSlug: item.courseSlug,
    oldBatchKey: item.batchKey,
    oldBatchLabel: item.batchLabel,
    oldListId: item.brevoListId,
    newBatchKey: target.batchKey,
    newBatchLabel: target.batchLabel,
    newListId: target.brevoListId,
    source: "batch_switch"
  }).catch((error) => {
    console.warn("batch_switch_brevo_move_failed", {
      email: item.email || account.email,
      courseSlug: item.courseSlug,
      oldBatchKey: item.batchKey,
      newBatchKey: target.batchKey,
      error: error instanceof Error ? error.message : String(error)
    })
  })

  await sendBatchSwitchConfirmationEmail({
    email: item.email || account.email,
    fullName: item.displayName || account.fullName,
    courseName: item.courseName,
    oldBatchLabel: item.batchLabel,
    oldBatchStartText: displayBatchDate(item.batchStartAt),
    newBatchLabel: target.batchLabel,
    newBatchStartText: displayBatchDate(target.batchStartAt)
  }).catch((error) => {
    console.warn("batch_switch_email_failed", {
      email: item.email || account.email,
      courseSlug: item.courseSlug,
      oldBatchKey: item.batchKey,
      newBatchKey: target.batchKey,
      error: error instanceof Error ? error.message : String(error)
    })
  })

  return {
    ok: true,
    courseSlug: item.courseSlug,
    sourceType: item.sourceType,
    sourceId: sourceIdFor(item),
    oldBatch: {
      batchKey: item.batchKey,
      batchLabel: item.batchLabel,
      batchStartAt: item.batchStartAt
    },
    newBatch: {
      batchKey: target.batchKey,
      batchLabel: target.batchLabel,
      batchStartAt: target.batchStartAt,
      batchStartText: displayBatchDate(target.batchStartAt)
    }
  }
}
