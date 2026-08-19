"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireAdmin } from "@/lib/auth"
import { setInternalToast } from "@/lib/internal-toast"
import { safeUserErrorMessage } from "@/lib/student-error-feedback"
import {
  generateSeoDraftForOpportunity,
  updateOpportunityStatus
} from "@/lib/seo"
import { applySeoMetadataChange, approveSeoRewriteLink, discardSeoRewrite, getSeoChangeReview, prepareSeoRewrite, rejectSeoChangeReview, reviewSeoRewriteLink, saveSeoInternalLinkSuggestionFeedback } from "@/lib/seo-review"

export async function updateOpportunityStatusAction(formData: FormData) {
  await requireAdmin("/internal/seo")
  await updateOpportunityStatus(
    String(formData.get("pidOpportunity") || ""),
    String(formData.get("status") || "")
  )
  await setInternalToast({ title: "SEO opportunity updated", message: "The opportunity status has been saved." })
  revalidatePath("/internal/seo")
}

export async function generateSeoDraftAction(formData: FormData) {
  await requireAdmin("/internal/seo")
  const pidOpportunity = String(formData.get("pidOpportunity") || "").trim()
  if (!pidOpportunity) redirect("/internal/seo")

  let nextUrl = "/internal/seo"
  try {
    const result = await generateSeoDraftForOpportunity(pidOpportunity)
    await setInternalToast(result.reused
      ? { title: "Existing SEO draft opened", message: "This article already has an active content change, so no second draft was generated." }
      : { title: "SEO draft generated", message: "Review the generated content change before applying it." })
    revalidatePath("/internal/seo")
    nextUrl = `/internal/seo/changes/${result.pidChange}`
  } catch (error) {
    const message = safeUserErrorMessage(error, "Draft generation failed. Please try again.")
    nextUrl = `/internal/seo?error=${encodeURIComponent(message)}`
  }
  redirect(nextUrl)
}

export async function applySeoChangeAction(formData: FormData) {
  await requireAdmin("/internal/seo")
  const pidChange = String(formData.get("pidChange") || "").trim()
  if (!pidChange) redirect("/internal/seo")
  let nextUrl = `/internal/seo/changes/${pidChange}`
  try {
    const result = await applySeoMetadataChange(pidChange)
    const review = await getSeoChangeReview(pidChange)
    await setInternalToast(result.status === "awaiting_link_review"
      ? { title: "Link review required", message: "Approve the new internal links before applying the saved rewrite." }
      : { title: "SEO change applied", message: "The approved rewrite, metadata, and FAQ have been saved." })
    revalidatePath("/internal/seo")
    revalidatePath("/blog")
    if (review?.blogSlug) revalidatePath(`/blog/${review.blogSlug}`)
    nextUrl = `/internal/seo/changes/${pidChange}?${result.status === "awaiting_link_review" ? "linkReview=1" : `applied=${result.status}`}`
  } catch (error) {
    nextUrl = `/internal/seo/changes/${pidChange}?error=${encodeURIComponent(safeUserErrorMessage(error, "Could not apply SEO draft. Please try again."))}`
  }
  redirect(nextUrl)
}

export async function rejectSeoChangeAction(formData: FormData) {
  await requireAdmin("/internal/seo")
  const pidChange = String(formData.get("pidChange") || "").trim()
  if (!pidChange) redirect("/internal/seo")
  await rejectSeoChangeReview(pidChange)
  await setInternalToast({ title: "SEO change rejected", message: "The proposed content change has been rejected." })
  revalidatePath("/internal/seo")
  redirect(`/internal/seo/changes/${pidChange}?rejected=1`)
}

export async function generateSeoRewriteAction(formData: FormData) {
  await requireAdmin("/internal/seo")
  const pidChange = String(formData.get("pidChange") || "").trim()
  let nextUrl = `/internal/seo/changes/${pidChange}`
  try {
    const result = await prepareSeoRewrite(pidChange)
    revalidatePath(`/internal/seo/changes/${pidChange}`)
    nextUrl = `/internal/seo/changes/${pidChange}?${result.status === "processing" ? "rewrite=processing" : result.status === "awaiting_link_review" ? "linkReview=1" : "rewrite=ready"}`
  } catch (error) { nextUrl = `/internal/seo/changes/${pidChange}?error=${encodeURIComponent(safeUserErrorMessage(error, "Could not generate rewrite. Please try again."))}` }
  redirect(nextUrl)
}

export async function approveSeoRewriteLinkAction(formData: FormData) {
  const admin = await requireAdmin("/internal/seo")
  const pidChange = String(formData.get("pidChange") || ""), url = String(formData.get("url") || ""), scope = String(formData.get("scope") || ""), note = String(formData.get("note") || "")
  if (scope !== "once" && scope !== "global") redirect(`/internal/seo/changes/${pidChange}`)
  let nextUrl = `/internal/seo/changes/${pidChange}`
  try {
    const result = await approveSeoRewriteLink({ pidChange, url, scope, approvedBy: admin.adminUuid, note })
    revalidatePath(`/internal/seo/changes/${pidChange}`)
    nextUrl = `/internal/seo/changes/${pidChange}?${result.status === "awaiting_link_review" ? "linkReview=1" : "rewrite=ready"}`
  } catch (error) { nextUrl = `/internal/seo/changes/${pidChange}?error=${encodeURIComponent(safeUserErrorMessage(error, "Could not approve link. Please try again."))}` }
  redirect(nextUrl)
}

export async function saveSeoInternalLinkSuggestionAction(formData: FormData) {
  const admin = await requireAdmin("/internal/seo")
  const pidChange = String(formData.get("pidChange") || ""), originalUrl = String(formData.get("originalUrl") || ""), decision = String(formData.get("decision") || ""), replacementUrl = String(formData.get("replacementUrl") || ""), note = String(formData.get("note") || "")
  if (!pidChange || !["keep", "rejected", "amended"].includes(decision)) redirect(`/internal/seo/changes/${pidChange}`)
  let nextUrl = `/internal/seo/changes/${pidChange}?linkSuggestionSaved=1`
  try {
    await saveSeoInternalLinkSuggestionFeedback({ pidChange, originalUrl, decision: decision as "keep" | "rejected" | "amended", replacementUrl, note, updatedBy: admin.adminUuid })
    revalidatePath(`/internal/seo/changes/${pidChange}`)
  } catch (error) { nextUrl = `/internal/seo/changes/${pidChange}?error=${encodeURIComponent(safeUserErrorMessage(error, "Could not save internal-link feedback. Please try again."))}` }
  redirect(nextUrl)
}

export async function reviewSeoRewriteLinkAction(formData: FormData) {
  const admin = await requireAdmin("/internal/seo")
  const pidChange = String(formData.get("pidChange") || ""), url = String(formData.get("url") || ""), decision = String(formData.get("decision") || ""), replacementUrl = String(formData.get("replacementUrl") || ""), note = String(formData.get("note") || "")
  if (!pidChange || !["rejected", "amended"].includes(decision)) redirect(`/internal/seo/changes/${pidChange}`)
  let nextUrl = `/internal/seo/changes/${pidChange}`
  try {
    const result = await reviewSeoRewriteLink({ pidChange, url, decision: decision as "rejected" | "amended", replacementUrl, note, reviewedBy: admin.adminUuid })
    revalidatePath(`/internal/seo/changes/${pidChange}`)
    nextUrl = `/internal/seo/changes/${pidChange}?${result.status === "awaiting_link_review" ? "linkReview=1" : "rewrite=ready"}`
  } catch (error) { nextUrl = `/internal/seo/changes/${pidChange}?error=${encodeURIComponent(safeUserErrorMessage(error, "Could not review link. Please try again."))}` }
  redirect(nextUrl)
}

export async function discardSeoRewriteAction(formData: FormData) {
  await requireAdmin("/internal/seo")
  const pidChange = String(formData.get("pidChange") || "")
  await discardSeoRewrite(pidChange)
  revalidatePath(`/internal/seo/changes/${pidChange}`)
  redirect(`/internal/seo/changes/${pidChange}?rewriteDiscarded=1`)
}
