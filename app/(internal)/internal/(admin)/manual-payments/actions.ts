"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth"
import { sendManualPaymentMetaPurchase } from "@/lib/manual-payment-meta"
import {
  addExternalStudentPayment,
  completeManualPaymentRecovery,
  deleteHolidayWaitlistContact,
  provisionAllMissingPaidEnrollmentAccounts,
  resendBatchActivationEmails,
  resendPaidEnrollmentActivationEmail,
  sendWhatsAppCampaign,
  updateManualPaymentEmail
} from "@/lib/admin-enrollments"
import { reviewManualPayment } from "@/lib/payments/manual-payment-review"
import { reconcileCoursePaystackOrders } from "@/lib/payments/paystack-reconciliation"

export type ManualPaymentActionState = {
  status: "idle" | "success" | "error"
  title: string
  message: string
  submittedAt: number
}

export async function reconcilePaystackPaymentsAction(
  _previousState: ManualPaymentActionState,
  formData: FormData
): Promise<ManualPaymentActionState> {
  await requireAdmin("/internal/manual-payments")
  try {
    const result = await reconcileCoursePaystackOrders({
      courseSlug: String(formData.get("courseSlug") || "all"),
      batchKey: String(formData.get("batchKey") || "all"),
      limit: 20
    })
    const details = [
      `${result.markedPaid} payment${result.markedPaid === 1 ? "" : "s"} marked paid`,
      `${result.accountsCreated} account${result.accountsCreated === 1 ? "" : "s"} created`,
      `${result.provisioned} enrollment${result.provisioned === 1 ? "" : "s"} provisioned`,
      `${result.checked} Paystack reference${result.checked === 1 ? "" : "s"} checked`,
      `${result.stillProcessing} still processing`,
      `${result.notPaid} not paid`
    ]
    if (result.mismatched) details.push(`${result.mismatched} amount or currency mismatch${result.mismatched === 1 ? "" : "es"}`)
    if (result.duplicateReview) details.push(`${result.duplicateReview} duplicate payment${result.duplicateReview === 1 ? "" : "s"} held for review`)
    if (result.failed) details.push(`${result.failed} failed`)
    revalidatePath("/internal/manual-payments")
    revalidatePath("/dashboard")
    return {
      status: result.failed || result.mismatched || result.duplicateReview ? "error" : "success",
      title: "Paystack reconciliation complete",
      message: details.join(", ") + ".",
      submittedAt: Date.now()
    }
  } catch (error) {
    console.error("paystack_reconciliation_action_failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return {
      status: "error",
      title: "Paystack reconciliation failed",
      message: "Could not reconcile Paystack payments. No payment status was changed by this failed run. Please try again or check the server logs.",
      submittedAt: Date.now()
    }
  }
}

export async function reviewManualPaymentAction(
  _previousState: ManualPaymentActionState,
  formData: FormData
): Promise<ManualPaymentActionState> {
  const admin = await requireAdmin("/internal/manual-payments")
  const paymentUuid = String(formData.get("paymentUuid") || "").trim()
  const action = String(formData.get("action") || "").trim().toLowerCase()
  const reviewNote = String(formData.get("reviewNote") || "").trim()

  try {
    if (action !== "approve" && action !== "reject") throw new Error("Invalid payment review action.")
    await reviewManualPayment({
      paymentUuid,
      action: action as "approve" | "reject",
      reviewedBy: admin.email || admin.adminUuid || "admin",
      reviewNote
    })
    revalidatePath("/internal/manual-payments")
    return {
      status: "success",
      title: action === "approve" ? "Payment approved" : "Payment rejected",
      message: "Manual payment review has been saved.",
      submittedAt: Date.now()
    }
  } catch (error) {
    return {
      status: "error",
      title: action === "approve" ? "Payment was not approved" : "Payment was not rejected",
      message: error instanceof Error ? error.message : "The payment review could not be saved.",
      submittedAt: Date.now()
    }
  }
}

export type ExternalStudentPaymentActionState = ManualPaymentActionState

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
      affiliateCode: String(formData.get("affiliateCode") || ""),
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
    const affiliateMessage = result.affiliateCommission && !result.affiliateCommission.ok
      ? " Affiliate credit is queued for automatic reconciliation."
      : ""
    revalidatePath("/internal/manual-payments")
    revalidatePath("/dashboard")
    return {
      status: "success",
      title: result.buyerType === "family" ? "Group access provisioned" : "External payment added",
      message: `${accessMessage}${emailMessage}${affiliateMessage}`,
      submittedAt: Date.now()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not provision this student."
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

export async function updateManualPaymentEmailAction(
  _previousState: ManualPaymentActionState,
  formData: FormData
): Promise<ManualPaymentActionState> {
  const admin = await requireAdmin("/internal/manual-payments")
  try {
    await updateManualPaymentEmail({
      paymentUuid: String(formData.get("paymentUuid") || ""),
      newEmail: String(formData.get("newEmail") || ""),
      actor: admin.email || admin.adminUuid || "admin"
    })
    revalidatePath("/internal/manual-payments")
    revalidatePath("/dashboard")
    return {
      status: "success",
      title: "Payment email updated",
      message: "The manual payment record now uses the corrected email address.",
      submittedAt: Date.now()
    }
  } catch (error) {
    return {
      status: "error",
      title: "Payment email was not updated",
      message: error instanceof Error ? error.message : "The corrected email address could not be saved.",
      submittedAt: Date.now()
    }
  }
}

export async function completeManualPaymentRecoveryAction(
  _previousState: ManualPaymentActionState,
  formData: FormData
): Promise<ManualPaymentActionState> {
  const admin = await requireAdmin("/internal/manual-payments")
  const actor = admin.email || admin.adminUuid || "admin"
  const paymentUuid = String(formData.get("paymentUuid") || "")
  try {
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
    revalidatePath("/internal/manual-payments")
    revalidatePath("/dashboard")
    return {
      status: "success",
      title: "Recovered payment approved",
      message: "Customer details were saved, access was provisioned, and the normal approval notifications were processed.",
      submittedAt: Date.now()
    }
  } catch (error) {
    return {
      status: "error",
      title: "Recovered payment was not approved",
      message: error instanceof Error ? error.message : "The customer details could not be saved and approved.",
      submittedAt: Date.now()
    }
  }
}

export async function sendManualPaymentMetaPurchaseAction(
  _previousState: ManualPaymentActionState,
  formData: FormData
): Promise<ManualPaymentActionState> {
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
    revalidatePath("/internal/manual-payments")
    return {
      status: "success",
      title: result.alreadySent ? "Meta event already dispatched" : "Meta purchase event sent",
      message: result.alreadySent ? "The existing successful dispatch was preserved; no duplicate event was sent." : "Meta accepted the manual-payment purchase event.",
      submittedAt: Date.now()
    }
  } catch (error) {
    return {
      status: "error",
      title: "Meta event was not sent",
      message: error instanceof Error ? error.message : "Meta could not accept the purchase event. The record is safe to retry.",
      submittedAt: Date.now()
    }
  }
}

export type ActivationEmailActionState = ManualPaymentActionState

export async function resendManualPaymentActivationEmailAction(
  _previousState: ActivationEmailActionState,
  formData: FormData
): Promise<ActivationEmailActionState> {
  await requireAdmin("/internal/manual-payments")
  try {
    const result = await resendPaidEnrollmentActivationEmail({
      source: String(formData.get("source") || "manual"),
      paymentUuid: String(formData.get("paymentUuid") || "")
    })
    revalidatePath("/internal/manual-payments")
    return {
      status: result.emailSent ? "success" : "error",
      title: result.accountCreated && result.emailSent
        ? "Account created and Activation Email sent."
        : result.emailSent
          ? "Activation Email sent."
          : "Activation Email was not sent.",
      message: result.accountCreated && !result.emailSent
        ? "The account was created, but the email provider did not accept the activation email. You can safely retry."
        : "",
      submittedAt: Date.now()
    }
  } catch (error) {
    return {
      status: "error",
      title: "Activation was not sent",
      message: error instanceof Error ? error.message : "The account could not be provisioned or emailed.",
      submittedAt: Date.now()
    }
  }
}

export type ProvisionMissingAccountsActionState = ManualPaymentActionState

export async function provisionMissingPaidEnrollmentAccountsAction(
  _previousState: ProvisionMissingAccountsActionState
): Promise<ProvisionMissingAccountsActionState> {
  await requireAdmin("/internal/manual-payments")
  try {
    const result = await provisionAllMissingPaidEnrollmentAccounts({ limit: 8 })
    revalidatePath("/internal/manual-payments")
    revalidatePath("/dashboard")

    if (result.failed) {
      return {
        status: "error",
        title: "Some accounts could not be created",
        message: `${result.accountsCreated} created, ${result.emailsSent} activation emails sent, and ${result.failed} failed.${result.remaining ? ` ${result.remaining} remain.` : ""}`,
        submittedAt: Date.now()
      }
    }
    if (!result.totalMissing) {
      return {
        status: "success",
        title: "No missing accounts found",
        message: "Every paid enrollment currently has a student account.",
        submittedAt: Date.now()
      }
    }
    return {
      status: "success",
      title: result.accountsCreated === 1
        ? "Account created and Activation Email sent."
        : "Accounts created and Activation Emails sent.",
      message: result.accountsCreated === 1
        ? ""
        : `${result.accountsCreated} accounts were created and ${result.emailsSent} activation emails were sent.${result.remaining ? ` ${result.remaining} remain.` : ""}`,
      submittedAt: Date.now()
    }
  } catch (error) {
    return {
      status: "error",
      title: "Global account check failed",
      message: error instanceof Error ? error.message : "Missing paid-enrollment accounts could not be provisioned.",
      submittedAt: Date.now()
    }
  }
}

export async function resendBatchActivationEmailsAction(
  _previousState: ManualPaymentActionState,
  formData: FormData
): Promise<ManualPaymentActionState> {
  await requireAdmin("/internal/manual-payments")
  try {
    const result = await resendBatchActivationEmails({
      courseSlug: String(formData.get("courseSlug") || ""),
      batchKey: String(formData.get("batchKey") || ""),
      batchLabel: String(formData.get("batchLabel") || ""),
      subject: String(formData.get("subject") || ""),
      messageTemplate: String(formData.get("messageTemplate") || ""),
      limit: Number(formData.get("limit") || 500)
    })
    revalidatePath("/internal/manual-payments")
    return {
      status: result.failed ? "error" : "success",
      title: result.failed ? "Batch activation completed with issues" : "Batch activation emails processed",
      message: `${result.sent} sent, ${result.failed} failed${result.createdAccounts ? `, ${result.createdAccounts} account${result.createdAccounts === 1 ? "" : "s"} created` : ""}.`,
      submittedAt: Date.now()
    }
  } catch (error) {
    return {
      status: "error",
      title: "Batch activation emails were not sent",
      message: error instanceof Error ? error.message : "The batch activation email run could not be completed.",
      submittedAt: Date.now()
    }
  }
}

export async function deleteHolidayWaitlistContactAction(
  _previousState: ManualPaymentActionState,
  formData: FormData
): Promise<ManualPaymentActionState> {
  await requireAdmin("/internal/manual-payments")
  try {
    await deleteHolidayWaitlistContact(formData.get("id"))
    revalidatePath("/internal/manual-payments")
    return {
      status: "success",
      title: "Waitlist contact deleted",
      message: "The holiday waitlist contact has been removed.",
      submittedAt: Date.now()
    }
  } catch (error) {
    return {
      status: "error",
      title: "Waitlist contact was not deleted",
      message: error instanceof Error ? error.message : "The holiday waitlist contact could not be removed.",
      submittedAt: Date.now()
    }
  }
}

export async function sendWhatsAppCampaignAction(
  _previousState: ManualPaymentActionState,
  formData: FormData
): Promise<ManualPaymentActionState> {
  const admin = await requireAdmin("/internal/manual-payments")
  const sendTest = String(formData.get("sendMode") || "") === "test"
  try {
    const result = await sendWhatsAppCampaign({
      campaignName: String(formData.get("campaignName") || ""),
      templateName: String(formData.get("templateName") || ""),
      templateLanguage: String(formData.get("templateLanguage") || "en"),
      variableMode: String(formData.get("variableMode") || "recipient_full_name"),
      templatePreview: String(formData.get("templatePreview") || ""),
      courseSlug: String(formData.get("courseSlug") || "all"),
      testPhone: String(formData.get("testPhone") || ""),
      sendTest,
      createdBy: admin.email || admin.adminUuid || "admin"
    })
    revalidatePath("/internal/manual-payments")
    return {
      status: "success",
      title: sendTest ? "WhatsApp test sent" : "WhatsApp campaign queued",
      message: sendTest
        ? "The test broadcast was sent to the selected phone number."
        : `${result.recipientCount} recipient${result.recipientCount === 1 ? "" : "s"} queued for delivery.`,
      submittedAt: Date.now()
    }
  } catch (error) {
    return {
      status: "error",
      title: sendTest ? "WhatsApp test was not sent" : "WhatsApp campaign was not queued",
      message: error instanceof Error ? error.message : "The WhatsApp request could not be completed.",
      submittedAt: Date.now()
    }
  }
}
