import crypto from "crypto"
import { cookies } from "next/headers"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { addColumnIfMissing } from "@/lib/schema-guards"

const COOKIE_NAME = "tws_student_session"
const SESSION_MAX_AGE = 60 * 60 * 24 * 30
const DEFAULT_MAX_DEVICES_PER_ACCOUNT = 2
const DEFAULT_MAX_CONCURRENT_SESSIONS_PER_ACCOUNT = 2
const DEVICE_ALERT_IP_SPREAD_THRESHOLD = 3

export interface StudentSessionAccount {
  id: bigint
  accountUuid: string
  fullName: string
  email: string
  domainsAutoRenewEnabled: boolean
  certificateNameConfirmedAt: Date | null
  certificateNameUpdatedAt: Date | null
}

export function normalizeStudentEmail(value: FormDataEntryValue | string | null | undefined) {
  const email = String(value || "").trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ""
}

function normalizeEmail(value: FormDataEntryValue | string | null | undefined) {
  return normalizeStudentEmail(value)
}

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
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

function randomToken() {
  return crypto.randomBytes(48).toString("base64url")
}

function shaToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex")
}

function maxDevicesPerAccount() {
  const raw = Number(process.env.STUDENT_MAX_DEVICES_PER_ACCOUNT || process.env.SCHOOL_STUDENT_MAX_DEVICES_PER_ACCOUNT || DEFAULT_MAX_DEVICES_PER_ACCOUNT)
  return Number.isFinite(raw) && raw >= 1 ? Math.trunc(raw) : DEFAULT_MAX_DEVICES_PER_ACCOUNT
}

function maxConcurrentSessionsPerAccount() {
  const raw = Number(process.env.STUDENT_MAX_CONCURRENT_SESSIONS_PER_ACCOUNT || process.env.SCHOOL_STUDENT_MAX_CONCURRENT_SESSIONS_PER_ACCOUNT || DEFAULT_MAX_CONCURRENT_SESSIONS_PER_ACCOUNT)
  return Number.isFinite(raw) && raw >= 1 ? Math.trunc(raw) : DEFAULT_MAX_CONCURRENT_SESSIONS_PER_ACCOUNT
}

function ipPrefix(ip: string) {
  const value = clean(ip, 90)
  if (!value) return ""
  if (value.includes(":")) return value.split(":").filter(Boolean).slice(0, 4).join(":")
  const parts = value.split(".")
  return parts.length >= 3 ? `${parts[0]}.${parts[1]}.${parts[2]}` : value
}

function shaValue(raw: string) {
  return crypto.createHash("sha256").update(String(raw || "")).digest("hex")
}

async function resolveStudentDeviceIdentity() {
  const headerStore = await headers()
  const explicit = clean(headerStore.get("x-student-device-id"), 180).replace(/[^\w.\-:]/g, "")
  const userAgent = clean(headerStore.get("user-agent"), 255)
  const forwardedFor = clean(headerStore.get("x-forwarded-for"), 90)
  const ip = clean(forwardedFor.split(",")[0] || headerStore.get("cf-connecting-ip") || headerStore.get("x-real-ip"), 90)
  const fallbackSeed = `${userAgent}|${ipPrefix(ip)}`
  const base = explicit || fallbackSeed || `anon_${Date.now()}`
  return {
    deviceIdHint: explicit,
    deviceHash: shaValue(`dev:${base}`),
    ipHash: ip ? shaValue(`ip:${ip}`) : "",
    userAgent
  }
}

async function ensureStudentSecurityTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS student_account_devices (
      id BIGINT NOT NULL AUTO_INCREMENT,
      account_id BIGINT NOT NULL,
      device_hash VARCHAR(128) NOT NULL,
      device_id_hint VARCHAR(190) NULL,
      last_ip_hash VARCHAR(128) NULL,
      last_user_agent VARCHAR(255) NULL,
      first_seen_at DATETIME NOT NULL,
      last_seen_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_student_device_per_account (account_id, device_hash),
      KEY idx_student_devices_account (account_id),
      KEY idx_student_devices_seen (last_seen_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS student_security_alerts (
      id BIGINT NOT NULL AUTO_INCREMENT,
      alert_uuid VARCHAR(64) NOT NULL,
      account_id BIGINT NOT NULL,
      school_id BIGINT NULL,
      alert_type VARCHAR(80) NOT NULL,
      severity VARCHAR(30) NOT NULL DEFAULT 'medium',
      alert_key VARCHAR(128) NULL,
      title VARCHAR(255) NOT NULL,
      details_json LONGTEXT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'open',
      occurrences INT NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL,
      last_seen_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_student_alert_uuid (alert_uuid),
      KEY idx_student_alert_account (account_id, status, created_at),
      KEY idx_student_alert_school (school_id, status, created_at),
      KEY idx_student_alert_type (alert_type, status),
      KEY idx_student_alert_seen (last_seen_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

export async function ensureStudentDemographicColumns() {
  await addColumnIfMissing("student_accounts", "demographic_country", "VARCHAR(120) NULL")
  await addColumnIfMissing("student_accounts", "demographic_region", "VARCHAR(120) NULL")
  await addColumnIfMissing("student_accounts", "age_band", "VARCHAR(40) NULL")
  await addColumnIfMissing("student_accounts", "gender", "VARCHAR(40) NULL")
  await addColumnIfMissing("student_accounts", "learner_category", "VARCHAR(80) NULL")
  await addColumnIfMissing("student_accounts", "demographic_updated_at", "DATETIME NULL")
}

async function createStudentSecurityAlert(input: {
  accountId: bigint
  alertType: string
  severity: string
  alertKey: string
  title: string
  details?: Record<string, unknown>
}) {
  const now = new Date()
  const existing = await prisma.$queryRaw<Array<{ id: bigint; occurrences: number }>>(Prisma.sql`
    SELECT id, occurrences
    FROM student_security_alerts
    WHERE account_id = ${input.accountId}
      AND alert_key = ${input.alertKey}
      AND status = 'open'
    LIMIT 1
  `)
  if (existing[0]) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE student_security_alerts
      SET occurrences = ${Number(existing[0].occurrences || 0) + 1},
          last_seen_at = ${now},
          updated_at = ${now},
          details_json = ${JSON.stringify(input.details || {})}
      WHERE id = ${existing[0].id}
      LIMIT 1
    `)
    return
  }
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO student_security_alerts
      (alert_uuid, account_id, alert_type, severity, alert_key, title, details_json, status, occurrences, created_at, last_seen_at, updated_at)
    VALUES
      (${`ssa_${crypto.randomUUID().replace(/-/g, "")}`}, ${input.accountId}, ${input.alertType}, ${input.severity}, ${input.alertKey}, ${input.title},
       ${JSON.stringify(input.details || {})}, 'open', 1, ${now}, ${now}, ${now})
  `)
}

async function registerStudentDevice(accountId: bigint, identity: Awaited<ReturnType<typeof resolveStudentDeviceIdentity>>) {
  await ensureStudentSecurityTables()
  const now = new Date()
  const existing = await prisma.$queryRaw<Array<{ id: bigint }>>(Prisma.sql`
    SELECT id
    FROM student_account_devices
    WHERE account_id = ${accountId}
      AND device_hash = ${identity.deviceHash}
    LIMIT 1
  `)
  if (existing[0]) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE student_account_devices
      SET device_id_hint = ${identity.deviceIdHint || null},
          last_ip_hash = ${identity.ipHash || null},
          last_user_agent = ${identity.userAgent || null},
          last_seen_at = ${now},
          updated_at = ${now}
      WHERE id = ${existing[0].id}
      LIMIT 1
    `)
    return
  }

  const countRows = await prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
    SELECT COUNT(*) AS total
    FROM student_account_devices
    WHERE account_id = ${accountId}
  `)
  const currentCount = Number(countRows[0]?.total || 0)
  const limit = maxDevicesPerAccount()
  if (currentCount >= limit) {
    await createStudentSecurityAlert({
      accountId,
      alertType: "device_limit_reached",
      severity: "low",
      alertKey: shaValue(`device_limit_reached:${accountId}:${identity.deviceHash}`),
      title: "Device history limit reached (login still allowed)",
      details: { limit, currentCount, attemptedDeviceHash: identity.deviceHash, userAgent: identity.userAgent }
    })
    return
  }

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO student_account_devices
      (account_id, device_hash, device_id_hint, last_ip_hash, last_user_agent, first_seen_at, last_seen_at, created_at, updated_at)
    VALUES
      (${accountId}, ${identity.deviceHash}, ${identity.deviceIdHint || null}, ${identity.ipHash || null}, ${identity.userAgent || null},
       ${now}, ${now}, ${now}, ${now})
  `)

  if (currentCount > 0) {
    await createStudentSecurityAlert({
      accountId,
      alertType: "new_device_login",
      severity: "medium",
      alertKey: shaValue(`new_device:${accountId}:${identity.deviceHash}`),
      title: "New device added to student account",
      details: { knownDevicesBefore: currentCount, knownDevicesAfter: currentCount + 1, userAgent: identity.userAgent }
    })
  }

  const spreadRows = await prisma.$queryRaw<Array<{ ipCount: bigint }>>(Prisma.sql`
    SELECT COUNT(DISTINCT last_ip_hash) AS ipCount
    FROM student_account_devices
    WHERE account_id = ${accountId}
      AND last_ip_hash IS NOT NULL
      AND last_ip_hash <> ''
  `)
  const ipCount = Number(spreadRows[0]?.ipCount || 0)
  if (ipCount >= DEVICE_ALERT_IP_SPREAD_THRESHOLD) {
    await createStudentSecurityAlert({
      accountId,
      alertType: "high_ip_spread",
      severity: "high",
      alertKey: shaValue(`ip_spread:${accountId}:${ipCount}`),
      title: "High IP/device spread detected",
      details: { uniqueIps: ipCount, threshold: DEVICE_ALERT_IP_SPREAD_THRESHOLD }
    })
  }
}

type StudentAccountForSession = {
  id: bigint
  accountUuid: string
  fullName: string
  email: string
  domainsAutoRenewEnabled: boolean
  certificateNameConfirmedAt: Date | null
  certificateNameUpdatedAt: Date | null
}

export async function createStudentSessionForAccount(account: StudentAccountForSession) {
  const token = randomToken()
  const now = new Date()
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000)
  const identity = await resolveStudentDeviceIdentity()
  await registerStudentDevice(account.id, identity).catch(() => null)

  const activeSessions = await prisma.studentSession.findMany({
    where: {
      accountId: account.id,
      expiresAt: { gt: now }
    },
    orderBy: [{ lastSeenAt: "asc" }, { createdAt: "asc" }],
    select: { id: true }
  })
  const maxConcurrent = maxConcurrentSessionsPerAccount()
  const staleSessionIds = activeSessions.slice(0, Math.max(0, activeSessions.length - maxConcurrent + 1)).map((session) => session.id)

  await prisma.$transaction([
    prisma.studentSession.deleteMany({
      where: {
        accountId: account.id,
        expiresAt: { lte: now }
      }
    }),
    prisma.studentSession.deleteMany({
      where: {
        id: { in: staleSessionIds }
      }
    }),
    prisma.studentSession.create({
      data: {
        sessionUuid: `ss_${crypto.randomUUID().replace(/-/g, "")}`,
        accountId: account.id,
        tokenHash: shaToken(token),
        deviceHash: identity.deviceHash || null,
        deviceIdHint: identity.deviceIdHint || null,
        ipHash: identity.ipHash || null,
        userAgent: identity.userAgent || null,
        expiresAt,
        createdAt: now,
        lastSeenAt: now
      }
    }),
    prisma.studentAccount.update({
      where: { accountUuid: account.accountUuid },
      data: { lastLoginAt: now, updatedAt: now }
    })
  ])

  return {
    token,
    account: {
      id: account.id,
      accountUuid: account.accountUuid,
      fullName: account.fullName,
      email: account.email,
      domainsAutoRenewEnabled: account.domainsAutoRenewEnabled,
      certificateNameConfirmedAt: account.certificateNameConfirmedAt,
      certificateNameUpdatedAt: account.certificateNameUpdatedAt
    }
  }
}

export async function loginStudent(emailInput: string, passwordInput: string) {
  const email = normalizeEmail(emailInput)
  const password = String(passwordInput || "")
  if (!email || !password) return { ok: false as const, error: "Invalid email or password" }

  const account = await prisma.studentAccount.findUnique({ where: { email } })
  if (!account) return { ok: false as const, error: "Invalid email or password" }

  const hash = await hashPassword(password, account.passwordSalt)
  if (!timingSafeEqual(hash, account.passwordHash)) {
    return { ok: false as const, error: "Invalid email or password" }
  }

  if (account.mustResetPassword) {
    return {
      ok: false as const,
      code: "PASSWORD_RESET_REQUIRED",
      error: "Password reset required before sign in"
    }
  }

  const session = await createStudentSessionForAccount(account)

  return {
    ok: true as const,
    token: session.token,
    account: session.account
  }
}

export async function createStudentPasswordResetToken(emailInput: string, options?: { neverExpires?: boolean }) {
  const email = normalizeEmail(emailInput)
  if (!email) return null
  const account = await prisma.studentAccount.findUnique({ where: { email } })
  if (!account) return null
  const rawToken = randomToken()
  const tokenHash = shaToken(rawToken)
  const now = new Date()
  await prisma.studentAccount.update({
    where: { email },
    data: {
      resetTokenHash: tokenHash,
      resetTokenExpiresAt: options?.neverExpires ? null : new Date(Date.now() + 1000 * 60 * 60),
      resetRequestedAt: now,
      updatedAt: now
    }
  })
  return {
    token: rawToken,
    accountId: account.id,
    email: account.email,
    fullName: account.fullName
  }
}

export async function setStudentPassword(accountId: bigint, passwordInput: string) {
  const password = String(passwordInput || "")
  if (password.length < 8) throw new Error("Password must be at least 8 characters")
  const salt = crypto.randomBytes(16).toString("hex")
  const hash = await hashPassword(password, salt)
  const now = new Date()
  await prisma.studentAccount.update({
    where: { id: accountId },
    data: {
      passwordHash: hash,
      passwordSalt: salt,
      mustResetPassword: false,
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      resetRequestedAt: null,
      updatedAt: now
    }
  })
}

export async function consumeStudentPasswordResetToken(tokenInput: string, passwordInput: string) {
  const token = clean(tokenInput, 500)
  if (!token) throw new Error("Reset token is required")
  const tokenHash = shaToken(token)
  const account = await prisma.studentAccount.findFirst({
    where: { resetTokenHash: tokenHash }
  })
  if (!account) throw new Error("Invalid or expired reset token")
  if (account.resetTokenExpiresAt && account.resetTokenExpiresAt.getTime() < Date.now()) {
    throw new Error("Invalid or expired reset token")
  }
  await setStudentPassword(account.id, passwordInput)
  return account
}

export async function verifyStudentPassword(accountId: bigint, passwordInput: string) {
  const account = await prisma.studentAccount.findUnique({ where: { id: accountId } })
  if (!account) return false
  const hash = await hashPassword(String(passwordInput || ""), account.passwordSalt)
  return timingSafeEqual(hash, account.passwordHash)
}

export async function getStudentProfile(accountId: bigint) {
  await ensureStudentDemographicColumns()
  const account = await prisma.studentAccount.findUnique({ where: { id: accountId } })
  if (!account) throw new Error("Account not found")
  const demographicRows = await prisma.$queryRaw<Array<{
    demographicCountry: string | null
    demographicRegion: string | null
    ageBand: string | null
    gender: string | null
    learnerCategory: string | null
    demographicUpdatedAt: Date | null
  }>>(Prisma.sql`
    SELECT demographic_country AS demographicCountry,
      demographic_region AS demographicRegion,
      age_band AS ageBand,
      gender,
      learner_category AS learnerCategory,
      demographic_updated_at AS demographicUpdatedAt
    FROM student_accounts
    WHERE id = ${accountId}
    LIMIT 1
  `)
  const demographics = demographicRows[0]
  return {
    accountUuid: account.accountUuid,
    fullName: account.fullName,
    email: account.email,
    phone: account.phoneE164 || "",
    whatsappOptedIn: account.whatsappOptedIn,
    whatsappOptedInAt: account.whatsappOptedInAt,
    whatsappOptedOutAt: account.whatsappOptedOutAt,
    certificateNameConfirmedAt: account.certificateNameConfirmedAt,
    certificateNameUpdatedAt: account.certificateNameUpdatedAt,
    certificateNameNeedsConfirmation: !account.certificateNameConfirmedAt,
    demographicCountry: clean(demographics?.demographicCountry, 120),
    demographicRegion: clean(demographics?.demographicRegion, 120),
    ageBand: clean(demographics?.ageBand, 40),
    gender: clean(demographics?.gender, 40),
    learnerCategory: clean(demographics?.learnerCategory, 80),
    demographicUpdatedAt: demographics?.demographicUpdatedAt || null
  }
}

export async function updateStudentProfile(accountId: bigint, input: {
  fullName: string
  phoneE164?: string
  whatsappOptedIn?: boolean
  demographicCountry?: string
  demographicRegion?: string
  ageBand?: string
  gender?: string
  learnerCategory?: string
}) {
  await ensureStudentDemographicColumns()
  const fullName = clean(input.fullName, 180)
  const phoneE164 = clean(input.phoneE164, 20)
  const whatsappOptedIn = input.whatsappOptedIn === true
  if (!fullName) throw new Error("Full name is required")
  const existing = await prisma.studentAccount.findUnique({ where: { id: accountId } })
  if (!existing) throw new Error("Account not found")
  const nameChanged = clean(existing.fullName, 180) !== fullName
  if (nameChanged && existing.certificateNameConfirmedAt) {
    throw new Error("Certificate name has been confirmed and locked. Name changes are no longer allowed.")
  }
  const now = new Date()
  const account = await prisma.studentAccount.update({
    where: { id: accountId },
    data: {
      fullName,
      phoneE164: phoneE164 || null,
      whatsappOptedIn,
      whatsappOptedInAt: whatsappOptedIn ? existing.whatsappOptedInAt || now : existing.whatsappOptedInAt,
      whatsappOptedOutAt: whatsappOptedIn ? null : now,
      certificateNameConfirmedAt: nameChanged ? null : existing.certificateNameConfirmedAt,
      certificateNameUpdatedAt: nameChanged ? now : existing.certificateNameUpdatedAt,
      updatedAt: now
    }
  })
  await prisma.$executeRaw(Prisma.sql`
    UPDATE school_students
    SET full_name = ${fullName}, updated_at = ${now}
    WHERE account_id = ${accountId}
  `).catch(() => null)
  await prisma.$executeRaw(Prisma.sql`
    UPDATE student_accounts
    SET demographic_country = ${clean(input.demographicCountry, 120) || null},
        demographic_region = ${clean(input.demographicRegion, 120) || null},
        age_band = ${clean(input.ageBand, 40) || null},
        gender = ${clean(input.gender, 40) || null},
        learner_category = ${clean(input.learnerCategory, 80) || null},
        demographic_updated_at = ${now}
    WHERE id = ${accountId}
  `)
  return account
}

export async function confirmStudentCertificateName(accountId: bigint) {
  const existing = await prisma.studentAccount.findUnique({ where: { id: accountId } })
  if (!existing) throw new Error("Account not found")
  if (!clean(existing.fullName, 180)) throw new Error("Profile name is required before confirmation")
  if (existing.certificateNameConfirmedAt) {
    throw new Error("Certificate name has already been confirmed and cannot be confirmed again.")
  }
  const now = new Date()
  return prisma.studentAccount.update({
    where: { id: accountId },
    data: {
      certificateNameConfirmedAt: now,
      certificateNameUpdatedAt: existing.certificateNameUpdatedAt || now,
      updatedAt: now
    }
  })
}

export async function listStudentSecurity(accountId: bigint, currentToken?: string) {
  await ensureStudentSecurityTables().catch(() => null)
  const currentTokenHash = currentToken ? shaToken(currentToken) : ""
  const sessions = await prisma.studentSession.findMany({
    where: { accountId, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, sessionUuid: true, deviceIdHint: true, userAgent: true, createdAt: true, lastSeenAt: true, expiresAt: true, tokenHash: true }
  })
  const devices = await prisma.$queryRaw<Array<{
    id: bigint
    deviceIdHint: string | null
    lastUserAgent: string | null
    firstSeenAt: Date
    lastSeenAt: Date
  }>>(Prisma.sql`
    SELECT id, device_id_hint AS deviceIdHint, last_user_agent AS lastUserAgent, first_seen_at AS firstSeenAt, last_seen_at AS lastSeenAt
    FROM student_account_devices
    WHERE account_id = ${accountId}
    ORDER BY last_seen_at DESC
  `).catch(() => [])
  const alerts = await prisma.$queryRaw<Array<{
    alertUuid: string
    alertType: string
    severity: string
    title: string
    status: string
    occurrences: number
    lastSeenAt: Date
  }>>(Prisma.sql`
    SELECT alert_uuid AS alertUuid, alert_type AS alertType, severity, title, status, occurrences, last_seen_at AS lastSeenAt
    FROM student_security_alerts
    WHERE account_id = ${accountId}
    ORDER BY last_seen_at DESC
    LIMIT 10
  `).catch(() => [])
  return {
    sessions: sessions.map((session) => ({
      id: session.id,
      sessionUuid: session.sessionUuid,
      deviceIdHint: session.deviceIdHint,
      userAgent: session.userAgent,
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
      expiresAt: session.expiresAt,
      isCurrent: !!currentTokenHash && session.tokenHash === currentTokenHash
    })),
    devices,
    alerts
  }
}

export async function revokeStudentSession(accountId: bigint, sessionUuid: string, currentToken?: string) {
  const currentTokenHash = currentToken ? shaToken(currentToken) : ""
  await prisma.studentSession.deleteMany({
    where: {
      accountId,
      sessionUuid,
      tokenHash: currentTokenHash ? { not: currentTokenHash } : undefined
    }
  })
}

export async function revokeOtherStudentSessions(accountId: bigint, currentToken: string) {
  await prisma.studentSession.deleteMany({
    where: {
      accountId,
      tokenHash: { not: shaToken(currentToken) }
    }
  })
}

export async function setStudentSessionCookie(token: string) {
  const cookieStore = await cookies()
  const headerStore = await headers()
  const host = (headerStore.get("host") || "").toLowerCase()
  const isLocalHost =
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("[::1]")
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !isLocalHost,
    path: "/",
    maxAge: SESSION_MAX_AGE
  })
}

export async function clearStudentSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value || ""
  if (token) {
    await prisma.studentSession.deleteMany({ where: { tokenHash: shaToken(token) } }).catch(() => null)
  }
  cookieStore.delete(COOKIE_NAME)
}

export async function getStudentSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value || ""
  if (!token) return null

  const session = await prisma.studentSession.findUnique({
    where: { tokenHash: shaToken(token) },
    include: { account: true }
  })
  if (!session) return null

  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.studentSession.delete({ where: { tokenHash: shaToken(token) } }).catch(() => null)
    return null
  }

  await prisma.studentSession
    .update({
      where: { tokenHash: shaToken(token) },
      data: { lastSeenAt: new Date() }
    })
    .catch(() => null)

  return {
    token,
    account: {
      id: session.account.id,
      accountUuid: session.account.accountUuid,
      fullName: session.account.fullName,
      email: session.account.email,
      domainsAutoRenewEnabled: session.account.domainsAutoRenewEnabled,
      certificateNameConfirmedAt: session.account.certificateNameConfirmedAt,
      certificateNameUpdatedAt: session.account.certificateNameUpdatedAt
    } satisfies StudentSessionAccount
  }
}

export async function requireStudent() {
  const session = await getStudentSession()
  if (!session) redirect("/dashboard/login")
  return session
}
