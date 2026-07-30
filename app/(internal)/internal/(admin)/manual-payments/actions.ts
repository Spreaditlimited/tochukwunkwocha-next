"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth"
import { setInternalToast } from "@/lib/internal-toast"
import { sendManualPaymentMetaPurchase } from "@/lib/manual-payment-meta"
import {
  addExternalStudentPayment,
  completeManualPaymentRecovery,
  deleteHolidayWaitlistContact,
  resendBatchActivationEmails,
  resendManualPaymentActivationEmail,
  sendWhatsAppCampaign,
  updateManualPaymentEmail
} from "@/lib/admin-enrollments"
import { reviewManualPayment } from "@/lib/payments/manual-payment-review"
import { reconcileCoursePaystackOrders } from "@/lib/payments/paystack-reconciliation"

export async function reconcilePaystackPaymentsAction(formData: FormData) {
  await requireAdmin("/internal/manual-payments")
  try {
    const result = await reconcileCoursePaystackOrders({
      courseSlug: String(formData.get("courseSlug") || "all"),
      batchKey: String(formData.get("batchKey") || "all"),
      limit: 80
    })
    const details = [
      `${result.markedPaid} payment${result.markedPaid === 1 ? "" : "s"} marked paid`,
      `${result.accountsCreated} account${result.accountsCreated === 1 ? "" : "s"} created`,
      `${result.provisioned} enrollment${result.provisioned === 1 ? "" : "s"} provisioned`,
      `${result.checked} Paystack reference${result.checked === 1 ? "" : "s"} checked`
    ]
    if (result.failed) details.push(`${result.failed} failed`)
    await setInternalToast({
      type: result.failed ? "error" : "success",
      title: "Paystack reconciliation complete",
      message: details.join(", ") + "."
    })
  } catch (error) {
    await setInternalToast({
      type: "error",
      title: "Paystack reconciliation failed",
      message: error instanceof Error ? error.message : "Could not reconcile Paystack payments."
    })
  }
  revalidatePath("/internal/manual-payments")
  revalidatePath("/dashboard")
}

export async function reviewManualPaymentAction(formData: FormData) {
  const admin = await requireAdmin("/internal/manual-payments")
  const paymentUuid = String(formData.get("paymentUuid") || "").trim()
  const action = String(formData.get("action") || "").trim().toLowerCase()
  const reviewNote = String(formData.get("reviewNote") || "").trim()

  if (action !== "approve" && action !== "reject") throw new Error("Invalid action")
  try {
    await reviewManualPayment({
      paymentUuid,
      action: action as "approve" | "reject",
      reviewedBy: admin.email || admin.adminUuid || "admin",
      reviewNote
    })
    await setInternalToast({ title: action === "approve" ? "Payment approved" : "Payment rejected", message: "Manual payment review has been saved." })
  } catch (error) {
    await setInternalToast({
      type: "error",
      title: action === "approve" ? "Payment was not approved" : "Payment was not rejected",
      message: error instanceof Error ? error.message : "The payment review could not be saved."
    })
  }
  revalidatePath("/internal/manual-payments")
}

export type ExternalStudentPaymentActionState = {
  status: "idle" | "success" | "error"
  title: string
  message: string
  submittedAt: number
}

export async function addExternalStudentPaymentAction(
  _previousState: ExternalStudentPaymentActionState,
  formData: FormData
): Promise<ExternalStudentPaymentActionState> {
  const admin = await requireAdmin("/internal/manual-payments")
  try {
    let groupLearners: unknown[] = []
    try {
      const parsed = JSON.parse(String(formData.get("groupLearnersJson") || "[]"))
      groupLearners = Array.isArray(parsed) ? parsed : []
    } catch {
      throw new Error("The learner assignment details could not be read. Please review them and try again.")
    }
    const result = await addExternalStudentPayment({
      sourceType: String(formData.get("sourceType") || ""),
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
      groupLearners,
      reviewedBy: admin.email || admin.adminUuid || "admin"
    })
    const accessMessage = result.buyerType === "family"
      ? `${result.seatsCredited} group seat${result.seatsCredited === 1 ? "" : "s"} credited. ${result.learnersAssigned} assigned now; ${result.seatsAvailable} available for the parent.`
      : "The student payment record has been created and access has been provisioned."
    const emailMessage = result.activationEmailSent
      ? ""
      : " Access is active, but the activation email was not sent. Use the activation-email resend tool."
    await setInternalToast({
      type: result.activationEmailSent ? "success" : "info",
      title: result.buyerType === "family" ? "Group access provisioned" : "External payment added",
      message: `${accessMessage}${emailMessage}`
    })
    revalidatePath("/internal/manual-payments")
    revalidatePath("/dashboard")
    return {
      status: "success",
      title: result.buyerType === "family" ? "Group access provisioned" : "External payment added",
      message: `${accessMessage}${emailMessage}`,
      submittedAt: Date.now()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not provision this student."
    await setInternalToast({
      type: "error",
      title: "Could not provision access",
      message
    })
    revalidatePath("/internal/manual-payments")
    revalidatePath("/dashboard")
    return {
      status: "error",
      title: "Could not provision access",
      message,
      submittedAt: Date.now()
    }
  }
}

export async function updateManualPaymentEmailAction(formData: FormData) {
  const admin = await requireAdmin("/internal/manual-payments")
  await updateManualPaymentEmail({
    paymentUuid: String(formData.get("paymentUuid") || ""),
    newEmail: String(formData.get("newEmail") || ""),
    actor: admin.email || admin.adminUuid || "admin"
  })
  await setInternalToast({ title: "Payment email updated", message: "The manual payment record now uses the corrected email address." })
  revalidatePath("/internal/manual-payments")
  revalidatePath("/dashboard")
}

export async function completeManualPaymentRecoveryAction(formData: FormData) {
  const admin = await requireAdmin("/internal/manual-payments")
  const actor = admin.email || admin.adminUuid || "admin"
  const paymentUuid = String(formData.get("paymentUuid") || "")
  await completeManualPaymentRecovery({
    paymentUuid,
    firstName: String(formData.get("firstName") || ""),
    email: String(formData.get("email") || ""),
    phone: String(formData.get("phone") || ""),
    transferReference: String(formData.get("transferReference") || ""),
    actor
  })
  await reviewManualPayment({
    paymentUuid,
    action: "approve",
    reviewedBy: actor,
    reviewNote: "Recovered customer details confirmed and payment proof approved by admin."
  })
  await setInternalToast({
    title: "Recovered payment approved",
    message: "Customer details were saved, access was provisioned, and the normal approval notifications were processed."
  })
  revalidatePath("/internal/manual-payments")
  revalidatePath("/dashboard")
}

export async function sendManualPaymentMetaPurchaseAction(formData: FormData) {
  await requireAdmin("/internal/manual-payments")
  const paymentUuid = String(formData.get("paymentUuid") || "")
  try {
    const result = await sendManualPaymentMetaPurchase({
      paymentUuid,
      fbp: String(formData.get("fbp") || ""),
      fbc: String(formData.get("fbc") || ""),
      fbclid: String(formData.get("fbclid") || ""),
      eventSourceUrl: String(formData.get("eventSourceUrl") || "")
    })
    await setInternalToast({
      title: result.alreadySent ? "Meta event already dispatched" : "Meta purchase event sent",
      message: result.alreadySent ? "The existing successful dispatch was preserved; no duplicate event was sent." : "Meta accepted the manual-payment purchase event."
    })
  } catch (error) {
    await setInternalToast({
      type: "error",
      title: "Meta event was not sent",
      message: error instanceof Error ? error.message : "Meta could not accept the purchase event. The record is safe to retry."
    })
  }
  revalidatePath("/internal/manual-payments")
}

export async function resendManualPaymentActivationEmailAction(formData: FormData) {
  await requireAdmin("/internal/manual-payments")
  await resendManualPaymentActivationEmail({
    paymentUuid: String(formData.get("paymentUuid") || ""),
    subject: String(formData.get("subject") || ""),
    messageTemplate: String(formData.get("messageTemplate") || "")
  })
  await setInternalToast({ title: "Activation email sent", message: "The student reset/access email has been resent." })
  revalidatePath("/internal/manual-payments")
}

export async function resendBatchActivationEmailsAction(formData: FormData) {
  await requireAdmin("/internal/manual-payments")
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
  await requireAdmin("/internal/manual-payments")
  await deleteHolidayWaitlistContact(formData.get("id"))
  await setInternalToast({ title: "Waitlist contact deleted", message: "The holiday waitlist contact has been removed." })
  revalidatePath("/internal/manual-payments")
}

export async function sendWhatsAppCampaignAction(formData: FormData) {
  const admin = await requireAdmin("/internal/manual-payments")
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
