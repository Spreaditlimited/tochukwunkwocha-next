import crypto from "crypto"
import fs from "node:fs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { applyAdminSettingsToProcessEnv } from "@/lib/admin-settings"
import { prisma } from "@/lib/prisma"

export interface AdminSession {
  adminUuid: string
  fullName: string
  email: string
  isOwner: boolean
  allowedPages: string[]
}

const COOKIE_NAME = "tochukwu_admin_session"

function authSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.AUTH_SECRET || "dev-only-change-this-secret"
}

function normalizeEmail(value: FormDataEntryValue | string | null | undefined) {
  return String(value || "").trim().toLowerCase()
}

function timingSafeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

function unquoteEnvValue(value: string) {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function readRawEnvValue(keyName: string) {
  try {
    const text = fs.readFileSync(".env", "utf8")
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith("#") || !line.includes("=")) continue
      const key = line.slice(0, line.indexOf("=")).trim()
      if (key === keyName) return unquoteEnvValue(line.slice(line.indexOf("=") + 1))
    }
  } catch {}
  return ""
}

function matchesAnySecret(input: string, candidates: string[]) {
  return candidates.some((candidate) => candidate && timingSafeEqual(input, candidate))
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
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean)
  } catch {}
  return raw
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeInternalPath(value: string) {
  const path = String(value || "").trim()
  if (!path) return ""
  const withSlash = path.startsWith("/") ? path : `/${path}`
  return withSlash.replace(/\/+$/, "") || "/"
}

function sign(value: string) {
  return crypto.createHmac("sha256", authSecret()).update(value).digest("hex")
}

function encodeSession(session: AdminSession) {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url")
  return `${payload}.${sign(payload)}`
}

function decodeSession(token: string | undefined): AdminSession | null {
  if (!token) return null
  const [payload, signature] = token.split(".")
  if (!payload || !signature || !timingSafeEqual(signature, sign(payload))) return null
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
    if (!parsed?.adminUuid || !parsed?.email) return null
    return {
      adminUuid: String(parsed.adminUuid),
      fullName: String(parsed.fullName || "Admin"),
      email: String(parsed.email),
      isOwner: Boolean(parsed.isOwner),
      allowedPages: Array.isArray(parsed.allowedPages) ? parsed.allowedPages.map(String) : []
    }
  } catch {
    return null
  }
}

export async function loginAdmin(emailInput: string, passwordInput: string) {
  await applyAdminSettingsToProcessEnv().catch(() => null)
  const email = normalizeEmail(emailInput)
  const password = String(passwordInput || "").trim()
  if (!password) return null

  const expectedDashboardPasswords = [
    String(process.env.ADMIN_DASHBOARD_PASSWORD || ""),
    readRawEnvValue("ADMIN_DASHBOARD_PASSWORD")
  ]

  if (email) {
    const admin = await prisma.tochukwuAdminAccount.findUnique({ where: { email } })
    if (!admin || !admin.isActive) return null

    const hash = await hashPassword(password, admin.passwordSalt)
    if (!timingSafeEqual(hash, admin.passwordHash)) return null

    const now = new Date()
    await prisma.tochukwuAdminAccount.update({
      where: { adminUuid: admin.adminUuid },
      data: { lastLoginAt: now, updatedAt: now }
    })

    return {
      adminUuid: admin.adminUuid,
      fullName: admin.fullName,
      email: admin.email,
      isOwner: admin.isOwner,
      allowedPages: parseAllowedPages(admin.allowedPages)
    } satisfies AdminSession
  }

  if (matchesAnySecret(password, expectedDashboardPasswords)) {
    return {
      adminUuid: "owner",
      fullName: "Owner",
      email: "owner@local",
      isOwner: true,
      allowedPages: []
    } satisfies AdminSession
  }

  return null
}

export async function setAdminSession(session: AdminSession) {
  await applyAdminSettingsToProcessEnv().catch(() => null)
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  })
}

export async function clearAdminSession() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export async function getAdminSession() {
  await applyAdminSettingsToProcessEnv().catch(() => null)
  const cookieStore = await cookies()
  return decodeSession(cookieStore.get(COOKIE_NAME)?.value)
}

export async function requireAdmin() {
  const session = await getAdminSession()
  if (!session) redirect("/internal/login")
  return session
}

export function canAccessDashboardPath(session: AdminSession, path: string) {
  if (session.isOwner) return true
  if (!session.allowedPages.length) return true
  const normalizedPath = normalizeInternalPath(path)
  return session.allowedPages.some((allowed) => {
    const normalizedAllowed = normalizeInternalPath(allowed)
    return normalizedPath === normalizedAllowed || normalizedPath.startsWith(`${normalizedAllowed}/`)
  })
}
