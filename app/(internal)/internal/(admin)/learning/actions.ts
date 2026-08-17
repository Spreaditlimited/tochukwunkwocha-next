"use server"

import { revalidatePath, revalidateTag } from "next/cache"

import { requireAdmin } from "@/lib/auth"
import { setInternalToast } from "@/lib/internal-toast"
import {
  formBool,
  replyToCertificateProof,
  resendCertificateApprovalEmail,
  resendStudentResetLink,
  resetStudentDevices,
  reviewAdditionalProjectLink,
  reviewAssignment,
  setPublicProjectLearnerType,
  reviewTranscriptAccess,
  saveCourseFeatures
} from "@/lib/admin-learning-support"

const PATH = "/internal/learning"

export async function saveCourseFeaturesAction(formData: FormData) {
  await requireAdmin("/internal/learning")
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

export async function resendCertificateApprovalEmailAction(formData: FormData) {
  await requireAdmin("/internal/learning")
  const result = await resendCertificateApprovalEmail(String(formData.get("assignmentId") || ""))
  const failed = !result.certificate.issued || !result.email.sent
  await setInternalToast({
    type: failed ? "error" : "success",
    title: failed ? "Certificate email not sent" : "Certificate email sent",
    message: [result.certificate.message, result.email.error].filter(Boolean).join(" ")
  })
  revalidateTag("public-student-projects")
  revalidatePath("/projects")
  revalidatePath(PATH)
}

export async function reviewAssignmentAction(formData: FormData) {
  await requireAdmin("/internal/learning")
  try {
    const result = await reviewAssignment({
      assignmentId: String(formData.get("assignmentId") || ""),
      status: String(formData.get("status") || ""),
      feedback: String(formData.get("feedback") || ""),
      sendApprovalEmail: formData.get("sendApprovalEmail") === "on"
    })
    const details = [
      result.publicProjectPublished ? "The student project is public." : "",
      result.certificate.message,
      result.email.attempted
        ? result.email.sent
          ? result.email.role === "learner" ? "Learner email sent." : "Group or school owner email sent."
          : `Learning Support notification failed: ${result.email.error}`
        : ""
    ].filter(Boolean)
    await setInternalToast({
      type: result.email.attempted && !result.email.sent ? "error" : "success",
      title: result.email.attempted && !result.email.sent ? "Review saved; email failed" : "Assignment reviewed",
      message: details.join(" ") || "The learner assignment status has been updated."
    })
    revalidateTag("public-student-projects")
    revalidatePath("/projects")
    revalidatePath(PATH)
  } catch (error) {
    console.error("assignment_review_action_failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    await setInternalToast({
      type: "error",
      title: "Assignment review needs attention",
      message: error instanceof Error
        ? error.message
        : "The assignment review could not be completed. Please check the form and try again."
    })
  }
}

export async function setPublicProjectLearnerTypeAction(formData: FormData) {
  await requireAdmin("/internal/learning")
  const result = await setPublicProjectLearnerType({
    accountId: String(formData.get("accountId") || ""),
    learnerType: String(formData.get("learnerType") || "standard")
  })
  await setInternalToast({
    type: "success",
    title: "Project label saved",
    message: result.learnerType === "young"
      ? "This student's public projects will show the Young Learner badge."
      : "This student's public projects will use the standard learner presentation."
  })
  revalidateTag("public-student-projects")
  revalidatePath("/projects")
  revalidatePath(PATH)
}

export async function reviewAdditionalProjectLinkAction(formData: FormData) {
  await requireAdmin("/internal/learning")
  const result = await reviewAdditionalProjectLink({
    linkUuid: String(formData.get("linkUuid") || ""),
    reviewStatus: String(formData.get("reviewStatus") || "pending"),
    reviewNote: String(formData.get("reviewNote") || "")
  })
  await setInternalToast({
    type: "success",
    title: result.reviewStatus === "approved" ? "Project link approved" : result.reviewStatus === "rejected" ? "Project link hidden" : "Project link returned to review",
    message: result.reviewStatus === "approved"
      ? "The additional project link is approved and published on the Student Projects page."
      : "The additional project link is not visible on the public Student Projects page."
  })
  revalidateTag("public-student-projects")
  revalidatePath("/projects")
  revalidatePath(PATH)
}

export async function replyToCertificateProofAction(formData: FormData) {
  await requireAdmin("/internal/learning")
  const result = await replyToCertificateProof({
    assignmentId: String(formData.get("assignmentId") || ""),
    message: String(formData.get("message") || "")
  })
  await setInternalToast({
    type: result.email.sent ? "success" : "error",
    title: result.email.sent ? "Reply sent" : "Reply saved; email failed",
    message: result.email.sent
      ? "The learner can now see the reply; the learner or responsible owner has been notified by email."
      : result.email.error
  })
  revalidatePath(PATH)
}

export async function reviewTranscriptAccessAction(formData: FormData) {
  await requireAdmin("/internal/learning")
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
  await requireAdmin("/internal/learning")
  await resetStudentDevices({
    accountId: String(formData.get("accountId") || ""),
    email: String(formData.get("email") || "")
  })
  await setInternalToast({ title: "Student devices reset", message: "Trusted devices have been cleared for the selected learner." })
  revalidatePath(PATH)
}

export async function resendStudentResetLinkAction(formData: FormData) {
  await requireAdmin("/internal/learning")
  await resendStudentResetLink({
    accountId: String(formData.get("accountId") || ""),
    email: String(formData.get("email") || "")
  })
  await setInternalToast({ title: "Reset link sent", message: "The student password reset email has been queued." })
  revalidatePath(PATH)
}
