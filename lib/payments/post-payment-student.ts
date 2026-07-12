import { prisma } from "@/lib/prisma"
import { provisionFamilyOrder } from "@/lib/family-enrollment"
import { createStudentPasswordResetToken, createStudentSessionForAccount } from "@/lib/student-auth"
import { findOrCreateStudentAccount, normalizeEmail } from "@/lib/payments/course-checkout"

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

export async function provisionStudentForPaidOrder(order: PaidOrderRow | null | undefined) {
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

  const reset = existing ? null : await createStudentPasswordResetToken(email, { neverExpires: true })
  const session = await createStudentSessionForAccount(account)

  if (String(order?.buyer_type || "").toLowerCase() === "family" && order?.order_uuid && order?.course_slug) {
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

  return {
    account,
    token: session.token,
    resetToken: reset?.token || null
  }
}
