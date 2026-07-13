import crypto from "crypto"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { addColumnIfMissing } from "@/lib/schema-guards"
import { ensureCertificateVerificationColumns } from "@/lib/certificate-verification"

const STUDENT_CODE_LENGTH = 10
const STUDENT_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function normalizeEmail(value: unknown) {
  const email = clean(value, 220).toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ""
}

function syntheticSchoolStudentEmail() {
  return `school-student-${crypto.randomUUID().replace(/-/g, "")}@student-code.local`
}

function hashPassword(password: string, salt: string) {
  return new Promise<string>((resolve, reject) => {
    crypto.scrypt(String(password || ""), String(salt || ""), 64, (error, key) => {
      if (error) reject(error)
      else resolve(key.toString("hex"))
    })
  })
}

async function findOrCreateStudentAccount(input: { fullName: string; email: string }) {
  const existing = await prisma.studentAccount.findUnique({ where: { email: input.email } })
  if (existing) return { account: existing, created: false }

  const salt = crypto.randomBytes(16).toString("hex")
  const temporaryPassword = `${crypto.randomBytes(8).toString("base64url")}A9!`
  const passwordHash = await hashPassword(temporaryPassword, salt)
  const now = new Date()
  const account = await prisma.studentAccount.create({
    data: {
      accountUuid: `sa_${crypto.randomUUID().replace(/-/g, "")}`,
      fullName: input.fullName,
      email: input.email,
      passwordHash,
      passwordSalt: salt,
      mustResetPassword: true,
      domainsAutoRenewEnabled: true,
      createdAt: now,
      updatedAt: now
    }
  })
  return { account, created: true }
}

function makeStudentCode() {
  const bytes = crypto.randomBytes(STUDENT_CODE_LENGTH)
  let out = ""
  for (let i = 0; i < STUDENT_CODE_LENGTH; i += 1) {
    out += STUDENT_CODE_ALPHABET[bytes[i] % STUDENT_CODE_ALPHABET.length]
  }
  return out
}

function iso(value: unknown) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

async function ensureSchoolTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS school_students (
      id BIGINT NOT NULL AUTO_INCREMENT,
      school_id BIGINT NOT NULL,
      student_uuid VARCHAR(64) NOT NULL,
      full_name VARCHAR(180) NOT NULL,
      email VARCHAR(220) NOT NULL,
      student_code VARCHAR(20) NULL,
      account_id BIGINT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'active',
      disabled_at DATETIME NULL,
      website_url VARCHAR(1000) NULL,
      website_submitted_at DATETIME NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_school_student_uuid (student_uuid),
      UNIQUE KEY uniq_school_student_email (school_id, email),
      UNIQUE KEY uniq_school_student_code (school_id, student_code),
      KEY idx_school_student_school (school_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS school_student_code_resets (
      id BIGINT NOT NULL AUTO_INCREMENT,
      school_id BIGINT NOT NULL,
      student_id BIGINT NOT NULL,
      previous_code VARCHAR(20) NULL,
      new_code VARCHAR(20) NOT NULL,
      reset_by_admin_id BIGINT NOT NULL,
      reason VARCHAR(300) NULL,
      created_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      KEY idx_school_code_reset_school (school_id, created_at),
      KEY idx_school_code_reset_student (student_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS school_student_course_access (
      id BIGINT NOT NULL AUTO_INCREMENT,
      school_id BIGINT NOT NULL,
      student_id BIGINT NOT NULL,
      account_id BIGINT NULL,
      course_slug VARCHAR(120) NOT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'active',
      granted_source VARCHAR(60) NULL,
      granted_by_admin_id BIGINT NULL,
      granted_at DATETIME NOT NULL,
      revoked_at DATETIME NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_school_student_course (student_id, course_slug),
      KEY idx_school_student_course_school (school_id, course_slug, status),
      KEY idx_school_student_course_account (account_id, course_slug, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS school_course_seat_balances (
      id BIGINT NOT NULL AUTO_INCREMENT,
      school_id BIGINT NOT NULL,
      course_slug VARCHAR(120) NOT NULL,
      seats_purchased INT NOT NULL DEFAULT 0,
      seats_consumed INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_school_course_seat_balance (school_id, course_slug),
      KEY idx_school_course_seat_balance_school (school_id, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS school_seat_ledger (
      id BIGINT NOT NULL AUTO_INCREMENT,
      school_id BIGINT NOT NULL,
      course_slug VARCHAR(120) NOT NULL,
      entry_type VARCHAR(40) NOT NULL,
      quantity INT NOT NULL,
      source_order_uuid VARCHAR(64) NULL,
      idempotency_key VARCHAR(140) NULL,
      metadata_json LONGTEXT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_school_seat_ledger_idempotency (school_id, course_slug, entry_type, idempotency_key),
      KEY idx_school_seat_ledger_school (school_id, course_slug, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS school_certificates (
      id BIGINT NOT NULL AUTO_INCREMENT,
      school_id BIGINT NOT NULL,
      student_id BIGINT NOT NULL,
      course_slug VARCHAR(120) NOT NULL,
      certificate_no VARCHAR(120) NOT NULL,
      recipient_name VARCHAR(180) NOT NULL DEFAULT '',
      status VARCHAR(40) NOT NULL DEFAULT 'issued',
      issued_by_admin_id BIGINT NOT NULL,
      issued_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_school_cert_no (certificate_no),
      UNIQUE KEY uniq_school_cert_student_course (student_id, course_slug),
      KEY idx_school_cert_school (school_id, issued_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await addColumnIfMissing("school_students", "student_code", "VARCHAR(20) NULL")
  await addColumnIfMissing("school_students", "account_id", "BIGINT NULL")
  await addColumnIfMissing("school_students", "website_url", "VARCHAR(1000) NULL")
  await addColumnIfMissing("school_students", "website_submitted_at", "DATETIME NULL")
  await addColumnIfMissing("school_certificates", "recipient_name", "VARCHAR(180) NOT NULL DEFAULT ''")
  await ensureCertificateVerificationColumns()
}

async function assignStudentCode(schoolId: number, studentId: number) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = makeStudentCode()
    try {
      await prisma.$executeRaw`
        UPDATE school_students
        SET student_code = ${code}, updated_at = UTC_TIMESTAMP()
        WHERE id = ${studentId}
          AND school_id = ${schoolId}
          AND (student_code IS NULL OR student_code = '')
        LIMIT 1
      `
      const rows = await prisma.$queryRaw<Array<{ studentCode: string | null }>>`
        SELECT student_code AS studentCode
        FROM school_students
        WHERE id = ${studentId}
          AND school_id = ${schoolId}
        LIMIT 1
      `
      if (rows[0]?.studentCode) return clean(rows[0].studentCode, 20).toUpperCase()
    } catch (error) {
      if (String((error as { code?: string })?.code || "").toUpperCase() !== "P2010") continue
      continue
    }
  }
  return ""
}

async function seatsUsed(schoolId: number) {
  const rows = await prisma.$queryRaw<Array<{ total: bigint | number }>>`
    SELECT COUNT(*) AS total
    FROM school_students
    WHERE school_id = ${schoolId}
      AND status = 'active'
  `
  return Number(rows[0]?.total || 0)
}

async function grantStudentCourseAccess(input: { schoolId: number; studentId: number; accountId: bigint | number; courseSlug: string; adminId?: number }) {
  const courseSlug = clean(input.courseSlug, 120).toLowerCase() || "prompt-to-profit"
  await prisma.$executeRaw`
    INSERT INTO school_student_course_access
      (school_id, student_id, account_id, course_slug, status, granted_source, granted_by_admin_id, granted_at, revoked_at, created_at, updated_at)
    VALUES
      (${input.schoolId}, ${input.studentId}, ${input.accountId}, ${courseSlug}, 'active', 'school_dashboard', ${input.adminId || null}, UTC_TIMESTAMP(), NULL, UTC_TIMESTAMP(), UTC_TIMESTAMP())
    ON DUPLICATE KEY UPDATE
      account_id = VALUES(account_id),
      status = 'active',
      revoked_at = NULL,
      updated_at = UTC_TIMESTAMP()
  `
}

export function parseSchoolStudentsCsv(text: string) {
  const src = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let inQuotes = false
  for (let index = 0; index < src.length; index += 1) {
    const ch = src[index]
    const next = src[index + 1]
    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (!inQuotes && ch === ",") {
      row.push(cell)
      cell = ""
      continue
    }
    if (!inQuotes && ch === "\n") {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
      continue
    }
    cell += ch
  }
  row.push(cell)
  if (row.some((item) => clean(item, 500))) rows.push(row)
  const [header, ...body] = rows
  const headerMap = (header || []).map((item) => clean(item, 60).toLowerCase())
  const nameIndex = Math.max(0, headerMap.indexOf("full_name"))
  const emailIndex = headerMap.indexOf("email")
  return body
    .map((items) => ({
      fullName: clean(items[nameIndex], 180),
      email: emailIndex >= 0 ? clean(items[emailIndex], 220) : ""
    }))
    .filter((item) => item.fullName)
}

export function schoolStudentsCsvTemplate() {
  return "full_name,email\nJane Doe,\nJohn Doe,john@example.com\n"
}

function humanSchoolCourseName(courseSlug: string) {
  const slug = clean(courseSlug, 120).toLowerCase()
  if (slug === "prompt-to-production") return "Prompt to Profit Advanced"
  if (slug === "prompt-to-profit") return "Prompt to Profit"
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export async function getSchoolCertificatePublic(certificateNo: string) {
  await ensureSchoolTables()
  const certNo = clean(certificateNo, 140).toUpperCase()
  if (!certNo) return null
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT
      c.certificate_no,
      c.recipient_name,
      c.issued_at,
      c.course_slug,
      c.status,
      c.project_url,
      c.project_verified_at,
      c.project_status_at_issue,
      s.website_url,
      s.full_name AS student_name,
      s.email AS student_email,
      sc.school_name
    FROM school_certificates c
    JOIN school_students s ON s.id = c.student_id
    JOIN school_accounts sc ON sc.id = c.school_id
    WHERE c.certificate_no COLLATE utf8mb4_unicode_ci = ${certNo} COLLATE utf8mb4_unicode_ci
      AND c.status = 'issued'
    LIMIT 1
  `)
  const row = rows[0]
  if (!row) return null
  const courseSlug = clean(row.course_slug, 120)
  return {
    certificateNo: clean(row.certificate_no, 140),
    issuedAt: iso(row.issued_at),
    courseSlug,
    courseName: humanSchoolCourseName(courseSlug),
    studentName: clean(row.recipient_name, 180) || clean(row.student_name, 180),
    studentEmail: clean(row.student_email, 220),
    schoolName: clean(row.school_name, 220),
    projectUrl: clean(row.project_url, 1200) || clean(row.website_url, 1200),
    projectVerifiedAt: iso(row.project_verified_at || row.issued_at),
    projectStatusAtIssue: clean(row.project_status_at_issue, 80)
  }
}

export async function getSchoolDashboardData(input: { schoolId: number; courseSlug: string }) {
  await ensureSchoolTables()
  const schoolRows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT seats_purchased, access_expires_at
    FROM school_accounts
    WHERE id = ${input.schoolId}
    LIMIT 1
  `)
  const seatsPurchased = Number(schoolRows[0]?.seats_purchased || 0)
  const students = await listSchoolStudents(input)
  const activeStudents = students.filter((student) => student.status === "active")
  const avgCompletion = activeStudents.length
    ? Math.round(activeStudents.reduce((sum, student) => sum + student.completionPercent, 0) / activeStudents.length)
    : 0
  const activeLast7 = activeStudents.filter((student) => {
    const time = student.lastActivityAt ? new Date(student.lastActivityAt).getTime() : 0
    return time > 0 && Date.now() - time <= 7 * 24 * 60 * 60 * 1000
  }).length
  const used = await seatsUsed(input.schoolId)
  const [advanced, advancedCandidates] = await Promise.all([
    getSchoolAdvancedSeatSummary(input.schoolId),
    listSchoolAdvancedUpgradeCandidates(input.schoolId)
  ])
  return {
    metrics: {
      seatsPurchased,
      seatsUsed: used,
      seatsAvailable: Math.max(0, seatsPurchased - used),
      accessExpiresAt: iso(schoolRows[0]?.access_expires_at),
      averageCompletionPercent: avgCompletion,
      activeLast7Days: activeLast7,
      studentsTotal: students.length,
      studentsActive: activeStudents.length,
      studentsCompleted: activeStudents.filter((student) => student.completionPercent >= 100).length
    },
    students,
    advanced,
    advancedCandidates
  }
}

export async function listSchoolStudents(input: { schoolId: number; courseSlug: string }) {
  await ensureSchoolTables()
  const totalRows = await prisma.$queryRaw<Array<{ totalLessons: bigint | number }>>`
    SELECT COUNT(*) AS totalLessons
    FROM tochukwu_learning_lessons l
    JOIN tochukwu_learning_modules m ON m.id = l.module_id
    WHERE m.course_slug COLLATE utf8mb4_unicode_ci = ${input.courseSlug} COLLATE utf8mb4_unicode_ci
      AND m.is_active = 1
      AND l.is_active = 1
  `.catch(() => [{ totalLessons: 0 }])
  const totalLessons = Number(totalRows[0]?.totalLessons || 0)
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT
      s.id, s.full_name, s.email, s.student_code, s.status, s.account_id, s.website_url, s.website_submitted_at,
      cert.certificate_no, cert.issued_at AS certificate_issued_at,
      COUNT(CASE WHEN p.is_completed = 1 THEN 1 END) AS completed_lessons,
      MAX(COALESCE(p.last_watched_at, p.completed_at)) AS last_activity_at,
      s.created_at
    FROM school_students s
    LEFT JOIN school_certificates cert
      ON cert.student_id = s.id
     AND cert.course_slug COLLATE utf8mb4_unicode_ci = ${input.courseSlug} COLLATE utf8mb4_unicode_ci
     AND cert.status = 'issued'
    LEFT JOIN tochukwu_learning_lesson_progress p ON p.account_id = s.account_id
    LEFT JOIN tochukwu_learning_lessons l ON l.id = p.lesson_id AND l.is_active = 1
    LEFT JOIN tochukwu_learning_modules m ON m.id = l.module_id
      AND m.course_slug COLLATE utf8mb4_unicode_ci = ${input.courseSlug} COLLATE utf8mb4_unicode_ci
      AND m.is_active = 1
    WHERE s.school_id = ${input.schoolId}
    GROUP BY s.id, s.full_name, s.email, s.student_code, s.status, s.account_id, s.website_url, s.website_submitted_at,
      cert.certificate_no, cert.issued_at, s.created_at
    ORDER BY s.created_at DESC, s.id DESC
  `)
  return rows.map((row) => {
    const completedLessons = Number(row.completed_lessons || 0)
    return {
      id: Number(row.id || 0),
      fullName: clean(row.full_name, 180),
      email: clean(row.email, 220),
      studentCode: clean(row.student_code, 20).toUpperCase(),
      status: clean(row.status, 40) || "active",
      accountId: Number(row.account_id || 0) || null,
      websiteUrl: clean(row.website_url, 1000),
      websiteSubmittedAt: iso(row.website_submitted_at),
      certificateNo: clean(row.certificate_no, 140),
      certificateIssuedAt: iso(row.certificate_issued_at),
      completedLessons,
      totalLessons,
      completionPercent: totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0,
      lastActivityAt: iso(row.last_activity_at),
      createdAt: iso(row.created_at)
    }
  })
}

export async function addSchoolStudent(input: { schoolId: number; fullName: string; email: string; courseSlug?: string; adminId?: number }) {
  await ensureSchoolTables()
  const fullName = clean(input.fullName, 180)
  const email = normalizeEmail(input.email) || syntheticSchoolStudentEmail()
  if (!fullName) throw new Error("Student name is required.")
  const schoolRows = await prisma.$queryRaw<Array<{ seatsPurchased: number | bigint }>>`
    SELECT seats_purchased AS seatsPurchased
    FROM school_accounts
    WHERE id = ${input.schoolId}
    LIMIT 1
  `
  const seatsPurchased = Number(schoolRows[0]?.seatsPurchased || 0)
  const used = await seatsUsed(input.schoolId)
  if (used >= seatsPurchased) throw new Error("No available seats. Buy more seats to enroll additional students.")
  const existing = await prisma.$queryRaw<Array<{ id: number | bigint }>>`
    SELECT id
    FROM school_students
    WHERE school_id = ${input.schoolId}
      AND email COLLATE utf8mb4_unicode_ci = ${email} COLLATE utf8mb4_unicode_ci
    LIMIT 1
  `
  const { account } = await findOrCreateStudentAccount({ fullName, email })
  if (existing[0]) {
    await prisma.$executeRaw`
      UPDATE school_students
      SET full_name = ${fullName}, account_id = ${account.id}, status = 'active', disabled_at = NULL, updated_at = UTC_TIMESTAMP()
      WHERE id = ${Number(existing[0].id)}
      LIMIT 1
    `
    await assignStudentCode(input.schoolId, Number(existing[0].id))
    await grantStudentCourseAccess({ schoolId: input.schoolId, studentId: Number(existing[0].id), accountId: account.id, courseSlug: input.courseSlug || "prompt-to-profit", adminId: input.adminId })
    return { updated: true }
  }
  await prisma.$executeRaw`
    INSERT INTO school_students
      (school_id, student_uuid, full_name, email, account_id, status, created_at, updated_at)
    VALUES
      (${input.schoolId}, ${`sst_${crypto.randomUUID().replace(/-/g, "")}`}, ${fullName}, ${email}, ${account.id}, 'active', UTC_TIMESTAMP(), UTC_TIMESTAMP())
  `
  const rows = await prisma.$queryRaw<Array<{ id: number | bigint }>>`
    SELECT id
    FROM school_students
    WHERE school_id = ${input.schoolId}
      AND email COLLATE utf8mb4_unicode_ci = ${email} COLLATE utf8mb4_unicode_ci
    ORDER BY id DESC
    LIMIT 1
  `
  if (rows[0]) {
    await assignStudentCode(input.schoolId, Number(rows[0].id))
    await grantStudentCourseAccess({ schoolId: input.schoolId, studentId: Number(rows[0].id), accountId: account.id, courseSlug: input.courseSlug || "prompt-to-profit", adminId: input.adminId })
  }
  return { created: true }
}

export async function importSchoolStudents(input: { schoolId: number; courseSlug: string; adminId: number; rows: Array<{ fullName: string; email: string }> }) {
  const result = { created: 0, updated: 0, skipped: 0, errors: [] as string[] }
  for (let index = 0; index < input.rows.length; index += 1) {
    const row = input.rows[index]
    try {
      const added = await addSchoolStudent({
        schoolId: input.schoolId,
        courseSlug: input.courseSlug,
        adminId: input.adminId,
        fullName: row.fullName,
        email: row.email
      })
      if (added.created) result.created += 1
      else if (added.updated) result.updated += 1
      else result.skipped += 1
    } catch (error) {
      result.errors.push(`Row ${index + 1}: ${error instanceof Error ? error.message : "Could not import student"}`)
    }
  }
  return result
}

export async function setSchoolStudentStatus(input: { schoolId: number; studentId: number; active: boolean }) {
  await prisma.$executeRaw`
    UPDATE school_students
    SET status = ${input.active ? "active" : "disabled"},
        disabled_at = ${input.active ? null : new Date()},
        updated_at = UTC_TIMESTAMP()
    WHERE id = ${input.studentId}
      AND school_id = ${input.schoolId}
    LIMIT 1
  `
}

export async function resetSchoolStudentCode(input: { schoolId: number; studentId: number; adminId: number }) {
  await ensureSchoolTables()
  const rows = await prisma.$queryRaw<Array<{ previousCode: string | null }>>`
    SELECT student_code AS previousCode
    FROM school_students
    WHERE id = ${input.studentId}
      AND school_id = ${input.schoolId}
    LIMIT 1
  `
  if (!rows[0]) throw new Error("Student not found.")
  let newCode = ""
  for (let attempt = 0; attempt < 20; attempt += 1) {
    newCode = makeStudentCode()
    try {
      await prisma.$executeRaw`
        UPDATE school_students
        SET student_code = ${newCode}, updated_at = UTC_TIMESTAMP()
        WHERE id = ${input.studentId}
          AND school_id = ${input.schoolId}
        LIMIT 1
      `
      break
    } catch {
      newCode = ""
    }
  }
  if (!newCode) throw new Error("Could not generate a unique student code. Try again.")
  await prisma.$executeRaw`
    INSERT INTO school_student_code_resets
      (school_id, student_id, previous_code, new_code, reset_by_admin_id, reason, created_at)
    VALUES
      (${input.schoolId}, ${input.studentId}, ${clean(rows[0].previousCode, 20) || null}, ${newCode}, ${input.adminId}, 'Reset by school admin', UTC_TIMESTAMP())
  `
  return { newCode }
}

export async function issueSchoolCertificate(input: { schoolId: number; studentId: number; adminId: number; courseSlug: string }) {
  await ensureSchoolTables()
  const courseSlug = clean(input.courseSlug, 120).toLowerCase() || "prompt-to-profit"
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT s.id, s.full_name, s.email, s.account_id, s.status, s.website_url,
           a.full_name AS account_full_name, a.certificate_name_confirmed_at
    FROM school_students s
    LEFT JOIN student_accounts a ON a.id = s.account_id
    WHERE s.id = ${input.studentId}
      AND s.school_id = ${input.schoolId}
    LIMIT 1
  `)
  const student = rows[0]
  if (!student) throw new Error("Student not found.")
  if (clean(student.status, 40).toLowerCase() !== "active") throw new Error("Student must be active before certificate can be issued.")
  if (!clean(student.website_url, 1000)) throw new Error("Student must submit website link before certificate can be issued.")
  const accountId = Number(student.account_id || 0)
  if (!accountId) throw new Error("Student has no learner account yet.")
  if (!student.certificate_name_confirmed_at) throw new Error("Student must confirm their certificate name in profile before certificate can be issued.")

  const current = await listSchoolStudents({ schoolId: input.schoolId, courseSlug })
  const currentStudent = current.find((item) => item.id === input.studentId)
  if (!currentStudent?.totalLessons) throw new Error("Course has no lessons configured.")
  if (currentStudent.completedLessons < currentStudent.totalLessons) throw new Error("Student has not completed 100% of the course.")

  const certNo = `TN-SCH-${crypto.randomUUID().replace(/-/g, "").slice(0, 14).toUpperCase()}`
  const recipientName = clean(student.account_full_name, 180)
  const projectUrl = clean(student.website_url, 1000)
  await prisma.$executeRaw`
    INSERT INTO school_certificates
      (school_id, student_id, course_slug, certificate_no, recipient_name, status, issued_by_admin_id, issued_at, project_url, project_verified_at, project_status_at_issue, created_at, updated_at)
    VALUES
      (${input.schoolId}, ${input.studentId}, ${courseSlug}, ${certNo}, ${recipientName}, 'issued', ${input.adminId}, UTC_TIMESTAMP(), ${projectUrl}, UTC_TIMESTAMP(), 'live_at_issue', UTC_TIMESTAMP(), UTC_TIMESTAMP())
    ON DUPLICATE KEY UPDATE
      status = 'issued',
      issued_by_admin_id = VALUES(issued_by_admin_id),
      issued_at = VALUES(issued_at),
      project_url = COALESCE(project_url, VALUES(project_url)),
      project_verified_at = COALESCE(project_verified_at, VALUES(project_verified_at)),
      project_status_at_issue = COALESCE(project_status_at_issue, VALUES(project_status_at_issue)),
      updated_at = VALUES(updated_at)
  `
  const certRows = await prisma.$queryRaw<Array<{ certificateNo: string }>>`
    SELECT certificate_no AS certificateNo
    FROM school_certificates
    WHERE student_id = ${input.studentId}
      AND course_slug COLLATE utf8mb4_unicode_ci = ${courseSlug} COLLATE utf8mb4_unicode_ci
    LIMIT 1
  `
  return {
    certificateNo: clean(certRows[0]?.certificateNo || certNo, 120),
    certificateUrl: `/schools/certificate/?certificate_no=${encodeURIComponent(clean(certRows[0]?.certificateNo || certNo, 120))}`
  }
}

export async function deleteSchoolCertificate(input: { schoolId: number; studentId: number; courseSlug: string }) {
  await ensureSchoolTables()
  const courseSlug = clean(input.courseSlug, 120).toLowerCase() || "prompt-to-profit"
  await prisma.$executeRaw`
    DELETE FROM school_certificates
    WHERE school_id = ${input.schoolId}
      AND student_id = ${input.studentId}
      AND course_slug COLLATE utf8mb4_unicode_ci = ${courseSlug} COLLATE utf8mb4_unicode_ci
  `
}

export async function getSchoolAdvancedSeatSummary(schoolId: number) {
  await ensureSchoolTables()
  const rows = await prisma.$queryRaw<Array<{ seatsPurchased: number | bigint; seatsUsed: number | bigint }>>`
    SELECT seats_purchased AS seatsPurchased, seats_consumed AS seatsUsed
    FROM school_course_seat_balances
    WHERE school_id = ${schoolId}
      AND course_slug = 'prompt-to-production'
    LIMIT 1
  `
  const seatsPurchased = Number(rows[0]?.seatsPurchased || 0)
  const seatsUsed = Number(rows[0]?.seatsUsed || 0)
  return {
    courseSlug: "prompt-to-production",
    seatsPurchased,
    seatsUsed,
    seatsAvailable: Math.max(0, seatsPurchased - seatsUsed)
  }
}

export async function listSchoolAdvancedUpgradeCandidates(schoolId: number) {
  await ensureSchoolTables()
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT
      s.id,
      s.full_name,
      s.email,
      s.student_code,
      s.status,
      acc.id AS access_id
    FROM school_students s
    LEFT JOIN school_student_course_access acc
      ON acc.student_id = s.id
     AND acc.course_slug = 'prompt-to-production'
     AND acc.status = 'active'
    WHERE s.school_id = ${schoolId}
    ORDER BY s.created_at DESC, s.id DESC
  `)
  return rows.map((row) => {
    const status = clean(row.status, 40).toLowerCase() || "active"
    const active = status === "active"
    const alreadyUpgraded = Number(row.access_id || 0) > 0
    return {
      id: Number(row.id || 0),
      fullName: clean(row.full_name, 180),
      email: clean(row.email, 220),
      studentCode: clean(row.student_code, 20).toUpperCase(),
      status,
      eligible: active && !alreadyUpgraded,
      alreadyUpgraded,
      ineligibleReason: active ? (alreadyUpgraded ? "already_upgraded" : "") : "inactive_student"
    }
  })
}

export async function runSchoolAdvancedUpgrade(input: {
  schoolId: number
  adminId: number
  mode: "all" | "selected"
  selectedStudentIds?: number[]
  idempotencyKey?: string
}) {
  await ensureSchoolTables()
  const mode = input.mode === "all" ? "all" : "selected"
  const selectedStudentIds = Array.isArray(input.selectedStudentIds)
    ? input.selectedStudentIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
    : []
  if (mode === "selected" && !selectedStudentIds.length) throw new Error("Select at least one student to upgrade.")

  const idempotencyKey = clean(input.idempotencyKey, 140) || `upgrade_${crypto.randomUUID().replace(/-/g, "")}`
  const result = {
    totals: {
      requested: 0,
      upgraded: 0,
      skippedAlreadyUpgraded: 0,
      skippedIneligible: 0,
      failed: 0
    }
  }

  await prisma.$transaction(async (tx) => {
    const balanceRows = await tx.$queryRaw<Array<{ id: number | bigint; seatsPurchased: number | bigint; seatsUsed: number | bigint }>>`
      SELECT id, seats_purchased AS seatsPurchased, seats_consumed AS seatsUsed
      FROM school_course_seat_balances
      WHERE school_id = ${input.schoolId}
        AND course_slug = 'prompt-to-production'
      LIMIT 1
      FOR UPDATE
    `
    const balance = balanceRows[0]
    const purchased = Number(balance?.seatsPurchased || 0)
    const used = Number(balance?.seatsUsed || 0)
    let seatsAvailable = Math.max(0, purchased - used)
    if (seatsAvailable <= 0) throw new Error("No advanced seats available. Buy advanced seats first.")

    const rows = mode === "all"
      ? await tx.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          SELECT s.id, s.account_id, s.status, s.student_code, acc.id AS access_id
          FROM school_students s
          LEFT JOIN school_student_course_access acc
            ON acc.student_id = s.id
           AND acc.course_slug = 'prompt-to-production'
           AND acc.status = 'active'
          WHERE s.school_id = ${input.schoolId}
          FOR UPDATE
        `)
      : await tx.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          SELECT s.id, s.account_id, s.status, s.student_code, acc.id AS access_id
          FROM school_students s
          LEFT JOIN school_student_course_access acc
            ON acc.student_id = s.id
           AND acc.course_slug = 'prompt-to-production'
           AND acc.status = 'active'
          WHERE s.school_id = ${input.schoolId}
            AND s.id IN (${Prisma.join(selectedStudentIds)})
          FOR UPDATE
        `)

    result.totals.requested = rows.length

    for (const row of rows) {
      const studentId = Number(row.id || 0)
      const isActive = clean(row.status, 40).toLowerCase() === "active"
      const alreadyUpgraded = Number(row.access_id || 0) > 0
      if (!isActive) {
        result.totals.skippedIneligible += 1
        continue
      }
      if (alreadyUpgraded) {
        result.totals.skippedAlreadyUpgraded += 1
        continue
      }
      if (seatsAvailable <= 0) {
        result.totals.failed += 1
        continue
      }

      await tx.$executeRaw`
        INSERT IGNORE INTO school_student_course_access
          (school_id, student_id, account_id, course_slug, status, granted_source, granted_by_admin_id, granted_at, created_at, updated_at)
        VALUES
          (${input.schoolId}, ${studentId}, ${Number(row.account_id || 0) || null}, 'prompt-to-production', 'active', 'school_dashboard_upgrade', ${input.adminId}, UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP())
      `
      result.totals.upgraded += 1
      seatsAvailable -= 1
    }

    if (result.totals.upgraded > 0) {
      const nextUsed = used + result.totals.upgraded
      if (balance) {
        await tx.$executeRaw`
          UPDATE school_course_seat_balances
          SET seats_consumed = ${nextUsed}, updated_at = UTC_TIMESTAMP()
          WHERE id = ${Number(balance.id)}
          LIMIT 1
        `
      } else {
        await tx.$executeRaw`
          INSERT INTO school_course_seat_balances
            (school_id, course_slug, seats_purchased, seats_consumed, created_at, updated_at)
          VALUES
            (${input.schoolId}, 'prompt-to-production', 0, ${result.totals.upgraded}, UTC_TIMESTAMP(), UTC_TIMESTAMP())
        `
      }
      await tx.$executeRaw`
        INSERT INTO school_seat_ledger
          (school_id, course_slug, entry_type, quantity, source_order_uuid, idempotency_key, metadata_json, created_at, updated_at)
        VALUES
          (${input.schoolId}, 'prompt-to-production', 'upgrade_consume', ${-1 * result.totals.upgraded}, NULL, ${idempotencyKey}, ${JSON.stringify({ mode, upgraded: result.totals.upgraded })}, UTC_TIMESTAMP(), UTC_TIMESTAMP())
      `
    }
  })

  return result
}
