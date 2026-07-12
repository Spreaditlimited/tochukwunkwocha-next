"use server"

import { revalidatePath } from "next/cache"

import { setInternalToast } from "@/lib/internal-toast"
import { prisma } from "@/lib/prisma"

function normalizeCode(value: unknown) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9-_]/g, "").slice(0, 40)
}

function toMinor(value: unknown) {
  const numeric = Number(String(value || "").replace(/[, ]/g, ""))
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric * 100) : null
}

function toSqlDate(value: unknown) {
  const raw = String(value || "").trim()
  if (!raw) return null
  const date = new Date(raw)
  return Number.isFinite(date.getTime()) ? date : null
}

export async function saveCouponAction(formData: FormData) {
  const code = normalizeCode(formData.get("code"))
  const discountType = String(formData.get("discountType") || "percent").trim().toLowerCase() === "fixed" ? "fixed" : "percent"
  const description = String(formData.get("description") || "").trim().slice(0, 240) || null
  const courseSlug = String(formData.get("courseSlug") || "").trim().toLowerCase().slice(0, 120) || null
  const percentOff = discountType === "percent" ? Number(formData.get("percentOff") || 0) : null
  const fixedNgnMinor = discountType === "fixed" ? toMinor(formData.get("fixedNgn")) : null
  const fixedGbpMinor = discountType === "fixed" ? toMinor(formData.get("fixedGbp")) : null
  const maxUses = Number(formData.get("maxUses") || 0)
  const maxUsesPerEmail = Number(formData.get("maxUsesPerEmail") || 0)
  const now = new Date()
  if (!code) throw new Error("Coupon code is required.")
  if (discountType === "percent" && (!Number.isFinite(percentOff || 0) || Number(percentOff) <= 0)) throw new Error("Enter a valid percentage discount.")
  if (discountType === "fixed" && !fixedNgnMinor && !fixedGbpMinor) throw new Error("Enter at least one fixed amount.")

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS course_coupons (
      id BIGINT NOT NULL AUTO_INCREMENT,
      code VARCHAR(40) NOT NULL,
      description VARCHAR(240) NULL,
      discount_type VARCHAR(16) NOT NULL,
      percent_off DECIMAL(6,2) NULL,
      fixed_ngn_minor INT NULL,
      fixed_gbp_minor INT NULL,
      course_slug VARCHAR(120) NULL,
      starts_at DATETIME NULL,
      ends_at DATETIME NULL,
      max_uses INT NULL,
      max_uses_per_email INT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_coupon_code (code),
      KEY idx_coupon_active_dates (is_active, starts_at, ends_at),
      KEY idx_coupon_course_slug (course_slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRaw`
    INSERT INTO course_coupons
      (code, description, discount_type, percent_off, fixed_ngn_minor, fixed_gbp_minor, course_slug, starts_at, ends_at,
       max_uses, max_uses_per_email, is_active, created_at, updated_at)
    VALUES
      (${code}, ${description}, ${discountType}, ${percentOff}, ${fixedNgnMinor}, ${fixedGbpMinor}, ${courseSlug}, ${toSqlDate(formData.get("startsAt"))},
       ${toSqlDate(formData.get("endsAt"))}, ${Number.isFinite(maxUses) && maxUses > 0 ? Math.round(maxUses) : null},
       ${Number.isFinite(maxUsesPerEmail) && maxUsesPerEmail > 0 ? Math.round(maxUsesPerEmail) : null},
       ${formData.get("isActive") === "on" ? 1 : 0}, ${now}, ${now})
    ON DUPLICATE KEY UPDATE
      description = VALUES(description),
      discount_type = VALUES(discount_type),
      percent_off = VALUES(percent_off),
      fixed_ngn_minor = VALUES(fixed_ngn_minor),
      fixed_gbp_minor = VALUES(fixed_gbp_minor),
      course_slug = VALUES(course_slug),
      starts_at = VALUES(starts_at),
      ends_at = VALUES(ends_at),
      max_uses = VALUES(max_uses),
      max_uses_per_email = VALUES(max_uses_per_email),
      is_active = VALUES(is_active),
      updated_at = VALUES(updated_at)
  `
  await setInternalToast({ title: "Coupon saved", message: `${code} is now updated for checkout use.` })
  revalidatePath("/internal/coupons")
}

export async function toggleCouponAction(formData: FormData) {
  const code = normalizeCode(formData.get("code"))
  const isActive = formData.get("isActive") === "1"
  if (!code) throw new Error("Coupon code is required.")
  await prisma.$executeRaw`
    UPDATE course_coupons
    SET is_active = ${isActive ? 1 : 0}, updated_at = ${new Date()}
    WHERE code = ${code}
    LIMIT 1
  `
  await setInternalToast({ title: isActive ? "Coupon activated" : "Coupon paused", message: `${code} has been ${isActive ? "enabled" : "disabled"}.` })
  revalidatePath("/internal/coupons")
}
