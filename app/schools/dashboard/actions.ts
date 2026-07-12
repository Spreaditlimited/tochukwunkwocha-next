"use server"

import crypto from "crypto"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import {
  addSchoolStudent,
  deleteSchoolCertificate,
  importSchoolStudents,
  issueSchoolCertificate,
  parseSchoolStudentsCsv,
  resetSchoolStudentCode,
  runSchoolAdvancedUpgrade,
  setSchoolStudentStatus
} from "@/lib/school-dashboard"
import { clearSchoolAdminSession, requireSchoolAdmin } from "@/lib/school-auth"
import { createSchoolAdvancedSeatCheckout } from "@/lib/payments/school-advanced"

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

export async function addSchoolStudentAction(formData: FormData) {
  const session = await requireSchoolAdmin()
  await addSchoolStudent({
    schoolId: session.schoolId,
    courseSlug: session.courseSlug || "prompt-to-profit",
    adminId: session.id,
    fullName: clean(formData.get("fullName"), 180),
    email: clean(formData.get("email"), 220)
  })
  revalidatePath("/schools/dashboard")
}

export async function importSchoolStudentsAction(formData: FormData) {
  const session = await requireSchoolAdmin()
  const csvFile = formData.get("csvFile")
  const csvText = csvFile instanceof File ? await csvFile.text() : clean(formData.get("csvText"), 200000)
  const rows = parseSchoolStudentsCsv(csvText)
  if (!rows.length) throw new Error("Upload a CSV with full_name and optional email columns.")
  await importSchoolStudents({
    schoolId: session.schoolId,
    courseSlug: session.courseSlug || "prompt-to-profit",
    adminId: session.id,
    rows
  })
  revalidatePath("/schools/dashboard")
}

export async function upgradeSchoolAdvancedStudentsAction(formData: FormData) {
  const session = await requireSchoolAdmin()
  const mode = clean(formData.get("mode"), 20) === "all" ? "all" : "selected"
  const selectedStudentIds = formData
    .getAll("studentId")
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0)
  await runSchoolAdvancedUpgrade({
    schoolId: session.schoolId,
    adminId: session.id,
    mode,
    selectedStudentIds,
    idempotencyKey: `school-ui-${Date.now()}-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`
  })
  revalidatePath("/schools/dashboard")
}

export async function createSchoolAdvancedSeatCheckoutAction(formData: FormData) {
  const session = await requireSchoolAdmin()
  const checkout = await createSchoolAdvancedSeatCheckout({
    schoolId: session.schoolId,
    schoolName: session.schoolName,
    adminName: session.fullName,
    adminEmail: session.email,
    courseSlug: session.courseSlug || "prompt-to-profit",
    seatCount: formData.get("seatCount")
  })
  redirect(checkout.checkoutUrl)
}

export async function toggleSchoolStudentAction(formData: FormData) {
  const session = await requireSchoolAdmin()
  await setSchoolStudentStatus({
    schoolId: session.schoolId,
    studentId: Number(formData.get("studentId") || 0),
    active: clean(formData.get("active"), 10) === "1"
  })
  revalidatePath("/schools/dashboard")
}

export async function resetSchoolStudentCodeAction(formData: FormData) {
  const session = await requireSchoolAdmin()
  await resetSchoolStudentCode({
    schoolId: session.schoolId,
    studentId: Number(formData.get("studentId") || 0),
    adminId: session.id
  })
  revalidatePath("/schools/dashboard")
}

export async function issueSchoolCertificateAction(formData: FormData) {
  const session = await requireSchoolAdmin()
  await issueSchoolCertificate({
    schoolId: session.schoolId,
    studentId: Number(formData.get("studentId") || 0),
    adminId: session.id,
    courseSlug: session.courseSlug || "prompt-to-profit"
  })
  revalidatePath("/schools/dashboard")
}

export async function deleteSchoolCertificateAction(formData: FormData) {
  const session = await requireSchoolAdmin()
  await deleteSchoolCertificate({
    schoolId: session.schoolId,
    studentId: Number(formData.get("studentId") || 0),
    courseSlug: session.courseSlug || "prompt-to-profit"
  })
  revalidatePath("/schools/dashboard")
}

export async function schoolLogoutAction() {
  await clearSchoolAdminSession()
  redirect("/schools/login")
}
