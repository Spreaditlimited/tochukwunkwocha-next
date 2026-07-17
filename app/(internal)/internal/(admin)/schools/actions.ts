"use server"

import { revalidatePath } from "next/cache"

import { setInternalToast } from "@/lib/internal-toast"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/auth"

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function toDate(value: unknown) {
  const raw = clean(value, 80)
  if (!raw) return null
  const date = new Date(raw)
  return Number.isFinite(date.getTime()) ? date : null
}

export async function updateSchoolAccountAction(formData: FormData) {
  await requireAdmin("/internal/schools")
  const schoolId = BigInt(String(formData.get("schoolId") || "0"))
  const status = clean(formData.get("status"), 40).toLowerCase() || "active"
  const seats = Number(formData.get("seatsPurchased") || 0)
  if (!schoolId) throw new Error("schoolId is required.")
  if (!["active", "disabled", "expired"].includes(status)) throw new Error("status must be active, disabled, or expired.")
  if (!Number.isFinite(seats) || seats < 1) throw new Error("Seats purchased must be at least 1.")
  await prisma.$executeRaw`
    UPDATE school_accounts
    SET status = ${status},
        seats_purchased = ${Math.round(seats)},
        access_expires_at = ${toDate(formData.get("accessExpiresAt"))},
        updated_at = ${new Date()}
    WHERE id = ${schoolId}
    LIMIT 1
  `
  await setInternalToast({ title: "School account updated", message: "Seats, status, and access expiry have been saved." })
  revalidatePath("/internal/schools")
}
