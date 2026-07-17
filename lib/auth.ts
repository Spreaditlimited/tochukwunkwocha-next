import crypto from "crypto"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"

import { applyAdminSettingsToProcessEnv } from "@/lib/admin-settings"
import { ensureAdminAccountsTable } from "@/lib/admin-accounts"
import { canAccessDashboardPath, isSafeInternalPath, normalizeInternalPath } from "@/lib/admin-permissions"
import { prisma } from "@/lib/prisma"

export { canAccessDashboardPath } from "@/lib/admin-permissions"

export interface AdminSession {
  adminUuid: string
  fullName: string
  email: string
  isOwner: boolean
  allowedPages: string[]
}

const COOKIE_NAME = "tochukwu_admin_session"
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12
const MAX_LOGIN_ATTEMPTS = 5
const MAX_LOGIN_ATTEMPTS_PER_IP = 25
const LOGIN_LOCK_MINUTES = 15
let adminSecurityTablesPromise: Promise<void> | null = null

function normalizeEmail(value: FormDataEntryValue | string | null | undefined) {
  return String(value || "").trim().toLowerCase()
}

function timingSafeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

function hashPassword(password: string, salt: string) {
  return new Promise<string>((resolve, reject) => {
    crypto.scrypt(String(password || ""), String(salt || ""), 64, (error, key) => {
      if (error) reject(error)
      else resolve(key.toString("hex"))
    })
  })
}

function parseAllowedPages(value: string | null | undefined) {
  const raw = String(value || "").trim()
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map(String).map(normalizeInternalPath).filter(isSafeInternalPath)
  } catch {}
  return raw
    .split(/[,\n]/)
    .map(normalizeInternalPath)
    .filter(isSafeInternalPath)
}

function randomToken() {
  return crypto.randomBytes(48).toString("base64url")
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

async function requestIdentity() {
  const headerStore = await headers()
  const forwarded = String(headerStore.get("x-forwarded-for") || "").trim()
  const ip = String(forwarded.split(",")[0] || headerStore.get("cf-connecting-ip") || headerStore.get("x-real-ip") || "unknown").trim().slice(0, 90)
  return {
    ipHash: sha256(`admin-ip:${ip}`),
    userAgent: String(headerStore.get("user-agent") || "").trim().slice(0, 255)
  }
}

async function ensureAdminSecurityTables() {
  if (adminSecurityTablesPromise) return adminSecurityTablesPromise
  adminSecurityTablesPromise = (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS tochukwu_admin_sessions (
        id BIGINT NOT NULL AUTO_INCREMENT,
        session_uuid VARCHAR(64) NOT NULL,
        admin_uuid VARCHAR(64) NOT NULL,
        token_hash VARCHAR(128) NOT NULL,
        ip_hash VARCHAR(128) NULL,
        user_agent VARCHAR(255) NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL,
        last_seen_at DATETIME NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_tochukwu_admin_session_uuid (session_uuid),
        UNIQUE KEY uniq_tochukwu_admin_session_token (token_hash),
        KEY idx_tochukwu_admin_session_admin (admin_uuid),
        KEY idx_tochukwu_admin_session_expiry (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS tochukwu_admin_login_attempts (
        id BIGINT NOT NULL AUTO_INCREMENT,
        identity_hash VARCHAR(128) NOT NULL,
        ip_hash VARCHAR(128) NOT NULL,
        attempts INT NOT NULL DEFAULT 0,
        locked_until DATETIME NULL,
        updated_at DATETIME NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_tochukwu_admin_login_identity_ip (identity_hash, ip_hash),
        KEY idx_tochukwu_admin_login_ip (ip_hash, locked_until)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
  })().catch((error) => {
    adminSecurityTablesPromise = null
    throw error
  })
  return adminSecurityTablesPromise
}

async function loginAttempt(email: string, ipHash: string) {
  const identityHash = sha256(`admin-email:${email || "missing"}`)
  const rows = await prisma.$queryRaw<Array<{ attempts: number | bigint; lockedUntil: Date | null }>>`
    SELECT attempts, locked_until AS lockedUntil
    FROM tochukwu_admin_login_attempts
    WHERE identity_hash = ${identityHash} AND ip_hash = ${ipHash}
    LIMIT 1
  `
  return { identityHash, row: rows[0] || null }
}

async function recentLoginAttemptsForIp(ipHash: string) {
  const rows = await prisma.$queryRaw<Array<{ total: number | bigint | null }>>`
    SELECT COALESCE(SUM(attempts), 0) AS total
    FROM tochukwu_admin_login_attempts
    WHERE ip_hash = ${ipHash}
      AND updated_at >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)
  `
  return Number(rows[0]?.total || 0)
}

async function recordLoginFailure(identityHash: string, ipHash: string, current: { attempts: number | bigint; lockedUntil: Date | null } | null) {
  const now = new Date()
  const attempts = current?.lockedUntil && current.lockedUntil.getTime() <= now.getTime() ? 1 : Number(current?.attempts || 0) + 1
  const lockedUntil = attempts >= MAX_LOGIN_ATTEMPTS ? new Date(now.getTime() + LOGIN_LOCK_MINUTES * 60 * 1000) : null
  await prisma.$executeRaw`
    INSERT INTO tochukwu_admin_login_attempts (identity_hash, ip_hash, attempts, locked_until, updated_at)
    VALUES (${identityHash}, ${ipHash}, ${attempts}, ${lockedUntil}, ${now})
    ON DUPLICATE KEY UPDATE attempts = VALUES(attempts), locked_until = VALUES(locked_until), updated_at = VALUES(updated_at)
  `
}

export async function loginAdmin(emailInput: string, passwordInput: string) {
  await applyAdminSettingsToProcessEnv().catch(() => null)
  await ensureAdminAccountsTable()
  await ensureAdminSecurityTables()
  const email = normalizeEmail(emailInput)
  const password = String(passwordInput || "")
  const identity = await requestIdentity()
  const attempt = await loginAttempt(email, identity.ipHash)
  const recentIpAttempts = await recentLoginAttemptsForIp(identity.ipHash)
  if ((attempt.row?.lockedUntil && attempt.row.lockedUntil.getTime() > Date.now()) || recentIpAttempts >= MAX_LOGIN_ATTEMPTS_PER_IP) return null
  if (!email || !password) {
    await recordLoginFailure(attempt.identityHash, identity.ipHash, attempt.row)
    return null
  }

  let admin = await prisma.tochukwuAdminAccount.findUnique({ where: { email } })
  if (!admin) {
    const accountCount = await prisma.tochukwuAdminAccount.count()
    if (accountCount === 0) {
      const configuredBootstrapPassword = String(process.env.ADMIN_DASHBOARD_PASSWORD || "")
      const suppliedBootstrapHash = await hashPassword(password, "admin-bootstrap-verification")
      const configuredBootstrapHash = await hashPassword(configuredBootstrapPassword, "admin-bootstrap-verification")
      if (configuredBootstrapPassword && timingSafeEqual(suppliedBootstrapHash, configuredBootstrapHash)) {
        const salt = crypto.randomBytes(16).toString("hex")
        const now = new Date()
        admin = await prisma.tochukwuAdminAccount.create({
          data: {
            adminUuid: `adm_${crypto.randomUUID().replace(/-/g, "")}`,
            fullName: "Owner",
            email,
            passwordHash: await hashPassword(password, salt),
            passwordSalt: salt,
            isOwner: true,
            isActive: true,
            allowedPages: "",
            createdBy: "secure-bootstrap",
            createdAt: now,
            updatedAt: now
          }
        })
      }
    }
  }
  const passwordHash = await hashPassword(password, admin?.passwordSalt || "invalid-admin-login-salt")
  if (!admin || !admin.isActive || !timingSafeEqual(passwordHash, admin.passwordHash)) {
    await recordLoginFailure(attempt.identityHash, identity.ipHash, attempt.row)
    return null
  }

  const now = new Date()
  await prisma.$transaction([
    prisma.tochukwuAdminAccount.update({
      where: { adminUuid: admin.adminUuid },
      data: { lastLoginAt: now, updatedAt: now }
    }),
    prisma.$executeRaw`
      DELETE FROM tochukwu_admin_login_attempts
      WHERE identity_hash = ${attempt.identityHash} AND ip_hash = ${identity.ipHash}
    `
  ])

  return {
    adminUuid: admin.adminUuid,
    fullName: admin.fullName,
    email: admin.email,
    isOwner: admin.isOwner,
    allowedPages: parseAllowedPages(admin.allowedPages)
  } satisfies AdminSession
}

export async function setAdminSession(session: AdminSession) {
  await ensureAdminSecurityTables()
  const identity = await requestIdentity()
  const token = randomToken()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000)
  await prisma.$executeRaw`
    INSERT INTO tochukwu_admin_sessions
      (session_uuid, admin_uuid, token_hash, ip_hash, user_agent, expires_at, created_at, last_seen_at)
    VALUES
      (${`ads_${crypto.randomUUID().replace(/-/g, "")}`}, ${session.adminUuid}, ${sha256(token)}, ${identity.ipHash}, ${identity.userAgent || null}, ${expiresAt}, ${now}, ${now})
  `
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS
  })
}

export async function clearAdminSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value || ""
  if (token) {
    await ensureAdminSecurityTables().catch(() => null)
    await prisma.$executeRaw`DELETE FROM tochukwu_admin_sessions WHERE token_hash = ${sha256(token)}`.catch(() => null)
  }
  cookieStore.delete(COOKIE_NAME)
}

export async function getAdminSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value || ""
  if (!token) return null
  try {
    await ensureAdminSecurityTables()
    const rows = await prisma.$queryRaw<Array<{
      adminUuid: string
      fullName: string
      email: string
      isOwner: number | bigint | boolean
      allowedPages: string | null
      expiresAt: Date
    }>>`
      SELECT a.admin_uuid AS adminUuid, a.full_name AS fullName, a.email,
        a.is_owner AS isOwner, a.allowed_pages AS allowedPages, s.expires_at AS expiresAt
      FROM tochukwu_admin_sessions s
      JOIN tochukwu_admin_accounts a ON a.admin_uuid = s.admin_uuid AND a.is_active = 1
      WHERE s.token_hash = ${sha256(token)}
      LIMIT 1
    `
    const row = rows[0]
    if (!row || row.expiresAt.getTime() <= Date.now()) {
      await prisma.$executeRaw`DELETE FROM tochukwu_admin_sessions WHERE token_hash = ${sha256(token)}`.catch(() => null)
      return null
    }
    await prisma.$executeRaw`UPDATE tochukwu_admin_sessions SET last_seen_at = ${new Date()} WHERE token_hash = ${sha256(token)}`.catch(() => null)
    return {
      adminUuid: row.adminUuid,
      fullName: row.fullName,
      email: row.email,
      isOwner: Boolean(row.isOwner),
      allowedPages: parseAllowedPages(row.allowedPages)
    } satisfies AdminSession
  } catch {
    return null
  }
}

export async function requireAdmin(path?: string) {
  const session = await getAdminSession()
  if (!session) redirect("/internal/login")
  if (path && !canAccessDashboardPath(session, path)) {
    const fallback = session.allowedPages.find((allowed) => isSafeInternalPath(normalizeInternalPath(allowed)))
    redirect(fallback ? `${normalizeInternalPath(fallback)}?error=forbidden` : "/")
  }
  return session
}
