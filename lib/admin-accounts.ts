import crypto from "crypto"

import { prisma } from "@/lib/prisma"

export const INTERNAL_PAGE_OPTIONS = [
  { path: "/internal", label: "Overview" },
  { path: "/internal/blog", label: "Blog CMS" },
  { path: "/internal/resources", label: "Resources" },
  { path: "/internal/manual-payments", label: "Manual Payments" },
  { path: "/internal/installments", label: "Installments" },
  { path: "/internal/coupons", label: "Coupons" },
  { path: "/internal/marketing", label: "Marketing" },
  { path: "/internal/whatsapp", label: "WhatsApp" },
  { path: "/internal/domains", label: "Domains" },
  { path: "/internal/video-library", label: "Video Library" },
  { path: "/internal/learning", label: "Learning Support" },
  { path: "/internal/learning-progress", label: "Learning Progress" },
  { path: "/internal/security", label: "Security" },
  { path: "/internal/schools", label: "Schools" },
  { path: "/internal/school-scorecards", label: "School Scorecards" },
  { path: "/internal/school-calls", label: "School Calls" },
  { path: "/internal/build-scorecards", label: "Build Scorecards" },
  { path: "/internal/build-calls", label: "Build Calls" },
  { path: "/internal/private-coaching", label: "Private Coaching" },
  { path: "/internal/affiliates", label: "Affiliates" },
  { path: "/internal/seo", label: "SEO Queue" },
  { path: "/internal/settings", label: "Settings" },
  { path: "/internal/admin-accounts", label: "Admin Accounts" },
]

const PAGE_PATHS = new Set(INTERNAL_PAGE_OPTIONS.map((item) => item.path))

function clean(value: unknown, max = 220) {
  return String(value || "").trim().slice(0, max)
}

function normalizeEmail(value: unknown) {
  const email = clean(value, 220).toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ""
}

function normalizeAllowedPages(input: unknown) {
  const values = Array.isArray(input) ? input : String(input || "").split(",")
  const out: string[] = []
  for (const raw of values) {
    const path = clean(raw, 220).replace(/\/+$/, "")
    if (PAGE_PATHS.has(path) && !out.includes(path)) out.push(path)
  }
  return out
}

function hashPassword(password: string, salt: string) {
  return new Promise<string>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, key) => {
      if (error) reject(error)
      else resolve(key.toString("hex"))
    })
  })
}

export async function ensureAdminAccountsTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_admin_accounts (
      id BIGINT NOT NULL AUTO_INCREMENT,
      admin_uuid VARCHAR(64) NOT NULL,
      full_name VARCHAR(180) NOT NULL,
      email VARCHAR(220) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      password_salt VARCHAR(255) NOT NULL,
      is_owner TINYINT(1) NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      allowed_pages TEXT NULL,
      created_by VARCHAR(120) NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      last_login_at DATETIME NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_admin_uuid (admin_uuid),
      UNIQUE KEY uniq_tochukwu_admin_email (email),
      KEY idx_tochukwu_admin_active (is_active, email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`ALTER TABLE tochukwu_admin_accounts MODIFY allowed_pages TEXT NULL`).catch(() => null)
}

export async function listAdminAccounts() {
  await ensureAdminAccountsTable()
  return prisma.tochukwuAdminAccount.findMany({ orderBy: { createdAt: "desc" } })
}

export async function createAdminAccount(input: {
  fullName: string
  email: string
  password: string
  allowedPages: string[]
  createdBy: string
}) {
  await ensureAdminAccountsTable()
  const fullName = clean(input.fullName, 180)
  const email = normalizeEmail(input.email)
  const password = String(input.password || "").trim()
  const allowedPages = normalizeAllowedPages(input.allowedPages)
  if (!fullName || !email || password.length < 12) throw new Error("Full name, valid email, and password of at least 12 characters are required.")
  if (!allowedPages.length) throw new Error("Select at least one page permission.")

  const salt = crypto.randomBytes(16).toString("hex")
  const hash = await hashPassword(password, salt)
  const now = new Date()
  return prisma.tochukwuAdminAccount.create({
    data: {
      adminUuid: `adm_${crypto.randomUUID().replace(/-/g, "")}`,
      fullName,
      email,
      passwordHash: hash,
      passwordSalt: salt,
      isOwner: false,
      isActive: true,
      allowedPages: allowedPages.join(","),
      createdBy: clean(input.createdBy, 120) || "owner",
      createdAt: now,
      updatedAt: now
    }
  })
}

export async function updateAdminAccount(input: {
  adminUuid: string
  isActive?: boolean
  allowedPages?: string[]
  password?: string
}) {
  await ensureAdminAccountsTable()
  const adminUuid = clean(input.adminUuid, 64)
  const existing = await prisma.tochukwuAdminAccount.findUnique({ where: { adminUuid } })
  if (!existing) throw new Error("Admin account not found.")
  if (existing.isOwner) throw new Error("Owner account cannot be edited here.")

  const data: Record<string, unknown> = { updatedAt: new Date() }
  if (typeof input.isActive === "boolean") data.isActive = input.isActive
  if (input.allowedPages) {
    const allowedPages = normalizeAllowedPages(input.allowedPages)
    if (!allowedPages.length) throw new Error("Select at least one page permission.")
    data.allowedPages = allowedPages.join(",")
  }
  if (typeof input.password === "string" && input.password.trim()) {
    const password = input.password.trim()
    if (password.length < 12) throw new Error("Password must be at least 12 characters.")
    const salt = crypto.randomBytes(16).toString("hex")
    data.passwordSalt = salt
    data.passwordHash = await hashPassword(password, salt)
  }
  const updated = await prisma.tochukwuAdminAccount.update({ where: { adminUuid }, data })
  if (typeof input.isActive === "boolean" || (typeof input.password === "string" && input.password.trim())) {
    await prisma.$executeRaw`DELETE FROM tochukwu_admin_sessions WHERE admin_uuid = ${adminUuid}`.catch(() => null)
  }
  return updated
}
