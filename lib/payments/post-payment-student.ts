import { prisma } from "@/lib/prisma"
import { sendStudentAccountReadyEmail, syncEnrollmentToBrevo } from "@/lib/enrollment-notifications"
import { provisionFamilyOrder } from "@/lib/family-enrollment"
import { createStudentSessionForAccount, createStudentTemporaryPassword } from "@/lib/student-auth"
import { findOrCreateStudentAccount, normalizeEmail } from "@/lib/payments/course-checkout"
import { sendEnrollmentConfirmedWhatsApp } from "@/lib/transactional-whatsapp"

type PaidOrderRow = {
  order_uuid?: string | null
  course_slug?: string | null
  first_name: string | null
  email: string | null
  phone: string | null
  buyer_type?: string | null
  seat_count?: number | bigint | null
  batch_key?: string | null
  batch_label?: string | null
}

export async function provisionStudentForPaidOrder(
  order: PaidOrderRow | null | undefined,
  options?: { createSession?: boolean; sendNotifications?: boolean }
) {
  const email = normalizeEmail(order?.email)
  if (!email) return null

  const existing = await prisma.studentAccount.findUnique({ where: { email } })
  const account =
    existing ||
    (await findOrCreateStudentAccount({
      fullName: String(order?.first_name || "Student").trim() || "Student",
      email,
      phone: String(order?.phone || "").trim() || undefined
    }))

  const isGroupEnrollment = String(order?.buyer_type || "").toLowerCase() === "family"
  if (isGroupEnrollment && order?.order_uuid && order?.course_slug) {
    await provisionFamilyOrder({
      sourceType: "course_order",
      sourceUuid: String(order.order_uuid),
      parentAccountId: account.id,
      parentName: account.fullName,
      parentEmail: account.email,
      parentPhone: account.phoneE164 || String(order.phone || ""),
      courseSlug: String(order.course_slug),
      batchKey: order.batch_key || "",
      batchLabel: order.batch_label || "",
      quantity: Math.max(1, Number(order.seat_count || 1))
    })
  }

  const sendNotifications = options?.sendNotifications !== false || !existing
  const needsFirstUsePassword = sendNotifications && (!existing || (existing.mustResetPassword && !existing.resetRequestedAt))
  const temporary = needsFirstUsePassword ? await createStudentTemporaryPassword(email) : null
  if (!isGroupEnrollment) {
    await syncEnrollmentToBrevo({
      fullName: account.fullName,
      email: account.email,
      phone: account.phoneE164 || String(order?.phone || ""),
      courseSlug: order?.course_slug || "",
      batchKey: order?.batch_key || "",
      batchLabel: order?.batch_label || "",
      source: "paid_course_enrollment"
    }).catch(() => null)
  }
  if (sendNotifications) {
    await sendEnrollmentConfirmedWhatsApp({
      phone: account.phoneE164 || String(order?.phone || ""),
      fullName: account.fullName,
      courseSlug: order?.course_slug || "",
      dashboardPath: isGroupEnrollment ? "/dashboard/family" : "/dashboard/courses"
    }).catch(() => null)
  }
  let activationEmailSent = false
  if (temporary?.password && sendNotifications) {
    const delivery = await sendStudentAccountReadyEmail({
      email: account.email,
      fullName: account.fullName,
      courseSlug: order?.course_slug || "",
      temporaryPassword: temporary.password
    }).catch(() => null)
    activationEmailSent = Boolean(delivery?.ok)
  }

  const session = options?.createSession === false
    ? null
    : await createStudentSessionForAccount(account).catch((error) => {
        console.error("[student-provisioning] account created but automatic sign-in session failed", {
          email: account.email,
          error: error instanceof Error ? error.message : String(error)
        })
        return null
      })

  return {
    account,
    token: session?.token || null,
    resetToken: null,
    accountCreated: !existing,
    activationEmailSent
  }
}
