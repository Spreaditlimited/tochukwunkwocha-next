"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth"
import { bookBuildCallFromLead, sendBuildDiscoveryPaymentLink, updateBuildCallOutcome } from "@/lib/admin-build-service"
import { setInternalToast } from "@/lib/internal-toast"

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

export async function bookBuildScorecardCallAction(formData: FormData) {
  await requireAdmin()
  await bookBuildCallFromLead({
    leadUuid: clean(formData.get("leadUuid"), 64),
    slotStartIso: clean(formData.get("slotStartIso"), 80)
  })
  await setInternalToast({ title: "Build call booked", message: "The scorecard lead now has a scheduled discovery call." })
  revalidatePath("/internal/build-scorecards")
  revalidatePath("/internal/build-calls")
}

export async function updateBuildScorecardOutcomeAction(formData: FormData) {
  const admin = await requireAdmin()
  await updateBuildCallOutcome({
    bookingUuid: clean(formData.get("bookingUuid"), 72),
    outcomeStatus: clean(formData.get("outcomeStatus"), 40),
    assignedOwner: clean(formData.get("assignedOwner"), 180),
    nextFollowUpAtIso: clean(formData.get("nextFollowUpAtIso"), 80),
    outcomeFeedback: clean(formData.get("outcomeFeedback"), 4000),
    outcomeUpdatedBy: admin.email || admin.fullName || "admin"
  })
  await setInternalToast({ title: "Build scorecard updated", message: "Outcome and follow-up details have been saved." })
  revalidatePath("/internal/build-scorecards")
  revalidatePath("/internal/build-calls")
}

export async function sendBuildDiscoveryPaymentLinkAction(formData: FormData) {
  const admin = await requireAdmin()
  await sendBuildDiscoveryPaymentLink({
    leadUuid: clean(formData.get("leadUuid"), 64),
    actor: admin.email || admin.fullName || "admin",
    country: clean(formData.get("country"), 80),
    provider: clean(formData.get("provider"), 40)
  })
  await setInternalToast({ title: "Payment link sent", message: "The build discovery payment link has been generated and sent." })
  revalidatePath("/internal/build-scorecards")
}
