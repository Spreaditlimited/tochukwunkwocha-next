import { prisma } from "@/lib/prisma"
import { upsertAdminSettings } from "@/lib/admin-settings"
import { configuredLearningCourseSlugSql, dayLevelCourseSlugRegex } from "@/lib/learning-course-catalog"
import { addColumnIfMissing } from "@/lib/schema-guards"
import { sanitizeRichNotes } from "@/lib/rich-notes"

export const PUBLIC_VIDEO_SLOTS = [
  { key: "home-introduction", label: "Home introduction", page: "Home" },
  { key: "prompt-to-profit-basic-intro", label: "Prompt to Profit Basic intro", page: "Prompt to Profit Basic" },
  { key: "prompt-to-profit-advanced-intro", label: "Prompt to Profit Advanced intro", page: "Prompt to Profit Advanced" },
  { key: "about-academy-story", label: "About academy story", page: "About Us" }
] as const

export type PublicVideoSlotKey = typeof PUBLIC_VIDEO_SLOTS[number]["key"]

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

export function slugify(value: unknown, fallback = "item") {
  const slug = clean(value, 180)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug || fallback
}

function toInt(value: unknown, fallback = 0) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? Math.round(numberValue) : fallback
}

function toMinor(value: unknown) {
  const raw = String(value || "").replace(/[, ]/g, "")
  if (!raw) return null
  const numeric = Number(raw)
  return Number.isFinite(numeric) && numeric >= 0 ? Math.round(numeric * 100) : null
}

function toMinorUnit(value: unknown) {
  const numberValue = Number(String(value || "").replace(/[, ]/g, ""))
  return Number.isFinite(numberValue) && numberValue >= 0 ? Math.round(numberValue) : null
}

function toDate(value: unknown) {
  const raw = clean(value, 80)
  if (!raw) return null
  const date = new Date(raw)
  return Number.isFinite(date.getTime()) ? date : null
}

function toBigIntId(value: unknown) {
  const raw = String(value || "0").trim()
  return /^\d+$/.test(raw) ? BigInt(raw) : BigInt(0)
}

function normalizeBatchKey(value: unknown) {
  return clean(value, 64).toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 64)
}

function normalizePrefix(value: unknown) {
  return clean(value || "PTP", 20).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || "PTP"
}

function prefixFromSlug(value: unknown) {
  const compact = clean(value, 120).split("-").filter(Boolean).map((part) => part[0]).join("").toUpperCase().replace(/[^A-Z0-9]/g, "")
  return compact.slice(0, 10) || "CRS"
}

function normalizeAccessMode(value: unknown) {
  return clean(value, 24).toLowerCase() === "immediate" ? "immediate" : "drip"
}

function normalizeScheduleRows(input: unknown) {
  const rows = Array.isArray(input) ? input : []
  const seen = new Set<string>()
  const out: Array<{ batchKey: string; accessMode: "immediate" | "drip"; dripAt: Date | null }> = []
  for (const row of rows) {
    const item = row && typeof row === "object" ? row as Record<string, unknown> : {}
    const batchKey = normalizeBatchKey(item.batchKey || item.batch_key)
    if (!batchKey || seen.has(batchKey)) continue
    const accessMode = normalizeAccessMode(item.accessMode || item.access_mode)
    const dripAt = accessMode === "immediate" ? null : toDate(item.dripAt || item.drip_at)
    if (accessMode === "drip" && !dripAt) continue
    seen.add(batchKey)
    out.push({ batchKey, accessMode, dripAt })
  }
  return out
}

function hasInvalidScheduleRows(input: unknown) {
  const rows = Array.isArray(input) ? input : []
  return rows.some((row) => {
    const item = row && typeof row === "object" ? row as Record<string, unknown> : {}
    const batchKey = normalizeBatchKey(item.batchKey || item.batch_key)
    if (!batchKey) return false
    const accessMode = normalizeAccessMode(item.accessMode || item.access_mode)
    return accessMode === "drip" && !toDate(item.dripAt || item.drip_at)
  })
}

export async function ensureVideoLibraryTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_learning_courses (
      id BIGINT NOT NULL AUTO_INCREMENT,
      course_slug VARCHAR(120) NOT NULL,
      course_title VARCHAR(220) NOT NULL,
      course_description TEXT NULL,
      enrollment_mode VARCHAR(24) NOT NULL DEFAULT 'batch',
      price_ngn_minor INT NULL,
      price_gbp_minor INT NULL,
      price_usd_minor INT NULL,
      price_eur_minor INT NULL,
      school_advanced_discount_ngn_minor INT NULL,
      school_advanced_discount_gbp_minor INT NULL,
      school_advanced_discount_usd_minor INT NULL,
      school_advanced_discount_eur_minor INT NULL,
      payment_methods VARCHAR(120) NULL,
      is_enrollment_locked TINYINT(1) NOT NULL DEFAULT 0,
      is_published TINYINT(1) NOT NULL DEFAULT 0,
      release_at DATETIME NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_learning_course_slug (course_slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_learning_video_assets (
      id BIGINT NOT NULL AUTO_INCREMENT,
      provider VARCHAR(60) NOT NULL DEFAULT 'cloudflare_stream',
      video_uid VARCHAR(120) NOT NULL,
      filename VARCHAR(320) NULL,
      hls_url TEXT NULL,
      dash_url TEXT NULL,
      duration_seconds DECIMAL(10,2) NULL,
      ready_to_stream TINYINT(1) NOT NULL DEFAULT 0,
      source_created_at DATETIME NULL,
      source_deleted_at DATETIME NULL,
      source_payload_json LONGTEXT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_learning_video_uid (video_uid),
      KEY idx_tochukwu_learning_video_provider (provider, updated_at),
      KEY idx_tochukwu_learning_video_filename (filename(190))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_learning_modules (
      id BIGINT NOT NULL AUTO_INCREMENT,
      course_slug VARCHAR(120) NOT NULL,
      module_slug VARCHAR(160) NOT NULL,
      module_title VARCHAR(220) NOT NULL,
      module_description TEXT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      drip_enabled TINYINT(1) NOT NULL DEFAULT 0,
      drip_at DATETIME NULL,
      drip_batch_key VARCHAR(64) NULL,
      drip_offset_seconds INT NULL,
      drip_notified_at DATETIME NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_learning_module_slug (course_slug, module_slug),
      KEY idx_tochukwu_learning_module_course (course_slug, sort_order, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_learning_course_modules (
      id BIGINT NOT NULL AUTO_INCREMENT,
      course_slug VARCHAR(120) NOT NULL,
      module_id BIGINT NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      drip_enabled TINYINT(1) NOT NULL DEFAULT 0,
      drip_at DATETIME NULL,
      drip_batch_key VARCHAR(64) NULL,
      drip_offset_seconds INT NULL,
      drip_notified_at DATETIME NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_learning_course_module (course_slug, module_id),
      KEY idx_tochukwu_learning_course_module_order (course_slug, sort_order, id),
      KEY idx_tochukwu_learning_course_module_module (module_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_learning_module_batch_drips (
      id BIGINT NOT NULL AUTO_INCREMENT,
      module_id BIGINT NOT NULL,
      batch_key VARCHAR(64) NOT NULL,
      access_mode VARCHAR(24) NOT NULL DEFAULT 'drip',
      drip_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_module_batch_drip (module_id, batch_key),
      KEY idx_module_batch_drip_module (module_id),
      KEY idx_module_batch_drip_batch (batch_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_learning_lessons (
      id BIGINT NOT NULL AUTO_INCREMENT,
      module_id BIGINT NOT NULL,
      lesson_slug VARCHAR(160) NOT NULL,
      lesson_title VARCHAR(220) NOT NULL,
      lesson_order INT NOT NULL DEFAULT 1,
      video_asset_id BIGINT NULL,
      lesson_notes TEXT NULL,
      captions_vtt_url TEXT NULL,
      captions_languages_json TEXT NULL,
      transcript_text LONGTEXT NULL,
      audio_description_text LONGTEXT NULL,
      sign_language_video_url TEXT NULL,
      accessibility_status VARCHAR(32) NOT NULL DEFAULT 'draft',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_learning_lesson_slug (module_id, lesson_slug),
      KEY idx_tochukwu_learning_lesson_module (module_id, lesson_order, id),
      KEY idx_tochukwu_learning_lesson_asset (video_asset_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_public_video_slots (
      slot_key VARCHAR(120) NOT NULL,
      slot_label VARCHAR(180) NOT NULL,
      page_label VARCHAR(120) NOT NULL,
      video_asset_id BIGINT NULL,
      headline VARCHAR(220) NULL,
      description TEXT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (slot_key),
      KEY idx_tochukwu_public_video_asset (video_asset_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await addColumnIfMissing("tochukwu_learning_courses", "price_usd_minor", "INT NULL")
  await addColumnIfMissing("tochukwu_learning_courses", "price_eur_minor", "INT NULL")
  await addColumnIfMissing("tochukwu_learning_courses", "school_advanced_discount_ngn_minor", "INT NULL")
  await addColumnIfMissing("tochukwu_learning_courses", "school_advanced_discount_gbp_minor", "INT NULL")
  await addColumnIfMissing("tochukwu_learning_courses", "school_advanced_discount_usd_minor", "INT NULL")
  await addColumnIfMissing("tochukwu_learning_courses", "school_advanced_discount_eur_minor", "INT NULL")
  await addColumnIfMissing("tochukwu_learning_courses", "payment_methods", "VARCHAR(120) NULL")
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS course_batches (
      id BIGINT NOT NULL AUTO_INCREMENT,
      course_slug VARCHAR(120) NOT NULL,
      batch_key VARCHAR(64) NOT NULL,
      batch_label VARCHAR(120) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'closed',
      is_active TINYINT(1) NOT NULL DEFAULT 0,
      paystack_reference_prefix VARCHAR(20) NOT NULL DEFAULT 'PTP',
      paystack_amount_minor INT NOT NULL,
      paypal_amount_minor INT NOT NULL DEFAULT 2400,
      brevo_list_id VARCHAR(64) NULL,
      seat_limit INT NULL,
      batch_start_at DATETIME NULL,
      activated_at DATETIME NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_course_batch (course_slug, batch_key),
      KEY idx_course_batches_active (course_slug, is_active, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await addColumnIfMissing("course_batches", "batch_start_at", "DATETIME NULL")
  await addColumnIfMissing("course_batches", "brevo_list_id", "VARCHAR(64) NULL")
  await addColumnIfMissing("course_batches", "seat_limit", "INT NULL")
  await addColumnIfMissing("course_batches", "activated_at", "DATETIME NULL")
  await addColumnIfMissing("tochukwu_learning_video_assets", "source_deleted_at", "DATETIME NULL")
  await addColumnIfMissing("tochukwu_learning_modules", "drip_enabled", "TINYINT(1) NOT NULL DEFAULT 0")
  await addColumnIfMissing("tochukwu_learning_modules", "drip_at", "DATETIME NULL")
  await addColumnIfMissing("tochukwu_learning_modules", "drip_batch_key", "VARCHAR(64) NULL")
  await addColumnIfMissing("tochukwu_learning_modules", "drip_offset_seconds", "INT NULL")
  await addColumnIfMissing("tochukwu_learning_modules", "drip_notified_at", "DATETIME NULL")
  await addColumnIfMissing("tochukwu_learning_course_modules", "drip_enabled", "TINYINT(1) NOT NULL DEFAULT 0")
  await addColumnIfMissing("tochukwu_learning_course_modules", "drip_at", "DATETIME NULL")
  await addColumnIfMissing("tochukwu_learning_course_modules", "drip_batch_key", "VARCHAR(64) NULL")
  await addColumnIfMissing("tochukwu_learning_course_modules", "drip_offset_seconds", "INT NULL")
  await addColumnIfMissing("tochukwu_learning_course_modules", "drip_notified_at", "DATETIME NULL")
  await addColumnIfMissing("tochukwu_learning_module_batch_drips", "access_mode", "VARCHAR(24) NOT NULL DEFAULT 'drip'")
  await addColumnIfMissing("tochukwu_learning_module_batch_drips", "access_mode", "VARCHAR(24) NOT NULL DEFAULT 'drip'")
  await addColumnIfMissing("tochukwu_learning_lessons", "transcript_text", "LONGTEXT NULL")
  await addColumnIfMissing("tochukwu_learning_lessons", "captions_vtt_url", "TEXT NULL")
  await addColumnIfMissing("tochukwu_learning_lessons", "captions_languages_json", "TEXT NULL")
  await addColumnIfMissing("tochukwu_learning_lessons", "audio_description_text", "LONGTEXT NULL")
  await addColumnIfMissing("tochukwu_learning_lessons", "sign_language_video_url", "TEXT NULL")
  await addColumnIfMissing("tochukwu_learning_lessons", "accessibility_status", "VARCHAR(32) NOT NULL DEFAULT 'draft'")
  await addColumnIfMissing("tochukwu_public_video_slots", "page_label", "VARCHAR(120) NOT NULL DEFAULT ''")
  await addColumnIfMissing("tochukwu_public_video_slots", "headline", "VARCHAR(220) NULL")
  await addColumnIfMissing("tochukwu_public_video_slots", "description", "TEXT NULL")

  for (const slot of PUBLIC_VIDEO_SLOTS) {
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO tochukwu_public_video_slots (slot_key, slot_label, page_label, is_active, created_at, updated_at)
        VALUES (?, ?, ?, 1, NOW(), NOW())
        ON DUPLICATE KEY UPDATE slot_label = VALUES(slot_label), page_label = VALUES(page_label), updated_at = updated_at
      `,
      slot.key,
      slot.label,
      slot.page
    )
  }
}

export async function listVideoLibrary() {
  await ensureVideoLibraryTables()
  const [courses, modules, lessons, videos, batches, moduleDripSchedules, publicVideoSlots] = await Promise.all([
    prisma.$queryRaw<Array<{
      id: bigint
      courseSlug: string
      courseTitle: string
      courseDescription: string | null
      enrollmentMode: string | null
      priceNgnMinor: number | bigint | null
      priceGbpMinor: number | bigint | null
      priceUsdMinor: number | bigint | null
      priceEurMinor: number | bigint | null
      schoolAdvancedDiscountNgnMinor: number | bigint | null
      schoolAdvancedDiscountGbpMinor: number | bigint | null
      schoolAdvancedDiscountUsdMinor: number | bigint | null
      schoolAdvancedDiscountEurMinor: number | bigint | null
      paymentMethods: string | null
      isPublished: number | bigint | boolean
      isEnrollmentLocked: number | bigint | boolean
      releaseAt: Date | null
      updatedAt: Date | null
    }>>`
      SELECT id, course_slug AS courseSlug, course_title AS courseTitle, course_description AS courseDescription,
        enrollment_mode AS enrollmentMode, price_ngn_minor AS priceNgnMinor, price_gbp_minor AS priceGbpMinor,
        price_usd_minor AS priceUsdMinor, price_eur_minor AS priceEurMinor,
        school_advanced_discount_ngn_minor AS schoolAdvancedDiscountNgnMinor,
        school_advanced_discount_gbp_minor AS schoolAdvancedDiscountGbpMinor,
        school_advanced_discount_usd_minor AS schoolAdvancedDiscountUsdMinor,
        school_advanced_discount_eur_minor AS schoolAdvancedDiscountEurMinor,
        payment_methods AS paymentMethods,
        is_published AS isPublished, is_enrollment_locked AS isEnrollmentLocked, release_at AS releaseAt, updated_at AS updatedAt
      FROM tochukwu_learning_courses
      WHERE NOT EXISTS (
        SELECT 1
        FROM tochukwu_learning_modules lm
        WHERE lm.module_slug COLLATE utf8mb4_unicode_ci = tochukwu_learning_courses.course_slug COLLATE utf8mb4_unicode_ci
           OR lm.module_title COLLATE utf8mb4_unicode_ci = tochukwu_learning_courses.course_title COLLATE utf8mb4_unicode_ci
      )
      AND tochukwu_learning_courses.course_slug NOT REGEXP ${dayLevelCourseSlugRegex}
      AND (
        tochukwu_learning_courses.course_slug IN (${configuredLearningCourseSlugSql()})
        OR EXISTS (
          SELECT 1
          FROM course_batches cb
          WHERE cb.course_slug COLLATE utf8mb4_unicode_ci = tochukwu_learning_courses.course_slug COLLATE utf8mb4_unicode_ci
        )
      )
      ORDER BY updated_at DESC
    `,
    prisma.$queryRaw<Array<{
      id: bigint
      courseSlug: string
      moduleSlug: string
      moduleTitle: string
      moduleDescription: string | null
      sortOrder: number | bigint
      isActive: number | bigint | boolean
      dripEnabled: number | bigint | boolean
      dripAt: Date | null
      dripBatchKey: string | null
      lessonCount: number | bigint
      activeLessonCount: number | bigint
      missingCaptionsCount: number | bigint
      missingTranscriptCount: number | bigint
      updatedAt: Date | null
    }>>`
      SELECT m.id, cm.course_slug AS courseSlug, m.module_slug AS moduleSlug, m.module_title AS moduleTitle,
        m.module_description AS moduleDescription, cm.sort_order AS sortOrder, cm.is_active AS isActive,
        cm.drip_enabled AS dripEnabled, cm.drip_at AS dripAt, cm.drip_batch_key AS dripBatchKey,
        COALESCE(x.lessonCount, 0) AS lessonCount,
        COALESCE(x.activeLessonCount, 0) AS activeLessonCount,
        COALESCE(x.missingCaptionsCount, 0) AS missingCaptionsCount,
        COALESCE(x.missingTranscriptCount, 0) AS missingTranscriptCount,
        m.updated_at AS updatedAt
      FROM tochukwu_learning_course_modules cm
      JOIN tochukwu_learning_modules m ON m.id = cm.module_id
      LEFT JOIN (
        SELECT module_id,
          COUNT(*) AS lessonCount,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS activeLessonCount,
          SUM(CASE WHEN is_active = 1 AND COALESCE(TRIM(captions_vtt_url), '') = '' THEN 1 ELSE 0 END) AS missingCaptionsCount,
          SUM(CASE WHEN is_active = 1 AND COALESCE(TRIM(transcript_text), '') = '' THEN 1 ELSE 0 END) AS missingTranscriptCount
        FROM tochukwu_learning_lessons
        GROUP BY module_id
      ) x ON x.module_id = m.id
      ORDER BY cm.course_slug ASC, cm.sort_order ASC, cm.id ASC
    `,
    prisma.$queryRaw<Array<{
      id: bigint
      moduleId: bigint
      lessonSlug: string
      lessonTitle: string
      lessonOrder: number | bigint
      videoAssetId: bigint | null
      lessonNotes: string | null
      transcriptText: string | null
      captionsVttUrl: string | null
      captionsLanguagesJson: string | null
      audioDescriptionText: string | null
      signLanguageVideoUrl: string | null
      accessibilityStatus: string | null
      isActive: number | bigint | boolean
      videoUid: string | null
      filename: string | null
    }>>`
      SELECT l.id, l.module_id AS moduleId, l.lesson_slug AS lessonSlug, l.lesson_title AS lessonTitle,
        l.lesson_order AS lessonOrder, l.video_asset_id AS videoAssetId, l.lesson_notes AS lessonNotes,
        l.transcript_text AS transcriptText, l.captions_vtt_url AS captionsVttUrl, l.captions_languages_json AS captionsLanguagesJson,
        l.audio_description_text AS audioDescriptionText, l.sign_language_video_url AS signLanguageVideoUrl,
        l.accessibility_status AS accessibilityStatus,
        l.is_active AS isActive, a.video_uid AS videoUid, a.filename
      FROM tochukwu_learning_lessons l
      LEFT JOIN tochukwu_learning_video_assets a ON a.id = l.video_asset_id
      ORDER BY l.module_id ASC, l.lesson_order ASC, l.id ASC
    `,
    prisma.$queryRaw<Array<{
      id: bigint
      videoUid: string
      filename: string | null
      readyToStream: number | bigint | boolean
      durationSeconds: number | string | null
      sourceDeletedAt: Date | null
      updatedAt: Date | null
    }>>`
      SELECT id, video_uid AS videoUid, filename, ready_to_stream AS readyToStream,
        duration_seconds AS durationSeconds, source_deleted_at AS sourceDeletedAt, updated_at AS updatedAt
      FROM tochukwu_learning_video_assets
      ORDER BY updated_at DESC
      LIMIT 300
    `,
    prisma.$queryRaw<Array<{
      courseSlug: string
      batchKey: string
      batchLabel: string | null
      status: string | null
      isActive: number | bigint | boolean | null
      paystackReferencePrefix: string | null
      paystackAmountMinor: number | bigint | null
      paypalAmountMinor: number | bigint | null
      brevoListId: string | null
      seatLimit: number | bigint | null
      batchStartAt: Date | null
    }>>`
      SELECT course_slug AS courseSlug, batch_key AS batchKey, batch_label AS batchLabel,
        status, is_active AS isActive, paystack_reference_prefix AS paystackReferencePrefix,
        paystack_amount_minor AS paystackAmountMinor, paypal_amount_minor AS paypalAmountMinor,
        brevo_list_id AS brevoListId, seat_limit AS seatLimit, batch_start_at AS batchStartAt
      FROM course_batches
      WHERE COALESCE(TRIM(course_slug), '') <> ''
        AND COALESCE(TRIM(batch_key), '') <> ''
      ORDER BY course_slug ASC, is_active DESC, batch_start_at IS NULL ASC, batch_start_at ASC, batch_label ASC
    `.catch(() => []),
    prisma.$queryRaw<Array<{
      moduleId: bigint
      batchKey: string
      accessMode: string
      dripAt: Date | null
    }>>`
      SELECT module_id AS moduleId, batch_key AS batchKey, access_mode AS accessMode, drip_at AS dripAt
      FROM tochukwu_learning_module_batch_drips
      ORDER BY module_id ASC, batch_key ASC
    `.catch(() => [])
    ,
    prisma.$queryRaw<Array<{
      slotKey: string
      slotLabel: string
      pageLabel: string
      videoAssetId: bigint | null
      headline: string | null
      description: string | null
      isActive: number | bigint | boolean
      videoUid: string | null
      filename: string | null
      readyToStream: number | bigint | boolean | null
      sourceDeletedAt: Date | null
    }>>`
      SELECT s.slot_key AS slotKey, s.slot_label AS slotLabel, s.page_label AS pageLabel,
        s.video_asset_id AS videoAssetId, s.headline, s.description, s.is_active AS isActive,
        a.video_uid AS videoUid, a.filename, a.ready_to_stream AS readyToStream, a.source_deleted_at AS sourceDeletedAt
      FROM tochukwu_public_video_slots s
      LEFT JOIN tochukwu_learning_video_assets a ON a.id = s.video_asset_id
      ORDER BY CASE s.slot_key
        WHEN 'home-introduction' THEN 1
        WHEN 'prompt-to-profit-basic-intro' THEN 2
        WHEN 'prompt-to-profit-advanced-intro' THEN 3
        WHEN 'about-academy-story' THEN 4
        ELSE 99
      END, s.slot_label ASC
    `.catch(() => [])
  ])
  return { courses, modules, lessons, videos, batches, moduleDripSchedules, publicVideoSlots }
}

export async function savePublicVideoSlot(input: {
  slotKey: string
  videoAssetId?: string
  headline?: string
  description?: string
  isActive?: boolean
}) {
  await ensureVideoLibraryTables()
  const slot = PUBLIC_VIDEO_SLOTS.find((item) => item.key === input.slotKey)
  if (!slot) throw new Error("Unknown public video slot.")

  const videoAssetId = toBigIntId(input.videoAssetId)
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO tochukwu_public_video_slots
        (slot_key, slot_label, page_label, video_asset_id, headline, description, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        slot_label = VALUES(slot_label),
        page_label = VALUES(page_label),
        video_asset_id = VALUES(video_asset_id),
        headline = VALUES(headline),
        description = VALUES(description),
        is_active = VALUES(is_active),
        updated_at = NOW()
    `,
    slot.key,
    slot.label,
    slot.page,
    videoAssetId > BigInt(0) ? videoAssetId : null,
    clean(input.headline, 220) || null,
    clean(input.description, 1200) || null,
    input.isActive === false ? 0 : 1
  )
}

export async function saveVideoLibraryCourse(input: {
  courseSlug: string
  courseTitle: string
  courseDescription?: string
  enrollmentMode?: string
  priceNgn?: string
  priceGbp?: string
  priceUsd?: string
  priceEur?: string
  schoolAdvancedDiscountNgn?: string
  schoolAdvancedDiscountGbp?: string
  schoolAdvancedDiscountUsd?: string
  schoolAdvancedDiscountEur?: string
  paymentMethods?: string[]
  isPublished?: boolean
  isEnrollmentLocked?: boolean
  releaseAt?: string
}) {
  await ensureVideoLibraryTables()
  const courseSlug = slugify(input.courseSlug, "course").slice(0, 120)
  const courseTitle = clean(input.courseTitle, 220)
  if (!courseSlug || !courseTitle) throw new Error("Course slug and title are required.")
  const paymentMethods = (Array.isArray(input.paymentMethods) ? input.paymentMethods : [])
    .map((method) => clean(method, 40).toLowerCase())
    .filter((method) => ["paystack", "stripe", "manual_transfer"].includes(method))
    .filter((method, index, arr) => arr.indexOf(method) === index)
    .join(",")
  const now = new Date()
  await prisma.$executeRaw`
    INSERT INTO tochukwu_learning_courses
      (course_slug, course_title, course_description, enrollment_mode, price_ngn_minor, price_gbp_minor, price_usd_minor, price_eur_minor,
       school_advanced_discount_ngn_minor, school_advanced_discount_gbp_minor, school_advanced_discount_usd_minor, school_advanced_discount_eur_minor,
       payment_methods, is_published, is_enrollment_locked, release_at, created_at, updated_at)
    VALUES
      (${courseSlug}, ${courseTitle}, ${clean(input.courseDescription, 4000) || null}, ${input.enrollmentMode === "immediate" ? "immediate" : "batch"},
       ${toMinor(input.priceNgn)}, ${toMinor(input.priceGbp)}, ${toMinor(input.priceUsd)}, ${toMinor(input.priceEur)},
       ${toMinor(input.schoolAdvancedDiscountNgn)}, ${toMinor(input.schoolAdvancedDiscountGbp)}, ${toMinor(input.schoolAdvancedDiscountUsd)}, ${toMinor(input.schoolAdvancedDiscountEur)},
       ${paymentMethods || null}, ${input.isPublished ? 1 : 0}, ${input.isEnrollmentLocked ? 1 : 0}, ${toDate(input.releaseAt)}, ${now}, ${now})
    ON DUPLICATE KEY UPDATE
      course_title = VALUES(course_title),
      course_description = VALUES(course_description),
      enrollment_mode = VALUES(enrollment_mode),
      price_ngn_minor = VALUES(price_ngn_minor),
      price_gbp_minor = VALUES(price_gbp_minor),
      price_usd_minor = VALUES(price_usd_minor),
      price_eur_minor = VALUES(price_eur_minor),
      school_advanced_discount_ngn_minor = VALUES(school_advanced_discount_ngn_minor),
      school_advanced_discount_gbp_minor = VALUES(school_advanced_discount_gbp_minor),
      school_advanced_discount_usd_minor = VALUES(school_advanced_discount_usd_minor),
      school_advanced_discount_eur_minor = VALUES(school_advanced_discount_eur_minor),
      payment_methods = VALUES(payment_methods),
      is_published = VALUES(is_published),
      is_enrollment_locked = VALUES(is_enrollment_locked),
      release_at = VALUES(release_at),
      updated_at = VALUES(updated_at)
  `
  if (input.enrollmentMode !== "immediate") {
    const existing = await prisma.$queryRaw<Array<{ batchKey: string; isActive: number | bigint | boolean | null }>>`
      SELECT batch_key AS batchKey, is_active AS isActive
      FROM course_batches
      WHERE course_slug = ${courseSlug}
      ORDER BY created_at ASC
    `.catch(() => [])
    if (!existing.length) {
      await saveCourseBatch({
        courseSlug,
        batchLabel: "Batch 1",
        batchKey: "batch-1",
        status: "open",
        paystackReferencePrefix: prefixFromSlug(courseSlug),
        paystackAmountMinor: String(toMinor(input.priceNgn) || 0),
        paypalAmountMinor: String(toMinor(input.priceGbp) || 2400),
        activate: true
      })
    } else if (!existing.some((row) => Number(row.isActive || 0) === 1)) {
      await activateCourseBatch(courseSlug, existing[0].batchKey)
    }
  }
}

export async function saveCourseBatch(input: {
  courseSlug: string
  batchKey?: string
  originalBatchKey?: string
  batchLabel: string
  status?: string
  paystackReferencePrefix?: string
  paystackAmountMinor?: string
  paypalAmountMinor?: string
  brevoListId?: string
  seatLimit?: string
  batchStartAt?: string
  activate?: boolean
}) {
  await ensureVideoLibraryTables()
  const courseSlug = slugify(input.courseSlug, "course").slice(0, 120)
  const originalBatchKey = normalizeBatchKey(input.originalBatchKey)
  const batchLabel = clean(input.batchLabel, 120)
  const batchKey = normalizeBatchKey(input.batchKey || batchLabel)
  const paystackAmountMinor = toMinorUnit(input.paystackAmountMinor)
  const paypalAmountMinor = toMinorUnit(input.paypalAmountMinor) || 2400
  if (!courseSlug || !batchLabel || !batchKey) throw new Error("Course, batch label, and batch key are required.")
  if (!paystackAmountMinor || paystackAmountMinor <= 0) throw new Error("Valid Paystack amount in minor units is required.")
  const now = new Date()
  const status = clean(input.status, 32).toLowerCase() === "open" ? "open" : "closed"
  const seatLimit = toInt(input.seatLimit, 0) > 0 ? toInt(input.seatLimit, 0) : null
  const batchStartAt = toDate(input.batchStartAt)
  if (originalBatchKey) {
    await prisma.$executeRaw`
      UPDATE course_batches
      SET batch_key = ${batchKey},
          batch_label = ${batchLabel},
          status = ${status},
          paystack_reference_prefix = ${normalizePrefix(input.paystackReferencePrefix || prefixFromSlug(courseSlug))},
          paystack_amount_minor = ${paystackAmountMinor},
          paypal_amount_minor = ${paypalAmountMinor},
          brevo_list_id = ${clean(input.brevoListId, 64) || null},
          seat_limit = ${seatLimit},
          batch_start_at = ${batchStartAt},
          updated_at = ${now}
      WHERE course_slug = ${courseSlug}
        AND batch_key = ${originalBatchKey}
      LIMIT 1
    `
  } else {
    await prisma.$executeRaw`
      INSERT INTO course_batches
        (course_slug, batch_key, batch_label, status, is_active, paystack_reference_prefix, paystack_amount_minor, paypal_amount_minor, brevo_list_id, seat_limit, batch_start_at, activated_at, created_at, updated_at)
      VALUES
        (${courseSlug}, ${batchKey}, ${batchLabel}, ${status}, 0, ${normalizePrefix(input.paystackReferencePrefix || prefixFromSlug(courseSlug))},
         ${paystackAmountMinor}, ${paypalAmountMinor}, ${clean(input.brevoListId, 64) || null}, ${seatLimit}, ${batchStartAt}, NULL, ${now}, ${now})
      ON DUPLICATE KEY UPDATE
        batch_label = VALUES(batch_label),
        status = VALUES(status),
        paystack_reference_prefix = VALUES(paystack_reference_prefix),
        paystack_amount_minor = VALUES(paystack_amount_minor),
        paypal_amount_minor = VALUES(paypal_amount_minor),
        brevo_list_id = VALUES(brevo_list_id),
        seat_limit = VALUES(seat_limit),
        batch_start_at = VALUES(batch_start_at),
        updated_at = VALUES(updated_at)
    `
  }
  if (input.activate) await activateCourseBatch(courseSlug, batchKey)
}

export async function activateCourseBatch(courseSlugInput: string, batchKeyInput: string) {
  await ensureVideoLibraryTables()
  const courseSlug = slugify(courseSlugInput, "course").slice(0, 120)
  const batchKey = normalizeBatchKey(batchKeyInput)
  if (!courseSlug || !batchKey) throw new Error("Course and batch key are required.")
  const now = new Date()
  const rows = await prisma.$queryRaw<Array<{ batchStartAt: Date | null }>>`
    SELECT batch_start_at AS batchStartAt
    FROM course_batches
    WHERE course_slug = ${courseSlug}
      AND batch_key = ${batchKey}
    LIMIT 1
  `
  if (!rows.length) throw new Error("Batch not found.")
  await prisma.$executeRaw`UPDATE course_batches SET is_active = 0, updated_at = ${now} WHERE course_slug = ${courseSlug}`
  await prisma.$executeRaw`
    UPDATE course_batches
    SET is_active = 1, status = 'open', activated_at = ${now}, updated_at = ${now}
    WHERE course_slug = ${courseSlug}
      AND batch_key = ${batchKey}
    LIMIT 1
  `
}

export async function deleteCourseBatch(courseSlugInput: string, batchKeyInput: string) {
  await ensureVideoLibraryTables()
  const courseSlug = slugify(courseSlugInput, "course").slice(0, 120)
  const batchKey = normalizeBatchKey(batchKeyInput)
  if (!courseSlug || !batchKey) throw new Error("Course and batch key are required.")
  const rows = await prisma.$queryRaw<Array<{ isActive: number | bigint | boolean | null }>>`
    SELECT is_active AS isActive
    FROM course_batches
    WHERE course_slug = ${courseSlug}
      AND batch_key = ${batchKey}
    LIMIT 1
  `
  if (!rows.length) throw new Error("Batch not found.")
  if (Number(rows[0].isActive || 0) === 1) throw new Error("Cannot delete the active batch. Activate another batch first.")
  const [orders, manualPayments, drips] = await Promise.all([
    prisma.$queryRaw<Array<{ total: bigint }>>`SELECT COUNT(*) AS total FROM course_orders WHERE course_slug = ${courseSlug} AND batch_key = ${batchKey}`.catch(() => [{ total: BigInt(0) }]),
    prisma.$queryRaw<Array<{ total: bigint }>>`SELECT COUNT(*) AS total FROM course_manual_payments WHERE course_slug = ${courseSlug} AND batch_key = ${batchKey}`.catch(() => [{ total: BigInt(0) }]),
    prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*) AS total
      FROM tochukwu_learning_module_batch_drips d
      INNER JOIN tochukwu_learning_course_modules cm ON cm.module_id = d.module_id
      WHERE cm.course_slug = ${courseSlug}
        AND d.batch_key = ${batchKey}
    `.catch(() => [{ total: BigInt(0) }])
  ])
  if (Number(orders[0]?.total || 0) > 0) throw new Error("Cannot delete batch with existing course orders.")
  if (Number(manualPayments[0]?.total || 0) > 0) throw new Error("Cannot delete batch with existing manual payments.")
  if (Number(drips[0]?.total || 0) > 0) throw new Error("Cannot delete batch while module drip rules still reference it.")
  await prisma.$executeRaw`
    DELETE FROM course_batches
    WHERE course_slug = ${courseSlug}
      AND batch_key = ${batchKey}
    LIMIT 1
  `
}

async function upsertCourseModuleMapping(input: {
  moduleId: bigint
  courseSlug: string
  sortOrder: number
  isActive: boolean
  dripEnabled: boolean
  primaryBatchKey: string | null
  primaryDripAt: Date | null
  dripOffsetSeconds?: number | null
}) {
  const now = new Date()
  await prisma.$executeRaw`
    INSERT INTO tochukwu_learning_course_modules
      (course_slug, module_id, sort_order, is_active, drip_enabled, drip_at, drip_batch_key, drip_offset_seconds, drip_notified_at, created_at, updated_at)
    VALUES
      (${input.courseSlug}, ${input.moduleId}, ${input.sortOrder}, ${input.isActive ? 1 : 0}, ${input.dripEnabled ? 1 : 0},
       ${input.primaryDripAt}, ${input.primaryBatchKey}, ${input.dripOffsetSeconds ?? null}, NULL, ${now}, ${now})
    ON DUPLICATE KEY UPDATE
      sort_order = VALUES(sort_order),
      is_active = VALUES(is_active),
      drip_enabled = VALUES(drip_enabled),
      drip_at = VALUES(drip_at),
      drip_batch_key = VALUES(drip_batch_key),
      drip_offset_seconds = VALUES(drip_offset_seconds),
      updated_at = VALUES(updated_at)
  `
}

async function replaceModuleBatchDrips(moduleId: bigint, schedules: Array<{ batchKey: string; accessMode: "immediate" | "drip"; dripAt: Date | null }>) {
  await prisma.$executeRaw`DELETE FROM tochukwu_learning_module_batch_drips WHERE module_id = ${moduleId}`
  const now = new Date()
  for (const row of schedules) {
    await prisma.$executeRaw`
      INSERT INTO tochukwu_learning_module_batch_drips
        (module_id, batch_key, access_mode, drip_at, created_at, updated_at)
      VALUES
        (${moduleId}, ${row.batchKey}, ${row.accessMode}, ${row.dripAt || new Date(0)}, ${now}, ${now})
      ON DUPLICATE KEY UPDATE
        access_mode = VALUES(access_mode),
        drip_at = VALUES(drip_at),
        updated_at = VALUES(updated_at)
    `
  }
}

async function listCourseBatchKeys(courseSlug: string) {
  const rows = await prisma.$queryRaw<Array<{ batchKey: string | null }>>`
    SELECT batch_key AS batchKey
    FROM course_batches
    WHERE course_slug = ${courseSlug}
  `.catch(() => [])
  return rows.map((row) => normalizeBatchKey(row.batchKey)).filter(Boolean)
}

async function resolveCourseDripAnchor(courseSlug: string) {
  const rows = await prisma.$queryRaw<Array<{ anchorStartAt: Date | null }>>`
    SELECT COALESCE(
      MAX(CASE WHEN is_active = 1 THEN batch_start_at ELSE NULL END),
      MIN(batch_start_at)
    ) AS anchorStartAt
    FROM course_batches
    WHERE course_slug = ${courseSlug}
      AND batch_start_at IS NOT NULL
  `.catch(() => [])
  return rows[0]?.anchorStartAt || null
}

async function findModuleId(courseSlug: string, moduleSlug: string) {
  const rows = await prisma.$queryRaw<Array<{ id: bigint }>>`
    SELECT id
    FROM tochukwu_learning_modules
    WHERE course_slug = ${courseSlug}
      AND module_slug = ${moduleSlug}
    ORDER BY id ASC
    LIMIT 1
  `
  return rows[0]?.id || BigInt(0)
}

async function findModuleIdByTitle(courseSlug: string, moduleTitle: string) {
  const rows = await prisma.$queryRaw<Array<{ id: bigint }>>`
    SELECT id
    FROM tochukwu_learning_modules
    WHERE course_slug = ${courseSlug}
      AND module_title = ${moduleTitle}
    ORDER BY id ASC
    LIMIT 1
  `
  return rows[0]?.id || BigInt(0)
}

export async function cloneVideoLibraryModule(input: {
  sourceModuleId: string
  targetCourseSlug: string
  forceDuplicate?: boolean
}) {
  await ensureVideoLibraryTables()
  const sourceModuleId = toBigIntId(input.sourceModuleId)
  const targetCourseSlug = slugify(input.targetCourseSlug, "course").slice(0, 120)
  if (sourceModuleId <= BigInt(0) || !targetCourseSlug) throw new Error("Source module and target course are required.")
  const sourceRows = await prisma.$queryRaw<Array<{
    id: bigint
    moduleSlug: string
    moduleTitle: string
    moduleDescription: string | null
    sortOrder: number | bigint
    isActive: number | bigint | boolean
    dripEnabled: number | bigint | boolean
    dripAt: Date | null
    dripBatchKey: string | null
  }>>`
    SELECT id, module_slug AS moduleSlug, module_title AS moduleTitle, module_description AS moduleDescription,
      sort_order AS sortOrder, is_active AS isActive, drip_enabled AS dripEnabled, drip_at AS dripAt, drip_batch_key AS dripBatchKey
    FROM tochukwu_learning_modules
    WHERE id = ${sourceModuleId}
    LIMIT 1
  `
  const source = sourceRows[0]
  if (!source) throw new Error("Source module not found.")
  const courseRows = await prisma.$queryRaw<Array<{ courseSlug: string }>>`
    SELECT course_slug AS courseSlug
    FROM tochukwu_learning_courses
    WHERE course_slug = ${targetCourseSlug}
      AND NOT EXISTS (
        SELECT 1
        FROM tochukwu_learning_modules lm
        WHERE lm.module_slug COLLATE utf8mb4_unicode_ci = tochukwu_learning_courses.course_slug COLLATE utf8mb4_unicode_ci
           OR lm.module_title COLLATE utf8mb4_unicode_ci = tochukwu_learning_courses.course_title COLLATE utf8mb4_unicode_ci
      )
      AND tochukwu_learning_courses.course_slug NOT REGEXP ${dayLevelCourseSlugRegex}
      AND (
        tochukwu_learning_courses.course_slug IN (${configuredLearningCourseSlugSql()})
        OR EXISTS (
          SELECT 1
          FROM course_batches cb
          WHERE cb.course_slug COLLATE utf8mb4_unicode_ci = tochukwu_learning_courses.course_slug COLLATE utf8mb4_unicode_ci
        )
      )
    LIMIT 1
  `
  if (!courseRows.length) throw new Error("Target course does not exist.")
  if (!input.forceDuplicate) {
    const existingMap = await prisma.$queryRaw<Array<{ id: bigint }>>`
      SELECT id
      FROM tochukwu_learning_course_modules
      WHERE course_slug = ${targetCourseSlug}
        AND module_id = ${sourceModuleId}
      LIMIT 1
    `.catch(() => [])
    if (existingMap.length) return { linkedExistingModule: true, copiedLessons: 0, alreadyMapped: true }

    const existingTitleModuleId = await findModuleIdByTitle(targetCourseSlug, source.moduleTitle)
    if (existingTitleModuleId > BigInt(0)) {
      await upsertCourseModuleMapping({
        moduleId: existingTitleModuleId,
        courseSlug: targetCourseSlug,
        sortOrder: Number(source.sortOrder || 0),
        isActive: Number(source.isActive || 0) !== 0,
        dripEnabled: Number(source.dripEnabled || 0) === 1,
        primaryBatchKey: source.dripBatchKey,
        primaryDripAt: source.dripAt
      })
      return { linkedExistingModule: true, copiedLessons: 0, matchedExistingTitle: true }
    }

    await upsertCourseModuleMapping({
      moduleId: sourceModuleId,
      courseSlug: targetCourseSlug,
      sortOrder: Number(source.sortOrder || 0),
      isActive: Number(source.isActive || 0) !== 0,
      dripEnabled: Number(source.dripEnabled || 0) === 1,
      primaryBatchKey: source.dripBatchKey,
      primaryDripAt: source.dripAt
    })
    return { linkedExistingModule: true, copiedLessons: 0 }
  }

  const baseTitle = clean(source.moduleTitle, 200) || "Module"
  let moduleTitle = baseTitle
  for (let attempt = 2; attempt < 250; attempt += 1) {
    const exists = await findModuleIdByTitle(targetCourseSlug, moduleTitle)
    if (exists <= BigInt(0)) break
    moduleTitle = `${baseTitle} (${attempt})`.slice(0, 220)
  }
  const baseSlug = slugify(source.moduleSlug || source.moduleTitle, "module").slice(0, 145)
  let moduleSlug = baseSlug
  for (let attempt = 2; attempt < 250; attempt += 1) {
    const exists = await findModuleId(targetCourseSlug, moduleSlug)
    if (exists <= BigInt(0)) break
    moduleSlug = `${baseSlug}-${attempt}`.slice(0, 160)
  }
  const now = new Date()
  await prisma.$executeRaw`
    INSERT INTO tochukwu_learning_modules
      (course_slug, module_slug, module_title, module_description, sort_order, is_active, drip_enabled, drip_at, drip_batch_key, drip_offset_seconds, created_at, updated_at)
    VALUES
      (${targetCourseSlug}, ${moduleSlug}, ${moduleTitle}, ${source.moduleDescription}, ${Number(source.sortOrder || 0)}, ${Number(source.isActive || 0) === 0 ? 0 : 1},
       ${Number(source.dripEnabled || 0) === 1 ? 1 : 0}, ${source.dripAt}, ${source.dripBatchKey}, NULL, ${now}, ${now})
  `
  const newModuleId = await findModuleId(targetCourseSlug, moduleSlug)
  if (newModuleId <= BigInt(0)) throw new Error("Could not clone module.")
  await upsertCourseModuleMapping({
    moduleId: newModuleId,
    courseSlug: targetCourseSlug,
    sortOrder: Number(source.sortOrder || 0),
    isActive: Number(source.isActive || 0) !== 0,
    dripEnabled: Number(source.dripEnabled || 0) === 1,
    primaryBatchKey: source.dripBatchKey,
    primaryDripAt: source.dripAt
  })
  const [sourceLessons, sourceSchedules] = await Promise.all([
    prisma.$queryRaw<Array<{
      lessonSlug: string
      lessonTitle: string
      lessonOrder: number | bigint
      videoAssetId: bigint | null
      lessonNotes: string | null
      captionsVttUrl: string | null
      captionsLanguagesJson: string | null
      transcriptText: string | null
      audioDescriptionText: string | null
      signLanguageVideoUrl: string | null
      accessibilityStatus: string | null
      isActive: number | bigint | boolean
    }>>`
      SELECT lesson_slug AS lessonSlug, lesson_title AS lessonTitle, lesson_order AS lessonOrder, video_asset_id AS videoAssetId,
        lesson_notes AS lessonNotes, captions_vtt_url AS captionsVttUrl, captions_languages_json AS captionsLanguagesJson,
        transcript_text AS transcriptText, audio_description_text AS audioDescriptionText, sign_language_video_url AS signLanguageVideoUrl,
        accessibility_status AS accessibilityStatus, is_active AS isActive
      FROM tochukwu_learning_lessons
      WHERE module_id = ${sourceModuleId}
      ORDER BY lesson_order ASC, id ASC
    `,
    prisma.$queryRaw<Array<{ batchKey: string; accessMode: string; dripAt: Date | null }>>`
      SELECT batch_key AS batchKey, access_mode AS accessMode, drip_at AS dripAt
      FROM tochukwu_learning_module_batch_drips
      WHERE module_id = ${sourceModuleId}
      ORDER BY batch_key ASC
    `.catch(() => [])
  ])
  for (const lesson of sourceLessons) {
    await saveVideoLibraryLesson({
      moduleId: String(newModuleId),
      lessonSlug: lesson.lessonSlug,
      lessonTitle: lesson.lessonTitle,
      lessonOrder: String(lesson.lessonOrder || 0),
      videoAssetId: lesson.videoAssetId ? String(lesson.videoAssetId) : "",
      lessonNotes: lesson.lessonNotes || "",
      captionsVttUrl: lesson.captionsVttUrl || "",
      captionsLanguagesJson: lesson.captionsLanguagesJson || "",
      transcriptText: lesson.transcriptText || "",
      audioDescriptionText: lesson.audioDescriptionText || "",
      signLanguageVideoUrl: lesson.signLanguageVideoUrl || "",
      accessibilityStatus: lesson.accessibilityStatus || "draft",
      isActive: Number(lesson.isActive || 0) !== 0
    })
  }
  await replaceModuleBatchDrips(newModuleId, normalizeScheduleRows(sourceSchedules.map((row) => ({
    batchKey: row.batchKey,
    accessMode: row.accessMode,
    dripAt: row.dripAt ? row.dripAt.toISOString() : ""
  }))))
  return { linkedExistingModule: false, copiedLessons: sourceLessons.length }
}

export async function detachVideoLibraryModule(input: { moduleId: string; courseSlug: string }) {
  await ensureVideoLibraryTables()
  const moduleId = toBigIntId(input.moduleId)
  const courseSlug = slugify(input.courseSlug, "course").slice(0, 120)
  if (moduleId <= BigInt(0) || !courseSlug) throw new Error("Module and course are required.")
  const moduleRows = await prisma.$queryRaw<Array<{ moduleSlug: string; moduleTitle: string; courseSlug: string }>>`
    SELECT module_slug AS moduleSlug, module_title AS moduleTitle, course_slug AS courseSlug
    FROM tochukwu_learning_modules
    WHERE id = ${moduleId}
    LIMIT 1
  `
  const module = moduleRows[0]
  if (!module) throw new Error("Module not found.")
  const mappingRows = await prisma.$queryRaw<Array<{ id: bigint }>>`
    SELECT id
    FROM tochukwu_learning_course_modules
    WHERE course_slug = ${courseSlug}
      AND module_id = ${moduleId}
    LIMIT 1
  `.catch(() => [])
  if (mappingRows.length) {
    await prisma.$executeRaw`
      DELETE FROM tochukwu_learning_course_modules
      WHERE course_slug = ${courseSlug}
        AND module_id = ${moduleId}
      LIMIT 1
    `
    return
  }
  if (module.courseSlug !== courseSlug) throw new Error("Module is no longer mapped to the selected course.")
  const unassigned = "__unassigned_modules__"
  const baseSlug = slugify(module.moduleSlug || module.moduleTitle, "module").slice(0, 145)
  let nextSlug = baseSlug
  for (let attempt = 2; attempt < 250; attempt += 1) {
    const exists = await findModuleId(unassigned, nextSlug)
    if (exists <= BigInt(0)) break
    nextSlug = `${baseSlug}-${attempt}`.slice(0, 160)
  }
  await prisma.$executeRaw`
    UPDATE tochukwu_learning_modules
    SET course_slug = ${unassigned},
        module_slug = ${nextSlug},
        is_active = 0,
        updated_at = ${new Date()}
    WHERE id = ${moduleId}
    LIMIT 1
  `
}

function parseCsvLine(line: string) {
  const out: string[] = []
  let current = ""
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }
    if (char === "," && !quoted) {
      out.push(current.trim())
      current = ""
      continue
    }
    current += char
  }
  out.push(current.trim())
  return out
}

function stripVttToPlainText(value: string) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^WEBVTT/i.test(line) && !/^\d+$/.test(line) && !/-->/.test(line))
    .map((line) => line.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, 120000)
}

async function fetchTextUrl(url: string) {
  const target = clean(url, 1200)
  if (!target) return ""
  const response = await fetch(target, { headers: { Accept: "text/vtt,text/plain,*/*" } }).catch(() => null)
  if (!response?.ok) return ""
  return clean(await response.text().catch(() => ""), 200000)
}

export async function autofillModuleAccessibility(input: { moduleId: string; includeAudioDescription?: boolean }) {
  await ensureVideoLibraryTables()
  const moduleId = toBigIntId(input.moduleId)
  if (moduleId <= BigInt(0)) throw new Error("Module is required.")
  const lessons = await prisma.$queryRaw<Array<{
    id: bigint
    lessonTitle: string
    captionsVttUrl: string | null
    transcriptText: string | null
    audioDescriptionText: string | null
    videoUid: string | null
  }>>`
    SELECT l.id, l.lesson_title AS lessonTitle, l.captions_vtt_url AS captionsVttUrl,
      l.transcript_text AS transcriptText, l.audio_description_text AS audioDescriptionText,
      a.video_uid AS videoUid
    FROM tochukwu_learning_lessons l
    LEFT JOIN tochukwu_learning_video_assets a ON a.id = l.video_asset_id
    WHERE l.module_id = ${moduleId}
      AND l.is_active = 1
    ORDER BY l.lesson_order ASC, l.id ASC
  `
  let scanned = 0
  let updated = 0
  let skipped = 0
  let blocked = 0
  for (const lesson of lessons) {
    scanned += 1
    const videoUid = clean(lesson.videoUid, 120)
    if (!videoUid) {
      blocked += 1
      continue
    }
    const captionsUrl = lesson.captionsVttUrl || `https://videodelivery.net/${encodeURIComponent(videoUid)}/captions/en.vtt`
    let transcript = lesson.transcriptText || ""
    if (!transcript) {
      const vtt = await fetchTextUrl(captionsUrl)
      transcript = stripVttToPlainText(vtt)
    }
    const ready = Boolean(captionsUrl && transcript)
    if (!captionsUrl && !transcript) {
      skipped += 1
      continue
    }
    await prisma.$executeRaw`
      UPDATE tochukwu_learning_lessons
      SET captions_vtt_url = ${captionsUrl || null},
          captions_languages_json = COALESCE(captions_languages_json, ${JSON.stringify(["en"])}),
          transcript_text = COALESCE(NULLIF(transcript_text, ''), ${transcript || null}),
          audio_description_text = ${input.includeAudioDescription ? (lesson.audioDescriptionText || transcript ? `Audio description notes can be reviewed from the transcript for ${lesson.lessonTitle}.` : null) : lesson.audioDescriptionText},
          accessibility_status = ${ready ? "ready" : "in_progress"},
          updated_at = ${new Date()}
      WHERE id = ${lesson.id}
      LIMIT 1
    `
    updated += 1
  }
  return { scanned, updated, skipped, blocked }
}

function parseCsvTable(csvText: string) {
  const lines = String(csvText || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length < 2) return { headers: [] as string[], rows: [] as Array<Record<string, string>> }
  const headers = parseCsvLine(lines[0]).map((header) => clean(header, 80).toLowerCase())
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    const row: Record<string, string> = {}
    headers.forEach((header, index) => {
      row[header] = values[index] || ""
    })
    return row
  })
  return { headers, rows }
}

function pickCsv(row: Record<string, string>, names: string[]) {
  for (const name of names) {
    const value = row[name]
    if (value !== undefined && String(value).trim()) return String(value).trim()
  }
  return ""
}

export async function importVideoLibraryCsv(csvText: string, apply = false) {
  await ensureVideoLibraryTables()
  const parsed = parseCsvTable(csvText)
  if (!parsed.rows.length) throw new Error("CSV has no data rows.")
  const rows = parsed.rows.map((row, index) => ({
    rowNumber: index + 2,
    courseSlug: slugify(pickCsv(row, ["course_slug", "course", "course-slug"]), ""),
    moduleTitle: clean(pickCsv(row, ["module_title", "module", "module-name"]), 220),
    moduleDescription: clean(pickCsv(row, ["module_description", "module_desc", "description"]), 4000),
    lessonTitle: clean(pickCsv(row, ["lesson_title", "lesson", "lesson-name", "title"]), 220),
    lessonOrder: String(toInt(pickCsv(row, ["lesson_order", "order", "lesson_no", "lesson_number"]) || index + 1, index + 1)),
    videoUid: clean(pickCsv(row, ["video_uid", "video_id", "uid"]), 120),
    filename: clean(pickCsv(row, ["filename", "file_name", "name"]), 320),
    hlsUrl: clean(pickCsv(row, ["hls_url", "hls", "manifest_hls"]), 1200),
    dashUrl: clean(pickCsv(row, ["dash_url", "dash", "manifest_dash"]), 1200),
    captionsVttUrl: clean(pickCsv(row, ["captions_vtt_url", "captions_url", "captions"]), 1200),
    captionsLanguagesJson: clean(pickCsv(row, ["captions_languages_json", "captions_languages", "caption_languages"]), 4000),
    transcriptText: clean(pickCsv(row, ["transcript_text", "transcript"]), 120000),
    audioDescriptionText: clean(pickCsv(row, ["audio_description_text", "audio_description"]), 120000),
    signLanguageVideoUrl: clean(pickCsv(row, ["sign_language_video_url", "sign_language_url"]), 1200),
    accessibilityStatus: clean(pickCsv(row, ["accessibility_status"]), 32).toLowerCase() || "draft"
  }))
  const errors: string[] = []
  for (const row of rows) {
    if (!row.courseSlug) errors.push(`Row ${row.rowNumber}: course_slug is required`)
    if (!row.moduleTitle) errors.push(`Row ${row.rowNumber}: module_title is required`)
    if (!row.lessonTitle) errors.push(`Row ${row.rowNumber}: lesson_title is required`)
  }
  if (!apply) {
    return { applied: false, totalRows: rows.length, errorCount: errors.length, errors: errors.slice(0, 30), sampleRows: rows.slice(0, 12) }
  }
  if (errors.length) throw new Error(`Import has validation errors: ${errors.slice(0, 5).join("; ")}`)
  const knownCourses = await prisma.$queryRaw<Array<{ courseSlug: string }>>`
    SELECT course_slug AS courseSlug
    FROM tochukwu_learning_courses
    WHERE NOT EXISTS (
      SELECT 1
      FROM tochukwu_learning_modules lm
      WHERE lm.module_slug COLLATE utf8mb4_unicode_ci = tochukwu_learning_courses.course_slug COLLATE utf8mb4_unicode_ci
         OR lm.module_title COLLATE utf8mb4_unicode_ci = tochukwu_learning_courses.course_title COLLATE utf8mb4_unicode_ci
    )
    AND tochukwu_learning_courses.course_slug NOT REGEXP ${dayLevelCourseSlugRegex}
    AND (
      tochukwu_learning_courses.course_slug IN (${configuredLearningCourseSlugSql()})
      OR EXISTS (
        SELECT 1
        FROM course_batches cb
        WHERE cb.course_slug COLLATE utf8mb4_unicode_ci = tochukwu_learning_courses.course_slug COLLATE utf8mb4_unicode_ci
      )
    )
  `
  const known = new Set(knownCourses.map((course) => course.courseSlug))
  const unknown = Array.from(new Set(rows.map((row) => row.courseSlug).filter((slug) => !known.has(slug))))
  if (unknown.length) throw new Error(`Create these courses first before import: ${unknown.join(", ")}`)
  let modulesWritten = 0
  let lessonsWritten = 0
  let assetsWritten = 0
  const moduleCache = new Map<string, bigint>()
  for (const row of rows) {
    const key = `${row.courseSlug}::${row.moduleTitle.toLowerCase()}`
    let moduleId = moduleCache.get(key)
    if (!moduleId) {
      await saveVideoLibraryModule({
        courseSlug: row.courseSlug,
        moduleTitle: row.moduleTitle,
        moduleDescription: row.moduleDescription,
        isActive: true
      })
      moduleId = await findModuleId(row.courseSlug, slugify(row.moduleTitle, "module"))
      moduleCache.set(key, moduleId)
      modulesWritten += 1
    }
    let videoAssetId = ""
    if (row.videoUid || row.hlsUrl || row.dashUrl || row.filename) {
      const uid = row.videoUid || row.hlsUrl.match(/\/([a-f0-9]{32}|[a-zA-Z0-9_-]{20,})\//)?.[1] || row.filename
      await prisma.$executeRaw`
        INSERT INTO tochukwu_learning_video_assets
          (provider, video_uid, filename, hls_url, dash_url, ready_to_stream, created_at, updated_at)
        VALUES
          ('cloudflare_stream', ${uid}, ${row.filename || uid}, ${row.hlsUrl || null}, ${row.dashUrl || null}, 1, ${new Date()}, ${new Date()})
        ON DUPLICATE KEY UPDATE
          filename = VALUES(filename),
          hls_url = VALUES(hls_url),
          dash_url = VALUES(dash_url),
          ready_to_stream = VALUES(ready_to_stream),
          updated_at = VALUES(updated_at)
      `
      const asset = await prisma.$queryRaw<Array<{ id: bigint }>>`SELECT id FROM tochukwu_learning_video_assets WHERE video_uid = ${uid} LIMIT 1`
      videoAssetId = asset[0]?.id ? String(asset[0].id) : ""
      assetsWritten += 1
    }
    await saveVideoLibraryLesson({
      moduleId: String(moduleId),
      lessonTitle: row.lessonTitle,
      lessonOrder: row.lessonOrder,
      videoAssetId,
      captionsVttUrl: row.captionsVttUrl,
      captionsLanguagesJson: row.captionsLanguagesJson,
      transcriptText: row.transcriptText,
      audioDescriptionText: row.audioDescriptionText,
      signLanguageVideoUrl: row.signLanguageVideoUrl,
      accessibilityStatus: row.accessibilityStatus,
      isActive: true
    })
    lessonsWritten += 1
  }
  return { applied: true, rowsProcessed: rows.length, modulesWritten, lessonsWritten, assetsWritten }
}

export async function saveVideoLibraryModule(input: {
  moduleId?: string
  courseSlug: string
  moduleSlug?: string
  moduleTitle: string
  moduleDescription?: string
  sortOrder?: string
  isActive?: boolean
  dripEnabled?: boolean
  dripSchedules?: Array<{ batchKey?: string; batch_key?: string; accessMode?: string; access_mode?: string; dripAt?: string; drip_at?: string }>
}) {
  await ensureVideoLibraryTables()
  const moduleId = toBigIntId(input.moduleId)
  const courseSlug = slugify(input.courseSlug, "course").slice(0, 120)
  const moduleTitle = clean(input.moduleTitle, 220)
  const moduleSlug = slugify(input.moduleSlug || moduleTitle, "module").slice(0, 160)
  const sortOrder = toInt(input.sortOrder, 0)
  const isActive = input.isActive !== false
  const schedules = normalizeScheduleRows(input.dripSchedules)
  if (Boolean(input.dripEnabled) && hasInvalidScheduleRows(input.dripSchedules)) {
    throw new Error("Set a valid drip date/time for every selected batch that is not marked Immediate access.")
  }
  const courseRows = await prisma.$queryRaw<Array<{ enrollmentMode: string | null }>>`
    SELECT enrollment_mode AS enrollmentMode
    FROM tochukwu_learning_courses
    WHERE course_slug = ${courseSlug}
    LIMIT 1
  `
  if (!courseRows.length) throw new Error("Create this course first before adding modules.")
  const immediateCourse = clean(courseRows[0]?.enrollmentMode, 24).toLowerCase() === "immediate"
  const batchKeys = await listCourseBatchKeys(courseSlug)
  if (!immediateCourse && Boolean(input.dripEnabled) && batchKeys.length && !schedules.length) {
    throw new Error("Add at least one batch access rule when batch access control is enabled.")
  }
  if (!immediateCourse && Boolean(input.dripEnabled) && schedules.some((row) => batchKeys.length && !batchKeys.includes(row.batchKey))) {
    throw new Error("One or more drip batches are invalid for this course.")
  }
  const dripEnabled = !immediateCourse && Boolean(input.dripEnabled) && schedules.length > 0
  const primaryDrip = schedules.find((row) => row.accessMode === "drip" && row.dripAt) || null
  const primaryBatchKey = dripEnabled ? (primaryDrip?.batchKey || schedules[0]?.batchKey || null) : null
  const primaryDripAt = dripEnabled ? (primaryDrip?.dripAt || null) : null
  const anchorStartAt = dripEnabled && primaryDripAt ? await resolveCourseDripAnchor(courseSlug) : null
  const dripOffsetSeconds = anchorStartAt && primaryDripAt
    ? Math.round((primaryDripAt.getTime() - anchorStartAt.getTime()) / 1000)
    : null
  const now = new Date()
  if (!courseSlug || !moduleTitle) throw new Error("Course and module title are required.")
  if (moduleId > BigInt(0)) {
    await prisma.$executeRaw`
      UPDATE tochukwu_learning_modules
      SET course_slug = ${courseSlug}, module_slug = ${moduleSlug}, module_title = ${moduleTitle},
          module_description = ${sanitizeRichNotes(input.moduleDescription) || null}, sort_order = ${sortOrder},
          is_active = ${isActive ? 1 : 0}, drip_enabled = ${dripEnabled ? 1 : 0},
          drip_at = ${primaryDripAt}, drip_batch_key = ${primaryBatchKey}, drip_offset_seconds = ${dripOffsetSeconds},
          updated_at = ${now}
      WHERE id = ${moduleId}
      LIMIT 1
    `
    await upsertCourseModuleMapping({ moduleId, courseSlug, sortOrder, isActive, dripEnabled, primaryBatchKey, primaryDripAt, dripOffsetSeconds })
    await replaceModuleBatchDrips(moduleId, dripEnabled ? schedules : [])
    return
  }
  await prisma.$executeRaw`
    INSERT INTO tochukwu_learning_modules
      (course_slug, module_slug, module_title, module_description, sort_order, is_active, drip_enabled, drip_at, drip_batch_key, drip_offset_seconds, created_at, updated_at)
    VALUES
      (${courseSlug}, ${moduleSlug}, ${moduleTitle}, ${sanitizeRichNotes(input.moduleDescription) || null}, ${sortOrder}, ${isActive ? 1 : 0},
       ${dripEnabled ? 1 : 0}, ${primaryDripAt}, ${primaryBatchKey}, ${dripOffsetSeconds}, ${now}, ${now})
    ON DUPLICATE KEY UPDATE
      module_title = VALUES(module_title),
      module_description = VALUES(module_description),
      sort_order = VALUES(sort_order),
      is_active = VALUES(is_active),
      drip_enabled = VALUES(drip_enabled),
      drip_at = VALUES(drip_at),
      drip_batch_key = VALUES(drip_batch_key),
      drip_offset_seconds = VALUES(drip_offset_seconds),
      updated_at = VALUES(updated_at)
  `
  const savedModuleId = await findModuleId(courseSlug, moduleSlug)
  if (savedModuleId > BigInt(0)) {
    await upsertCourseModuleMapping({ moduleId: savedModuleId, courseSlug, sortOrder, isActive, dripEnabled, primaryBatchKey, primaryDripAt, dripOffsetSeconds })
    await replaceModuleBatchDrips(savedModuleId, dripEnabled ? schedules : [])
  }
}

export async function saveVideoLibraryLesson(input: {
  lessonId?: string
  moduleId: string
  lessonSlug?: string
  lessonTitle: string
  lessonOrder?: string
  videoAssetId?: string
  lessonNotes?: string
  transcriptText?: string
  captionsVttUrl?: string
  captionsLanguagesJson?: string
  audioDescriptionText?: string
  signLanguageVideoUrl?: string
  accessibilityStatus?: string
  isActive?: boolean
}) {
  await ensureVideoLibraryTables()
  const lessonId = toBigIntId(input.lessonId)
  const moduleId = toBigIntId(input.moduleId)
  const lessonTitle = clean(input.lessonTitle, 220)
  const lessonSlug = slugify(input.lessonSlug || lessonTitle, "lesson").slice(0, 160)
  const videoAssetIdNumber = toBigIntId(input.videoAssetId)
  if (moduleId <= BigInt(0) || !lessonTitle) throw new Error("Module and lesson title are required.")
  const now = new Date()
  const status = ["ready", "in_progress", "blocked", "draft"].includes(clean(input.accessibilityStatus, 32)) ? clean(input.accessibilityStatus, 32) : "draft"
  if (lessonId > BigInt(0)) {
    await prisma.$executeRaw`
      UPDATE tochukwu_learning_lessons
      SET lesson_slug = ${lessonSlug}, lesson_title = ${lessonTitle}, lesson_order = ${toInt(input.lessonOrder, 1)},
          video_asset_id = ${videoAssetIdNumber > BigInt(0) ? videoAssetIdNumber : null},
          lesson_notes = ${sanitizeRichNotes(input.lessonNotes) || null},
          transcript_text = ${clean(input.transcriptText, 120000) || null},
          captions_vtt_url = ${clean(input.captionsVttUrl, 1200) || null},
          captions_languages_json = ${clean(input.captionsLanguagesJson, 4000) || null},
          audio_description_text = ${clean(input.audioDescriptionText, 120000) || null},
          sign_language_video_url = ${clean(input.signLanguageVideoUrl, 1200) || null},
          accessibility_status = ${status},
          is_active = ${input.isActive ? 1 : 0},
          updated_at = ${now}
      WHERE id = ${lessonId}
      LIMIT 1
    `
    return
  }
  await prisma.$executeRaw`
    INSERT INTO tochukwu_learning_lessons
      (module_id, lesson_slug, lesson_title, lesson_order, video_asset_id, lesson_notes, transcript_text, captions_vtt_url, captions_languages_json, audio_description_text, sign_language_video_url, accessibility_status, is_active, created_at, updated_at)
    VALUES
      (${moduleId}, ${lessonSlug}, ${lessonTitle}, ${toInt(input.lessonOrder, 1)}, ${videoAssetIdNumber > BigInt(0) ? videoAssetIdNumber : null},
       ${sanitizeRichNotes(input.lessonNotes) || null}, ${clean(input.transcriptText, 120000) || null}, ${clean(input.captionsVttUrl, 1200) || null},
       ${clean(input.captionsLanguagesJson, 4000) || null}, ${clean(input.audioDescriptionText, 120000) || null}, ${clean(input.signLanguageVideoUrl, 1200) || null},
       ${status}, ${input.isActive ? 1 : 0}, ${now}, ${now})
    ON DUPLICATE KEY UPDATE
      lesson_title = VALUES(lesson_title),
      lesson_order = VALUES(lesson_order),
      video_asset_id = VALUES(video_asset_id),
      lesson_notes = VALUES(lesson_notes),
      transcript_text = VALUES(transcript_text),
      captions_vtt_url = VALUES(captions_vtt_url),
      captions_languages_json = VALUES(captions_languages_json),
      audio_description_text = VALUES(audio_description_text),
      sign_language_video_url = VALUES(sign_language_video_url),
      accessibility_status = VALUES(accessibility_status),
      is_active = VALUES(is_active),
      updated_at = VALUES(updated_at)
  `
}

export async function saveVideoLibraryLessons(input: {
  moduleId: string
  lessons: Array<{
    id?: string | null
    lessonSlug?: string | null
    lessonTitle?: string | null
    lessonOrder?: string | number | null
    videoAssetId?: string | number | null
    lessonNotes?: string | null
    captionsVttUrl?: string | null
    captionsLanguagesJson?: string | null
    transcriptText?: string | null
    audioDescriptionText?: string | null
    signLanguageVideoUrl?: string | null
    accessibilityStatus?: string | null
    isActive?: boolean | number | string | null
  }>
  replaceAll?: boolean
}) {
  await ensureVideoLibraryTables()
  const moduleId = toBigIntId(input.moduleId)
  if (moduleId <= BigInt(0)) throw new Error("Module is required.")

  const moduleRows = await prisma.$queryRaw<Array<{ id: bigint }>>`
    SELECT id
    FROM tochukwu_learning_modules
    WHERE id = ${moduleId}
    LIMIT 1
  `
  if (!moduleRows.length) throw new Error("Module not found.")

  await prisma.$transaction(async (tx) => {
    const keepIds: bigint[] = []
    const rows = Array.isArray(input.lessons) ? input.lessons : []

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] || {}
      const lessonId = toBigIntId(row.id)
      const lessonTitle = clean(row.lessonTitle, 220)
      if (!lessonTitle) continue

      const lessonOrder = toInt(row.lessonOrder, index + 1)
      const videoAssetId = toBigIntId(row.videoAssetId)
      const statusRaw = clean(row.accessibilityStatus, 32).toLowerCase()
      const accessibilityStatus = ["ready", "in_progress", "blocked"].includes(statusRaw) ? statusRaw : "draft"
      const isActive = row.isActive === false || Number(row.isActive) === 0 ? 0 : 1
      const titleNorm = lessonTitle.toLowerCase().replace(/\s+/g, " ").trim()
      const now = new Date()

      const existingByTitle = await tx.$queryRaw<Array<{ id: bigint; lessonSlug: string | null }>>`
        SELECT id, lesson_slug AS lessonSlug
        FROM tochukwu_learning_lessons
        WHERE module_id = ${moduleId}
          AND LOWER(TRIM(lesson_title)) = ${titleNorm}
        ORDER BY id ASC
        LIMIT 1
      `
      const existingTitleRow = existingByTitle[0] || null

      if (lessonId > BigInt(0) || existingTitleRow?.id) {
        const targetLessonId = existingTitleRow?.id || lessonId
        const keepSlug = clean(existingTitleRow?.lessonSlug || row.lessonSlug, 160) || slugify(lessonTitle, "lesson").slice(0, 160)
        await tx.$executeRaw`
          UPDATE tochukwu_learning_lessons
          SET lesson_slug = ${keepSlug},
              lesson_title = ${lessonTitle},
              lesson_order = ${lessonOrder},
              video_asset_id = ${videoAssetId > BigInt(0) ? videoAssetId : null},
              lesson_notes = ${sanitizeRichNotes(row.lessonNotes) || null},
              captions_vtt_url = ${clean(row.captionsVttUrl, 1200) || null},
              captions_languages_json = ${clean(row.captionsLanguagesJson, 4000) || null},
              transcript_text = ${clean(row.transcriptText, 120000) || null},
              audio_description_text = ${clean(row.audioDescriptionText, 120000) || null},
              sign_language_video_url = ${clean(row.signLanguageVideoUrl, 1200) || null},
              accessibility_status = ${accessibilityStatus},
              is_active = ${isActive},
              updated_at = ${now}
          WHERE id = ${targetLessonId}
            AND module_id = ${moduleId}
          LIMIT 1
        `
        keepIds.push(targetLessonId)
        continue
      }

      const baseSlug = slugify(row.lessonSlug || lessonTitle, "lesson").slice(0, 160)
      let createdId = BigInt(0)
      for (let attempt = 1; attempt <= 8; attempt += 1) {
        const nextSlug = attempt === 1 ? baseSlug : `${baseSlug}-${attempt}`.slice(0, 160)
        try {
          await tx.$executeRaw`
            INSERT INTO tochukwu_learning_lessons
              (module_id, lesson_slug, lesson_title, lesson_order, video_asset_id, lesson_notes, captions_vtt_url, captions_languages_json,
               transcript_text, audio_description_text, sign_language_video_url, accessibility_status, is_active, created_at, updated_at)
            VALUES
              (${moduleId}, ${nextSlug}, ${lessonTitle}, ${lessonOrder}, ${videoAssetId > BigInt(0) ? videoAssetId : null},
               ${sanitizeRichNotes(row.lessonNotes) || null}, ${clean(row.captionsVttUrl, 1200) || null}, ${clean(row.captionsLanguagesJson, 4000) || null},
               ${clean(row.transcriptText, 120000) || null}, ${clean(row.audioDescriptionText, 120000) || null}, ${clean(row.signLanguageVideoUrl, 1200) || null},
               ${accessibilityStatus}, ${isActive}, ${now}, ${now})
          `
          const inserted = await tx.$queryRaw<Array<{ id: bigint }>>`
            SELECT id
            FROM tochukwu_learning_lessons
            WHERE module_id = ${moduleId}
              AND lesson_slug = ${nextSlug}
            ORDER BY id DESC
            LIMIT 1
          `
          createdId = inserted[0]?.id || BigInt(0)
          break
        } catch (error) {
          const message = String((error as Error)?.message || "").toLowerCase()
          if (!message.includes("duplicate")) throw error
        }
      }
      if (createdId > BigInt(0)) keepIds.push(createdId)
    }

    if (input.replaceAll !== false) {
      const existing = await tx.$queryRaw<Array<{ id: bigint }>>`
        SELECT id
        FROM tochukwu_learning_lessons
        WHERE module_id = ${moduleId}
      `
      for (const row of existing) {
        if (!keepIds.some((id) => id === row.id)) {
          await tx.$executeRaw`
            DELETE FROM tochukwu_learning_lessons
            WHERE id = ${row.id}
              AND module_id = ${moduleId}
            LIMIT 1
          `
        }
      }
    }
  })
}

export async function deleteVideoLibraryLesson(input: { lessonId: string; moduleId?: string }) {
  await ensureVideoLibraryTables()
  const lessonId = toBigIntId(input.lessonId)
  const moduleId = toBigIntId(input.moduleId)
  if (lessonId <= BigInt(0)) throw new Error("Lesson is required.")
  if (moduleId > BigInt(0)) {
    await prisma.$executeRaw`
      DELETE FROM tochukwu_learning_lessons
      WHERE id = ${lessonId}
        AND module_id = ${moduleId}
      LIMIT 1
    `
    return
  }
  await prisma.$executeRaw`
    DELETE FROM tochukwu_learning_lessons
    WHERE id = ${lessonId}
    LIMIT 1
  `
}

function cloudflareConfig() {
  const accountId = clean(process.env.CLOUDFLARE_ACCOUNT_ID, 120)
  const token = clean(process.env.CLOUDFLARE_STREAM_API_TOKEN, 500)
  if (!accountId) throw new Error("Missing CLOUDFLARE_ACCOUNT_ID.")
  if (!token) throw new Error("Missing CLOUDFLARE_STREAM_API_TOKEN.")
  return { accountId, token }
}

async function cloudflareRequest(pathname: string, init?: RequestInit) {
  const config = cloudflareConfig()
  const response = await fetch(`https://api.cloudflare.com/client/v4${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {})
    }
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || payload?.success !== true) {
    const message = payload?.errors?.[0]?.message || payload?.message || `Cloudflare request failed (${response.status})`
    throw new Error(message)
  }
  return payload
}

export async function syncCloudflareVideos(maxPagesInput = 20) {
  await ensureVideoLibraryTables()
  const maxPages = Math.max(1, Math.min(maxPagesInput, 50))
  let page = 1
  let totalPages = 1
  let fetched = 0
  let upserted = 0
  while (page <= totalPages && page <= maxPages) {
    const result = await syncCloudflareVideosPage(page, maxPages)
    fetched += result.fetched
    upserted += result.upserted
    totalPages = result.totalPages
    page = result.nextPage || page + 1
  }
  return { fetched, upserted, scannedPages: page - 1, maxPages }
}

export async function syncCloudflareVideosPage(pageInput = 1, maxPagesInput = 20) {
  await ensureVideoLibraryTables()
  const config = cloudflareConfig()
  const page = Math.max(1, toInt(pageInput, 1))
  const maxPages = Math.max(1, Math.min(toInt(maxPagesInput, 20), 50))
  const payload = await cloudflareRequest(`/accounts/${encodeURIComponent(config.accountId)}/stream?per_page=100&page=${page}`)
  const rows = Array.isArray(payload.result) ? payload.result : []
  const totalPages = Math.max(1, Number(payload.result_info?.total_pages || 1) || 1)
  const totalCount = Math.max(0, Number(payload.result_info?.total_count || 0) || 0)
  const syncedUids: string[] = []
  let fetched = 0
  let upserted = 0
  for (const row of rows) {
    const uid = clean(row?.uid, 120)
    if (!uid) continue
    fetched += 1
    syncedUids.push(uid)
    await prisma.$executeRaw`
      INSERT INTO tochukwu_learning_video_assets
        (provider, video_uid, filename, hls_url, dash_url, duration_seconds, ready_to_stream, source_created_at, source_deleted_at, source_payload_json, created_at, updated_at)
      VALUES
        ('cloudflare_stream', ${uid}, ${clean(row?.meta?.name || row?.meta?.filename, 320) || null}, ${clean(row?.playback?.hls, 2000) || null},
         ${clean(row?.playback?.dash, 2000) || null}, ${Number.isFinite(Number(row?.duration)) ? Number(row.duration) : null}, ${row?.readyToStream === true ? 1 : 0},
         ${toDate(row?.created)}, NULL, ${JSON.stringify(row)}, ${new Date()}, ${new Date()})
      ON DUPLICATE KEY UPDATE
        filename = VALUES(filename),
        hls_url = VALUES(hls_url),
        dash_url = VALUES(dash_url),
        duration_seconds = VALUES(duration_seconds),
        ready_to_stream = VALUES(ready_to_stream),
        source_created_at = VALUES(source_created_at),
        source_deleted_at = NULL,
        source_payload_json = VALUES(source_payload_json),
        updated_at = VALUES(updated_at)
    `
    upserted += 1
  }
  const done = page >= totalPages || page >= maxPages
  return { page, totalPages, totalCount, maxPages, fetched, upserted, syncedUids, nextPage: done ? null : page + 1, done }
}

async function ensureCloudflareSigningKey(updatedBy: string, forceRotate = false) {
  const config = cloudflareConfig()
  let keyId = clean(process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID, 120)
  let privateKey = clean(process.env.CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY, 5000)
  let keySource = "existing"
  if (forceRotate || !keyId || !privateKey) {
    const created = await cloudflareRequest(`/accounts/${encodeURIComponent(config.accountId)}/stream/keys`, { method: "POST", body: "{}" })
    const result = created.result || {}
    keyId = clean(result.id || result.key_id || result.jwk?.kid, 120)
    privateKey = typeof result.jwk === "object" ? JSON.stringify(result.jwk) : clean(result.pem || result.private_key || result.privateKey || result.key || result.jwk, 5000)
    if (!keyId || !privateKey) throw new Error("Cloudflare did not return a signing key id and private key.")
    await upsertAdminSettings([
      { key: "CLOUDFLARE_STREAM_SIGNING_KEY_ID", value: keyId },
      { key: "CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY", value: privateKey },
      { key: "CLOUDFLARE_STREAM_TOKEN_TTL_SECONDS", value: clean(process.env.CLOUDFLARE_STREAM_TOKEN_TTL_SECONDS, 20) || "300" }
    ], updatedBy)
    keySource = forceRotate ? "rotated" : "created"
  }
  return { config, keyId, keySource }
}

export async function countCloudflareVideosForSigning(input?: { scope?: "all" | "recent"; since?: Date | string | null }) {
  await ensureVideoLibraryTables()
  const scope = input?.scope === "recent" ? "recent" : "all"
  const since = input?.since ? new Date(input.since) : new Date(Date.now() - 24 * 60 * 60 * 1000)
  const rows = await prisma.$queryRaw<Array<{ total: number | bigint | null }>>`
    SELECT COUNT(DISTINCT a.video_uid) AS total
    FROM tochukwu_learning_video_assets a
    WHERE COALESCE(TRIM(a.video_uid), '') <> ''
      AND (${scope} = 'all' OR a.updated_at >= ${Number.isNaN(since.getTime()) ? new Date(Date.now() - 24 * 60 * 60 * 1000) : since})
  `
  return toInt(rows[0]?.total)
}

export async function enforceSignedCloudflareVideosBatch(updatedBy: string, input?: {
  scope?: "all" | "recent"
  since?: Date | string | null
  offset?: number
  limit?: number
  forceRotate?: boolean
}) {
  await ensureVideoLibraryTables()
  const scope = input?.scope === "recent" ? "recent" : "all"
  const since = input?.since ? new Date(input.since) : new Date(Date.now() - 24 * 60 * 60 * 1000)
  const safeSince = Number.isNaN(since.getTime()) ? new Date(Date.now() - 24 * 60 * 60 * 1000) : since
  const offset = Math.max(0, toInt(input?.offset, 0))
  const limit = Math.max(1, Math.min(toInt(input?.limit, 10), 25))
  const totalVideos = await countCloudflareVideosForSigning({ scope, since: safeSince })
  const { config, keyId, keySource } = await ensureCloudflareSigningKey(updatedBy, Boolean(input?.forceRotate))
  const rows = await prisma.$queryRaw<Array<{ videoUid: string }>>`
    SELECT DISTINCT a.video_uid AS videoUid
    FROM tochukwu_learning_video_assets a
    WHERE COALESCE(TRIM(a.video_uid), '') <> ''
      AND (${scope} = 'all' OR a.updated_at >= ${safeSince})
    ORDER BY a.video_uid ASC
    LIMIT ${limit}
    OFFSET ${offset}
  `
  let protectedVideos = 0
  const failures: Array<{ videoUid: string; error: string }> = []
  for (const row of rows) {
    try {
      await cloudflareRequest(`/accounts/${encodeURIComponent(config.accountId)}/stream/${encodeURIComponent(row.videoUid)}`, {
        method: "POST",
        body: JSON.stringify({ requireSignedURLs: true })
      })
      protectedVideos += 1
    } catch (error) {
      failures.push({ videoUid: row.videoUid, error: error instanceof Error ? error.message : "Failed" })
    }
  }
  return {
    keyId,
    keySource,
    scope,
    totalVideos,
    processedVideos: rows.length,
    protectedVideos,
    failedVideos: failures.length,
    failures
  }
}

export async function enforceSignedCloudflareVideos(updatedBy: string, forceRotate = false) {
  await ensureVideoLibraryTables()
  const { keyId, keySource, config } = await ensureCloudflareSigningKey(updatedBy, forceRotate)
  const rows = await prisma.$queryRaw<Array<{ videoUid: string }>>`
    SELECT DISTINCT a.video_uid AS videoUid
    FROM tochukwu_learning_video_assets a
    LEFT JOIN tochukwu_learning_lessons l ON l.video_asset_id = a.id
    WHERE COALESCE(TRIM(a.video_uid), '') <> ''
    ORDER BY a.video_uid ASC
  `
  let protectedVideos = 0
  const failures: Array<{ videoUid: string; error: string }> = []
  for (const row of rows) {
    try {
      await cloudflareRequest(`/accounts/${encodeURIComponent(config.accountId)}/stream/${encodeURIComponent(row.videoUid)}`, {
        method: "POST",
        body: JSON.stringify({ requireSignedURLs: true })
      })
      protectedVideos += 1
    } catch (error) {
      failures.push({ videoUid: row.videoUid, error: error instanceof Error ? error.message : "Failed" })
    }
  }
  return { keyId, keySource, totalVideos: rows.length, protectedVideos, failedVideos: failures.length, failures: failures.slice(0, 25) }
}
