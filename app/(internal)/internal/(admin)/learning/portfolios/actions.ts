"use server"

import { revalidatePath, revalidateTag } from "next/cache"

import { requireAdmin } from "@/lib/auth"
import { setInternalToast } from "@/lib/internal-toast"
import { reviewStudentPublicPortfolio, updateStudentHireEnquiry } from "@/lib/student-public-profile"

const PATH = "/internal/learning/portfolios"

export async function reviewStudentPortfolioAction(formData: FormData) {
  const admin = await requireAdmin("/internal/learning")
  try {
    const result = await reviewStudentPublicPortfolio({
      profileUuid: String(formData.get("profileUuid") || ""),
      reviewStatus: String(formData.get("reviewStatus") || "pending"),
      reviewNote: String(formData.get("reviewNote") || ""),
      guardianConsentConfirmed: formData.get("guardianConsentConfirmed") === "on",
      reviewedBy: admin.fullName || admin.email
    })
    await setInternalToast({
      title: result.reviewStatus === "approved" ? "Portfolio published" : result.reviewStatus === "rejected" ? "Changes requested" : "Portfolio returned to review",
      message: result.reviewStatus === "approved" ? "The approved portfolio snapshot and eligible hiring status are now public." : "The existing approved version, if any, remains unchanged."
    })
    revalidateTag("public-student-projects")
    revalidatePath("/projects")
    revalidatePath(`/projects/${result.publicSlug}`)
  } catch (error) {
    await setInternalToast({ type: "error", title: "Portfolio review failed", message: error instanceof Error ? error.message : "The review could not be saved." })
  }
  revalidatePath(PATH)
}

export async function updateStudentHireEnquiryAction(formData: FormData) {
  await requireAdmin("/internal/learning")
  try {
    await updateStudentHireEnquiry({
      enquiryUuid: String(formData.get("enquiryUuid") || ""),
      status: String(formData.get("status") || "new"),
      adminNote: String(formData.get("adminNote") || "")
    })
    await setInternalToast({ title: "Enquiry updated", message: "The hiring-enquiry status and internal note have been saved." })
  } catch (error) {
    await setInternalToast({ type: "error", title: "Enquiry update failed", message: error instanceof Error ? error.message : "The enquiry could not be updated." })
  }
  revalidatePath(PATH)
}
