import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { watWallDateTimeMs } from "@/lib/utils"

export type BatchLearnerEnrollment = {
  accountId: bigint
  learnerName: string
  recipientName: string
  recipientEmail: string
  courseSlug: string
  courseName: string
  batchKey: string
  batchLabel: string
  batchStartAt: Date
  enrolledAt: Date | null
  enrollmentSource: "card" | "manual" | "group" | "school"
}

export type LearnerProgressSnapshot = BatchLearnerEnrollment & {
  totalLessons: number
  releasedLessons: number
  completedLessons: number
  remainingLessons: number
  completionPercent: number
  lastActivityAt: Date | null
  lastLessonId: number | null
  lastLessonTitle: string
  resumeLessonId: number | null
  resumeLessonTitle: string
  proofStatus: string
  certificateIssued: boolean
}

type CurriculumRow = {
  courseSlug: string
  courseName: string | null
  moduleId: bigint
  moduleSortOrder: number | bigint | null
  dripEnabled: number | bigint | null
  dripAt: Date | null
  dripBatchKey: string | null
  dripOffsetSeconds: number | bigint | null
  lessonId: bigint
  lessonTitle: string | null
  lessonOrder: number | bigint | null
}

type ProgressRow = {
  accountId: bigint
  lessonId: bigint
  isCompleted: number | bigint | null
  completedAt: Date | null
  lastWatchedAt: Date | null
  updatedAt: Date | null
}

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function normalizeEmail(value: unknown) {
  return clean(value, 220).toLowerCase()
}

function normalizeBatchKey(value: unknown) {
  return clean(value, 64).toLowerCase()
}

function dateMs(value: Date | string | null | undefined) {
  return watWallDateTimeMs(value)
}

function latestDate(...values: Array<Date | null | undefined>) {
  return values.filter((value): value is Date => value instanceof Date)
    .sort((left, right) => right.getTime() - left.getTime())[0] || null
}

export async function listStartedBatchLearnerEnrollments(nowMs = Date.now()) {
  const rows = await prisma.$queryRaw<Array<{
    accountId: bigint
    learnerName: string | null
    recipientName: string | null
    recipientEmail: string | null
    courseSlug: string | null
    courseName: string | null
    batchKey: string | null
    batchLabel: string | null
    batchStartAt: Date | null
    enrolledAt: Date | null
    enrollmentSource: string
  }>>(Prisma.sql`
    SELECT candidate.accountId, candidate.learnerName, candidate.recipientName,
      candidate.recipientEmail, candidate.courseSlug, course.course_title AS courseName,
      candidate.batchKey, candidate.batchLabel, candidate.batchStartAt,
      candidate.enrolledAt, candidate.enrollmentSource
    FROM (
      SELECT sa.id AS accountId,
        COALESCE(NULLIF(sa.full_name, ''), NULLIF(o.first_name, ''), 'Student') COLLATE utf8mb4_unicode_ci AS learnerName,
        COALESCE(NULLIF(sa.full_name, ''), NULLIF(o.first_name, ''), 'Student') COLLATE utf8mb4_unicode_ci AS recipientName,
        LOWER(sa.email) COLLATE utf8mb4_unicode_ci AS recipientEmail,
        o.course_slug COLLATE utf8mb4_unicode_ci AS courseSlug,
        o.batch_key COLLATE utf8mb4_unicode_ci AS batchKey,
        COALESCE(o.batch_label, b.batch_label, o.batch_key) COLLATE utf8mb4_unicode_ci AS batchLabel,
        b.batch_start_at AS batchStartAt,
        COALESCE(o.paid_at, o.updated_at, o.created_at) AS enrolledAt,
        'card' COLLATE utf8mb4_unicode_ci AS enrollmentSource
      FROM course_orders o
      JOIN student_accounts sa
        ON LOWER(sa.email) COLLATE utf8mb4_unicode_ci = LOWER(o.email) COLLATE utf8mb4_unicode_ci
      JOIN course_batches b
        ON b.course_slug COLLATE utf8mb4_unicode_ci = o.course_slug COLLATE utf8mb4_unicode_ci
       AND b.batch_key COLLATE utf8mb4_unicode_ci = o.batch_key COLLATE utf8mb4_unicode_ci
      WHERE o.status = 'paid'
        AND COALESCE(o.buyer_type, 'student') <> 'family'
        AND b.batch_start_at IS NOT NULL

      UNION ALL

      SELECT sa.id AS accountId,
        COALESCE(NULLIF(sa.full_name, ''), NULLIF(m.first_name, ''), 'Student') COLLATE utf8mb4_unicode_ci AS learnerName,
        COALESCE(NULLIF(sa.full_name, ''), NULLIF(m.first_name, ''), 'Student') COLLATE utf8mb4_unicode_ci AS recipientName,
        LOWER(sa.email) COLLATE utf8mb4_unicode_ci AS recipientEmail,
        m.course_slug COLLATE utf8mb4_unicode_ci AS courseSlug,
        m.batch_key COLLATE utf8mb4_unicode_ci AS batchKey,
        COALESCE(m.batch_label, b.batch_label, m.batch_key) COLLATE utf8mb4_unicode_ci AS batchLabel,
        b.batch_start_at AS batchStartAt,
        COALESCE(m.reviewed_at, m.updated_at, m.created_at) AS enrolledAt,
        'manual' COLLATE utf8mb4_unicode_ci AS enrollmentSource
      FROM course_manual_payments m
      JOIN student_accounts sa
        ON LOWER(sa.email) COLLATE utf8mb4_unicode_ci = LOWER(m.email) COLLATE utf8mb4_unicode_ci
      JOIN course_batches b
        ON b.course_slug COLLATE utf8mb4_unicode_ci = m.course_slug COLLATE utf8mb4_unicode_ci
       AND b.batch_key COLLATE utf8mb4_unicode_ci = m.batch_key COLLATE utf8mb4_unicode_ci
      WHERE m.status = 'approved'
        AND COALESCE(m.buyer_type, 'student') <> 'family'
        AND b.batch_start_at IS NOT NULL

      UNION ALL

      SELECT c.account_id AS accountId,
        COALESCE(NULLIF(c.full_name, ''), NULLIF(sa.full_name, ''), 'Learner') COLLATE utf8mb4_unicode_ci AS learnerName,
        COALESCE(NULLIF(f.parent_name, ''), 'Parent') COLLATE utf8mb4_unicode_ci AS recipientName,
        LOWER(f.parent_email) COLLATE utf8mb4_unicode_ci AS recipientEmail,
        e.course_slug COLLATE utf8mb4_unicode_ci AS courseSlug,
        e.batch_key COLLATE utf8mb4_unicode_ci AS batchKey,
        COALESCE(e.batch_label, b.batch_label, e.batch_key) COLLATE utf8mb4_unicode_ci AS batchLabel,
        b.batch_start_at AS batchStartAt,
        COALESCE(e.paid_at, e.updated_at, e.created_at) AS enrolledAt,
        'group' COLLATE utf8mb4_unicode_ci AS enrollmentSource
      FROM family_child_enrollments e
      JOIN family_children c ON c.id = e.child_id AND c.family_id = e.family_id
      JOIN family_accounts f ON f.id = e.family_id
      JOIN student_accounts sa ON sa.id = c.account_id
      JOIN course_batches b
        ON b.course_slug COLLATE utf8mb4_unicode_ci = e.course_slug COLLATE utf8mb4_unicode_ci
       AND b.batch_key COLLATE utf8mb4_unicode_ci = e.batch_key COLLATE utf8mb4_unicode_ci
      WHERE e.status = 'active'
        AND c.status = 'active'
        AND f.status = 'active'
        AND c.account_id IS NOT NULL
        AND b.batch_start_at IS NOT NULL

      UNION ALL

      SELECT ss.account_id AS accountId,
        COALESCE(NULLIF(ss.full_name, ''), NULLIF(learner.full_name, ''), 'Learner') COLLATE utf8mb4_unicode_ci AS learnerName,
        COALESCE(NULLIF(admin.full_name, ''), NULLIF(sc.school_name, ''), 'School Administrator') COLLATE utf8mb4_unicode_ci AS recipientName,
        LOWER(admin.email) COLLATE utf8mb4_unicode_ci AS recipientEmail,
        sc.course_slug COLLATE utf8mb4_unicode_ci AS courseSlug,
        CONCAT('school-', sc.id) COLLATE utf8mb4_unicode_ci AS batchKey,
        COALESCE(NULLIF(sc.school_name, ''), 'School Registration') COLLATE utf8mb4_unicode_ci AS batchLabel,
        COALESCE(sc.paid_at, ss.created_at) AS batchStartAt,
        COALESCE(sc.paid_at, ss.created_at) AS enrolledAt,
        'school' COLLATE utf8mb4_unicode_ci AS enrollmentSource
      FROM school_students ss
      JOIN school_accounts sc ON sc.id = ss.school_id AND sc.status = 'active'
      JOIN student_accounts learner ON learner.id = ss.account_id
      JOIN school_admins admin ON admin.school_id = sc.id AND admin.is_active = 1
      WHERE ss.status = 'active'
        AND ss.account_id IS NOT NULL
        AND COALESCE(TRIM(sc.course_slug), '') <> ''
        AND (sc.access_expires_at IS NULL OR sc.access_expires_at >= NOW())
        AND admin.id = (
          SELECT MIN(primary_admin.id) FROM school_admins primary_admin
          WHERE primary_admin.school_id = sc.id AND primary_admin.is_active = 1
        )
    ) candidate
    JOIN tochukwu_learning_courses course
      ON course.course_slug COLLATE utf8mb4_unicode_ci = candidate.courseSlug COLLATE utf8mb4_unicode_ci
    WHERE course.is_published = 1
  `)

  const deduped = new Map<string, BatchLearnerEnrollment>()
  for (const row of rows) {
    const batchStartAt = row.batchStartAt
    const batchStartMs = dateMs(batchStartAt)
    const accountId = row.accountId
    const courseSlug = clean(row.courseSlug, 120).toLowerCase()
    const batchKey = normalizeBatchKey(row.batchKey)
    const recipientEmail = normalizeEmail(row.recipientEmail)
    if (!accountId || !courseSlug || !batchKey || !recipientEmail || !batchStartAt) continue
    if (!Number.isFinite(batchStartMs) || batchStartMs > nowMs) continue
    const key = `${accountId.toString()}::${courseSlug}::${batchKey}`
    const candidate: BatchLearnerEnrollment = {
      accountId,
      learnerName: clean(row.learnerName, 180) || "Learner",
      recipientName: clean(row.recipientName, 180) || clean(row.learnerName, 180) || "Student",
      recipientEmail,
      courseSlug,
      courseName: clean(row.courseName, 220) || courseSlug,
      batchKey,
      batchLabel: clean(row.batchLabel, 120) || batchKey,
      batchStartAt,
      enrolledAt: row.enrolledAt,
      enrollmentSource: ["manual", "group", "school"].includes(row.enrollmentSource)
        ? row.enrollmentSource as "manual" | "group" | "school"
        : "card"
    }
    const existing = deduped.get(key)
    if (!existing || (candidate.enrolledAt?.getTime() || 0) > (existing.enrolledAt?.getTime() || 0)) {
      deduped.set(key, candidate)
    }
  }
  return Array.from(deduped.values())
}

function moduleReleased(input: {
  row: CurriculumRow
  batchKey: string
  batchStartAt: Date
  schedules: Map<string, { accessMode: string; dripAt: Date | null }>
  nowMs: number
}) {
  if (Number(input.row.dripEnabled || 0) !== 1) return true
  if (input.schedules.size) {
    const schedule = input.schedules.get(input.batchKey)
    if (!schedule) return false
    if (clean(schedule.accessMode, 24).toLowerCase() === "immediate") return true
    const dripAtMs = dateMs(schedule.dripAt)
    return !Number.isFinite(dripAtMs) || input.nowMs >= dripAtMs
  }
  const targetBatchKey = normalizeBatchKey(input.row.dripBatchKey)
  if (targetBatchKey && targetBatchKey !== input.batchKey) return false
  const offsetSeconds = Number(input.row.dripOffsetSeconds)
  if (!targetBatchKey && Number.isFinite(offsetSeconds)) {
    const startMs = dateMs(input.batchStartAt)
    return Number.isFinite(startMs) && input.nowMs >= startMs + offsetSeconds * 1000
  }
  const dripAtMs = dateMs(input.row.dripAt)
  return !Number.isFinite(dripAtMs) || input.nowMs >= dripAtMs
}

export async function buildLearnerProgressSnapshots(
  enrollments: BatchLearnerEnrollment[],
  nowMs = Date.now()
) {
  if (!enrollments.length) return []
  const courseSlugs = Array.from(new Set(enrollments.map((row) => row.courseSlug)))
  const accountIds = Array.from(new Set(enrollments.map((row) => row.accountId.toString()))).map((id) => BigInt(id))

  const curriculum = await prisma.$queryRaw<CurriculumRow[]>(Prisma.sql`
    SELECT cm.course_slug AS courseSlug, c.course_title AS courseName,
      m.id AS moduleId, cm.sort_order AS moduleSortOrder,
      cm.drip_enabled AS dripEnabled, cm.drip_at AS dripAt,
      cm.drip_batch_key AS dripBatchKey, cm.drip_offset_seconds AS dripOffsetSeconds,
      l.id AS lessonId, l.lesson_title AS lessonTitle, l.lesson_order AS lessonOrder
    FROM tochukwu_learning_course_modules cm
    JOIN tochukwu_learning_courses c
      ON c.course_slug COLLATE utf8mb4_unicode_ci = cm.course_slug COLLATE utf8mb4_unicode_ci
    JOIN tochukwu_learning_modules m ON m.id = cm.module_id
    JOIN tochukwu_learning_lessons l ON l.module_id = m.id AND l.is_active = 1
    WHERE cm.course_slug IN (${Prisma.join(courseSlugs)})
      AND cm.is_active = 1
      AND m.is_active = 1
      AND c.is_published = 1
      AND (c.release_at IS NULL OR c.release_at <= NOW())
    ORDER BY cm.course_slug, cm.sort_order, cm.id, l.lesson_order, l.id
  `)
  const moduleIds = Array.from(new Set(curriculum.map((row) => row.moduleId.toString()))).map((id) => BigInt(id))
  const lessonIds = Array.from(new Set(curriculum.map((row) => row.lessonId.toString()))).map((id) => BigInt(id))
  const [scheduleRows, progressRows, proofRows, certificateRows] = await Promise.all([
    moduleIds.length
      ? prisma.$queryRaw<Array<{ moduleId: bigint; batchKey: string; accessMode: string; dripAt: Date | null }>>(Prisma.sql`
          SELECT module_id AS moduleId, batch_key AS batchKey, access_mode AS accessMode, drip_at AS dripAt
          FROM tochukwu_learning_module_batch_drips
          WHERE module_id IN (${Prisma.join(moduleIds)})
        `)
      : Promise.resolve([]),
    accountIds.length && lessonIds.length
      ? prisma.$queryRaw<ProgressRow[]>(Prisma.sql`
          SELECT account_id AS accountId, lesson_id AS lessonId, is_completed AS isCompleted,
            completed_at AS completedAt, last_watched_at AS lastWatchedAt, updated_at AS updatedAt
          FROM tochukwu_learning_lesson_progress
          WHERE account_id IN (${Prisma.join(accountIds)})
            AND lesson_id IN (${Prisma.join(lessonIds)})
        `)
      : Promise.resolve([]),
    prisma.$queryRaw<Array<{ accountId: bigint; courseSlug: string; batchKey: string; status: string }>>(Prisma.sql`
      SELECT account_id AS accountId, course_slug AS courseSlug,
        COALESCE(certificate_batch_key, '') AS batchKey, status
      FROM tochukwu_learning_assignments
      WHERE account_id IN (${Prisma.join(accountIds)})
        AND course_slug IN (${Prisma.join(courseSlugs)})
        AND submission_kind = 'link'
        AND submission_text = '[CERTIFICATE_PROOF_WEBSITE]'
      ORDER BY id DESC
    `).catch(() => []),
    prisma.$queryRaw<Array<{ accountId: bigint; courseSlug: string }>>(Prisma.sql`
      SELECT DISTINCT account_id AS accountId, course_slug AS courseSlug
      FROM student_certificates
      WHERE account_id IN (${Prisma.join(accountIds)})
        AND course_slug IN (${Prisma.join(courseSlugs)})
        AND status = 'issued'
    `).catch(() => [])
  ])

  const schedulesByModule = new Map<string, Map<string, { accessMode: string; dripAt: Date | null }>>()
  for (const row of scheduleRows) {
    const moduleKey = row.moduleId.toString()
    if (!schedulesByModule.has(moduleKey)) schedulesByModule.set(moduleKey, new Map())
    schedulesByModule.get(moduleKey)?.set(normalizeBatchKey(row.batchKey), {
      accessMode: clean(row.accessMode, 24),
      dripAt: row.dripAt
    })
  }
  const curriculumByCourse = new Map<string, CurriculumRow[]>()
  for (const row of curriculum) {
    const key = clean(row.courseSlug, 120).toLowerCase()
    curriculumByCourse.set(key, [...(curriculumByCourse.get(key) || []), row])
  }
  const progressByAccountLesson = new Map<string, ProgressRow>()
  for (const row of progressRows) progressByAccountLesson.set(`${row.accountId.toString()}::${row.lessonId.toString()}`, row)
  const proofByKey = new Map<string, string>()
  for (const row of proofRows) {
    const key = `${row.accountId.toString()}::${clean(row.courseSlug, 120).toLowerCase()}::${normalizeBatchKey(row.batchKey)}`
    if (!proofByKey.has(key)) proofByKey.set(key, clean(row.status, 32).toLowerCase())
  }
  const certificateKeys = new Set(certificateRows.map((row) => `${row.accountId.toString()}::${clean(row.courseSlug, 120).toLowerCase()}`))

  return enrollments.map<LearnerProgressSnapshot>((enrollment) => {
    const courseRows = curriculumByCourse.get(enrollment.courseSlug) || []
    const releasedRows = courseRows.filter((row) => moduleReleased({
      row,
      batchKey: enrollment.batchKey,
      batchStartAt: enrollment.batchStartAt,
      schedules: schedulesByModule.get(row.moduleId.toString()) || new Map(),
      nowMs
    }))
    const releasedLessonIds = new Set(releasedRows.map((row) => row.lessonId.toString()))
    const uniqueLessons = new Map<string, CurriculumRow>()
    for (const row of courseRows) uniqueLessons.set(row.lessonId.toString(), row)
    const orderedLessons = Array.from(uniqueLessons.values()).sort((left, right) =>
      Number(left.moduleSortOrder || 0) - Number(right.moduleSortOrder || 0)
      || Number(left.lessonOrder || 0) - Number(right.lessonOrder || 0)
      || Number(left.lessonId - right.lessonId)
    )
    let completedLessons = 0
    let lastActivityAt: Date | null = null
    let lastLessonId: number | null = null
    let lastLessonTitle = ""
    let resumeLesson: CurriculumRow | null = null
    for (const lesson of orderedLessons) {
      const progress = progressByAccountLesson.get(`${enrollment.accountId.toString()}::${lesson.lessonId.toString()}`)
      const completed = Number(progress?.isCompleted || 0) === 1
      if (completed) completedLessons += 1
      const released = releasedLessonIds.has(lesson.lessonId.toString())
      if (released && !completed && !resumeLesson) resumeLesson = lesson
      const activityAt = latestDate(progress?.lastWatchedAt, progress?.completedAt)
      if (activityAt && (!lastActivityAt || activityAt.getTime() > lastActivityAt.getTime())) {
        lastActivityAt = activityAt
        lastLessonId = Number(lesson.lessonId)
        lastLessonTitle = clean(lesson.lessonTitle, 220)
        if (released && !completed) resumeLesson = lesson
      }
    }
    const totalLessons = orderedLessons.length
    const proofKey = `${enrollment.accountId.toString()}::${enrollment.courseSlug}::${enrollment.batchKey}`
    return {
      ...enrollment,
      totalLessons,
      releasedLessons: releasedLessonIds.size,
      completedLessons,
      remainingLessons: Math.max(0, totalLessons - completedLessons),
      completionPercent: totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0,
      lastActivityAt,
      lastLessonId,
      lastLessonTitle,
      resumeLessonId: resumeLesson ? Number(resumeLesson.lessonId) : null,
      resumeLessonTitle: clean(resumeLesson?.lessonTitle, 220),
      proofStatus: proofByKey.get(proofKey) || "",
      certificateIssued: certificateKeys.has(`${enrollment.accountId.toString()}::${enrollment.courseSlug}`)
    }
  })
}

export async function listStartedLearnerProgressSnapshots(nowMs = Date.now()) {
  const enrollments = await listStartedBatchLearnerEnrollments(nowMs)
  return buildLearnerProgressSnapshots(enrollments, nowMs)
}
