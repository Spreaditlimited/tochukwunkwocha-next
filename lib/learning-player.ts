import crypto from "crypto"
import { Prisma } from "@prisma/client"

import { sendEmail } from "@/lib/email"
import { configuredLearningCourseSlugSql, dayLevelCourseSlugRegex } from "@/lib/learning-course-catalog"
import { prisma } from "@/lib/prisma"
import { plainTextToRichNotes } from "@/lib/rich-notes"
import { listStudentCourses } from "@/lib/student-dashboard"
import { watWallDateTimeMs } from "@/lib/utils"

const CERTIFICATE_PROOF_MARKER = "[CERTIFICATE_PROOF_WEBSITE]"

export type LearningLesson = {
  id: number
  slug: string
  title: string
  notes: string
  order: number
  accessibility: {
    captionsVttUrl: string
    captionsLanguages: { label: string; srclang: string }[]
    transcriptAvailable: boolean
    audioDescriptionText: string
    signLanguageVideoUrl: string
    status: string
  }
  video: {
    hasVideo: boolean
    filename: string
    durationSeconds: number | null
  }
  progress: {
    isCompleted: boolean
    completedAt: Date | null
    lastWatchedAt: Date | null
    watchSeconds: number
  }
}

export type LearningModule = {
  id: number
  slug: string
  title: string
  description: string
  sortOrder: number
  progress: {
    completedLessons: number
    totalLessons: number
    completionPercent: number
  }
  lessons: LearningLesson[]
}

export type LearningCoursePayload = {
  courseSlug: string
  courseTitle: string
  modules: LearningModule[]
  progress: {
    completedLessons: number
    totalLessons: number
    completionPercent: number
    lastActivityAt: Date | null
  }
}

export type LearningSupportPayload = {
  features: {
    assignmentsEnabled: boolean
    courseCommunityEnabled: boolean
    tutorQuestionsEnabled: boolean
  }
  assignments: {
    id: number
    assignmentUuid: string
    lessonId: number | null
    submissionKind: string
    submissionText: string
    submissionLink: string
    status: string
    adminFeedback: string
    attachments: { kind: string; url: string; sortOrder: number }[]
    createdAt: Date | null
  }[]
  threads: {
    id: number
    threadUuid: string
    lessonId: number | null
    questionType: string
    title: string
    body: string
    status: string
    repliesCount: number
    authorName: string
    isOwner?: boolean
    createdAt: Date | null
    lastActivityAt: Date | null
    replies?: {
      id: number
      replyUuid: string
      parentReplyId: number | null
      authorName: string
      authorEmail: string
      body: string
      createdAt: Date | null
      updatedAt: Date | null
      isOwner: boolean
    }[]
  }[]
}

type LessonRow = {
  moduleId: bigint
  moduleSlug: string | null
  moduleTitle: string | null
  moduleDescription: string | null
  sortOrder: number | bigint | null
  dripEnabled: number | bigint | null
  dripAt: Date | null
  dripBatchKey: string | null
  dripOffsetSeconds: number | bigint | null
  lessonId: bigint | null
  lessonSlug: string | null
  lessonTitle: string | null
  lessonNotes: string | null
  captionsVttUrl: string | null
  captionsLanguagesJson: string | null
  transcriptText: string | null
  audioDescriptionText: string | null
  signLanguageVideoUrl: string | null
  accessibilityStatus: string | null
  lessonOrder: number | bigint | null
  videoUid: string | null
  hlsUrl: string | null
  filename: string | null
  durationSeconds: number | bigint | null
  isCompleted: number | bigint | null
  completedAt: Date | null
  lastWatchedAt: Date | null
  watchSeconds: number | bigint | null
}

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function escapeHtml(value: unknown) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function siteBaseUrl() {
  return String(process.env.SITE_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://tochukwunkwocha.com").replace(/\/+$/, "")
}

function parseCaptionsLanguages(value: string | null) {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => ({
        label: clean(item?.label || item?.language || item?.srclang, 80),
        srclang: clean(item?.srclang || item?.language || "en", 12)
      }))
      .filter((item) => item.label || item.srclang)
  } catch {
    return []
  }
}

function pct(completed: number, total: number) {
  return total > 0 ? Math.round((completed / total) * 100) : 0
}

function normalizeBatchKey(value: unknown) {
  return clean(value, 64).toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 64)
}

function parseDateMs(value: unknown) {
  if (value instanceof Date) return watWallDateTimeMs(value)
  const raw = String(value || "").trim()
  if (!raw) return NaN
  return watWallDateTimeMs(raw.replace(" ", "T"))
}

async function getLearnerBatchContext(accountId: bigint, email: string, courseSlug: string) {
  const courses = await listStudentCourses(email, accountId).catch(() => [])
  const activeCourse = courses.find((course) => course.courseSlug === courseSlug && course.isActive && normalizeBatchKey(course.batchKey))
  const familyRows = await prisma.$queryRaw<{ batchKey: string | null }[]>(Prisma.sql`
    SELECT e.batch_key AS batchKey
    FROM family_children c
    JOIN family_accounts f ON f.id = c.family_id
    JOIN family_child_enrollments e ON e.child_id = c.id
    WHERE c.account_id = ${accountId}
      AND c.status = 'active'
      AND f.status = 'active'
      AND e.status = 'active'
      AND e.course_slug COLLATE utf8mb4_general_ci = ${courseSlug}
    ORDER BY e.id DESC
    LIMIT 1
  `).catch(() => [])
  const learnerBatchKey = normalizeBatchKey(activeCourse?.batchKey || familyRows[0]?.batchKey)
  const [activeBatchRows, learnerBatchRows, anchorRows] = await Promise.all([
    prisma.$queryRaw<{ batchKey: string | null }[]>(Prisma.sql`
      SELECT batch_key AS batchKey
      FROM course_batches
      WHERE course_slug COLLATE utf8mb4_general_ci = ${courseSlug}
        AND is_active = 1
      ORDER BY updated_at DESC
      LIMIT 1
    `).catch(() => []),
    learnerBatchKey
      ? prisma.$queryRaw<{ batchStartAt: Date | null }[]>(Prisma.sql`
          SELECT batch_start_at AS batchStartAt
          FROM course_batches
          WHERE course_slug COLLATE utf8mb4_general_ci = ${courseSlug}
            AND batch_key COLLATE utf8mb4_general_ci = ${learnerBatchKey}
          LIMIT 1
        `).catch(() => [])
      : Promise.resolve([]),
    prisma.$queryRaw<{ anchorStartAt: Date | null }[]>(Prisma.sql`
      SELECT COALESCE(
        MAX(CASE WHEN is_active = 1 THEN batch_start_at ELSE NULL END),
        MIN(batch_start_at)
      ) AS anchorStartAt
      FROM course_batches
      WHERE course_slug COLLATE utf8mb4_general_ci = ${courseSlug}
        AND batch_start_at IS NOT NULL
    `).catch(() => [])
  ])
  return {
    learnerBatchKey,
    activeBatchKey: normalizeBatchKey(activeBatchRows[0]?.batchKey),
    learnerBatchStartMs: parseDateMs(learnerBatchRows[0]?.batchStartAt),
    courseAnchorStartMs: parseDateMs(anchorRows[0]?.anchorStartAt)
  }
}

async function loadModuleBatchDripMap(moduleIds: number[]) {
  const ids = Array.from(new Set(moduleIds.filter((id) => id > 0)))
  const map = new Map<number, Map<string, { accessMode: "immediate" | "drip"; dripAtMs: number }>>()
  if (!ids.length) return map
  const rows = await prisma.$queryRaw<Array<{ moduleId: bigint; batchKey: string | null; accessMode: string | null; dripAt: Date | null }>>(Prisma.sql`
    SELECT module_id AS moduleId, batch_key AS batchKey, access_mode AS accessMode, drip_at AS dripAt
    FROM tochukwu_learning_module_batch_drips
    WHERE module_id IN (${Prisma.join(ids)})
  `).catch(() => [])
  rows.forEach((row) => {
    const moduleId = Number(row.moduleId || 0)
    const batchKey = normalizeBatchKey(row.batchKey)
    if (!moduleId || !batchKey) return
    if (!map.has(moduleId)) map.set(moduleId, new Map())
    map.get(moduleId)?.set(batchKey, {
      accessMode: clean(row.accessMode, 24).toLowerCase() === "immediate" ? "immediate" : "drip",
      dripAtMs: parseDateMs(row.dripAt)
    })
  })
  return map
}

function moduleIsReleasedForContext(row: {
  moduleId: number
  dripEnabled?: number | bigint | null
  dripAt?: Date | null
  dripBatchKey?: string | null
  dripOffsetSeconds?: number | bigint | null
}, context: Awaited<ReturnType<typeof getLearnerBatchContext>>, scheduleMap: Map<number, Map<string, { accessMode: "immediate" | "drip"; dripAtMs: number }>>) {
  if (Number(row.dripEnabled || 0) !== 1) return true
  const schedules = scheduleMap.get(row.moduleId)
  if (schedules && schedules.size > 0) {
    if (!context.learnerBatchKey) return false
    const schedule = schedules.get(context.learnerBatchKey)
    if (!schedule) return false
    if (schedule.accessMode === "immediate") return true
    return Number.isFinite(schedule.dripAtMs) ? Date.now() >= schedule.dripAtMs : true
  }
  const targetBatchKey = normalizeBatchKey(row.dripBatchKey)
  if (targetBatchKey) {
    if (!context.learnerBatchKey || targetBatchKey !== context.learnerBatchKey) return false
    const dripAtMs = parseDateMs(row.dripAt)
    return Number.isFinite(dripAtMs) ? Date.now() >= dripAtMs : true
  }
  if (context.activeBatchKey && context.learnerBatchKey && context.activeBatchKey !== context.learnerBatchKey) return true
  const offsetSeconds = Number(row.dripOffsetSeconds)
  if (Number.isFinite(offsetSeconds) && Number.isFinite(context.learnerBatchStartMs)) {
    return Date.now() >= context.learnerBatchStartMs + offsetSeconds * 1000
  }
  const dripAtMs = parseDateMs(row.dripAt)
  return Number.isFinite(dripAtMs) ? Date.now() >= dripAtMs : true
}

async function studentCanAccessReleasedModule(input: {
  accountId: bigint
  email: string
  courseSlug: string
  moduleId: number
  dripEnabled?: number | bigint | null
  dripAt?: Date | null
  dripBatchKey?: string | null
  dripOffsetSeconds?: number | bigint | null
}) {
  const courseSlug = clean(input.courseSlug, 120).toLowerCase()
  const allowed = await studentHasCourseAccess(input.accountId, input.email, courseSlug)
  if (!allowed) return false
  const [context, scheduleMap] = await Promise.all([
    getLearnerBatchContext(input.accountId, input.email, courseSlug),
    loadModuleBatchDripMap([input.moduleId])
  ])
  return moduleIsReleasedForContext(input, context, scheduleMap)
}

export async function ensureLearningProgressTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS tochukwu_learning_lesson_progress (
      id BIGINT NOT NULL AUTO_INCREMENT,
      account_id BIGINT NOT NULL,
      lesson_id BIGINT NOT NULL,
      module_id BIGINT NOT NULL,
      is_completed TINYINT(1) NOT NULL DEFAULT 0,
      completed_at DATETIME NULL,
      last_watched_at DATETIME NULL,
      watch_seconds INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_learning_lesson_progress (account_id, lesson_id),
      KEY idx_tochukwu_learning_progress_account (account_id, updated_at),
      KEY idx_tochukwu_learning_progress_lesson (lesson_id),
      KEY idx_tochukwu_learning_progress_module (module_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `
}

export async function studentHasCourseAccess(accountId: bigint, email: string, courseSlug: string) {
  const courses = await listStudentCourses(email, accountId)
  if (courses.some((course) => course.courseSlug === courseSlug && course.isActive)) return true

  const overrides = await prisma.$queryRaw<{ id: bigint }[]>(Prisma.sql`
    SELECT id
    FROM tochukwu_learning_access_overrides
    WHERE LOWER(email) COLLATE utf8mb4_general_ci = ${email.toLowerCase()}
      AND course_slug COLLATE utf8mb4_general_ci = ${courseSlug}
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
    LIMIT 1
  `).catch(() => [])
  if (overrides.length) return true

  const familyRows = await prisma.$queryRaw<{ id: bigint }[]>(Prisma.sql`
    SELECT e.id
    FROM family_children c
    JOIN family_accounts f ON f.id = c.family_id
    JOIN family_child_enrollments e ON e.child_id = c.id
    WHERE c.account_id = ${accountId}
      AND c.status = 'active'
      AND f.status = 'active'
      AND e.status = 'active'
      AND e.course_slug COLLATE utf8mb4_general_ci = ${courseSlug}
    LIMIT 1
  `).catch(() => [])
  return familyRows.length > 0
}

export async function getLearningCourseForStudent(input: {
  accountId: bigint
  email: string
  courseSlug: string
}): Promise<{ ok: true; course: LearningCoursePayload } | { ok: false; error: string }> {
  const courseSlug = clean(input.courseSlug, 120).toLowerCase()
  if (!courseSlug) return { ok: false, error: "course is required" }
  await ensureLearningProgressTable()

  const allowed = await studentHasCourseAccess(input.accountId, input.email, courseSlug)
  if (!allowed) return { ok: false, error: "You do not currently have access to this course." }

  const rows = await prisma.$queryRaw<LessonRow[]>(Prisma.sql`
    SELECT
      m.id AS moduleId,
      m.module_slug AS moduleSlug,
      m.module_title AS moduleTitle,
      m.module_description AS moduleDescription,
      cm.sort_order AS sortOrder,
      cm.drip_enabled AS dripEnabled,
      cm.drip_at AS dripAt,
      cm.drip_batch_key AS dripBatchKey,
      cm.drip_offset_seconds AS dripOffsetSeconds,
      l.id AS lessonId,
      l.lesson_slug AS lessonSlug,
      l.lesson_title AS lessonTitle,
      l.lesson_notes AS lessonNotes,
      l.captions_vtt_url AS captionsVttUrl,
      l.captions_languages_json AS captionsLanguagesJson,
      l.transcript_text AS transcriptText,
      l.audio_description_text AS audioDescriptionText,
      l.sign_language_video_url AS signLanguageVideoUrl,
      l.accessibility_status AS accessibilityStatus,
      l.lesson_order AS lessonOrder,
      a.video_uid AS videoUid,
      a.hls_url AS hlsUrl,
      a.filename AS filename,
      a.duration_seconds AS durationSeconds,
      p.is_completed AS isCompleted,
      p.completed_at AS completedAt,
      p.last_watched_at AS lastWatchedAt,
      p.watch_seconds AS watchSeconds
    FROM tochukwu_learning_course_modules cm
    JOIN tochukwu_learning_modules m ON m.id = cm.module_id
    JOIN tochukwu_learning_courses c ON c.course_slug = cm.course_slug
    LEFT JOIN tochukwu_learning_lessons l ON l.module_id = m.id AND l.is_active = 1
    LEFT JOIN tochukwu_learning_video_assets a ON a.id = l.video_asset_id AND a.source_deleted_at IS NULL
    LEFT JOIN tochukwu_learning_lesson_progress p ON p.lesson_id = l.id AND p.account_id = ${input.accountId}
    WHERE cm.course_slug COLLATE utf8mb4_general_ci = ${courseSlug}
      AND cm.is_active = 1
      AND c.is_published = 1
      AND (c.release_at IS NULL OR c.release_at <= NOW())
    ORDER BY cm.sort_order ASC, cm.id ASC, l.lesson_order ASC, l.id ASC
  `)

  const courseRows = await prisma.$queryRaw<{ courseTitle: string | null }[]>(Prisma.sql`
    SELECT course_title AS courseTitle
    FROM tochukwu_learning_courses
    WHERE course_slug COLLATE utf8mb4_general_ci = ${courseSlug}
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
  `)

  const byModule = new Map<number, LearningModule>()
  let completedLessons = 0
  let totalLessons = 0
  let lastActivityAt: Date | null = null
  const moduleIdsForSchedule = Array.from(new Set(rows.map((row) => Number(row.moduleId || 0)).filter((id) => id > 0)))
  const [dripContext, moduleScheduleMap] = await Promise.all([
    getLearnerBatchContext(input.accountId, input.email, courseSlug),
    loadModuleBatchDripMap(moduleIdsForSchedule)
  ])

  rows.filter((row) => moduleIsReleasedForContext({
    moduleId: Number(row.moduleId || 0),
    dripEnabled: row.dripEnabled,
    dripAt: row.dripAt,
    dripBatchKey: row.dripBatchKey,
    dripOffsetSeconds: row.dripOffsetSeconds
  }, dripContext, moduleScheduleMap)).forEach((row) => {
    const moduleId = Number(row.moduleId || 0)
    if (!moduleId) return
    if (!byModule.has(moduleId)) {
      byModule.set(moduleId, {
        id: moduleId,
        slug: clean(row.moduleSlug, 160),
        title: clean(row.moduleTitle, 220) || "Module",
        description: plainTextToRichNotes(clean(row.moduleDescription, 65000)),
        sortOrder: Number(row.sortOrder || 0),
        progress: { completedLessons: 0, totalLessons: 0, completionPercent: 0 },
        lessons: []
      })
    }
    if (!row.lessonId) return
    const completed = Number(row.isCompleted || 0) === 1
    const lesson: LearningLesson = {
      id: Number(row.lessonId),
      slug: clean(row.lessonSlug, 160),
      title: clean(row.lessonTitle, 220) || "Lesson",
      notes: plainTextToRichNotes(clean(row.lessonNotes, 65000)),
      order: Number(row.lessonOrder || 0),
      accessibility: {
        captionsVttUrl: clean(row.captionsVttUrl, 1200),
        captionsLanguages: parseCaptionsLanguages(row.captionsLanguagesJson),
        transcriptAvailable: !!clean(row.transcriptText, 1),
        audioDescriptionText: clean(row.audioDescriptionText, 120000),
        signLanguageVideoUrl: clean(row.signLanguageVideoUrl, 1200),
        status: clean(row.accessibilityStatus, 32) || "draft"
      },
      video: {
        hasVideo: !!clean(row.videoUid, 140),
        filename: clean(row.filename, 320),
        durationSeconds: row.durationSeconds == null ? null : Number(row.durationSeconds)
      },
      progress: {
        isCompleted: completed,
        completedAt: row.completedAt,
        lastWatchedAt: row.lastWatchedAt,
        watchSeconds: Number(row.watchSeconds || 0)
      }
    }
    const moduleRow = byModule.get(moduleId)
    if (!moduleRow) return
    moduleRow.lessons.push(lesson)
    moduleRow.progress.totalLessons += 1
    totalLessons += 1
    if (completed) {
      moduleRow.progress.completedLessons += 1
      completedLessons += 1
    }
    const latest = row.lastWatchedAt || row.completedAt
    if (latest && (!lastActivityAt || latest.getTime() > lastActivityAt.getTime())) lastActivityAt = latest
  })

  const modules = Array.from(byModule.values()).map((moduleRow) => ({
    ...moduleRow,
    progress: {
      ...moduleRow.progress,
      completionPercent: pct(moduleRow.progress.completedLessons, moduleRow.progress.totalLessons)
    }
  }))

  return {
    ok: true,
    course: {
      courseSlug,
      courseTitle: clean(courseRows[0]?.courseTitle, 220) || courseSlug,
      modules,
      progress: {
        completedLessons,
        totalLessons,
        completionPercent: pct(completedLessons, totalLessons),
        lastActivityAt
      }
    }
  }
}

export async function getLessonPlaybackSource(accountId: bigint, email: string, lessonId: number) {
  const rows = await prisma.$queryRaw<{ courseSlug: string; moduleId: bigint; dripEnabled: number | bigint | null; dripAt: Date | null; dripBatchKey: string | null; dripOffsetSeconds: number | bigint | null; videoUid: string | null; hlsUrl: string | null }[]>(Prisma.sql`
    SELECT cm.course_slug AS courseSlug, m.id AS moduleId, cm.drip_enabled AS dripEnabled, cm.drip_at AS dripAt,
      cm.drip_batch_key AS dripBatchKey, cm.drip_offset_seconds AS dripOffsetSeconds,
      a.video_uid AS videoUid, a.hls_url AS hlsUrl
    FROM tochukwu_learning_lessons l
    JOIN tochukwu_learning_modules m ON m.id = l.module_id
    JOIN tochukwu_learning_course_modules cm ON cm.module_id = m.id
    JOIN tochukwu_learning_courses c ON c.course_slug = cm.course_slug
    LEFT JOIN tochukwu_learning_video_assets a ON a.id = l.video_asset_id AND a.source_deleted_at IS NULL
    WHERE l.id = ${lessonId}
      AND l.is_active = 1
      AND cm.is_active = 1
      AND c.is_published = 1
      AND (c.release_at IS NULL OR c.release_at <= NOW())
  `)
  let row: (typeof rows)[number] | undefined
  for (const candidate of rows) {
    if (await studentCanAccessReleasedModule({
      accountId,
      email,
      courseSlug: candidate.courseSlug,
      moduleId: Number(candidate.moduleId || 0),
      dripEnabled: candidate.dripEnabled,
      dripAt: candidate.dripAt,
      dripBatchKey: candidate.dripBatchKey,
      dripOffsetSeconds: candidate.dripOffsetSeconds
    })) {
      row = candidate
      break
    }
  }
  if (!row) return { ok: false as const, error: "Lesson not found" }
  if (!row.videoUid) return { ok: false as const, error: "This lesson has no playable video yet." }
  return { ok: true as const, videoUid: row.videoUid, hlsUrl: row.hlsUrl }
}

export async function saveStudentLessonProgress(input: {
  accountId: bigint
  email: string
  lessonId: number
  markComplete?: boolean
  watchSeconds?: number
}) {
  await ensureLearningProgressTable()
  const rows = await prisma.$queryRaw<{ moduleId: bigint; courseSlug: string; dripEnabled: number | bigint | null; dripAt: Date | null; dripBatchKey: string | null; dripOffsetSeconds: number | bigint | null }[]>(Prisma.sql`
    SELECT l.module_id AS moduleId, cm.course_slug AS courseSlug, cm.drip_enabled AS dripEnabled, cm.drip_at AS dripAt,
      cm.drip_batch_key AS dripBatchKey, cm.drip_offset_seconds AS dripOffsetSeconds
    FROM tochukwu_learning_lessons l
    JOIN tochukwu_learning_modules m ON m.id = l.module_id
    JOIN tochukwu_learning_course_modules cm ON cm.module_id = m.id
    JOIN tochukwu_learning_courses c ON c.course_slug = cm.course_slug
    WHERE l.id = ${input.lessonId}
      AND l.is_active = 1
      AND cm.is_active = 1
      AND c.is_published = 1
  `)
  let row: (typeof rows)[number] | undefined
  for (const candidate of rows) {
    if (await studentCanAccessReleasedModule({
      accountId: input.accountId,
      email: input.email,
      courseSlug: candidate.courseSlug,
      moduleId: Number(candidate.moduleId || 0),
      dripEnabled: candidate.dripEnabled,
      dripAt: candidate.dripAt,
      dripBatchKey: candidate.dripBatchKey,
      dripOffsetSeconds: candidate.dripOffsetSeconds
    })) {
      row = candidate
      break
    }
  }
  if (!row) return { ok: false, error: "Lesson not found" }
  const courseSlug = clean(row.courseSlug, 120).toLowerCase()

  const now = new Date()
  const markComplete = !!input.markComplete
  const watchSeconds = Math.max(0, Math.trunc(Number(input.watchSeconds || 0)))
  await prisma.$executeRaw`
    INSERT INTO tochukwu_learning_lesson_progress
      (account_id, lesson_id, module_id, is_completed, completed_at, last_watched_at, watch_seconds, created_at, updated_at)
    VALUES
      (${input.accountId}, ${input.lessonId}, ${row.moduleId}, ${markComplete ? 1 : 0}, ${markComplete ? now : null}, ${now}, ${watchSeconds}, ${now}, ${now})
    ON DUPLICATE KEY UPDATE
      is_completed = GREATEST(is_completed, VALUES(is_completed)),
      completed_at = CASE
        WHEN completed_at IS NULL AND VALUES(is_completed) = 1 THEN VALUES(completed_at)
        ELSE completed_at
      END,
      last_watched_at = VALUES(last_watched_at),
      watch_seconds = GREATEST(0, COALESCE(watch_seconds, 0) + VALUES(watch_seconds)),
      updated_at = VALUES(updated_at)
  `
  return { ok: true, courseSlug }
}

export async function getStudentLessonTranscript(accountId: bigint, email: string, lessonId: number) {
  const rows = await prisma.$queryRaw<{ courseSlug: string; moduleId: bigint; dripEnabled: number | bigint | null; dripAt: Date | null; dripBatchKey: string | null; dripOffsetSeconds: number | bigint | null; lessonTitle: string | null; transcriptText: string | null }[]>(Prisma.sql`
    SELECT cm.course_slug AS courseSlug, m.id AS moduleId, cm.drip_enabled AS dripEnabled, cm.drip_at AS dripAt,
      cm.drip_batch_key AS dripBatchKey, cm.drip_offset_seconds AS dripOffsetSeconds,
      l.lesson_title AS lessonTitle, l.transcript_text AS transcriptText
    FROM tochukwu_learning_lessons l
    JOIN tochukwu_learning_modules m ON m.id = l.module_id
    JOIN tochukwu_learning_course_modules cm ON cm.module_id = m.id
    WHERE l.id = ${lessonId}
      AND l.is_active = 1
      AND cm.is_active = 1
  `)
  let row: (typeof rows)[number] | undefined
  for (const candidate of rows) {
    if (await studentCanAccessReleasedModule({
      accountId,
      email,
      courseSlug: candidate.courseSlug,
      moduleId: Number(candidate.moduleId || 0),
      dripEnabled: candidate.dripEnabled,
      dripAt: candidate.dripAt,
      dripBatchKey: candidate.dripBatchKey,
      dripOffsetSeconds: candidate.dripOffsetSeconds
    })) {
      row = candidate
      break
    }
  }
  if (!row) return { ok: false as const, error: "Lesson not found" }
  const transcript = clean(row.transcriptText, 120000)
  if (!transcript) return { ok: false as const, error: "Transcript is not available for this lesson yet." }
  return { ok: true as const, lessonTitle: clean(row.lessonTitle, 220), transcriptText: transcript }
}

export async function ensureLearningSupportTables() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS tochukwu_learning_course_features (
      id BIGINT NOT NULL AUTO_INCREMENT,
      course_slug VARCHAR(120) NOT NULL,
      assignments_enabled TINYINT(1) NOT NULL DEFAULT 0,
      course_community_enabled TINYINT(1) NOT NULL DEFAULT 0,
      tutor_questions_enabled TINYINT(1) NOT NULL DEFAULT 0,
      alumni_participation_mode VARCHAR(24) NOT NULL DEFAULT 'none',
      certificate_proof_required TINYINT(1) NOT NULL DEFAULT 0,
      certificate_proof_type VARCHAR(24) NOT NULL DEFAULT 'website_link',
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_learning_course_feature_slug (course_slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS tochukwu_learning_assignments (
      id BIGINT NOT NULL AUTO_INCREMENT,
      assignment_uuid VARCHAR(64) NOT NULL,
      course_slug VARCHAR(120) NOT NULL,
      account_id BIGINT NOT NULL,
      student_email VARCHAR(220) NOT NULL,
      student_name VARCHAR(180) NULL,
      lesson_id BIGINT NULL,
      module_id BIGINT NULL,
      submission_kind VARCHAR(24) NOT NULL,
      submission_text TEXT NULL,
      submission_link VARCHAR(1500) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'submitted',
      admin_feedback TEXT NULL,
      reviewed_by VARCHAR(120) NULL,
      reviewed_at DATETIME NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_learning_assignment_uuid (assignment_uuid),
      KEY idx_learning_assignment_course_status (course_slug, status, created_at),
      KEY idx_learning_assignment_student (student_email, course_slug, created_at),
      KEY idx_learning_assignment_account (account_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS tochukwu_learning_assignment_attachments (
      id BIGINT NOT NULL AUTO_INCREMENT,
      assignment_id BIGINT NOT NULL,
      attachment_kind VARCHAR(24) NOT NULL DEFAULT 'file',
      attachment_url VARCHAR(1500) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      KEY idx_learning_assignment_attachment_assignment (assignment_id, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS tochukwu_learning_assignment_events (
      id BIGINT NOT NULL AUTO_INCREMENT,
      assignment_id BIGINT NOT NULL,
      actor_type VARCHAR(24) NOT NULL DEFAULT 'system',
      actor_ref VARCHAR(220) NULL,
      event_type VARCHAR(32) NOT NULL,
      event_note VARCHAR(800) NULL,
      metadata_json LONGTEXT NULL,
      created_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      KEY idx_learning_assignment_event_assignment (assignment_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS tochukwu_learning_community_threads (
      id BIGINT NOT NULL AUTO_INCREMENT,
      thread_uuid VARCHAR(64) NOT NULL,
      course_slug VARCHAR(120) NOT NULL,
      account_id BIGINT NOT NULL,
      author_email VARCHAR(220) NOT NULL,
      author_name VARCHAR(180) NULL,
      lesson_id BIGINT NULL,
      module_id BIGINT NULL,
      question_type VARCHAR(24) NOT NULL DEFAULT 'peer',
      title VARCHAR(220) NOT NULL,
      body TEXT NOT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'open',
      replies_count INT NOT NULL DEFAULT 0,
      last_activity_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_learning_community_thread_uuid (thread_uuid),
      KEY idx_learning_community_course (course_slug, status, last_activity_at),
      KEY idx_learning_community_author (author_email, course_slug, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS tochukwu_learning_community_replies (
      id BIGINT NOT NULL AUTO_INCREMENT,
      reply_uuid VARCHAR(64) NOT NULL,
      thread_id BIGINT NOT NULL,
      parent_reply_id BIGINT NULL,
      course_slug VARCHAR(120) NOT NULL,
      account_id BIGINT NOT NULL,
      author_email VARCHAR(220) NOT NULL,
      author_name VARCHAR(180) NULL,
      mention_account_id BIGINT NULL,
      mention_email VARCHAR(220) NULL,
      mention_name VARCHAR(180) NULL,
      body TEXT NOT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_learning_community_reply_uuid (reply_uuid),
      KEY idx_learning_community_reply_thread (thread_id, created_at),
      KEY idx_learning_community_reply_author (author_email, course_slug, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS tochukwu_transcript_access (
      id BIGINT NOT NULL AUTO_INCREMENT,
      account_id BIGINT NOT NULL,
      course_slug VARCHAR(120) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      request_reason TEXT NULL,
      requested_at DATETIME NULL,
      approved_at DATETIME NULL,
      approved_by VARCHAR(64) NULL,
      expires_at DATETIME NULL,
      notes TEXT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_transcript_access_account_course (account_id, course_slug),
      KEY idx_tochukwu_transcript_access_status (status, updated_at),
      KEY idx_tochukwu_transcript_access_course (course_slug, status, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS tochukwu_transcript_access_audit (
      id BIGINT NOT NULL AUTO_INCREMENT,
      account_id BIGINT NOT NULL,
      course_slug VARCHAR(120) NOT NULL,
      lesson_id BIGINT NULL,
      event_type VARCHAR(50) NOT NULL,
      status VARCHAR(20) NOT NULL,
      detail_json LONGTEXT NULL,
      ip_hash VARCHAR(128) NULL,
      user_agent VARCHAR(255) NULL,
      created_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      KEY idx_tochukwu_transcript_audit_account (account_id, created_at),
      KEY idx_tochukwu_transcript_audit_course (course_slug, created_at),
      KEY idx_tochukwu_transcript_audit_event (event_type, status, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `
}

export async function getLearningSupportForStudent(accountId: bigint, email: string, courseSlugInput: string): Promise<LearningSupportPayload> {
  const courseSlug = clean(courseSlugInput, 120).toLowerCase()
  await ensureLearningSupportTables()
  const allowed = await studentHasCourseAccess(accountId, email, courseSlug)
  if (!allowed) throw new Error("You do not currently have access to this course.")
  const [featuresRows, assignments, threads] = await Promise.all([
    prisma.$queryRaw<{ assignmentsEnabled: number; courseCommunityEnabled: number; tutorQuestionsEnabled: number }[]>(Prisma.sql`
      SELECT
        COALESCE(assignments_enabled, 0) AS assignmentsEnabled,
        COALESCE(course_community_enabled, 0) AS courseCommunityEnabled,
        COALESCE(tutor_questions_enabled, 0) AS tutorQuestionsEnabled
      FROM tochukwu_learning_course_features
      WHERE course_slug COLLATE utf8mb4_general_ci = ${courseSlug}
      LIMIT 1
    `),
    prisma.$queryRaw<LearningSupportPayload["assignments"]>(Prisma.sql`
      SELECT
        CAST(id AS SIGNED) AS id,
        assignment_uuid AS assignmentUuid,
        CAST(lesson_id AS SIGNED) AS lessonId,
        submission_kind AS submissionKind,
        COALESCE(submission_text, '') AS submissionText,
        COALESCE(submission_link, '') AS submissionLink,
        COALESCE(status, '') AS status,
        COALESCE(admin_feedback, '') AS adminFeedback,
        created_at AS createdAt
      FROM tochukwu_learning_assignments
      WHERE course_slug COLLATE utf8mb4_general_ci = ${courseSlug}
        AND account_id = ${accountId}
        AND LOWER(student_email) COLLATE utf8mb4_general_ci = ${email.toLowerCase()}
        AND lesson_id IS NOT NULL
        AND NOT (submission_kind = 'link' AND submission_text = ${CERTIFICATE_PROOF_MARKER})
      ORDER BY id DESC
      LIMIT 30
    `),
    prisma.$queryRaw<LearningSupportPayload["threads"]>(Prisma.sql`
      SELECT
        CAST(id AS SIGNED) AS id,
        thread_uuid AS threadUuid,
        account_id AS accountId,
        CAST(lesson_id AS SIGNED) AS lessonId,
        question_type AS questionType,
        title,
        body,
        status,
        CAST(replies_count AS SIGNED) AS repliesCount,
        COALESCE(author_name, '') AS authorName,
        created_at AS createdAt,
        last_activity_at AS lastActivityAt
      FROM tochukwu_learning_community_threads
      WHERE course_slug COLLATE utf8mb4_general_ci = ${courseSlug}
      ORDER BY last_activity_at DESC, id DESC
      LIMIT 30
    `)
  ])
  const assignmentIds = assignments.map((item) => Number(item.id || 0)).filter(Boolean)
  const attachments = assignmentIds.length
    ? await prisma.$queryRaw<Array<{ assignmentId: number; kind: string; url: string; sortOrder: number }>>(Prisma.sql`
        SELECT CAST(assignment_id AS SIGNED) AS assignmentId, attachment_kind AS kind, attachment_url AS url, CAST(sort_order AS SIGNED) AS sortOrder
        FROM tochukwu_learning_assignment_attachments
        WHERE assignment_id IN (${Prisma.join(assignmentIds)})
        ORDER BY assignment_id ASC, sort_order ASC, id ASC
      `)
    : []
  const attachmentsByAssignment = new Map<number, { kind: string; url: string; sortOrder: number }[]>()
  attachments.forEach((item) => {
    const current = attachmentsByAssignment.get(Number(item.assignmentId)) || []
    current.push({ kind: clean(item.kind, 24) || "file", url: clean(item.url, 1500), sortOrder: Number(item.sortOrder || 0) })
    attachmentsByAssignment.set(Number(item.assignmentId), current)
  })
  const threadIds = threads.map((item) => Number(item.id || 0)).filter(Boolean)
  const replies = threadIds.length
    ? await prisma.$queryRaw<Array<{
        id: number
        replyUuid: string
        threadId: number
        parentReplyId: number | null
        authorName: string
        authorEmail: string
        body: string
        createdAt: Date | null
        updatedAt: Date | null
        accountId: bigint
      }>>(Prisma.sql`
        SELECT
          CAST(id AS SIGNED) AS id,
          reply_uuid AS replyUuid,
          CAST(thread_id AS SIGNED) AS threadId,
          CAST(parent_reply_id AS SIGNED) AS parentReplyId,
          COALESCE(author_name, '') AS authorName,
          COALESCE(author_email, '') AS authorEmail,
          body,
          created_at AS createdAt,
          updated_at AS updatedAt,
          account_id AS accountId
        FROM tochukwu_learning_community_replies
        WHERE thread_id IN (${Prisma.join(threadIds)})
          AND course_slug COLLATE utf8mb4_general_ci = ${courseSlug}
        ORDER BY id ASC
      `)
    : []
  const repliesByThread = new Map<number, LearningSupportPayload["threads"][number]["replies"]>()
  replies.forEach((reply) => {
    const current = repliesByThread.get(Number(reply.threadId)) || []
    current.push({
      id: Number(reply.id || 0),
      replyUuid: clean(reply.replyUuid, 64),
      parentReplyId: reply.parentReplyId == null ? null : Number(reply.parentReplyId),
      authorName: clean(reply.authorName, 180),
      authorEmail: clean(reply.authorEmail, 220),
      body: clean(reply.body, 20000),
      createdAt: reply.createdAt,
      updatedAt: reply.updatedAt,
      isOwner: String(reply.accountId) === String(accountId)
    })
    repliesByThread.set(Number(reply.threadId), current)
  })
  const features = featuresRows[0]
  return {
    features: {
      assignmentsEnabled: Number(features?.assignmentsEnabled || 0) === 1,
      courseCommunityEnabled: Number(features?.courseCommunityEnabled || 0) === 1,
      tutorQuestionsEnabled: Number(features?.tutorQuestionsEnabled || 0) === 1
    },
    assignments: assignments.map((item) => {
      const id = Number(item.id || 0)
      return {
        id,
        assignmentUuid: clean(item.assignmentUuid, 64),
        lessonId: item.lessonId == null ? null : Number(item.lessonId),
        submissionKind: clean(item.submissionKind, 24),
        submissionText: clean(item.submissionText, 4000),
        submissionLink: clean(item.submissionLink, 1500),
        status: clean(item.status, 32),
        adminFeedback: clean(item.adminFeedback, 4000),
        attachments: attachmentsByAssignment.get(id) || [],
        createdAt: item.createdAt
      }
    }),
    threads: threads.map((item) => {
      const id = Number(item.id || 0)
      return {
        id,
        threadUuid: clean(item.threadUuid, 64),
        lessonId: item.lessonId == null ? null : Number(item.lessonId),
        questionType: clean(item.questionType, 24),
        title: clean(item.title, 220),
        body: clean(item.body, 20000),
        status: clean(item.status, 32),
        repliesCount: Number(item.repliesCount || 0),
        authorName: clean(item.authorName, 180),
        createdAt: item.createdAt,
        lastActivityAt: item.lastActivityAt,
        isOwner: String((item as { accountId?: bigint }).accountId || "") === String(accountId),
        replies: repliesByThread.get(id) || []
      }
    })
  }
}

export async function createLearningAssignment(input: {
  accountId: bigint
  email: string
  fullName: string
  courseSlug: string
  lessonId: number | null
  moduleId: number | null
  submissionKind: string
  submissionText: string
  submissionLink: string
  screenshotUrls?: string[]
}) {
  const courseSlug = clean(input.courseSlug, 120).toLowerCase()
  await ensureLearningSupportTables()
  const allowed = await studentHasCourseAccess(input.accountId, input.email, courseSlug)
  if (!allowed) throw new Error("You do not currently have access to this course.")
  const features = await getLearningSupportForStudent(input.accountId, input.email, courseSlug)
  if (!features.features.assignmentsEnabled) throw new Error("Assignments are not enabled for this course.")
  const kind = clean(input.submissionKind, 24) || "text"
  const screenshotUrls = Array.isArray(input.screenshotUrls)
    ? input.screenshotUrls.map((url) => clean(url, 1500)).filter((url) => /^https?:\/\//i.test(url)).slice(0, 8)
    : []
  if (kind === "text" && !clean(input.submissionText, 4000)) throw new Error("Assignment text is required.")
  if (kind === "link" && !/^https?:\/\//i.test(clean(input.submissionLink, 1500))) throw new Error("A valid assignment link is required.")
  if (kind === "screenshots" && !screenshotUrls.length) throw new Error("At least one screenshot is required.")
  const now = new Date()
  const result = await prisma.$executeRaw`
    INSERT INTO tochukwu_learning_assignments
      (assignment_uuid, course_slug, account_id, student_email, student_name, lesson_id, module_id, submission_kind, submission_text, submission_link, status, created_at, updated_at)
    VALUES
      (${`assn_${crypto.randomUUID().replace(/-/g, "")}`}, ${courseSlug}, ${input.accountId}, ${input.email.toLowerCase()}, ${input.fullName}, ${input.lessonId}, ${input.moduleId}, ${kind}, ${clean(input.submissionText, 4000) || null}, ${clean(input.submissionLink, 1500) || null}, 'submitted', ${now}, ${now})
  `
  const inserted = await prisma.$queryRaw<Array<{ id: bigint }>>(Prisma.sql`
    SELECT id
    FROM tochukwu_learning_assignments
    WHERE course_slug COLLATE utf8mb4_general_ci = ${courseSlug}
      AND account_id = ${input.accountId}
      AND LOWER(student_email) COLLATE utf8mb4_general_ci = ${input.email.toLowerCase()}
    ORDER BY id DESC
    LIMIT 1
  `)
  const assignmentId = inserted[0]?.id
  if (assignmentId && screenshotUrls.length) {
    for (let index = 0; index < screenshotUrls.length; index += 1) {
      await prisma.$executeRaw`
        INSERT INTO tochukwu_learning_assignment_attachments
          (assignment_id, attachment_kind, attachment_url, sort_order, created_at)
        VALUES
          (${assignmentId}, 'screenshot', ${screenshotUrls[index]}, ${index}, ${now})
      `
    }
  }
  if (assignmentId) {
    await prisma.$executeRaw`
      INSERT INTO tochukwu_learning_assignment_events
        (assignment_id, actor_type, actor_ref, event_type, event_note, metadata_json, created_at)
      VALUES
        (${assignmentId}, 'student', ${input.email.toLowerCase()}, 'submitted', 'Assignment submitted', ${JSON.stringify({ kind, screenshot_count: screenshotUrls.length })}, ${now})
    `
  }
  return result
}

export async function createLearningThread(input: {
  accountId: bigint
  email: string
  fullName: string
  courseSlug: string
  lessonId: number | null
  moduleId: number | null
  questionType: string
  title: string
  body: string
}) {
  const courseSlug = clean(input.courseSlug, 120).toLowerCase()
  await ensureLearningSupportTables()
  const allowed = await studentHasCourseAccess(input.accountId, input.email, courseSlug)
  if (!allowed) throw new Error("You do not currently have access to this course.")
  const features = await getLearningSupportForStudent(input.accountId, input.email, courseSlug)
  if (!features.features.courseCommunityEnabled) throw new Error("Course community is not enabled for this course.")
  const now = new Date()
  await prisma.$executeRaw`
    INSERT INTO tochukwu_learning_community_threads
      (thread_uuid, course_slug, account_id, author_email, author_name, lesson_id, module_id, question_type, title, body, status, replies_count, last_activity_at, created_at, updated_at)
    VALUES
      (${`comt_${crypto.randomUUID().replace(/-/g, "")}`}, ${courseSlug}, ${input.accountId}, ${input.email.toLowerCase()}, ${input.fullName}, ${input.lessonId}, ${input.moduleId}, ${clean(input.questionType, 24) || "peer"}, ${clean(input.title, 220)}, ${clean(input.body, 4000)}, 'open', 0, ${now}, ${now}, ${now})
  `
}

async function sendCommunityReplyNotification(input: {
  courseSlug: string
  threadId: number
  threadTitle: string
  actorName: string
  actorEmail: string
  replyBody: string
  recipients: Array<{ email?: string | null; fullName?: string | null } | null>
}) {
  const actorEmail = clean(input.actorEmail, 220).toLowerCase()
  const recipients = new Map<string, { email: string; fullName: string }>()
  input.recipients.forEach((recipient) => {
    const email = clean(recipient?.email, 220).toLowerCase()
    if (!email || email === actorEmail) return
    recipients.set(email, { email, fullName: clean(recipient?.fullName, 180) })
  })
  if (!recipients.size) return

  const actorName = clean(input.actorName, 180) || "A classmate"
  const threadTitle = clean(input.threadTitle, 220) || "Course Community"
  const threadUrl = `${siteBaseUrl()}/dashboard/courses/player?course=${encodeURIComponent(input.courseSlug)}`
  const replyPreview = clean(input.replyBody, 700)
  await Promise.all(Array.from(recipients.values()).map((recipient) => {
    const firstName = clean(recipient.fullName.split(" ")[0], 80)
    return sendEmail({
      to: recipient.email,
      subject: `${actorName} replied to your message in ${threadTitle}`,
      text: [
        `Hello${firstName ? ` ${firstName}` : ""},`,
        "",
        `${actorName} replied to your message in the course discussion board.`,
        `Thread: ${threadTitle}`,
        replyPreview ? `Reply: ${replyPreview}` : "",
        "",
        `Open discussion board: ${threadUrl}`,
        "",
        "Tochukwu Tech and AI Academy"
      ].filter(Boolean).join("\n"),
      html: [
        `<p>Hello${firstName ? ` ${escapeHtml(firstName)}` : ""},</p>`,
        `<p><strong>${escapeHtml(actorName)}</strong> replied to your message in the course discussion board.</p>`,
        `<p><strong>Thread:</strong> ${escapeHtml(threadTitle)}</p>`,
        replyPreview ? `<p><strong>Reply:</strong><br/>${escapeHtml(replyPreview)}</p>` : "",
        `<p><a href="${escapeHtml(threadUrl)}">Open discussion board</a></p>`,
        `<p>Tochukwu Tech and AI Academy</p>`
      ].filter(Boolean).join("\n")
    })
  }))
}

export async function createLearningReply(input: {
  accountId: bigint
  email: string
  fullName: string
  courseSlug: string
  threadId: number
  parentReplyId?: number | null
  body: string
}) {
  const courseSlug = clean(input.courseSlug, 120).toLowerCase()
  await ensureLearningSupportTables()
  const allowed = await studentHasCourseAccess(input.accountId, input.email, courseSlug)
  if (!allowed) throw new Error("You do not currently have access to this course.")
  const body = clean(input.body, 20000)
  if (body.length < 2) throw new Error("Reply is too short.")
  const threadRows = await prisma.$queryRaw<Array<{ id: bigint; status: string; title: string | null; authorEmail: string | null; authorName: string | null }>>(Prisma.sql`
    SELECT id, status, title, author_email AS authorEmail, author_name AS authorName
    FROM tochukwu_learning_community_threads
    WHERE id = ${input.threadId}
      AND course_slug COLLATE utf8mb4_general_ci = ${courseSlug}
    LIMIT 1
  `)
  const thread = threadRows[0]
  if (!thread) throw new Error("Thread not found.")
  if (clean(thread.status, 24).toLowerCase() === "closed") throw new Error("This thread is closed.")
  const parentReplyId = Number(input.parentReplyId || 0)
  let parentReply: { id: bigint; authorEmail: string | null; authorName: string | null } | null = null
  if (parentReplyId > 0) {
    const parentRows = await prisma.$queryRaw<Array<{ id: bigint; authorEmail: string | null; authorName: string | null }>>(Prisma.sql`
      SELECT id, author_email AS authorEmail, author_name AS authorName
      FROM tochukwu_learning_community_replies
      WHERE id = ${parentReplyId}
        AND thread_id = ${input.threadId}
        AND course_slug COLLATE utf8mb4_general_ci = ${courseSlug}
      LIMIT 1
    `)
    if (!parentRows[0]) throw new Error("Parent reply not found.")
    parentReply = parentRows[0]
  }
  const now = new Date()
  await prisma.$transaction([
    prisma.$executeRaw`
      INSERT INTO tochukwu_learning_community_replies
        (reply_uuid, thread_id, parent_reply_id, course_slug, account_id, author_email, author_name, body, created_at, updated_at)
      VALUES
        (${`comr_${crypto.randomUUID().replace(/-/g, "")}`}, ${input.threadId}, ${parentReplyId > 0 ? parentReplyId : null}, ${courseSlug}, ${input.accountId}, ${input.email.toLowerCase()}, ${input.fullName}, ${body}, ${now}, ${now})
    `,
    prisma.$executeRaw`
      UPDATE tochukwu_learning_community_threads
      SET replies_count = replies_count + 1, last_activity_at = ${now}, updated_at = ${now}
      WHERE id = ${input.threadId}
      LIMIT 1
    `
  ])
  await sendCommunityReplyNotification({
    courseSlug,
    threadId: input.threadId,
    threadTitle: clean(thread.title, 220) || "Course Community",
    actorName: input.fullName,
    actorEmail: input.email,
    replyBody: body,
    recipients: [
      { email: thread.authorEmail, fullName: thread.authorName },
      parentReply ? { email: parentReply.authorEmail, fullName: parentReply.authorName } : null
    ]
  }).catch((error) => {
    console.warn("community_reply_notification_failed", {
      threadId: input.threadId,
      parentReplyId,
      error: error instanceof Error ? error.message : String(error)
    })
  })
}

export async function updateLearningThread(input: { accountId: bigint; email: string; courseSlug: string; threadId: number; title: string; body: string }) {
  const courseSlug = clean(input.courseSlug, 120).toLowerCase()
  const title = clean(input.title, 220)
  const body = clean(input.body, 20000)
  if (title.length < 4) throw new Error("Thread title must be at least 4 characters.")
  if (body.length < 8) throw new Error("Thread body must be at least 8 characters.")
  const now = new Date()
  const updated = await prisma.$executeRaw(Prisma.sql`
    UPDATE tochukwu_learning_community_threads
    SET title = ${title}, body = ${body}, updated_at = ${now}, last_activity_at = ${now}
    WHERE id = ${input.threadId}
      AND course_slug COLLATE utf8mb4_general_ci = ${courseSlug}
      AND account_id = ${input.accountId}
      AND LOWER(author_email) COLLATE utf8mb4_general_ci = ${input.email.toLowerCase()}
    LIMIT 1
  `)
  if (!Number(updated || 0)) throw new Error("Thread not found or you do not have permission to edit it.")
}

export async function deleteLearningThread(input: { accountId: bigint; email: string; courseSlug: string; threadId: number }) {
  const courseSlug = clean(input.courseSlug, 120).toLowerCase()
  const deleted = await prisma.$executeRaw(Prisma.sql`
    DELETE FROM tochukwu_learning_community_threads
    WHERE id = ${input.threadId}
      AND course_slug COLLATE utf8mb4_general_ci = ${courseSlug}
      AND account_id = ${input.accountId}
      AND LOWER(author_email) COLLATE utf8mb4_general_ci = ${input.email.toLowerCase()}
    LIMIT 1
  `)
  if (!Number(deleted || 0)) throw new Error("Thread not found or you do not have permission to delete it.")
  await prisma.$executeRaw(Prisma.sql`
    DELETE FROM tochukwu_learning_community_replies
    WHERE thread_id = ${input.threadId}
      AND course_slug COLLATE utf8mb4_general_ci = ${courseSlug}
  `)
}

export async function updateLearningReply(input: { accountId: bigint; email: string; courseSlug: string; replyId: number; body: string }) {
  const courseSlug = clean(input.courseSlug, 120).toLowerCase()
  const body = clean(input.body, 20000)
  if (body.length < 2) throw new Error("Reply is too short.")
  const now = new Date()
  const rows = await prisma.$queryRaw<Array<{ threadId: bigint }>>(Prisma.sql`
    SELECT thread_id AS threadId
    FROM tochukwu_learning_community_replies
    WHERE id = ${input.replyId}
      AND course_slug COLLATE utf8mb4_general_ci = ${courseSlug}
      AND account_id = ${input.accountId}
      AND LOWER(author_email) COLLATE utf8mb4_general_ci = ${input.email.toLowerCase()}
    LIMIT 1
  `)
  const threadId = rows[0]?.threadId
  if (!threadId) throw new Error("Reply not found or you do not have permission to edit it.")
  await prisma.$transaction([
    prisma.$executeRaw(Prisma.sql`
      UPDATE tochukwu_learning_community_replies
      SET body = ${body}, updated_at = ${now}
      WHERE id = ${input.replyId}
      LIMIT 1
    `),
    prisma.$executeRaw(Prisma.sql`
      UPDATE tochukwu_learning_community_threads
      SET last_activity_at = ${now}, updated_at = ${now}
      WHERE id = ${threadId}
      LIMIT 1
    `)
  ])
}

export async function deleteLearningReply(input: { accountId: bigint; email: string; courseSlug: string; replyId: number }) {
  const courseSlug = clean(input.courseSlug, 120).toLowerCase()
  const rows = await prisma.$queryRaw<Array<{ threadId: bigint }>>(Prisma.sql`
    SELECT thread_id AS threadId
    FROM tochukwu_learning_community_replies
    WHERE id = ${input.replyId}
      AND course_slug COLLATE utf8mb4_general_ci = ${courseSlug}
      AND account_id = ${input.accountId}
      AND LOWER(author_email) COLLATE utf8mb4_general_ci = ${input.email.toLowerCase()}
    LIMIT 1
  `)
  const threadId = rows[0]?.threadId
  if (!threadId) throw new Error("Reply not found or you do not have permission to delete it.")
  const now = new Date()
  await prisma.$transaction([
    prisma.$executeRaw(Prisma.sql`DELETE FROM tochukwu_learning_community_replies WHERE id = ${input.replyId} LIMIT 1`),
    prisma.$executeRaw(Prisma.sql`
      UPDATE tochukwu_learning_community_threads
      SET replies_count = GREATEST(replies_count - 1, 0), last_activity_at = ${now}, updated_at = ${now}
      WHERE id = ${threadId}
      LIMIT 1
    `)
  ])
}

export async function requestTranscriptAccess(input: { accountId: bigint; email: string; courseSlug: string; lessonId?: number | null; reason?: string }) {
  const courseSlug = clean(input.courseSlug, 120).toLowerCase()
  await ensureLearningSupportTables()
  const allowed = await studentHasCourseAccess(input.accountId, input.email, courseSlug)
  if (!allowed) throw new Error("You do not currently have access to this course.")
  const now = new Date()
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO tochukwu_transcript_access
      (account_id, course_slug, status, request_reason, requested_at, created_at, updated_at)
    VALUES
      (${input.accountId}, ${courseSlug}, 'pending', ${clean(input.reason, 4000) || "Accessibility accommodation requested by student."}, ${now}, ${now}, ${now})
    ON DUPLICATE KEY UPDATE
      status = CASE WHEN status = 'approved' THEN status ELSE 'pending' END,
      request_reason = CASE WHEN status = 'approved' THEN request_reason ELSE VALUES(request_reason) END,
      requested_at = CASE WHEN status = 'approved' THEN requested_at ELSE VALUES(requested_at) END,
      updated_at = VALUES(updated_at)
  `)
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO tochukwu_transcript_access_audit
      (account_id, course_slug, lesson_id, event_type, status, detail_json, created_at)
    VALUES
      (${input.accountId}, ${courseSlug}, ${input.lessonId || null}, 'request_submitted', 'pending', ${JSON.stringify({ reason: clean(input.reason, 4000) || null })}, ${now})
  `)
}
