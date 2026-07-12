"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireAdmin } from "@/lib/auth"
import { setInternalToast } from "@/lib/internal-toast"
import { generateResourceDraftFromForm, upsertBundleFromForm, upsertResourceFromForm } from "@/lib/resources"

export async function saveResourceAction(formData: FormData) {
  await requireAdmin()
  const resource = await upsertResourceFromForm(formData)
  revalidatePath("/resources")
  revalidatePath("/resources/videos")
  revalidatePath("/resources/prompts")
  revalidatePath("/internal/resources")
  await setInternalToast({
    title: "Resource saved",
    message: "The public resource library and internal CMS have been refreshed."
  })
  redirect(`/internal/resources?saved=${resource.slug}`)
}

export async function saveResourceBundleAction(formData: FormData) {
  await requireAdmin()
  const bundle = await upsertBundleFromForm(formData)
  revalidatePath("/resources")
  revalidatePath("/internal/resources")
  await setInternalToast({
    title: "Toolkit saved",
    message: "The bundle is now available to the resource library when published."
  })
  redirect(`/internal/resources?bundle=${bundle.slug}`)
}

export async function generateResourceDraftAction(formData: FormData) {
  await requireAdmin()
  const resource = await generateResourceDraftFromForm(formData)
  revalidatePath("/internal/resources")
  await setInternalToast({
    title: "Resource draft generated",
    message: "Review the draft, add prompt text or video media, then publish when ready."
  })
  redirect(`/internal/resources?generated=${resource.slug}`)
}
