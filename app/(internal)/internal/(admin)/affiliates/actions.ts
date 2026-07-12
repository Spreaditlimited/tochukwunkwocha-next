"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireAdmin } from "@/lib/auth"
import { runAffiliatePayoutBatch, saveAffiliateCourseRule } from "@/lib/admin-affiliates"
import { setInternalToast } from "@/lib/internal-toast"

const PATH = "/internal/affiliates"

export async function saveAffiliateCourseRuleAction(formData: FormData) {
  const session = await requireAdmin()
  await saveAffiliateCourseRule(formData, session.email || "admin")
  await setInternalToast({ title: "Affiliate rule saved", message: "Course commission settings have been updated." })
  revalidatePath(PATH)
  redirect(PATH)
}

export async function runAffiliatePayoutBatchAction(formData: FormData) {
  const session = await requireAdmin()
  const result = await runAffiliatePayoutBatch(formData, session.email || "admin")
  await setInternalToast({
    title: result.empty ? "No payouts to run" : "Affiliate payout batch processed",
    message: result.empty ? "No eligible commissions matched the payout rules." : `${result.paidCount} paid, ${result.failedCount} failed.`
  })
  revalidatePath(PATH)
  redirect(`${PATH}?payout=${encodeURIComponent(JSON.stringify({
    empty: result.empty,
    candidateCount: result.candidateCount,
    paidCount: result.paidCount,
    failedCount: result.failedCount,
    totalAmountMinor: result.totalAmountMinor,
    currency: result.currency,
    payoutBatchId: result.payoutBatchId || null
  }))}`)
}
