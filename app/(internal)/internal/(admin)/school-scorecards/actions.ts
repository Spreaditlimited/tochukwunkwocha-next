"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth"
import { updateSchoolCallOutcome } from "@/lib/admin-school-calls"
import { bookSchoolCallFromScorecard } from "@/lib/admin-school-scorecards"
import { setInternalToast } from "@/lib/internal-toast"

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

export async function bookSchoolScorecardCallAction(formData: FormData) {
  await requireAdmin()
  await bookSchoolCallFromScorecard({
    leadUuid: clean(formData.get("leadUuid"), 64),
    slotStartIso: clean(formData.get("slotStartIso"), 80)
  })
  await setInternalToast({ title: "School call booked", message: "The school scorecard lead now has a scheduled call." })
  revalidatePath("/internal/school-scorecards")
  revalidatePath("/internal/school-calls")
}

export async function updateSchoolScorecardOutcomeAction(formData: FormData) {
  const admin = await requireAdmin()
  await updateSchoolCallOutcome({
    bookingUuid: clean(formData.get("bookingUuid"), 72),
    outcomeStatus: clean(formData.get("outcomeStatus"), 40),
    assignedOwner: clean(formData.get("assignedOwner"), 180),
    nextFollowUpAtIso: clean(formData.get("nextFollowUpAtIso"), 80),
    outcomeFeedback: clean(formData.get("outcomeFeedback"), 4000),
    outcomeUpdatedBy: admin.email || admin.fullName || "admin"
  })
  await setInternalToast({ title: "School scorecard updated", message: "Outcome and follow-up details have been saved." })
  revalidatePath("/internal/school-scorecards")
  revalidatePath("/internal/school-calls")
}
