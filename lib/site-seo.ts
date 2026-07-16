import type { Metadata } from "next"

import { brand } from "@/lib/brand"

type MetadataInput = {
  title: string
  description: string
  path: string
  image?: string | null
  type?: "website" | "article"
  noIndex?: boolean
}

type BreadcrumbItem = {
  name: string
  path: string
}

export function getSiteUrl() {
  return String(process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_BASE_URL || "https://tochukwunkwocha.com").replace(/\/+$/, "")
}

export function absoluteUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path
  return `${getSiteUrl()}${path.startsWith("/") ? path : `/${path}`}`
}

export function buildMetadata({ title, description, path, image, type = "website", noIndex = false }: MetadataInput): Metadata {
  const url = absoluteUrl(path)
  const previewImage = absoluteUrl(image || brand.assets.ogDefault)

  return {
    title,
    description,
    metadataBase: new URL(getSiteUrl()),
    alternates: {
      canonical: url
    },
    openGraph: {
      title,
      description,
      url,
      siteName: brand.name,
      images: [{ url: previewImage }],
      locale: "en_US",
      type
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [previewImage]
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
          googleBot: {
            index: false,
            follow: false
          }
        }
      : undefined
  }
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: brand.name,
    alternateName: brand.shortName,
    url: getSiteUrl(),
    logo: absoluteUrl(brand.assets.logo),
    founder: {
      "@type": "Person",
      name: brand.personalName
    },
    slogan: brand.promise,
    description: brand.description
  }
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: brand.name,
    url: getSiteUrl(),
    publisher: {
      "@type": "EducationalOrganization",
      name: brand.name
    }
  }
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path)
    }))
  }
}

export function courseJsonLd(course: {
  title: string
  description: string
  href: string
  audience?: string
  duration?: string
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.title,
    description: course.description,
    url: absoluteUrl(course.href),
    provider: {
      "@type": "EducationalOrganization",
      name: brand.name,
      url: getSiteUrl()
    },
    audience: course.audience,
    timeRequired: course.duration
  }
}

export function serviceJsonLd(service: {
  title: string
  description: string
  href: string
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.title,
    description: service.description,
    url: absoluteUrl(service.href),
    provider: {
      "@type": "Organization",
      name: brand.name,
      url: getSiteUrl()
    }
  }
}

export function articleJsonLd(post: {
  blogTitle: string
  blogSlug: string
  excerpt?: string | null
  blogBy?: string | null
  createdAt?: Date | null
  updatedAt?: Date | null
}, image?: string | null) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.blogTitle,
    description: post.excerpt || undefined,
    image: image ? [absoluteUrl(image)] : undefined,
    datePublished: post.createdAt?.toISOString(),
    dateModified: (post.updatedAt || post.createdAt)?.toISOString(),
    author: {
      "@type": "Person",
      name: post.blogBy || brand.personalName
    },
    publisher: {
      "@type": "EducationalOrganization",
      name: brand.name,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl(brand.assets.logo)
      }
    },
    mainEntityOfPage: absoluteUrl(`/blog/${post.blogSlug}`)
  }
}
