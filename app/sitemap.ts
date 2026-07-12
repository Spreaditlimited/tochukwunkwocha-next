import type { MetadataRoute } from "next"

import { getPublishedPosts } from "@/lib/blog"
import { courses, services } from "@/lib/public-offers"
import { listPublishedResources, resourceAudiences } from "@/lib/resources"
import { absoluteUrl } from "@/lib/site-seo"

export const dynamic = "force-dynamic"

const staticRoutes = [
  "/",
  "/about",
  "/courses",
  "/blog",
  "/build",
  "/private-ai-build-coaching",
  "/projects",
  "/resources",
  "/resources/videos",
  "/resources/prompts",
  "/resources/downloads",
  "/resources/guides",
  "/contact",
  "/privacy-policy",
  "/terms-and-conditions"
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const [posts, resources] = await Promise.all([
    getPublishedPosts(500),
    listPublishedResources({ limit: 500 })
  ])

  return [
    ...staticRoutes.map((path) => ({
      url: absoluteUrl(path),
      lastModified: now,
      changeFrequency: path === "/" ? "weekly" as const : "monthly" as const,
      priority: path === "/" ? 1 : 0.7
    })),
    ...courses.map((course) => ({
      url: absoluteUrl(course.href),
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.85
    })),
    ...services.map((service) => ({
      url: absoluteUrl(service.href),
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.65
    })),
    ...resourceAudiences.map((audience) => ({
      url: absoluteUrl(`/resources/audiences/${audience.key}`),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7
    })),
    ...resources.map((resource) => ({
      url: absoluteUrl(`/resources/${resource.slug}`),
      lastModified: resource.updatedAt || resource.publishedAt || now,
      changeFrequency: "monthly" as const,
      priority: resource.featured ? 0.75 : 0.6
    })),
    ...posts.map((post) => ({
      url: absoluteUrl(`/blog/${post.blogSlug}`),
      lastModified: post.updatedAt || post.createdAt,
      changeFrequency: "monthly" as const,
      priority: post.blogFeatured ? 0.8 : 0.6
    }))
  ]
}
