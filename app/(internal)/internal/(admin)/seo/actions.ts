"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireAdmin } from "@/lib/auth"
import { setInternalToast } from "@/lib/internal-toast"
import {
  applySeoChange,
  generateSeoDraftForOpportunity,
  rejectSeoChange,
  updateOpportunityStatus
} from "@/lib/seo"

export async function updateOpportunityStatusAction(formData: FormData) {
  await requireAdmin()
  await updateOpportunityStatus(
    String(formData.get("pidOpportunity") || ""),
    String(formData.get("status") || "")
  )
  await setInternalToast({ title: "SEO opportunity updated", message: "The opportunity status has been saved." })
  revalidatePath("/internal/seo")
}

export async function generateSeoDraftAction(formData: FormData) {
  await requireAdmin()
  const pidOpportunity = String(formData.get("pidOpportunity") || "").trim()
  if (!pidOpportunity) redirect("/internal/seo")

  try {
    const result = await generateSeoDraftForOpportunity(pidOpportunity)
    await setInternalToast({ title: "SEO draft generated", message: "Review the generated content change before applying it." })
    revalidatePath("/internal/seo")
    redirect(`/internal/seo/changes/${result.pidChange}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Draft generation failed."
    redirect(`/internal/seo?error=${encodeURIComponent(message)}`)
  }
}

export async function applySeoChangeAction(formData: FormData) {
  await requireAdmin()
  const pidChange = String(formData.get("pidChange") || "").trim()
  if (!pidChange) redirect("/internal/seo")
  const slug = await applySeoChange(pidChange)
  await setInternalToast({ title: "SEO change applied", message: `The blog post ${slug} has been updated.` })
  revalidatePath("/internal/seo")
  revalidatePath(`/blog/${slug}`)
  redirect(`/internal/seo/changes/${pidChange}?applied=1`)
}

export async function rejectSeoChangeAction(formData: FormData) {
  await requireAdmin()
  const pidChange = String(formData.get("pidChange") || "").trim()
  if (!pidChange) redirect("/internal/seo")
  await rejectSeoChange(pidChange)
  await setInternalToast({ title: "SEO change rejected", message: "The proposed content change has been rejected." })
  revalidatePath("/internal/seo")
  redirect(`/internal/seo/changes/${pidChange}?rejected=1`)
}
