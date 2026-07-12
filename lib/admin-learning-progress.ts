import { configuredLearningCourseSlugSql, dayLevelCourseSlugRegex } from "@/lib/learning-course-catalog"
import { prisma } from "@/lib/prisma"

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function normKey(value: unknown) {
  return clean(value, 300).toLowerCase().replace(/\s+/g, " ").trim()
}

function normalizeDate(value: unknown): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

function canonicalizeCourseSlug(value: unknown) {
  const slug = clean(value, 120).toLowerCase()
  if (["prompt-to-profit-holiday", "prompt-to-profit-job-seekers", "prompt-to-profit-children"].includes(slug)) {
    return "prompt-to-profit"
  }
  if (slug === "prompt-to-profit-advanced") return "prompt-to-production"
  return slug || "prompt-to-profit"
}

function placeholders(values: unknown[]) {
  return values.map(() => "?").join(",")
}

type CanonicalLesson = {
  canonicalLessonKey: string
  lessonSlug: string
  lessonTitle: string
  lessonOrder: number
  sourceLessonIds: Set<number>
}

type CanonicalModule = {
  moduleKey: string
  moduleId: number
  moduleSlug: string
  moduleTitle: string
  sortOrder: number
  lessonsMap: Map<string, CanonicalLesson>
}

type CourseStructureRow = {
  module_id: bigint | number | null
  module_slug: string | null
  module_title: string | null
  sort_order: bigint | number | null
  lesson_id: bigint | number | null
  lesson_slug: string | null
  lesson_title: string | null
  lesson_order: bigint | number | null
  video_uid: string | null
}

function buildCanonicalCourseStructure(courseSlug: string, rows: CourseStructureRow[]) {
  const moduleMap = new Map<string, CanonicalModule>()
  const lessonBySourceLessonId = new Map<number, { moduleKey: string; canonicalLessonKey: string; lessonTitle: string }>()

  for (const row of rows || []) {
    const moduleId = Number(row.module_id || 0)
    if (!moduleId) continue
    const moduleSlug = clean(row.module_slug, 160)
    const moduleTitle = clean(row.module_title, 220) || "Module"
    const moduleSort = Number(row.sort_order || 0)
    const moduleKey = [normKey(courseSlug), normKey(moduleTitle) || normKey(moduleSlug) || String(moduleId)].join("::")
    if (!moduleMap.has(moduleKey)) {
      moduleMap.set(moduleKey, {
        moduleKey,
        moduleId,
        moduleSlug,
        moduleTitle,
        sortOrder: moduleSort,
        lessonsMap: new Map()
      })
    }
    const moduleBucket = moduleMap.get(moduleKey)
    if (!moduleBucket) continue
    if (moduleId < moduleBucket.moduleId) moduleBucket.moduleId = moduleId
    if (!moduleBucket.moduleTitle && moduleTitle) moduleBucket.moduleTitle = moduleTitle
    if (!moduleBucket.moduleSlug && moduleSlug) moduleBucket.moduleSlug = moduleSlug
    if (moduleSort < moduleBucket.sortOrder) moduleBucket.sortOrder = moduleSort

    const lessonId = Number(row.lesson_id || 0)
    if (!lessonId) continue
    const lessonSlug = clean(row.lesson_slug, 160)
    const lessonTitle = clean(row.lesson_title, 220) || "Lesson"
    const lessonOrder = Number(row.lesson_order || 0)
    const lessonKey = [
      moduleKey,
      normKey(lessonSlug) || normKey(lessonTitle) || String(lessonId),
      normKey(lessonTitle),
      normKey(row.video_uid)
    ].join("::")
    if (!moduleBucket.lessonsMap.has(lessonKey)) {
      moduleBucket.lessonsMap.set(lessonKey, {
        canonicalLessonKey: lessonKey,
        lessonSlug,
        lessonTitle,
        lessonOrder,
        sourceLessonIds: new Set()
      })
    }
    const lessonBucket = moduleBucket.lessonsMap.get(lessonKey)
    if (!lessonBucket) continue
    if (!lessonBucket.lessonTitle && lessonTitle) lessonBucket.lessonTitle = lessonTitle
    if (!lessonBucket.lessonSlug && lessonSlug) lessonBucket.lessonSlug = lessonSlug
    if (lessonOrder < lessonBucket.lessonOrder) lessonBucket.lessonOrder = lessonOrder
    lessonBucket.sourceLessonIds.add(lessonId)
    lessonBySourceLessonId.set(lessonId, {
      moduleKey,
      canonicalLessonKey: lessonKey,
      lessonTitle: lessonBucket.lessonTitle
    })
  }

  const modules = Array.from(moduleMap.values())
    .map((moduleBucket) => ({
      moduleKey: moduleBucket.moduleKey,
      moduleId: moduleBucket.moduleId,
      moduleSlug: moduleBucket.moduleSlug,
      moduleTitle: moduleBucket.moduleTitle,
      sortOrder: moduleBucket.sortOrder,
      lessons: Array.from(moduleBucket.lessonsMap.values())
        .map((lessonBucket) => ({
          canonicalLessonKey: lessonBucket.canonicalLessonKey,
          lessonSlug: lessonBucket.lessonSlug,
          lessonTitle: lessonBucket.lessonTitle,
          lessonOrder: lessonBucket.lessonOrder,
          sourceLessonIds: Array.from(lessonBucket.sourceLessonIds.values())
        }))
        .sort((a, b) => a.lessonOrder !== b.lessonOrder ? a.lessonOrder - b.lessonOrder : a.lessonTitle.localeCompare(b.lessonTitle))
    }))
    .sort((a, b) => a.sortOrder !== b.sortOrder ? a.sortOrder - b.sortOrder : a.moduleId - b.moduleId)

  return {
    modules,
    moduleByKey: new Map(modules.map((moduleRow) => [moduleRow.moduleKey, moduleRow])),
    lessonBySourceLessonId,
    totalLessons: modules.reduce((sum, moduleRow) => sum + moduleRow.lessons.length, 0)
  }
}

export async function ensureLearningProgressTable() {
  await prisma.$executeRawUnsafe(`
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
  `)
}

export async function listLearningProgressCourseOptions() {
  return prisma.$queryRaw<Array<{ courseSlug: string; courseTitle: string }>>`
    SELECT course_slug AS courseSlug, course_title AS courseTitle
    FROM tochukwu_learning_courses
    WHERE (is_published = 1 OR course_slug IN ('prompt-to-profit', 'prompt-to-production', 'prompt-to-profit-schools'))
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
    ORDER BY course_title ASC
  `.catch(() => [])
}

export async function listStudentsProgressByCourse(input?: {
  courseSlug?: string
  enrollmentType?: string
  batchKey?: string
  search?: string
}) {
  await ensureLearningProgressTable()
  const courseSlug = canonicalizeCourseSlug(input?.courseSlug)
  const search = clean(input?.search, 180).toLowerCase()
  const enrollmentType = ["all", "individual", "school"].includes(clean(input?.enrollmentType, 40).toLowerCase())
    ? clean(input?.enrollmentType, 40).toLowerCase()
    : "all"
  const batchKey = clean(input?.batchKey || "all", 120).toLowerCase() || "all"
  const normalizedBatchKey = batchKey === "unspecified" ? "" : batchKey
  const legacyCourseSlugs = courseSlug === "prompt-to-profit-schools" ? ["prompt-to-profit-for-schools"] : []
  const courseSlugScope = [courseSlug, ...legacyCourseSlugs]
  const schoolCourseSlugScope = courseSlug === "prompt-to-profit-schools"
    ? [courseSlug, "prompt-to-profit", ...legacyCourseSlugs]
    : [...courseSlugScope]

  const courseSlugWhereSql = courseSlugScope.length === 1 ? "= ?" : `IN (${placeholders(courseSlugScope)})`
  const schoolCourseSlugWhereSql = schoolCourseSlugScope.length === 1 ? "= ?" : `IN (${placeholders(schoolCourseSlugScope)})`

  const courseRows = await prisma.$queryRawUnsafe<CourseStructureRow[]>(`
    SELECT m.id AS module_id, m.module_slug, m.module_title, m.sort_order,
      l.id AS lesson_id, l.lesson_slug, l.lesson_title, l.lesson_order, a.video_uid
    FROM tochukwu_learning_modules m
    LEFT JOIN tochukwu_learning_lessons l ON l.module_id = m.id AND l.is_active = 1
    LEFT JOIN tochukwu_learning_video_assets a ON a.id = l.video_asset_id
    WHERE m.course_slug = ? AND m.is_active = 1
    ORDER BY m.sort_order ASC, m.id ASC, l.lesson_order ASC, l.id ASC
  `, courseSlug).catch(() => [])
  const canonicalCourse = buildCanonicalCourseStructure(courseSlug, courseRows)
  const totalLessons = canonicalCourse.totalLessons

  const studentRows = await prisma.$queryRawUnsafe<Array<{
    account_id: bigint | number | null
    full_name: string | null
    email: string | null
    enrollment_type: string | null
    batch_key: string | null
    batch_label: string | null
    school_name: string | null
    first_paid_at: Date | null
    last_activity_at: Date | null
  }>>(`
    SELECT
      COALESCE(sa.id, 0) AS account_id,
      COALESCE(NULLIF(sa.full_name, ''), enrolled.full_name, 'Student') AS full_name,
      enrolled.email,
      enrolled.enrollment_type,
      enrolled.batch_key,
      enrolled.batch_label,
      enrolled.school_name,
      enrolled.first_paid_at,
      MAX(CASE WHEN m.id IS NOT NULL THEN COALESCE(p.last_watched_at, p.completed_at) ELSE NULL END) AS last_activity_at
    FROM (
      SELECT x.email, x.enrollment_type, x.batch_key, x.batch_label, x.school_name,
        MIN(x.first_paid_at) AS first_paid_at, MAX(x.full_name) AS full_name
      FROM (
        SELECT LOWER(email) COLLATE utf8mb4_general_ci AS email,
          'individual' AS enrollment_type,
          LOWER(COALESCE(batch_key, '')) COLLATE utf8mb4_general_ci AS batch_key,
          COALESCE(batch_label, 'Unspecified Batch') COLLATE utf8mb4_general_ci AS batch_label,
          '' COLLATE utf8mb4_general_ci AS school_name,
          MIN(paid_at) AS first_paid_at,
          MAX(COALESCE(first_name, '')) COLLATE utf8mb4_general_ci AS full_name
        FROM course_orders
        WHERE course_slug ${courseSlugWhereSql}
          AND status = 'paid'
          AND COALESCE(buyer_type, 'student') <> 'family'
        GROUP BY LOWER(email) COLLATE utf8mb4_general_ci, LOWER(COALESCE(batch_key, '')) COLLATE utf8mb4_general_ci, COALESCE(batch_label, 'Unspecified Batch') COLLATE utf8mb4_general_ci

        UNION ALL

        SELECT LOWER(email) COLLATE utf8mb4_general_ci AS email,
          'individual' AS enrollment_type,
          LOWER(COALESCE(batch_key, '')) COLLATE utf8mb4_general_ci AS batch_key,
          COALESCE(batch_label, 'Unspecified Batch') COLLATE utf8mb4_general_ci AS batch_label,
          '' COLLATE utf8mb4_general_ci AS school_name,
          MIN(reviewed_at) AS first_paid_at,
          MAX(COALESCE(first_name, '')) COLLATE utf8mb4_general_ci AS full_name
        FROM course_manual_payments
        WHERE course_slug ${courseSlugWhereSql}
          AND status = 'approved'
          AND COALESCE(buyer_type, 'student') <> 'family'
        GROUP BY LOWER(email) COLLATE utf8mb4_general_ci, LOWER(COALESCE(batch_key, '')) COLLATE utf8mb4_general_ci, COALESCE(batch_label, 'Unspecified Batch') COLLATE utf8mb4_general_ci

        UNION ALL

        SELECT LOWER(ss.email) COLLATE utf8mb4_general_ci AS email,
          'school' AS enrollment_type,
          'school' COLLATE utf8mb4_general_ci AS batch_key,
          'School Registration' COLLATE utf8mb4_general_ci AS batch_label,
          COALESCE(sc.school_name, '') COLLATE utf8mb4_general_ci AS school_name,
          MIN(COALESCE(sc.paid_at, ss.created_at)) AS first_paid_at,
          MAX(COALESCE(ss.full_name, '')) COLLATE utf8mb4_general_ci AS full_name
        FROM school_students ss
        JOIN school_accounts sc ON sc.id = ss.school_id
        WHERE sc.course_slug ${schoolCourseSlugWhereSql}
          AND sc.status = 'active'
          AND ss.status = 'active'
          AND (sc.access_expires_at IS NULL OR sc.access_expires_at >= NOW())
        GROUP BY LOWER(ss.email) COLLATE utf8mb4_general_ci, COALESCE(sc.school_name, '') COLLATE utf8mb4_general_ci
      ) x
      WHERE (? = 'all' OR x.enrollment_type = ?)
        AND (
          ? = 'all'
          OR (? = 'school' AND x.enrollment_type = 'school')
          OR (x.enrollment_type = 'individual' AND COALESCE(x.batch_key, '') = ?)
        )
      GROUP BY x.email, x.enrollment_type, x.batch_key, x.batch_label, x.school_name
    ) enrolled
    LEFT JOIN student_accounts sa ON enrolled.email = LOWER(sa.email) COLLATE utf8mb4_general_ci
    LEFT JOIN tochukwu_learning_lesson_progress p ON p.account_id = sa.id
    LEFT JOIN tochukwu_learning_lessons l ON l.id = p.lesson_id
    LEFT JOIN tochukwu_learning_modules m ON m.id = l.module_id AND m.course_slug = ?
    WHERE (? = ''
      OR LOWER(COALESCE(sa.full_name, enrolled.full_name)) COLLATE utf8mb4_general_ci LIKE CONCAT('%', ?, '%')
      OR LOWER(enrolled.email) COLLATE utf8mb4_general_ci LIKE CONCAT('%', ?, '%')
      OR LOWER(enrolled.school_name) COLLATE utf8mb4_general_ci LIKE CONCAT('%', ?, '%'))
    GROUP BY sa.id, sa.full_name, enrolled.email, enrolled.enrollment_type, enrolled.batch_key,
      enrolled.batch_label, enrolled.school_name, enrolled.full_name, enrolled.first_paid_at
    ORDER BY COALESCE(MAX(COALESCE(p.last_watched_at, p.completed_at)), enrolled.first_paid_at) DESC, enrolled.email ASC
  `,
    ...courseSlugScope,
    ...courseSlugScope,
    ...schoolCourseSlugScope,
    enrollmentType,
    enrollmentType,
    batchKey,
    batchKey,
    normalizedBatchKey,
    courseSlug,
    search,
    search,
    search,
    search
  ).catch(() => [])

  const students = studentRows.map((row) => {
    const normalizedType = clean(row.enrollment_type, 30).toLowerCase() === "school" ? "school" : "individual"
    const normalizedBatch = clean(row.batch_key, 120).toLowerCase()
    return {
      accountId: Number(row.account_id || 0) || null,
      fullName: clean(row.full_name, 180),
      email: clean(row.email, 220),
      enrollmentType: normalizedType,
      batchKey: normalizedType === "school" ? "school" : (normalizedBatch || "unspecified"),
      batchLabel: normalizedType === "school" ? "School Registration" : (clean(row.batch_label, 120) || "Unspecified Batch"),
      schoolName: clean(row.school_name, 220),
      firstPaidAt: normalizeDate(row.first_paid_at),
      completedLessons: 0,
      totalLessons,
      completionPercent: 0,
      lastActivityAt: normalizeDate(row.last_activity_at),
      lastWatchedLessonTitle: "",
      lastWatchedAt: null as string | null,
      moduleBreakdown: [] as Array<{ moduleId: number; moduleTitle: string; completedLessons: number; totalLessons: number; completionPercent: number }>
    }
  })

  const accountIds = students.map((row) => Number(row.accountId || 0)).filter((id) => id > 0)
  const canonicalModules = canonicalCourse.modules.map((moduleRow) => ({
    moduleId: moduleRow.moduleId,
    moduleTitle: moduleRow.moduleTitle,
    totalLessons: moduleRow.lessons.length
  }))
  const completedLessonKeysByAccount = new Map<string, Set<string>>()
  const completedLessonKeysByAccountModule = new Map<string, Set<string>>()
  const lastWatchedByAccount = new Map<number, { lessonTitle: string; watchedAt: string | null }>()

  if (accountIds.length) {
    const progressRows = await prisma.$queryRawUnsafe<Array<{
      account_id: bigint | number
      lesson_id: bigint | number
      is_completed: bigint | number
      lesson_title: string | null
      watched_at: Date | null
    }>>(`
      SELECT p.account_id, p.lesson_id, p.is_completed, l.lesson_title,
        COALESCE(p.last_watched_at, p.completed_at, p.updated_at) AS watched_at
      FROM tochukwu_learning_lesson_progress p
      JOIN tochukwu_learning_lessons l ON l.id = p.lesson_id AND l.is_active = 1
      JOIN tochukwu_learning_modules m ON m.id = l.module_id AND m.is_active = 1
      WHERE m.course_slug = ? AND p.account_id IN (${placeholders(accountIds)})
      ORDER BY p.account_id ASC, COALESCE(p.last_watched_at, p.completed_at, p.updated_at) DESC, p.lesson_id DESC
    `, courseSlug, ...accountIds).catch(() => [])

    for (const row of progressRows) {
      const accountId = Number(row.account_id || 0)
      const sourceLessonId = Number(row.lesson_id || 0)
      if (!accountId || !sourceLessonId) continue
      const canonical = canonicalCourse.lessonBySourceLessonId.get(sourceLessonId)
      if (!canonical) continue
      const watchedAt = normalizeDate(row.watched_at)
      const existingLast = lastWatchedByAccount.get(accountId) || null
      if (!existingLast || (watchedAt && new Date(watchedAt).getTime() > new Date(existingLast.watchedAt || 0).getTime())) {
        lastWatchedByAccount.set(accountId, {
          lessonTitle: clean(canonical.lessonTitle || row.lesson_title, 220),
          watchedAt
        })
      }
      if (Number(row.is_completed || 0) !== 1) continue
      const accountKey = String(accountId)
      const moduleBucket = canonicalCourse.moduleByKey.get(canonical.moduleKey)
      if (!moduleBucket) continue
      const accountModuleKey = `${accountKey}::${moduleBucket.moduleId}`
      if (!completedLessonKeysByAccount.has(accountKey)) completedLessonKeysByAccount.set(accountKey, new Set())
      completedLessonKeysByAccount.get(accountKey)?.add(canonical.canonicalLessonKey)
      if (!completedLessonKeysByAccountModule.has(accountModuleKey)) completedLessonKeysByAccountModule.set(accountModuleKey, new Set())
      completedLessonKeysByAccountModule.get(accountModuleKey)?.add(canonical.canonicalLessonKey)
    }
  }

  for (const student of students) {
    const accountId = Number(student.accountId || 0)
    const accountKey = String(accountId)
    const last = lastWatchedByAccount.get(accountId) || null
    const completedSet = completedLessonKeysByAccount.get(accountKey) || new Set()
    student.completedLessons = completedSet.size
    student.completionPercent = totalLessons ? Math.round((completedSet.size / totalLessons) * 100) : 0
    student.lastWatchedLessonTitle = last?.lessonTitle || ""
    student.lastWatchedAt = last?.watchedAt || null
    student.moduleBreakdown = canonicalModules.map((moduleRow) => {
      const key = `${accountId}::${moduleRow.moduleId}`
      const completed = (completedLessonKeysByAccountModule.get(key) || new Set()).size
      return {
        moduleId: moduleRow.moduleId,
        moduleTitle: moduleRow.moduleTitle,
        completedLessons: completed,
        totalLessons: moduleRow.totalLessons,
        completionPercent: moduleRow.totalLessons ? Math.round((completed / moduleRow.totalLessons) * 100) : 0
      }
    })
  }

  const batchRows = await prisma.$queryRawUnsafe<Array<{ batch_key: string | null; batch_label: string | null }>>(`
    SELECT DISTINCT batch_key, batch_label
    FROM (
      SELECT LOWER(COALESCE(batch_key, '')) COLLATE utf8mb4_general_ci AS batch_key,
        COALESCE(batch_label, 'Unspecified Batch') COLLATE utf8mb4_general_ci AS batch_label
      FROM course_orders
      WHERE course_slug ${courseSlugWhereSql}
        AND status = 'paid'
        AND COALESCE(buyer_type, 'student') <> 'family'
      UNION
      SELECT LOWER(COALESCE(batch_key, '')) COLLATE utf8mb4_general_ci AS batch_key,
        COALESCE(batch_label, 'Unspecified Batch') COLLATE utf8mb4_general_ci AS batch_label
      FROM course_manual_payments
      WHERE course_slug ${courseSlugWhereSql}
        AND status = 'approved'
        AND COALESCE(buyer_type, 'student') <> 'family'
    ) b
    ORDER BY batch_label ASC, batch_key ASC
  `, ...courseSlugScope, ...courseSlugScope).catch(() => [])

  const schoolRows = await prisma.$queryRawUnsafe<Array<{ total: bigint | number }>>(`
    SELECT COUNT(*) AS total
    FROM school_students ss
    JOIN school_accounts sc ON sc.id = ss.school_id
    WHERE sc.course_slug ${schoolCourseSlugWhereSql}
      AND sc.status = 'active'
      AND ss.status = 'active'
      AND (sc.access_expires_at IS NULL OR sc.access_expires_at >= NOW())
  `, ...schoolCourseSlugScope).catch(() => [])

  const availableBatches = [{ key: "all", label: "All Batches" }]
  for (const row of batchRows) {
    const key = clean(row.batch_key, 120).toLowerCase() || "unspecified"
    if (key === "all" || availableBatches.some((item) => item.key === key)) continue
    availableBatches.push({ key, label: clean(row.batch_label, 120) || "Unspecified Batch" })
  }
  if (Number(schoolRows[0]?.total || 0) > 0) availableBatches.push({ key: "school", label: "School Registration" })

  return {
    courseSlug,
    totalLessons,
    filters: {
      enrollmentType,
      batchKey,
      availableBatches,
      availableEnrollmentTypes: [
        { key: "all", label: "All Enrollments" },
        { key: "individual", label: "Individual" },
        { key: "school", label: "School Registration" }
      ]
    },
    students
  }
}

export async function getStudentCourseProgressDetail(input: {
  courseSlug: string
  accountId?: string | number | null
  email?: string | null
}) {
  await ensureLearningProgressTable()
  const courseSlug = canonicalizeCourseSlug(input.courseSlug)
  const accountId = Number(input.accountId || 0)
  const emailInput = clean(input.email, 220).toLowerCase()
  if (!courseSlug) return null
  if ((!Number.isFinite(accountId) || accountId <= 0) && !emailInput) return null

  let student: { accountId: number | null; fullName: string; email: string; enrollmentType: string; schoolName: string } | null = null
  if (accountId > 0) {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: bigint | number; full_name: string | null; email: string | null }>>(
      `SELECT id, full_name, email FROM student_accounts WHERE id = ? LIMIT 1`,
      accountId
    ).catch(() => [])
    if (rows.length) {
      student = {
        accountId: Number(rows[0].id || 0) || null,
        fullName: clean(rows[0].full_name, 180),
        email: clean(rows[0].email, 220).toLowerCase(),
        enrollmentType: "individual",
        schoolName: ""
      }
    }
  }
  if (!student && emailInput) {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: bigint | number; full_name: string | null; email: string | null }>>(
      `SELECT id, full_name, email FROM student_accounts WHERE LOWER(email) COLLATE utf8mb4_general_ci = ? LIMIT 1`,
      emailInput
    ).catch(() => [])
    if (rows.length) {
      student = {
        accountId: Number(rows[0].id || 0) || null,
        fullName: clean(rows[0].full_name, 180),
        email: clean(rows[0].email, 220).toLowerCase(),
        enrollmentType: "individual",
        schoolName: ""
      }
    }
  }
  if (!student && emailInput) {
    const rows = await prisma.$queryRawUnsafe<Array<{ full_name: string | null; email: string | null; school_name: string | null }>>(
      `SELECT ss.full_name, ss.email, sc.school_name
       FROM school_students ss
       JOIN school_accounts sc ON sc.id = ss.school_id
       WHERE LOWER(ss.email) COLLATE utf8mb4_general_ci = ?
         AND sc.course_slug = ?
         AND sc.status = 'active'
         AND ss.status = 'active'
         AND (sc.access_expires_at IS NULL OR sc.access_expires_at >= NOW())
       ORDER BY ss.id DESC
       LIMIT 1`,
      emailInput,
      courseSlug
    ).catch(() => [])
    if (rows.length) {
      student = {
        accountId: null,
        fullName: clean(rows[0].full_name, 180),
        email: clean(rows[0].email, 220).toLowerCase(),
        enrollmentType: "school",
        schoolName: clean(rows[0].school_name, 220)
      }
    }
  }
  if (!student && emailInput) {
    const rows = await prisma.$queryRawUnsafe<Array<{ full_name: string | null; email: string | null }>>(
      `SELECT full_name, email
       FROM (
         SELECT COALESCE(first_name, '') AS full_name, LOWER(email) COLLATE utf8mb4_general_ci AS email
         FROM course_orders
         WHERE course_slug = ? AND status = 'paid' AND COALESCE(buyer_type, 'student') <> 'family' AND LOWER(email) COLLATE utf8mb4_general_ci = ?
         UNION ALL
         SELECT COALESCE(first_name, '') AS full_name, LOWER(email) COLLATE utf8mb4_general_ci AS email
         FROM course_manual_payments
         WHERE course_slug = ? AND status = 'approved' AND COALESCE(buyer_type, 'student') <> 'family' AND LOWER(email) COLLATE utf8mb4_general_ci = ?
       ) enrolled
       ORDER BY CASE WHEN full_name <> '' THEN 0 ELSE 1 END
       LIMIT 1`,
      courseSlug,
      emailInput,
      courseSlug,
      emailInput
    ).catch(() => [])
    if (rows.length) {
      student = {
        accountId: null,
        fullName: clean(rows[0].full_name, 180) || "Student",
        email: clean(rows[0].email, 220).toLowerCase(),
        enrollmentType: "individual",
        schoolName: ""
      }
    }
  }
  if (!student) return null

  const progressAccountId = Number(student.accountId || 0)
  const rows = await prisma.$queryRawUnsafe<Array<CourseStructureRow & {
    is_completed: bigint | number | null
    completed_at: Date | null
    last_watched_at: Date | null
    watch_seconds: bigint | number | null
  }>>(`
    SELECT m.id AS module_id, m.module_slug, m.module_title, m.sort_order,
      l.id AS lesson_id, l.lesson_slug, l.lesson_title, l.lesson_order, a.video_uid,
      p.is_completed, p.completed_at, p.last_watched_at, p.watch_seconds
    FROM tochukwu_learning_modules m
    LEFT JOIN tochukwu_learning_lessons l ON l.module_id = m.id AND l.is_active = 1
    LEFT JOIN tochukwu_learning_video_assets a ON a.id = l.video_asset_id
    LEFT JOIN tochukwu_learning_lesson_progress p ON p.lesson_id = l.id AND p.account_id = ?
    WHERE m.course_slug = ? AND m.is_active = 1
    ORDER BY m.sort_order ASC, m.id ASC, l.lesson_order ASC, l.id ASC
  `, progressAccountId > 0 ? progressAccountId : 0, courseSlug).catch(() => [])

  const canonicalCourse = buildCanonicalCourseStructure(courseSlug, rows)
  const lessonProgressByCanonicalKey = new Map<string, { isCompleted: boolean; completedAt: string | null; lastWatchedAt: string | null; watchSeconds: number }>()
  for (const row of rows) {
    const sourceLessonId = Number(row.lesson_id || 0)
    if (!sourceLessonId) continue
    const canonical = canonicalCourse.lessonBySourceLessonId.get(sourceLessonId)
    if (!canonical) continue
    const key = canonical.canonicalLessonKey
    const prev = lessonProgressByCanonicalKey.get(key) || { isCompleted: false, completedAt: null, lastWatchedAt: null, watchSeconds: 0 }
    const completedAt = normalizeDate(row.completed_at)
    const lastWatchedAt = normalizeDate(row.last_watched_at)
    lessonProgressByCanonicalKey.set(key, {
      isCompleted: prev.isCompleted || Number(row.is_completed || 0) === 1,
      completedAt: latestIso(prev.completedAt, completedAt),
      lastWatchedAt: latestIso(prev.lastWatchedAt, lastWatchedAt),
      watchSeconds: Math.max(prev.watchSeconds, Number(row.watch_seconds || 0))
    })
  }

  const modules = canonicalCourse.modules.map((moduleRow) => {
    const lessons = moduleRow.lessons.map((lesson, index) => {
      const progress = lessonProgressByCanonicalKey.get(lesson.canonicalLessonKey) || null
      return {
        lessonId: Number(lesson.sourceLessonIds[0] || 0),
        lessonTitle: lesson.lessonTitle,
        lessonOrder: Number(lesson.lessonOrder || index + 1),
        isCompleted: !!progress?.isCompleted,
        completedAt: progress?.completedAt || null,
        lastWatchedAt: progress?.lastWatchedAt || null,
        watchSeconds: Number(progress?.watchSeconds || 0)
      }
    })
    const completed = lessons.filter((lesson) => lesson.isCompleted).length
    return {
      moduleId: moduleRow.moduleId,
      moduleSlug: moduleRow.moduleSlug,
      moduleTitle: moduleRow.moduleTitle,
      sortOrder: moduleRow.sortOrder,
      progress: {
        completedLessons: completed,
        totalLessons: lessons.length,
        completionPercent: lessons.length ? Math.round((completed / lessons.length) * 100) : 0
      },
      lessons
    }
  })
  const totalLessons = modules.reduce((sum, moduleRow) => sum + moduleRow.progress.totalLessons, 0)
  const completedLessons = modules.reduce((sum, moduleRow) => sum + moduleRow.progress.completedLessons, 0)
  const watched = modules.flatMap((moduleRow) => moduleRow.lessons.map((lesson) => ({
    title: lesson.lessonTitle,
    watchedAt: lesson.lastWatchedAt || lesson.completedAt
  }))).filter((row) => row.watchedAt)
    .sort((a, b) => new Date(String(a.watchedAt)).getTime() - new Date(String(b.watchedAt)).getTime())
  const lastWatchedLesson = watched.at(-1) || null

  return {
    courseSlug,
    student,
    progress: {
      completedLessons,
      totalLessons,
      completionPercent: totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0,
      lastActivityAt: lastWatchedLesson?.watchedAt || null,
      lastWatchedLessonTitle: lastWatchedLesson?.title || "",
      lastWatchedAt: lastWatchedLesson?.watchedAt || null
    },
    modules
  }
}

function latestIso(a: string | null, b: string | null) {
  if (!a) return b || null
  if (!b) return a || null
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b
}
