import type { MetadataRoute } from "next"

import { absoluteUrl, getSiteUrl } from "@/lib/site-seo"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/checkout/",
        "/dashboard/",
        "/internal/",
        "/schools/dashboard/",
        "/schools/login",
        "/schools/reset-password",
        "/schools/reset-password-request",
        "/schools/book-call",
        "/build-scorecard",
        "/private-ai-build-coaching/apply",
        "/private-ai-build-coaching/subscribe"
      ]
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: getSiteUrl()
  }
}
