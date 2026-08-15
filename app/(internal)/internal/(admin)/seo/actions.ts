"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireAdmin } from "@/lib/auth"
import { setInternalToast } from "@/lib/internal-toast"
import {
  generateSeoDraftForOpportunity,
  updateOpportunityStatus
} from "@/lib/seo"
import { applySeoMetadataChange, approveSeoRewriteLink, discardSeoRewrite, getSeoChangeReview, prepareSeoRewrite, rejectSeoChangeReview } from "@/lib/seo-review"

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
    const message = error instanceof Error ? error.message : "Draft generation failed."
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
    nextUrl = `/internal/seo/changes/${pidChange}?error=${encodeURIComponent(error instanceof Error ? error.message : "Could not apply SEO draft.")}`
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
  } catch (error) { nextUrl = `/internal/seo/changes/${pidChange}?error=${encodeURIComponent(error instanceof Error ? error.message : "Could not generate rewrite.")}` }
  redirect(nextUrl)
}

export async function approveSeoRewriteLinkAction(formData: FormData) {
  const admin = await requireAdmin("/internal/seo")
  const pidChange = String(formData.get("pidChange") || ""), url = String(formData.get("url") || ""), scope = String(formData.get("scope") || "")
  if (scope !== "once" && scope !== "global") redirect(`/internal/seo/changes/${pidChange}`)
  let nextUrl = `/internal/seo/changes/${pidChange}`
  try {
    const result = await approveSeoRewriteLink({ pidChange, url, scope, approvedBy: admin.adminUuid })
    revalidatePath(`/internal/seo/changes/${pidChange}`)
    nextUrl = `/internal/seo/changes/${pidChange}?${result.status === "awaiting_link_review" ? "linkReview=1" : "rewrite=ready"}`
  } catch (error) { nextUrl = `/internal/seo/changes/${pidChange}?error=${encodeURIComponent(error instanceof Error ? error.message : "Could not approve link.")}` }
  redirect(nextUrl)
}

export async function discardSeoRewriteAction(formData: FormData) {
  await requireAdmin("/internal/seo")
  const pidChange = String(formData.get("pidChange") || "")
  await discardSeoRewrite(pidChange)
  revalidatePath(`/internal/seo/changes/${pidChange}`)
  redirect(`/internal/seo/changes/${pidChange}?rewriteDiscarded=1`)
}
