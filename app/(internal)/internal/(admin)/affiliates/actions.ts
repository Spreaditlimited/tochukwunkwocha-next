"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireAdmin } from "@/lib/auth"
import {
  finalizeAffiliatePayoutOtp,
  reconcileAffiliatePayouts,
  resendAffiliatePayoutOtp,
  retryAffiliatePayoutTransfer,
  runAffiliatePayoutBatch,
  saveAffiliateCourseRule
} from "@/lib/admin-affiliates"
import { setInternalToast } from "@/lib/internal-toast"

const PATH = "/internal/affiliates"

function safeMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "The payout operation could not be completed."
  return message.slice(0, 240)
}

export async function saveAffiliateCourseRuleAction(formData: FormData) {
  const session = await requireAdmin("/internal/affiliates")
  await saveAffiliateCourseRule(formData, session.email || "admin")
  await setInternalToast({ title: "Affiliate rule saved", message: "Course commission settings have been updated." })
  revalidatePath(PATH)
  redirect(PATH)
}

export async function runAffiliatePayoutBatchAction(formData: FormData) {
  const session = await requireAdmin("/internal/affiliates")
  let result
  try {
    result = await runAffiliatePayoutBatch(formData, session.email || "admin")
  } catch (error) {
    await setInternalToast({ type: "error", title: "Payout batch was not sent", message: safeMessage(error) })
    redirect(PATH)
  }
  await setInternalToast({
    title: result.empty ? "No payouts to run" : result.scheduled ? "Affiliate payout scheduled" : "Affiliate payout batch started",
    message: result.empty ? "No eligible commissions matched the payout rules." : result.scheduled
      ? `${result.pendingCount} commissions across ${result.transferCount} transfer(s) are reserved for the scheduled date.`
      : `${result.paidCount} paid, ${result.otpCount} awaiting OTP, ${result.pendingCount} pending, ${result.failedCount} failed.`
  })
  revalidatePath(PATH)
  redirect(`${PATH}?payout=${encodeURIComponent(JSON.stringify({
    empty: result.empty,
    candidateCount: result.candidateCount,
    paidCount: result.paidCount,
    pendingCount: result.pendingCount,
    otpCount: result.otpCount,
    failedCount: result.failedCount,
    totalAmountMinor: result.totalAmountMinor,
    paidAmountMinor: result.paidAmountMinor,
    transferCount: result.transferCount,
    scheduled: result.scheduled,
    currency: result.currency,
    payoutBatchId: result.payoutBatchId || null
  }))}`)
}

export async function finalizeAffiliatePayoutOtpAction(formData: FormData) {
  const session = await requireAdmin(PATH)
  let result
  try {
    result = await finalizeAffiliatePayoutOtp(formData, session.email || "admin")
  } catch (error) {
    await setInternalToast({ type: "error", title: "OTP was not accepted", message: safeMessage(error) })
    redirect(PATH)
  }
  await setInternalToast({ title: "Paystack OTP submitted", message: `Transfer status: ${result.status}. Final settlement will also be reconciled automatically.` })
  revalidatePath(PATH)
  redirect(PATH)
}

export async function resendAffiliatePayoutOtpAction(formData: FormData) {
  const session = await requireAdmin(PATH)
  try {
    await resendAffiliatePayoutOtp(formData, session.email || "admin")
  } catch (error) {
    await setInternalToast({ type: "error", title: "OTP could not be resent", message: safeMessage(error) })
    redirect(PATH)
  }
  await setInternalToast({ title: "Paystack OTP resent", message: "Check the phone linked to the Paystack account." })
  revalidatePath(PATH)
  redirect(PATH)
}

export async function reconcileAffiliatePayoutsAction(formData: FormData) {
  const session = await requireAdmin(PATH)
  let result
  try {
    result = await reconcileAffiliatePayouts({ reference: String(formData.get("reference") || ""), actor: session.email || "admin" })
  } catch (error) {
    await setInternalToast({ type: "error", title: "Payout status could not be refreshed", message: safeMessage(error) })
    redirect(PATH)
  }
  await setInternalToast({ title: "Payout status refreshed", message: `${result.checked} checked; ${result.paid} paid, ${result.pending} pending, ${result.otp} awaiting OTP.` })
  revalidatePath(PATH)
  redirect(PATH)
}

export async function retryAffiliatePayoutTransferAction(formData: FormData) {
  const session = await requireAdmin(PATH)
  try {
    await retryAffiliatePayoutTransfer(formData, session.email || "admin")
  } catch (error) {
    await setInternalToast({ type: "error", title: "Payout retry was not started", message: safeMessage(error) })
    redirect(PATH)
  }
  await setInternalToast({ title: "Payout retry started", message: "The previous provider state was checked before a new transfer was created." })
  revalidatePath(PATH)
  redirect(PATH)
}
