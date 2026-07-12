"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth"
import { setInternalToast } from "@/lib/internal-toast"
import {
  formBool,
  resendStudentResetLink,
  resetStudentDevices,
  reviewAssignment,
  reviewTranscriptAccess,
  saveCourseFeatures
} from "@/lib/admin-learning-support"

const PATH = "/internal/learning"

export async function saveCourseFeaturesAction(formData: FormData) {
  await requireAdmin()
  await saveCourseFeatures({
    courseSlug: String(formData.get("courseSlug") || ""),
    assignmentsEnabled: formBool(formData.get("assignmentsEnabled")),
    courseCommunityEnabled: formBool(formData.get("courseCommunityEnabled")),
    tutorQuestionsEnabled: formBool(formData.get("tutorQuestionsEnabled")),
    alumniParticipationMode: String(formData.get("alumniParticipationMode") || "none"),
    certificateProofRequired: formBool(formData.get("certificateProofRequired"))
  })
  await setInternalToast({ title: "Course features saved", message: "Learning support and certificate settings have been updated." })
  revalidatePath(PATH)
}

export async function reviewAssignmentAction(formData: FormData) {
  await requireAdmin()
  await reviewAssignment({
    assignmentId: String(formData.get("assignmentId") || ""),
    status: String(formData.get("status") || ""),
    feedback: String(formData.get("feedback") || ""),
    sendApprovalEmail: formData.get("sendApprovalEmail") === "on"
  })
  await setInternalToast({ title: "Assignment reviewed", message: "The learner assignment status has been updated." })
  revalidatePath(PATH)
}

export async function reviewTranscriptAccessAction(formData: FormData) {
  await requireAdmin()
  await reviewTranscriptAccess({
    accountId: String(formData.get("accountId") || ""),
    courseSlug: String(formData.get("courseSlug") || ""),
    status: String(formData.get("status") || ""),
    notes: String(formData.get("notes") || ""),
    expiresAt: String(formData.get("expiresAt") || "")
  })
  await setInternalToast({ title: "Transcript request reviewed", message: "Transcript access status has been saved." })
  revalidatePath(PATH)
}

export async function resetStudentDevicesAction(formData: FormData) {
  await requireAdmin()
  await resetStudentDevices({
    accountId: String(formData.get("accountId") || ""),
    email: String(formData.get("email") || "")
  })
  await setInternalToast({ title: "Student devices reset", message: "Trusted devices have been cleared for the selected learner." })
  revalidatePath(PATH)
}

export async function resendStudentResetLinkAction(formData: FormData) {
  await requireAdmin()
  await resendStudentResetLink({
    accountId: String(formData.get("accountId") || ""),
    email: String(formData.get("email") || "")
  })
  await setInternalToast({ title: "Reset link sent", message: "The student password reset email has been queued." })
  revalidatePath(PATH)
}
