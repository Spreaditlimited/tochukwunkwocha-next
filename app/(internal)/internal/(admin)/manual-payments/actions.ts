"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth"
import { setInternalToast } from "@/lib/internal-toast"
import {
  addExternalStudentPayment,
  deleteHolidayWaitlistContact,
  resendBatchActivationEmails,
  resendManualPaymentActivationEmail,
  sendManualPaymentMetaPurchase,
  sendWhatsAppCampaign,
  updateManualPaymentEmail
} from "@/lib/admin-enrollments"
import { reviewManualPayment } from "@/lib/payments/manual-payment-review"

export async function reviewManualPaymentAction(formData: FormData) {
  const admin = await requireAdmin()
  const paymentUuid = String(formData.get("paymentUuid") || "").trim()
  const action = String(formData.get("action") || "").trim().toLowerCase()
  const reviewNote = String(formData.get("reviewNote") || "").trim()

  if (action !== "approve" && action !== "reject") throw new Error("Invalid action")
  await reviewManualPayment({
    paymentUuid,
    action: action as "approve" | "reject",
    reviewedBy: admin.email || admin.adminUuid || "admin",
    reviewNote
  })
  await setInternalToast({ title: action === "approve" ? "Payment approved" : "Payment rejected", message: "Manual payment review has been saved." })
  revalidatePath("/internal/manual-payments")
}

export async function addExternalStudentPaymentAction(formData: FormData) {
  const admin = await requireAdmin()
  try {
    await addExternalStudentPayment({
      courseSlug: String(formData.get("courseSlug") || ""),
      batchKey: String(formData.get("batchKey") || ""),
      firstName: String(formData.get("firstName") || ""),
      email: String(formData.get("email") || ""),
      phone: String(formData.get("phone") || ""),
      country: String(formData.get("country") || "Nigeria"),
      proofUrl: String(formData.get("proofUrl") || ""),
      proofPublicId: String(formData.get("proofPublicId") || ""),
      transferReference: String(formData.get("transferReference") || ""),
      adminNote: String(formData.get("adminNote") || ""),
      couponCode: String(formData.get("couponCode") || ""),
      buyerType: String(formData.get("buyerType") || "student"),
      seatCount: Number(formData.get("seatCount") || 1),
      reviewedBy: admin.email || admin.adminUuid || "admin"
    })
    await setInternalToast({ title: "External payment added", message: "The student payment record has been created and provisioned." })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not provision this student."
    await setInternalToast({
      type: "error",
      title: "Could not provision access",
      message
    })
  }
  revalidatePath("/internal/manual-payments")
  revalidatePath("/dashboard")
}

export async function updateManualPaymentEmailAction(formData: FormData) {
  const admin = await requireAdmin()
  await updateManualPaymentEmail({
    paymentUuid: String(formData.get("paymentUuid") || ""),
    newEmail: String(formData.get("newEmail") || ""),
    actor: admin.email || admin.adminUuid || "admin"
  })
  await setInternalToast({ title: "Payment email updated", message: "The manual payment record now uses the corrected email address." })
  revalidatePath("/internal/manual-payments")
  revalidatePath("/dashboard")
}

export async function sendManualPaymentMetaPurchaseAction(formData: FormData) {
  await requireAdmin()
  await sendManualPaymentMetaPurchase({
    paymentUuid: String(formData.get("paymentUuid") || ""),
    fbp: String(formData.get("fbp") || ""),
    fbc: String(formData.get("fbc") || ""),
    eventSourceUrl: String(formData.get("eventSourceUrl") || "")
  })
  await setInternalToast({ title: "Meta purchase event sent", message: "The manual payment conversion event has been submitted." })
  revalidatePath("/internal/manual-payments")
}

export async function resendManualPaymentActivationEmailAction(formData: FormData) {
  await requireAdmin()
  await resendManualPaymentActivationEmail({
    paymentUuid: String(formData.get("paymentUuid") || ""),
    subject: String(formData.get("subject") || ""),
    messageTemplate: String(formData.get("messageTemplate") || "")
  })
  await setInternalToast({ title: "Activation email sent", message: "The student reset/access email has been resent." })
  revalidatePath("/internal/manual-payments")
}

export async function resendBatchActivationEmailsAction(formData: FormData) {
  await requireAdmin()
  const result = await resendBatchActivationEmails({
    courseSlug: String(formData.get("courseSlug") || ""),
    batchKey: String(formData.get("batchKey") || ""),
    batchLabel: String(formData.get("batchLabel") || ""),
    subject: String(formData.get("subject") || ""),
    messageTemplate: String(formData.get("messageTemplate") || ""),
    limit: Number(formData.get("limit") || 500)
  })
  await setInternalToast({
    title: "Batch activation emails processed",
    message: `${result.sent} sent, ${result.failed} failed${result.createdAccounts ? `, ${result.createdAccounts} account${result.createdAccounts === 1 ? "" : "s"} created` : ""}.`
  })
  revalidatePath("/internal/manual-payments")
}

export async function deleteHolidayWaitlistContactAction(formData: FormData) {
  await requireAdmin()
  await deleteHolidayWaitlistContact(formData.get("id"))
  await setInternalToast({ title: "Waitlist contact deleted", message: "The holiday waitlist contact has been removed." })
  revalidatePath("/internal/manual-payments")
}

export async function sendWhatsAppCampaignAction(formData: FormData) {
  const admin = await requireAdmin()
  await sendWhatsAppCampaign({
    campaignName: String(formData.get("campaignName") || ""),
    templateName: String(formData.get("templateName") || ""),
    templateLanguage: String(formData.get("templateLanguage") || "en"),
    variableMode: String(formData.get("variableMode") || "recipient_full_name"),
    templatePreview: String(formData.get("templatePreview") || ""),
    courseSlug: String(formData.get("courseSlug") || "all"),
    testPhone: String(formData.get("testPhone") || ""),
    sendTest: String(formData.get("sendMode") || "") === "test",
    createdBy: admin.email || admin.adminUuid || "admin"
  })
  await setInternalToast({ title: "WhatsApp campaign queued", message: "The selected campaign has been prepared for delivery." })
  revalidatePath("/internal/manual-payments")
}
