"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth"
import { setInternalToast } from "@/lib/internal-toast"
import {
  cancelSchoolCall,
  resendRecentSchoolCallNotifications,
  rescheduleSchoolCall,
  updateSchoolCallOutcome
} from "@/lib/admin-school-calls"

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

export async function updateSchoolCallOutcomeAction(formData: FormData) {
  const admin = await requireAdmin()
  await updateSchoolCallOutcome({
    bookingUuid: clean(formData.get("bookingUuid"), 72),
    outcomeStatus: clean(formData.get("outcomeStatus"), 40),
    assignedOwner: clean(formData.get("assignedOwner"), 180),
    nextFollowUpAtIso: clean(formData.get("nextFollowUpAtIso"), 80),
    outcomeFeedback: clean(formData.get("outcomeFeedback"), 4000),
    outcomeUpdatedBy: admin.email || admin.fullName || "admin"
  })
  await setInternalToast({ title: "School call outcome updated", message: "The call status and follow-up details have been saved." })
  revalidatePath("/internal/school-calls")
  revalidatePath("/internal/school-scorecards")
}

export async function rescheduleSchoolCallAction(formData: FormData) {
  await requireAdmin()
  await rescheduleSchoolCall({
    bookingUuid: clean(formData.get("bookingUuid"), 72),
    slotStartIso: clean(formData.get("slotStartIso"), 80),
    note: clean(formData.get("note"), 255) || "Rescheduled by admin"
  })
  await setInternalToast({ title: "School call rescheduled", message: "The new school call time has been saved." })
  revalidatePath("/internal/school-calls")
  revalidatePath("/internal/school-scorecards")
}

export async function cancelSchoolCallAction(formData: FormData) {
  await requireAdmin()
  await cancelSchoolCall({
    bookingUuid: clean(formData.get("bookingUuid"), 72),
    note: clean(formData.get("note"), 255) || "Cancelled by admin"
  })
  await setInternalToast({ title: "School call cancelled", message: "The booking has been marked as cancelled." })
  revalidatePath("/internal/school-calls")
  revalidatePath("/internal/school-scorecards")
}

export async function resendSchoolCallNotificationsAction(formData: FormData) {
  await requireAdmin()
  await resendRecentSchoolCallNotifications({ lookbackHours: Number(formData.get("lookbackHours") || 72) })
  await setInternalToast({ title: "School call notifications resent", message: "Recent eligible school call notifications have been queued again." })
  revalidatePath("/internal/school-calls")
}
