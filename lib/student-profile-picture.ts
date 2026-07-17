import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { addColumnIfMissing } from "@/lib/schema-guards"

export const STUDENT_PROFILE_PICTURE_MAX_BYTES = 1024 * 1024
export const STUDENT_PROFILE_PICTURE_ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

export async function ensureStudentProfilePictureColumns() {
  await addColumnIfMissing("student_accounts", "profile_picture_url", "TEXT NULL")
  await addColumnIfMissing("student_accounts", "profile_picture_public_id", "VARCHAR(500) NULL")
  await addColumnIfMissing("student_accounts", "profile_picture_updated_at", "DATETIME NULL")
}

export function detectStudentProfilePictureType(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg"
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "image/png"
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) return "image/webp"
  return ""
}

export async function saveStudentProfilePicture(input: {
  accountId: bigint
  url: string
  publicId: string
}) {
  await ensureStudentProfilePictureColumns()
  await prisma.$executeRaw(Prisma.sql`
    UPDATE student_accounts
    SET profile_picture_url = ${input.url},
        profile_picture_public_id = ${input.publicId},
        profile_picture_updated_at = ${new Date()},
        updated_at = ${new Date()}
    WHERE id = ${input.accountId}
    LIMIT 1
  `)
}

export async function clearStudentProfilePicture(accountId: bigint) {
  await ensureStudentProfilePictureColumns()
  await prisma.$executeRaw(Prisma.sql`
    UPDATE student_accounts
    SET profile_picture_url = NULL,
        profile_picture_public_id = NULL,
        profile_picture_updated_at = ${new Date()},
        updated_at = ${new Date()}
    WHERE id = ${accountId}
    LIMIT 1
  `)
}

export async function getStudentProfilePicture(accountId: bigint) {
  await ensureStudentProfilePictureColumns()
  const rows = await prisma.$queryRaw<Array<{
    profilePictureUrl: string | null
    profilePicturePublicId: string | null
  }>>(Prisma.sql`
    SELECT profile_picture_url AS profilePictureUrl,
           profile_picture_public_id AS profilePicturePublicId
    FROM student_accounts
    WHERE id = ${accountId}
    LIMIT 1
  `)
  return {
    url: String(rows[0]?.profilePictureUrl || "").trim(),
    publicId: String(rows[0]?.profilePicturePublicId || "").trim()
  }
}
