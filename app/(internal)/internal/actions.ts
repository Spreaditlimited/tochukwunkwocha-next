"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { clearAdminSession, requireAdmin } from "@/lib/auth"
import { upsertBlogPost } from "@/lib/blog"
import { generateBlogImageForPost, generateLeadMagnetForPost } from "@/lib/blog-automation"
import { setInternalToast } from "@/lib/internal-toast"

function boolFromForm(value: FormDataEntryValue | null) {
  return value === "on" || value === "true" || value === "1"
}

function tagsFromForm(value: FormDataEntryValue | null) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12)
}

export async function logoutAction() {
  await clearAdminSession()
  redirect("/internal/login")
}

export async function saveBlogPostAction(formData: FormData) {
  await requireAdmin()

  const blogTitle = String(formData.get("blogTitle") || "").trim()
  const blogContent = String(formData.get("blogContent") || "").trim()
  if (!blogTitle || !blogContent) redirect("/internal/blog/new?error=missing")

  const post = await upsertBlogPost({
    pidBlog: String(formData.get("pidBlog") || "").trim() || undefined,
    blogTitle,
    blogSlug: String(formData.get("blogSlug") || "").trim() || undefined,
    blogContent,
    blogPublished: boolFromForm(formData.get("blogPublished")),
    blogFeatured: boolFromForm(formData.get("blogFeatured")),
    blogImage: String(formData.get("blogImage") || "").trim(),
    blogBy: String(formData.get("blogBy") || "").trim(),
    excerpt: String(formData.get("excerpt") || "").trim(),
    tags: tagsFromForm(formData.get("tags")),
    seo: {
      metaTitle: String(formData.get("metaTitle") || "").trim(),
      seoTitle: String(formData.get("metaTitle") || "").trim(),
      metaDescription: String(formData.get("metaDescription") || "").trim(),
      focusKeyword: String(formData.get("focusKeyword") || "").trim()
    }
  })

  revalidatePath("/blog")
  revalidatePath(`/blog/${post.blogSlug}`)
  revalidatePath("/internal/blog")
  await setInternalToast({ title: "Blog post saved", message: "The public blog and internal CMS have been refreshed." })
  redirect(`/internal/blog/${post.pidBlog}?saved=1`)
}

export async function generateBlogImageAction(formData: FormData) {
  await requireAdmin()
  const pidBlog = String(formData.get("pidBlog") || "").trim()
  if (!pidBlog) redirect("/internal/blog?error=missing-blog")
  await generateBlogImageForPost(pidBlog)
  revalidatePath("/blog")
  revalidatePath("/internal/blog")
  revalidatePath(`/internal/blog/${pidBlog}`)
  await setInternalToast({ title: "Blog image generated", message: "The generated image has been attached to the post." })
  redirect(`/internal/blog/${pidBlog}?image=generated`)
}

export async function generateBlogLeadMagnetAction(formData: FormData) {
  await requireAdmin()
  const pidBlog = String(formData.get("pidBlog") || "").trim()
  if (!pidBlog) redirect("/internal/blog?error=missing-blog")
  await generateLeadMagnetForPost(pidBlog)
  revalidatePath("/blog")
  revalidatePath("/internal/blog")
  revalidatePath(`/internal/blog/${pidBlog}`)
  await setInternalToast({ title: "Lead magnet generated", message: "The post now has an AI-generated lead magnet draft." })
  redirect(`/internal/blog/${pidBlog}?leadMagnet=generated`)
}
