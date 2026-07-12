import crypto from "crypto"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { addColumnIfMissing } from "@/lib/schema-guards"

const SCHOOL_ADMIN_COOKIE = "tws_school_admin_session"
const SCHOOL_ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 30

export type SchoolAdminSession = {
  id: number
  fullName: string
  email: string
  schoolId: number
  schoolName: string
  courseSlug: string
  seatsPurchased: number
  schoolStatus: string
  accessExpiresAt: string | null
}

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function normalizeEmail(value: unknown) {
  const email = clean(value, 220).toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ""
}

function shaToken(token: string) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex")
}

function randomToken() {
  return crypto.randomBytes(48).toString("base64url")
}

function hashPassword(password: string, salt: string) {
  return new Promise<string>((resolve, reject) => {
    crypto.scrypt(String(password || ""), String(salt || ""), 64, (error, key) => {
      if (error) reject(error)
      else resolve(key.toString("hex"))
    })
  })
}

async function ensureSchoolAdminSessionTable() {
  await addColumnIfMissing("school_admins", "reset_token_hash", "VARCHAR(128) NULL")
  await addColumnIfMissing("school_admins", "reset_token_expires_at", "DATETIME NULL")
  await addColumnIfMissing("school_admins", "reset_requested_at", "DATETIME NULL")
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS school_admin_sessions (
      id BIGINT NOT NULL AUTO_INCREMENT,
      session_uuid VARCHAR(64) NOT NULL,
      admin_id BIGINT NOT NULL,
      token_hash VARCHAR(128) NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL,
      last_seen_at DATETIME NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_school_admin_session_uuid (session_uuid),
      UNIQUE KEY uniq_school_admin_session_token (token_hash),
      KEY idx_school_admin_session_admin (admin_id),
      KEY idx_school_admin_session_expiry (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

async function findSchoolAdminByEmail(emailInput: unknown) {
  const email = normalizeEmail(emailInput)
  if (!email) return null
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT id, school_id, admin_uuid, full_name, email, password_hash, password_salt, is_active
    FROM school_admins
    WHERE email COLLATE utf8mb4_unicode_ci = ${email} COLLATE utf8mb4_unicode_ci
    LIMIT 1
  `)
  return rows[0] || null
}

async function repairMissingSchoolLink(admin: Record<string, unknown>) {
  const adminId = Number(admin.id || 0)
  const schoolId = Number(admin.school_id || 0)
  const email = normalizeEmail(admin.email)
  if (!adminId || schoolId > 0 || !email) return admin
  const rows = await prisma.$queryRaw<Array<{ schoolId: number | bigint | null }>>(Prisma.sql`
    SELECT school_id AS schoolId
    FROM school_orders
    WHERE admin_email COLLATE utf8mb4_unicode_ci = ${email} COLLATE utf8mb4_unicode_ci
      AND status = 'paid'
      AND school_id IS NOT NULL
    ORDER BY paid_at DESC, id DESC
    LIMIT 1
  `)
  const recoveredSchoolId = Number(rows[0]?.schoolId || 0)
  if (!recoveredSchoolId) return admin
  await prisma.$executeRaw`
    UPDATE school_admins
    SET school_id = ${recoveredSchoolId}, is_active = 1, updated_at = UTC_TIMESTAMP()
    WHERE id = ${adminId}
    LIMIT 1
  `
  return { ...admin, school_id: recoveredSchoolId }
}

export async function verifySchoolAdminCredentials(input: { email: unknown; password: unknown }) {
  const email = normalizeEmail(input.email)
  const password = String(input.password || "")
  if (!email || !password) return null
  let admin = await findSchoolAdminByEmail(email)
  if (!admin || Number(admin.is_active || 0) !== 1) return null
  const hash = await hashPassword(password, clean(admin.password_salt, 255))
  const left = Buffer.from(hash)
  const right = Buffer.from(clean(admin.password_hash, 255))
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null
  admin = await repairMissingSchoolLink(admin)
  return admin
}

export async function createSchoolAdminSession(adminId: number) {
  await ensureSchoolAdminSessionTable()
  const token = randomToken()
  const tokenHash = shaToken(token)
  const now = new Date()
  const expiresAt = new Date(Date.now() + SCHOOL_ADMIN_SESSION_MAX_AGE * 1000)
  await prisma.$executeRaw`
    INSERT INTO school_admin_sessions
      (session_uuid, admin_id, token_hash, expires_at, created_at, last_seen_at)
    VALUES
      (${`scs_${crypto.randomUUID().replace(/-/g, "")}`}, ${adminId}, ${tokenHash}, ${expiresAt}, ${now}, ${now})
  `
  await prisma.$executeRaw`
    UPDATE school_admins
    SET last_login_at = ${now}, updated_at = ${now}
    WHERE id = ${adminId}
    LIMIT 1
  `
  const cookieStore = await cookies()
  cookieStore.set(SCHOOL_ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SCHOOL_ADMIN_SESSION_MAX_AGE
  })
}

export async function createSchoolAdminPasswordResetToken(emailInput: unknown) {
  await ensureSchoolAdminSessionTable()
  const admin = await findSchoolAdminByEmail(emailInput)
  if (!admin || Number(admin.is_active || 0) !== 1) return null
  const token = randomToken()
  const tokenHash = shaToken(token)
  const now = new Date()
  await prisma.$executeRaw`
    UPDATE school_admins
    SET reset_token_hash = ${tokenHash},
        reset_token_expires_at = NULL,
        reset_requested_at = ${now},
        updated_at = ${now}
    WHERE id = ${Number(admin.id || 0)}
    LIMIT 1
  `
  return {
    token,
    adminId: Number(admin.id || 0),
    email: normalizeEmail(admin.email),
    fullName: clean(admin.full_name, 180)
  }
}

export async function consumeSchoolAdminPasswordResetToken(input: { token: unknown; password: unknown }) {
  await ensureSchoolAdminSessionTable()
  const token = clean(input.token, 500)
  const password = String(input.password || "")
  if (!token) throw new Error("Reset token is required.")
  if (password.length < 8) throw new Error("Password must be at least 8 characters.")
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT id, email, full_name, is_active, reset_token_expires_at
    FROM school_admins
    WHERE reset_token_hash = ${shaToken(token)}
    LIMIT 1
  `)
  const admin = rows[0]
  if (!admin) throw new Error("Invalid or expired reset token.")
  if (Number(admin.is_active || 0) !== 1) throw new Error("Admin account disabled.")
  const expiresAt = admin.reset_token_expires_at ? new Date(String(admin.reset_token_expires_at)) : null
  if (expiresAt && (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() < Date.now())) {
    throw new Error("Invalid or expired reset token.")
  }
  const salt = crypto.randomBytes(16).toString("hex")
  const passwordHash = await hashPassword(password, salt)
  const now = new Date()
  await prisma.$executeRaw`
    UPDATE school_admins
    SET password_hash = ${passwordHash},
        password_salt = ${salt},
        reset_token_hash = NULL,
        reset_token_expires_at = NULL,
        reset_requested_at = NULL,
        updated_at = ${now}
    WHERE id = ${Number(admin.id || 0)}
    LIMIT 1
  `
  return {
    id: Number(admin.id || 0),
    email: normalizeEmail(admin.email),
    fullName: clean(admin.full_name, 180)
  }
}

export async function getSchoolAdminSession(): Promise<SchoolAdminSession | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SCHOOL_ADMIN_COOKIE)?.value || ""
  if (!token) return null
  const tokenHash = shaToken(token)
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT
      s.id AS session_id,
      s.expires_at,
      a.id AS admin_id,
      a.full_name AS admin_name,
      a.email AS admin_email,
      a.is_active AS admin_is_active,
      sc.id AS school_account_id,
      sc.school_name,
      sc.course_slug,
      sc.seats_purchased,
      sc.status AS school_status,
      sc.access_expires_at
    FROM school_admin_sessions s
    JOIN school_admins a ON a.id = s.admin_id
    LEFT JOIN school_accounts sc ON sc.id = a.school_id
    WHERE s.token_hash = ${tokenHash}
    LIMIT 1
  `)
  const row = rows[0]
  if (!row) return null
  const expiresAt = row.expires_at instanceof Date ? row.expires_at : new Date(String(row.expires_at || ""))
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) return null
  if (Number(row.admin_is_active || 0) !== 1 || !Number(row.school_account_id || 0)) return null
  await prisma.$executeRaw`
    UPDATE school_admin_sessions
    SET last_seen_at = ${new Date()}
    WHERE id = ${Number(row.session_id || 0)}
    LIMIT 1
  `
  return {
    id: Number(row.admin_id || 0),
    fullName: clean(row.admin_name, 180),
    email: normalizeEmail(row.admin_email),
    schoolId: Number(row.school_account_id || 0),
    schoolName: clean(row.school_name, 220),
    courseSlug: clean(row.course_slug, 120),
    seatsPurchased: Number(row.seats_purchased || 0),
    schoolStatus: clean(row.school_status, 40),
    accessExpiresAt: row.access_expires_at ? new Date(String(row.access_expires_at)).toISOString() : null
  }
}

export async function requireSchoolAdmin() {
  const session = await getSchoolAdminSession()
  if (!session) redirect("/schools/login")
  return session
}

export async function clearSchoolAdminSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SCHOOL_ADMIN_COOKIE)?.value || ""
  if (token) {
    await prisma.$executeRaw`
      DELETE FROM school_admin_sessions
      WHERE token_hash = ${shaToken(token)}
    `
  }
  cookieStore.set(SCHOOL_ADMIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  })
}
