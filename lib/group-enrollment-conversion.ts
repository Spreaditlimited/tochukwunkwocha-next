import crypto from "crypto"
import { Prisma } from "@prisma/client"

import { reconcileFamilyOwnerBrevoLists } from "@/lib/enrollment-notifications"
import { claimIndividualCourseEnrollment, ensureEnrollmentClaimTable } from "@/lib/enrollment-guard"
import { assignFamilyChildCode } from "@/lib/family-enrollment"
import { familyEnrollmentEnabledForCourse, normalizeEmail } from "@/lib/payments/course-checkout"
import { prisma } from "@/lib/prisma"

const CONVERSION_TRANSACTION_MAX_WAIT_MS = 10_000
const CONVERSION_TRANSACTION_TIMEOUT_MS = 90_000

export type ConvertibleIndividualEnrollment = {
  sourceType: "course_order" | "manual_payment"
  sourceUuid: string
  courseSlug: string
  courseName: string
  batchKey: string
  batchLabel: string
  batchStartAt: Date | string | null
  paidAt: Date | string | null
}

type ConversionSourceRow = {
  sourceType: "course_order" | "manual_payment"
  sourceUuid: string
  courseSlug: string
  batchKey: string | null
  batchLabel: string | null
  batchStartAt: Date | null
  email: string
  fullName: string | null
  phone: string | null
  status: string
  buyerType: string | null
  paidAt: Date | null
}

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function courseName(slug: string) {
  const names: Record<string, string> = {
    "prompt-to-profit": "Prompt to Profit",
    "prompt-to-profit-holiday": "Prompt to Profit Holiday",
    "prompt-to-production": "Prompt to Profit Advanced",
    "ai-for-everyday-business-owners": "AI for Everyday Business Owners",
    "prompt-to-profit-schools": "Prompt to Profit for Schools"
  }
  return names[slug] || slug.split("-").filter(Boolean).map((part) => `${part[0]?.toUpperCase() || ""}${part.slice(1)}`).join(" ")
}

function syntheticChildEmail() {
  return `family-child-${crypto.randomUUID().replace(/-/g, "")}@student-code.local`
}

function managedAccountPassword() {
  const salt = crypto.randomBytes(16).toString("hex")
  const hash = crypto.scryptSync(crypto.randomBytes(32), salt, 64).toString("hex")
  return { salt, hash }
}

let conversionTablePromise: Promise<void> | null = null

export function ensureIndividualGroupConversionTable() {
  if (conversionTablePromise) return conversionTablePromise
  conversionTablePromise = prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_individual_group_conversions (
      id BIGINT NOT NULL AUTO_INCREMENT,
      conversion_uuid VARCHAR(64) NOT NULL,
      parent_account_id BIGINT NOT NULL,
      child_account_id BIGINT NOT NULL,
      family_id BIGINT NOT NULL,
      child_id BIGINT NOT NULL,
      enrollment_id BIGINT NOT NULL,
      source_type VARCHAR(40) NOT NULL,
      source_uuid VARCHAR(80) NOT NULL,
      course_slug VARCHAR(120) NOT NULL,
      batch_key VARCHAR(64) NULL,
      batch_label VARCHAR(120) NULL,
      child_name VARCHAR(180) NOT NULL,
      metadata_json LONGTEXT NULL,
      created_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_individual_group_conversion_uuid (conversion_uuid),
      UNIQUE KEY uniq_tochukwu_individual_group_conversion_source (source_type, source_uuid),
      KEY idx_tochukwu_individual_group_conversion_parent (parent_account_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).then(() => undefined).catch((error) => {
    conversionTablePromise = null
    throw error
  })
  return conversionTablePromise
}

async function existingTables(names: string[]) {
  const rows = await prisma.$queryRaw<Array<{ tableName: string }>>(Prisma.sql`
    SELECT TABLE_NAME AS tableName
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN (${Prisma.join(names)})
  `)
  return new Set(rows.map((row) => clean(row.tableName, 120)))
}

export async function listConvertibleIndividualEnrollments(input: {
  parentAccountId: bigint
  parentEmail: string
}) {
  await ensureIndividualGroupConversionTable()
  const email = normalizeEmail(input.parentEmail)
  if (!email) return []
  const rows = await prisma.$queryRaw<ConversionSourceRow[]>(Prisma.sql`
    SELECT 'course_order' COLLATE utf8mb4_unicode_ci AS sourceType,
           o.order_uuid COLLATE utf8mb4_unicode_ci AS sourceUuid,
           LOWER(o.course_slug) COLLATE utf8mb4_unicode_ci AS courseSlug,
           o.batch_key COLLATE utf8mb4_unicode_ci AS batchKey,
           o.batch_label COLLATE utf8mb4_unicode_ci AS batchLabel,
           (SELECT batch.batch_start_at FROM course_batches batch
            WHERE batch.course_slug COLLATE utf8mb4_unicode_ci = o.course_slug COLLATE utf8mb4_unicode_ci
              AND batch.batch_key COLLATE utf8mb4_unicode_ci = o.batch_key COLLATE utf8mb4_unicode_ci
            LIMIT 1) AS batchStartAt,
           LOWER(o.email) COLLATE utf8mb4_unicode_ci AS email,
           o.first_name COLLATE utf8mb4_unicode_ci AS fullName,
           o.phone COLLATE utf8mb4_unicode_ci AS phone,
           o.status COLLATE utf8mb4_unicode_ci AS status,
           o.buyer_type COLLATE utf8mb4_unicode_ci AS buyerType,
           COALESCE(o.paid_at, o.updated_at, o.created_at) AS paidAt
    FROM course_orders o
    WHERE LOWER(o.email) COLLATE utf8mb4_unicode_ci = ${email} COLLATE utf8mb4_unicode_ci
      AND o.status = 'paid'
      AND COALESCE(o.buyer_type, 'student') <> 'family'
      AND COALESCE(o.order_uuid, '') <> ''
      AND NOT EXISTS (
        SELECT 1 FROM tochukwu_individual_group_conversions conversion
        WHERE conversion.source_type = 'course_order'
          AND conversion.source_uuid COLLATE utf8mb4_unicode_ci = o.order_uuid COLLATE utf8mb4_unicode_ci
      )

    UNION ALL

    SELECT 'manual_payment' COLLATE utf8mb4_unicode_ci AS sourceType,
           m.payment_uuid COLLATE utf8mb4_unicode_ci AS sourceUuid,
           LOWER(m.course_slug) COLLATE utf8mb4_unicode_ci AS courseSlug,
           m.batch_key COLLATE utf8mb4_unicode_ci AS batchKey,
           m.batch_label COLLATE utf8mb4_unicode_ci AS batchLabel,
           (SELECT batch.batch_start_at FROM course_batches batch
            WHERE batch.course_slug COLLATE utf8mb4_unicode_ci = m.course_slug COLLATE utf8mb4_unicode_ci
              AND batch.batch_key COLLATE utf8mb4_unicode_ci = m.batch_key COLLATE utf8mb4_unicode_ci
            LIMIT 1) AS batchStartAt,
           LOWER(m.email) COLLATE utf8mb4_unicode_ci AS email,
           m.first_name COLLATE utf8mb4_unicode_ci AS fullName,
           m.phone COLLATE utf8mb4_unicode_ci AS phone,
           m.status COLLATE utf8mb4_unicode_ci AS status,
           m.buyer_type COLLATE utf8mb4_unicode_ci AS buyerType,
           COALESCE(m.reviewed_at, m.updated_at, m.created_at) AS paidAt
    FROM course_manual_payments m
    WHERE LOWER(m.email) COLLATE utf8mb4_unicode_ci = ${email} COLLATE utf8mb4_unicode_ci
      AND m.status = 'approved'
      AND COALESCE(m.buyer_type, 'student') <> 'family'
      AND NOT EXISTS (
        SELECT 1 FROM tochukwu_individual_group_conversions conversion
        WHERE conversion.source_type = 'manual_payment'
          AND conversion.source_uuid COLLATE utf8mb4_unicode_ci = m.payment_uuid COLLATE utf8mb4_unicode_ci
      )

    ORDER BY paidAt DESC
  `)
  const candidates = rows.filter((row) => familyEnrollmentEnabledForCourse(row.courseSlug))
  if (!candidates.length) return []
  const certificates = await prisma.$queryRaw<Array<{ courseSlug: string }>>(Prisma.sql`
    SELECT DISTINCT LOWER(course_slug) AS courseSlug
    FROM student_certificates
    WHERE account_id = ${input.parentAccountId}
      AND LOWER(course_slug) IN (${Prisma.join(candidates.map((row) => row.courseSlug))})
  `).catch(() => [])
  const issuanceKeys = await prisma.$queryRaw<Array<{ courseSlug: string }>>(Prisma.sql`
    SELECT DISTINCT LOWER(course_slug) AS courseSlug
    FROM student_certificate_issuance_keys
    WHERE account_id = ${input.parentAccountId}
      AND LOWER(course_slug) IN (${Prisma.join(candidates.map((row) => row.courseSlug))})
  `).catch(() => [])
  const certificateCourses = new Set(
    [...certificates, ...issuanceKeys].map((row) => clean(row.courseSlug, 120).toLowerCase())
  )
  return candidates
    .filter((row) => !certificateCourses.has(row.courseSlug))
    .map((row): ConvertibleIndividualEnrollment => ({
      sourceType: row.sourceType,
      sourceUuid: clean(row.sourceUuid, 80),
      courseSlug: clean(row.courseSlug, 120).toLowerCase(),
      courseName: courseName(row.courseSlug),
      batchKey: clean(row.batchKey, 64),
      batchLabel: clean(row.batchLabel, 120) || "Immediate access",
      batchStartAt: row.batchStartAt,
      paidAt: row.paidAt
    }))
}

async function findLockedSource(
  tx: Prisma.TransactionClient,
  input: { sourceType: "course_order" | "manual_payment"; sourceUuid: string }
) {
  if (input.sourceType === "course_order") {
    const rows = await tx.$queryRaw<ConversionSourceRow[]>(Prisma.sql`
      SELECT 'course_order' AS sourceType, order_uuid AS sourceUuid, LOWER(course_slug) AS courseSlug,
             batch_key AS batchKey, batch_label AS batchLabel, NULL AS batchStartAt, LOWER(email) AS email,
             first_name AS fullName, phone, status, buyer_type AS buyerType,
             COALESCE(paid_at, updated_at, created_at) AS paidAt
      FROM course_orders
      WHERE order_uuid = ${input.sourceUuid}
      LIMIT 1
      FOR UPDATE
    `)
    return rows[0] || null
  }
  const rows = await tx.$queryRaw<ConversionSourceRow[]>(Prisma.sql`
    SELECT 'manual_payment' AS sourceType, payment_uuid AS sourceUuid, LOWER(course_slug) AS courseSlug,
           batch_key AS batchKey, batch_label AS batchLabel, NULL AS batchStartAt, LOWER(email) AS email,
           first_name AS fullName, phone, status, buyer_type AS buyerType,
           COALESCE(reviewed_at, updated_at, created_at) AS paidAt
    FROM course_manual_payments
    WHERE payment_uuid = ${input.sourceUuid}
    LIMIT 1
    FOR UPDATE
  `)
  return rows[0] || null
}

async function transferCourseLearningState(input: {
  tx: Prisma.TransactionClient
  tables: Set<string>
  parentAccountId: bigint
  childAccountId: bigint
  parentEmail: string
  childEmail: string
  childName: string
  courseSlug: string
}) {
  const { tx, tables, parentAccountId, childAccountId, childEmail, childName, courseSlug } = input
  if (tables.has("tochukwu_learning_lesson_progress")) {
    await tx.$executeRaw(Prisma.sql`
      UPDATE tochukwu_learning_lesson_progress progress
      JOIN tochukwu_learning_lessons lesson ON lesson.id = progress.lesson_id
      JOIN tochukwu_learning_course_modules course_module ON course_module.module_id = lesson.module_id
      SET progress.account_id = ${childAccountId}, progress.updated_at = ${new Date()}
      WHERE progress.account_id = ${parentAccountId}
        AND course_module.course_slug COLLATE utf8mb4_unicode_ci = ${courseSlug} COLLATE utf8mb4_unicode_ci
    `)
  }
  if (tables.has("tochukwu_learning_assignments")) {
    await tx.$executeRaw`
      UPDATE tochukwu_learning_assignments
      SET account_id = ${childAccountId}, student_email = ${childEmail}, student_name = ${childName}, updated_at = ${new Date()}
      WHERE account_id = ${parentAccountId} AND course_slug = ${courseSlug}
    `
  }
  if (tables.has("tochukwu_learning_assignment_messages")) {
    await tx.$executeRaw`
      UPDATE tochukwu_learning_assignment_messages
      SET account_id = ${childAccountId},
          author_ref = CASE WHEN author_type = 'student' THEN ${childEmail} ELSE author_ref END,
          author_name = CASE WHEN author_type = 'student' THEN ${childName} ELSE author_name END
      WHERE account_id = ${parentAccountId} AND course_slug = ${courseSlug}
    `
  }
  if (tables.has("tochukwu_learning_community_threads")) {
    await tx.$executeRaw`
      UPDATE tochukwu_learning_community_threads
      SET account_id = ${childAccountId}, author_email = ${childEmail}, author_name = ${childName}, updated_at = ${new Date()}
      WHERE account_id = ${parentAccountId} AND course_slug = ${courseSlug}
    `
  }
  if (tables.has("tochukwu_learning_community_replies")) {
    await tx.$executeRaw`
      UPDATE tochukwu_learning_community_replies
      SET account_id = ${childAccountId}, author_email = ${childEmail}, author_name = ${childName}, updated_at = ${new Date()}
      WHERE account_id = ${parentAccountId} AND course_slug = ${courseSlug}
    `
    await tx.$executeRaw`
      UPDATE tochukwu_learning_community_replies
      SET mention_account_id = ${childAccountId}, mention_email = ${childEmail}, mention_name = ${childName}, updated_at = ${new Date()}
      WHERE mention_account_id = ${parentAccountId} AND course_slug = ${courseSlug}
    `
  }
  if (tables.has("tochukwu_transcript_access")) {
    await tx.$executeRaw`
      UPDATE tochukwu_transcript_access
      SET account_id = ${childAccountId}, updated_at = ${new Date()}
      WHERE account_id = ${parentAccountId} AND course_slug = ${courseSlug}
    `
  }
  if (tables.has("tochukwu_transcript_access_audit")) {
    await tx.$executeRaw`
      UPDATE tochukwu_transcript_access_audit
      SET account_id = ${childAccountId}
      WHERE account_id = ${parentAccountId} AND course_slug = ${courseSlug}
    `
  }
  if (tables.has("student_project_links")) {
    await tx.$executeRaw`
      UPDATE student_project_links
      SET account_id = ${childAccountId}, updated_at = ${new Date()}
      WHERE account_id = ${parentAccountId} AND course_slug = ${courseSlug}
    `
  }
  if (tables.has("student_batch_changes")) {
    await tx.$executeRaw`
      UPDATE student_batch_changes
      SET account_id = ${childAccountId}, email = ${childEmail}
      WHERE account_id = ${parentAccountId} AND course_slug = ${courseSlug}
    `
  }
}

export async function convertIndividualEnrollmentToGroup(input: {
  parentAccountId: bigint
  parentName: string
  parentEmail: string
  sourceType: "course_order" | "manual_payment"
  sourceUuid: string
  childName: string
  childAge?: string
  childClassLevel?: string
  administrativeTargetBatchKey?: string
}) {
  await Promise.all([ensureIndividualGroupConversionTable(), ensureEnrollmentClaimTable()])
  const parentEmail = normalizeEmail(input.parentEmail)
  const childName = clean(input.childName, 180)
  const childAge = clean(input.childAge, 40)
  const childClassLevel = clean(input.childClassLevel, 80)
  const sourceUuid = clean(input.sourceUuid, 80)
  if (!parentEmail || !childName || !sourceUuid) throw new Error("Enrollment conversion details are incomplete.")

  // Password derivation is deliberately completed before opening the interactive
  // transaction so CPU work does not consume the database transaction window.
  const managedPassword = managedAccountPassword()

  const tables = await existingTables([
    "tochukwu_learning_lesson_progress",
    "tochukwu_learning_assignments",
    "tochukwu_learning_assignment_messages",
    "tochukwu_learning_community_threads",
    "tochukwu_learning_community_replies",
    "tochukwu_transcript_access",
    "tochukwu_transcript_access_audit",
    "student_project_links",
    "student_batch_changes",
    "student_certificates",
    "student_certificate_issuance_keys"
  ])
  const result = await prisma.$transaction(async (tx) => {
    const previous = await tx.$queryRaw<Array<{
      conversionUuid: string
      familyId: bigint
      childId: bigint
      childAccountId: bigint
      courseSlug: string
      batchKey: string | null
      batchLabel: string | null
    }>>(Prisma.sql`
      SELECT conversion_uuid AS conversionUuid, family_id AS familyId, child_id AS childId, child_account_id AS childAccountId,
             course_slug AS courseSlug, batch_key AS batchKey, batch_label AS batchLabel
      FROM tochukwu_individual_group_conversions
      WHERE parent_account_id = ${input.parentAccountId}
        AND source_type = ${input.sourceType}
        AND source_uuid = ${sourceUuid}
      LIMIT 1
      FOR UPDATE
    `)
    if (previous[0]) return { ...previous[0], alreadyConverted: true }

    const source = await findLockedSource(tx, { sourceType: input.sourceType, sourceUuid })
    if (!source || normalizeEmail(source.email) !== parentEmail) throw new Error("This enrollment does not belong to your account.")
    const requiredStatus = input.sourceType === "course_order" ? "paid" : "approved"
    if (clean(source.status, 40).toLowerCase() !== requiredStatus || clean(source.buyerType, 40).toLowerCase() === "family") {
      throw new Error("Only an active paid individual enrollment can be converted.")
    }
    const courseSlug = clean(source.courseSlug, 120).toLowerCase()
    const originalBatchKey = clean(source.batchKey, 64)
    const originalBatchLabel = clean(source.batchLabel, 120)
    let batchKey = originalBatchKey
    let batchLabel = originalBatchLabel
    if (!familyEnrollmentEnabledForCourse(courseSlug)) throw new Error("Group enrollment is not available for this course.")

    const administrativeTargetBatchKey = clean(input.administrativeTargetBatchKey, 64)
    if (administrativeTargetBatchKey && administrativeTargetBatchKey !== originalBatchKey) {
      const targetRows = await tx.$queryRaw<Array<{
        batchKey: string
        batchLabel: string | null
        status: string | null
        isActive: number | bigint | boolean | null
      }>>(Prisma.sql`
        SELECT batch_key AS batchKey, batch_label AS batchLabel, status, is_active AS isActive
        FROM course_batches
        WHERE course_slug COLLATE utf8mb4_unicode_ci = ${courseSlug} COLLATE utf8mb4_unicode_ci
          AND batch_key COLLATE utf8mb4_unicode_ci = ${administrativeTargetBatchKey} COLLATE utf8mb4_unicode_ci
        LIMIT 1
        FOR UPDATE
      `)
      const target = targetRows[0]
      if (!target) throw new Error("The administrative target batch does not belong to this course.")
      const targetOpen = Boolean(Number(target.isActive || 0)) || clean(target.status, 40).toLowerCase() === "open"
      if (!targetOpen) throw new Error("The administrative target batch is closed.")
      batchKey = clean(target.batchKey, 64)
      batchLabel = clean(target.batchLabel, 120) || batchKey
    }

    if (tables.has("student_certificates")) {
      const certificates = await tx.$queryRaw<Array<{ id: bigint }>>(Prisma.sql`
        SELECT id FROM student_certificates
        WHERE account_id = ${input.parentAccountId} AND course_slug = ${courseSlug}
        LIMIT 1 FOR UPDATE
      `)
      if (certificates.length) throw new Error("This enrollment has certificate records and requires administrator assistance to convert.")
    }
    if (tables.has("student_certificate_issuance_keys")) {
      const issuanceKeys = await tx.$queryRaw<Array<{ id: bigint }>>(Prisma.sql`
        SELECT id FROM student_certificate_issuance_keys
        WHERE account_id = ${input.parentAccountId} AND course_slug = ${courseSlug}
        LIMIT 1 FOR UPDATE
      `)
      if (issuanceKeys.length) throw new Error("This enrollment has certificate records and requires administrator assistance to convert.")
    }

    const timestamp = new Date()
    await tx.$executeRaw`
      INSERT INTO family_accounts
        (family_uuid, parent_account_id, parent_name, parent_email, parent_phone, status, created_at, updated_at)
      VALUES
        (${`fam_${crypto.randomUUID().replace(/-/g, "")}`}, ${input.parentAccountId}, ${clean(input.parentName, 180)},
         ${parentEmail}, ${clean(source.phone, 80) || null}, 'active', ${timestamp}, ${timestamp})
      ON DUPLICATE KEY UPDATE
        parent_name = VALUES(parent_name), parent_email = VALUES(parent_email),
        parent_phone = COALESCE(VALUES(parent_phone), parent_phone), status = 'active', updated_at = VALUES(updated_at)
    `
    const families = await tx.$queryRaw<Array<{ id: bigint }>>`
      SELECT id FROM family_accounts WHERE parent_account_id = ${input.parentAccountId} LIMIT 1 FOR UPDATE
    `
    const familyId = families[0]?.id
    if (!familyId) throw new Error("Could not create the group account.")

    const childEmail = syntheticChildEmail()
    const childAccount = await tx.studentAccount.create({
      data: {
        accountUuid: `sa_${crypto.randomUUID().replace(/-/g, "")}`,
        fullName: childName,
        email: childEmail,
        passwordHash: managedPassword.hash,
        passwordSalt: managedPassword.salt,
        mustResetPassword: false,
        phoneE164: null,
        whatsappOptedIn: false,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    })
    const conversionUuid = `igc_${crypto.randomUUID().replace(/-/g, "")}`
    const childUuid = `fch_${crypto.randomUUID().replace(/-/g, "")}`
    await tx.$executeRaw`
      INSERT INTO family_children
        (child_uuid, family_id, parent_account_id, account_id, full_name, age, class_level, email,
         status, source_type, source_uuid, created_at, updated_at)
      VALUES
        (${childUuid}, ${familyId}, ${input.parentAccountId}, ${childAccount.id}, ${childName}, ${childAge || null},
         ${childClassLevel || null}, NULL, 'active', 'individual_conversion', ${conversionUuid}, ${timestamp}, ${timestamp})
    `
    const children = await tx.$queryRaw<Array<{ id: bigint }>>`
      SELECT id FROM family_children WHERE child_uuid = ${childUuid} LIMIT 1
    `
    const childId = children[0]?.id
    if (!childId) throw new Error("Could not create the managed learner.")
    await assignFamilyChildCode(childId, tx)
    const enrollmentSourceUuid = `family_child_${childId.toString()}`
    await tx.$executeRaw`
      INSERT INTO family_child_enrollments
        (child_id, family_id, account_id, course_slug, batch_key, batch_label, source_type, source_uuid,
         status, paid_at, created_at, updated_at)
      VALUES
        (${childId}, ${familyId}, ${childAccount.id}, ${courseSlug}, ${batchKey || null}, ${batchLabel || null},
         'individual_conversion', ${enrollmentSourceUuid}, 'active', ${source.paidAt || timestamp}, ${timestamp}, ${timestamp})
    `
    const enrollments = await tx.$queryRaw<Array<{ id: bigint }>>`
      SELECT id FROM family_child_enrollments
      WHERE child_id = ${childId} AND source_uuid = ${enrollmentSourceUuid}
      LIMIT 1
    `
    const enrollmentId = enrollments[0]?.id
    if (!enrollmentId) throw new Error("Could not create the managed learner enrollment.")

    const balances = await tx.$queryRaw<Array<{ id: bigint }>>(Prisma.sql`
      SELECT id FROM family_seat_balances
      WHERE family_id = ${familyId} AND course_slug = ${courseSlug} AND batch_key = ${batchKey}
      LIMIT 1 FOR UPDATE
    `)
    if (balances[0]) {
      await tx.$executeRaw`
        UPDATE family_seat_balances
        SET seats_purchased = seats_purchased + 1, seats_consumed = seats_consumed + 1,
            batch_label = COALESCE(${batchLabel || null}, batch_label), updated_at = ${timestamp}
        WHERE id = ${balances[0].id} LIMIT 1
      `
    } else {
      await tx.$executeRaw`
        INSERT INTO family_seat_balances
          (family_id, course_slug, batch_key, batch_label, seats_purchased, seats_consumed, created_at, updated_at)
        VALUES (${familyId}, ${courseSlug}, ${batchKey}, ${batchLabel || null}, 1, 1, ${timestamp}, ${timestamp})
      `
    }
    await tx.$executeRaw`
      INSERT INTO family_seat_ledger
        (family_id, course_slug, batch_key, entry_type, quantity, source_type, source_uuid,
         idempotency_key, metadata_json, created_at, updated_at)
      VALUES
        (${familyId}, ${courseSlug}, ${batchKey}, 'purchase', 1, ${input.sourceType}, ${sourceUuid},
         ${`${input.sourceType}:${sourceUuid}:purchase`},
         ${JSON.stringify({ original_source_type: input.sourceType, original_source_uuid: sourceUuid })}, ${timestamp}, ${timestamp}),
        (${familyId}, ${courseSlug}, ${batchKey}, 'consume', 1, 'individual_conversion', ${conversionUuid},
         ${`individual_conversion:${input.sourceType}:${sourceUuid}:consume`},
         ${JSON.stringify({ child_id: childId.toString() })}, ${timestamp}, ${timestamp})
    `

    if (input.sourceType === "course_order") {
      await tx.$executeRaw`
        UPDATE course_orders SET buyer_type = 'family', seat_count = 1, family_account_id = ${familyId},
          batch_key = ${batchKey || null}, batch_label = ${batchLabel || null}, updated_at = ${timestamp}
        WHERE order_uuid = ${sourceUuid} AND status = 'paid' LIMIT 1
      `
    } else {
      await tx.$executeRaw`
        UPDATE course_manual_payments SET buyer_type = 'family', seat_count = 1, family_account_id = ${familyId},
          batch_key = ${batchKey || null}, batch_label = ${batchLabel || null}, updated_at = ${timestamp}
        WHERE payment_uuid = ${sourceUuid} AND status = 'approved' LIMIT 1
      `
    }
    await tx.$executeRaw`
      DELETE FROM tochukwu_course_enrollment_claims
      WHERE source_type = ${input.sourceType} AND source_uuid = ${sourceUuid}
      LIMIT 1
    `
    await claimIndividualCourseEnrollment(tx, {
      email: childEmail,
      courseSlug,
      sourceType: "family_child",
      sourceUuid: enrollmentSourceUuid,
      batchKey,
      batchLabel
    })
    await transferCourseLearningState({
      tx,
      tables,
      parentAccountId: input.parentAccountId,
      childAccountId: childAccount.id,
      parentEmail,
      childEmail,
      childName,
      courseSlug
    })
    await tx.$executeRaw`
      INSERT INTO tochukwu_individual_group_conversions
        (conversion_uuid, parent_account_id, child_account_id, family_id, child_id, enrollment_id,
         source_type, source_uuid, course_slug, batch_key, batch_label, child_name, metadata_json, created_at)
      VALUES
        (${conversionUuid}, ${input.parentAccountId}, ${childAccount.id}, ${familyId}, ${childId}, ${enrollmentId},
         ${input.sourceType}, ${sourceUuid}, ${courseSlug}, ${batchKey || null}, ${batchLabel || null}, ${childName},
         ${JSON.stringify({
           converted_by: administrativeTargetBatchKey ? "administrator" : "account_owner",
           progress_transferred: true,
           original_batch_key: originalBatchKey || null,
           original_batch_label: originalBatchLabel || null
         })}, ${timestamp})
    `
    return {
      conversionUuid,
      familyId,
      childId,
      childAccountId: childAccount.id,
      courseSlug,
      batchKey,
      batchLabel,
      alreadyConverted: false
    }
  }, {
    maxWait: CONVERSION_TRANSACTION_MAX_WAIT_MS,
    timeout: CONVERSION_TRANSACTION_TIMEOUT_MS
  })

  await reconcileFamilyOwnerBrevoLists({
    familyId: result.familyId,
    fullName: input.parentName,
    email: parentEmail,
    phone: null,
    courseSlug: result.courseSlug,
    source: "individual_to_group_conversion"
  }).catch((error) => {
    console.warn("individual_to_group_conversion_brevo_failed", {
      sourceType: input.sourceType,
      sourceUuid,
      error: error instanceof Error ? error.message : String(error)
    })
  })
  return {
    ok: true as const,
    conversionUuid: result.conversionUuid,
    childId: Number(result.childId),
    courseSlug: result.courseSlug,
    batchKey: result.batchKey,
    batchLabel: result.batchLabel,
    alreadyConverted: result.alreadyConverted
  }
}
