import { Prisma } from "@prisma/client"
import { unstable_cache } from "next/cache"

import { prisma } from "@/lib/prisma"
import { excerptFrom, safeJsonParse, slugify } from "@/lib/utils"

export interface BlogSeo {
  metaTitle?: string
  seoTitle?: string
  metaDescription?: string
  focusKeyword?: string
  imageAlt?: string
}

export function parseBlogSeo(post: {
  seoJson?: string | null
  blogExt2?: string | null
}): BlogSeo {
  const seo = safeJsonParse<BlogSeo>(post.seoJson, {})
  if (Object.keys(seo).length) return seo
  return safeJsonParse<BlogSeo>(post.blogExt2, {})
}

function parseBlogTags(tagsJson: string | null | undefined) {
  const tags = safeJsonParse<unknown>(tagsJson, [])
  if (!Array.isArray(tags)) return []
  return tags
    .map((tag) => String(tag || "").trim().toLowerCase())
    .filter(Boolean)
}

function tokenizeForRelatedPosts(value: string | null | undefined) {
  const stopWords = new Set([
    "about",
    "after",
    "again",
    "with",
    "without",
    "your",
    "from",
    "that",
    "this",
    "what",
    "when",
    "where",
    "which",
    "while",
    "will",
    "into",
    "using",
    "use",
    "how",
    "the",
    "and",
    "for",
    "you",
    "can",
    "are",
    "is",
    "to",
    "of",
    "in",
    "ai"
  ])

  return new Set(
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word.length > 2 && !stopWords.has(word))
  )
}

export const getPublishedPosts = unstable_cache(async (limit = 24) => {
  return prisma.tochukwuBlogPost.findMany({
    where: {
      blogPublished: true,
      createdAt: { lte: new Date() }
    },
    select: {
      pidBlog: true,
      blogSlug: true,
      blogTitle: true,
      blogImage: true,
      excerpt: true,
      createdAt: true,
      updatedAt: true,
      blogFeatured: true
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit
  })
}, ["published-blog-posts"], { revalidate: 300 })

export const getPublishedPostsPage = unstable_cache(async (input: { page?: number; pageSize?: number }) => {
  const pageSize = Math.max(1, Math.min(48, Math.round(Number(input.pageSize || 12))))
  const requestedPage = Math.max(1, Math.round(Number(input.page || 1)))
  const where = {
    blogPublished: true,
    createdAt: { lte: new Date() }
  }
  const total = await prisma.tochukwuBlogPost.count({ where })
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(requestedPage, totalPages)
  const posts = await prisma.tochukwuBlogPost.findMany({
    where,
    select: {
      pidBlog: true,
      blogSlug: true,
      blogTitle: true,
      blogImage: true,
      excerpt: true,
      createdAt: true
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize
  })

  return {
    posts,
    total,
    page,
    pageSize,
    totalPages
  }
}, ["published-blog-posts-page"], { revalidate: 300 })

export async function getContinueReadingPosts(
  currentPost: {
    pidBlog: string
    blogTitle: string
    excerpt?: string | null
    tagsJson?: string | null
    seoJson?: string | null
    blogExt2?: string | null
  },
  limit = 3
) {
  const currentTags = parseBlogTags(currentPost.tagsJson)
  const currentSeo = parseBlogSeo(currentPost)
  const currentTerms = tokenizeForRelatedPosts(
    `${currentPost.blogTitle} ${currentPost.excerpt || ""} ${currentSeo.focusKeyword || ""} ${currentTags.join(" ")}`
  )

  const candidates = await prisma.tochukwuBlogPost.findMany({
    where: {
      blogPublished: true,
      createdAt: { lte: new Date() },
      pidBlog: { not: currentPost.pidBlog }
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 80
  })

  return candidates
    .map((candidate) => {
      const candidateTags = parseBlogTags(candidate.tagsJson)
      const candidateSeo = parseBlogSeo(candidate)
      const candidateTerms = tokenizeForRelatedPosts(
        `${candidate.blogTitle} ${candidate.excerpt || ""} ${candidateSeo.focusKeyword || ""} ${candidateTags.join(" ")}`
      )
      const tagScore = candidateTags.filter((tag) => currentTags.includes(tag)).length * 12
      const termScore = [...candidateTerms].filter((term) => currentTerms.has(term)).length
      const focusScore =
        currentSeo.focusKeyword && candidateTerms.has(currentSeo.focusKeyword.toLowerCase())
          ? 8
          : 0

      return {
        post: candidate,
        score: tagScore + termScore + focusScore
      }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.post.createdAt.getTime() - a.post.createdAt.getTime())
    .slice(0, limit)
    .map((item) => item.post)
}

export function getBlogImageSrc(image: string | null | undefined) {
  const value = String(image || "").trim()
  if (!value) return null
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith("/assets/")) return `https://tochukwunkwocha.com${value}`
  if (value.startsWith("/")) return value

  const cloudinaryBaseUrl = String(
    process.env.CLOUDINARY_BASE_URL ||
      process.env.NEXT_PUBLIC_CLOUDINARY_BASE_URL ||
      (process.env.CLOUDINARY_CLOUD_NAME
        ? `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`
        : "")
  ).replace(/\/+$/, "")

  if (cloudinaryBaseUrl) {
    const publicId = value.startsWith("BLOG_") ? `tochukwu/blog/${value}` : value
    return `${cloudinaryBaseUrl}/${publicId.replace(/^\/+/, "")}`
  }

  return `/${value.replace(/^\.?\//, "")}`
}

export async function getPostBySlug(slug: string, includeDraft = false) {
  return prisma.tochukwuBlogPost.findFirst({
    where: {
      blogSlug: slug,
      ...(includeDraft ? {} : { blogPublished: true, createdAt: { lte: new Date() } })
    },
    include: {
      leadMagnet: true
    }
  })
}

export async function listCmsPosts(search?: string) {
  const q = String(search || "").trim()
  return prisma.tochukwuBlogPost.findMany({
    where: q
      ? {
          OR: [
            { blogTitle: { contains: q } },
            { blogSlug: { contains: q } },
            { blogContent: { contains: q } }
          ]
        }
      : undefined,
    include: {
      leadMagnet: true
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100
  })
}

export async function makeUniqueBlogSlug(titleOrSlug: string, currentPidBlog?: string) {
  const base = slugify(titleOrSlug) || `blog-${Date.now()}`
  let candidate = base
  let index = 2

  while (true) {
    const existing = await prisma.tochukwuBlogPost.findUnique({
      where: { blogSlug: candidate },
      select: { pidBlog: true }
    })
    if (!existing || existing.pidBlog === currentPidBlog) return candidate
    candidate = `${base}-${index}`
    index += 1
  }
}

export async function upsertBlogPost(input: {
  pidBlog?: string
  blogTitle: string
  blogSlug?: string
  blogContent: string
  blogPublished: boolean
  blogFeatured: boolean
  blogImage?: string
  blogBy?: string
  excerpt?: string
  tags?: string[]
  seo?: BlogSeo
}) {
  const now = new Date()
  const existing = input.pidBlog
    ? await prisma.tochukwuBlogPost.findUnique({ where: { pidBlog: input.pidBlog } })
    : null
  const pidBlog = existing?.pidBlog || input.pidBlog || `BLOG${Date.now()}`
  const blogSlug = await makeUniqueBlogSlug(input.blogSlug || input.blogTitle, existing?.pidBlog)
  const seoJson = JSON.stringify(input.seo || {})
  const data = {
    blogTitle: input.blogTitle.trim(),
    blogSlug,
    blogContent: input.blogContent.trim(),
    blogPublished: input.blogPublished,
    blogFeatured: input.blogFeatured,
    blogImage: input.blogImage?.trim() || null,
    blogBy: input.blogBy?.trim() || "Tochukwu Nkwocha",
    excerpt: excerptFrom(input.blogContent, input.excerpt),
    tagsJson: JSON.stringify(input.tags || []),
    seoJson,
    blogExt2: seoJson,
    updatedAt: now
  }

  if (existing) {
    return prisma.tochukwuBlogPost.update({
      where: { pidBlog },
      data
    })
  }

  return prisma.tochukwuBlogPost.create({
    data: {
      pidBlog,
      ...data,
      blogExt1: "",
      createdAt: now
    }
  })
}

export async function getBlogStats() {
  const [total, published, draft, opportunities] = await Promise.all([
    prisma.tochukwuBlogPost.count(),
    prisma.tochukwuBlogPost.count({ where: { blogPublished: true, createdAt: { lte: new Date() } } }),
    prisma.tochukwuBlogPost.count({ where: { blogPublished: false } }),
    prisma.tochukwuSeoOpportunity.count({ where: { status: "open" } }).catch(() => 0)
  ])

  return { total, published, draft, opportunities }
}

export async function findPostByPid(pidBlog: string) {
  return prisma.tochukwuBlogPost.findUnique({
    where: { pidBlog },
    include: { leadMagnet: true }
  })
}

export function sqlDateOnly(value: Date | null | undefined) {
  if (!value) return null
  return Prisma.sql`${value}`
}
