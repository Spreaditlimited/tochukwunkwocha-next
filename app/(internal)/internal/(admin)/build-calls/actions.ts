"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth"
import { setInternalToast } from "@/lib/internal-toast"
import {
  cancelBuildCall,
  resendRecentBuildCallNotifications,
  rescheduleBuildCall,
  updateBuildCallOutcome
} from "@/lib/admin-build-service"

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

export async function updateBuildCallOutcomeAction(formData: FormData) {
  const admin = await requireAdmin("/internal/build-calls")
  await updateBuildCallOutcome({
    bookingUuid: clean(formData.get("bookingUuid"), 72),
    outcomeStatus: clean(formData.get("outcomeStatus"), 40),
    assignedOwner: clean(formData.get("assignedOwner"), 180),
    nextFollowUpAtIso: clean(formData.get("nextFollowUpAtIso"), 80),
    outcomeFeedback: clean(formData.get("outcomeFeedback"), 4000),
    outcomeUpdatedBy: admin.email || admin.fullName || "admin"
  })
  await setInternalToast({ title: "Build call outcome updated", message: "The booking status and follow-up details have been saved." })
  revalidatePath("/internal/build-calls")
  revalidatePath("/internal/build-scorecards")
}

export async function rescheduleBuildCallAction(formData: FormData) {
  await requireAdmin("/internal/build-calls")
  await rescheduleBuildCall({
    bookingUuid: clean(formData.get("bookingUuid"), 72),
    slotStartIso: clean(formData.get("slotStartIso"), 80),
    note: clean(formData.get("note"), 255) || "Rescheduled by admin"
  })
  await setInternalToast({ title: "Build call rescheduled", message: "The new call time has been saved." })
  revalidatePath("/internal/build-calls")
  revalidatePath("/internal/build-scorecards")
}

export async function cancelBuildCallAction(formData: FormData) {
  await requireAdmin("/internal/build-calls")
  await cancelBuildCall({
    bookingUuid: clean(formData.get("bookingUuid"), 72),
    note: clean(formData.get("note"), 255) || "Cancelled by admin"
  })
  await setInternalToast({ title: "Build call cancelled", message: "The booking has been marked as cancelled." })
  revalidatePath("/internal/build-calls")
  revalidatePath("/internal/build-scorecards")
}

export async function resendBuildCallNotificationsAction(formData: FormData) {
  await requireAdmin("/internal/build-calls")
  await resendRecentBuildCallNotifications({
    lookbackHours: Number(formData.get("lookbackHours") || 72)
  })
  await setInternalToast({ title: "Build call notifications resent", message: "Recent eligible call notifications have been queued again." })
  revalidatePath("/internal/build-calls")
}
