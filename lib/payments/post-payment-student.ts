import { prisma } from "@/lib/prisma"
import { provisionFamilyOrder } from "@/lib/family-enrollment"
import { enqueueEnrollmentConfirmationNotification, processPaymentNotificationOutbox } from "@/lib/payment-notification-outbox"
import { createStudentSessionForAccount, createStudentTemporaryPassword } from "@/lib/student-auth"
import { findOrCreateStudentAccount, hasWhatsAppEnrollmentConsent, normalizeEmail } from "@/lib/payments/course-checkout"

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
  let activationEmailSent = false
  if (sendNotifications) {
    const notificationPhone = String(order?.phone || "").trim() || account.phoneE164 || ""
    const sendWhatsApp = await hasWhatsAppEnrollmentConsent({ phone: notificationPhone })
    const sourceUuid = String(order?.order_uuid || `${order?.course_slug || "course"}:${order?.batch_key || "batch"}:${email}`)
    const eventUuid = await enqueueEnrollmentConfirmationNotification({
      sourceType: "course_order",
      sourceUuid,
      email: account.email,
      fullName: account.fullName,
      phone: notificationPhone,
      courseSlug: order?.course_slug || "",
      batchKey: order?.batch_key || "",
      batchLabel: order?.batch_label || "",
      dashboardPath: isGroupEnrollment ? "/dashboard/family" : "/dashboard/courses",
      temporaryPassword: temporary?.password || null,
      syncBrevo: !isGroupEnrollment,
      sendWhatsApp
    })
    const delivery = await processPaymentNotificationOutbox({ eventUuid })
    activationEmailSent = delivery.completed === 1
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
