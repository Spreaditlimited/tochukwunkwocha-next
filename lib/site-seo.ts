import type { Metadata } from "next"

import { brand } from "@/lib/brand"
import { primaryBlogAuthor } from "@/lib/blog-author"

type MetadataInput = {
  title: string
  description: string
  path: string
  image?: string | null
  imageAlt?: string | null
  type?: "website" | "article"
  noIndex?: boolean
}

type BreadcrumbItem = {
  name: string
  path: string
}

export const CANONICAL_SITE_URL = "https://www.tochukwunkwocha.com"

export function getSiteUrl() {
  const configuredUrl = String(
    process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.SITE_BASE_URL ||
      CANONICAL_SITE_URL
  ).replace(/\/+$/, "")

  try {
    const hostname = new URL(configuredUrl).hostname.toLowerCase()
    if (hostname === "tochukwunkwocha.com" || hostname === "www.tochukwunkwocha.com") {
      return CANONICAL_SITE_URL
    }
  } catch {
    return CANONICAL_SITE_URL
  }

  return configuredUrl
}

export function absoluteUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path
  return `${getSiteUrl()}${path.startsWith("/") ? path : `/${path}`}`
}

export function buildMetadata({ title, description, path, image, imageAlt, type = "website", noIndex = false }: MetadataInput): Metadata {
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
      images: [{ url: previewImage, alt: imageAlt || title }],
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
}, offers: Array<Record<string, unknown>> = []) {
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
    timeRequired: course.duration,
    offers: offers.length ? offers : undefined
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

export function productJsonLd(product: {
  title: string
  description: string
  path: string
  image?: string | null
  variants: Array<{
    variantUuid: string
    title: string
    priceMinor: number
    currency: string
    available: boolean
  }>
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    url: absoluteUrl(product.path),
    image: product.image ? [absoluteUrl(product.image)] : undefined,
    brand: {
      "@type": "Brand",
      name: brand.name
    },
    offers: product.variants
      .filter((variant) => variant.priceMinor > 0)
      .map((variant) => ({
        "@type": "Offer",
        sku: variant.variantUuid,
        name: variant.title,
        price: (variant.priceMinor / 100).toFixed(2),
        priceCurrency: variant.currency.toUpperCase(),
        availability: variant.available
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
        url: absoluteUrl(product.path)
      }))
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
      "@id": absoluteUrl(primaryBlogAuthor.profilePath),
      name: primaryBlogAuthor.name,
      url: absoluteUrl(primaryBlogAuthor.profilePath),
      image: absoluteUrl(primaryBlogAuthor.portrait)
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

export function blogAuthorJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": absoluteUrl(primaryBlogAuthor.profilePath),
    name: primaryBlogAuthor.name,
    url: absoluteUrl(primaryBlogAuthor.profilePath),
    image: absoluteUrl(primaryBlogAuthor.portrait),
    description: primaryBlogAuthor.shortBio,
    jobTitle: ["Founder of Sure Imports", "Digital Marketing Executive"],
    worksFor: [
      {
        "@type": "Organization",
        name: "Sure Imports",
        url: primaryBlogAuthor.sureImportsUrl
      },
      {
        "@type": "Organization",
        name: "Technology consulting firm"
      }
    ]
  }
}
