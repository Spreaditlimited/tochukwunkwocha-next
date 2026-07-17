import type { NextConfig } from "next"
import { PHASE_DEVELOPMENT_SERVER } from "next/constants"

const sharedConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["lucide-react"]
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 7,
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "tochukwunkwocha.com" }
    ]
  },
  async headers() {
    const protectedHeaders = [
      { key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
    ]
    return [
      { source: "/internal/:path*", headers: protectedHeaders },
      { source: "/dashboard/:path*", headers: protectedHeaders },
      { source: "/api/internal/:path*", headers: protectedHeaders },
      { source: "/api/student/:path*", headers: protectedHeaders }
    ]
  },
  async redirects() {
    const promptToProfitLegacySlugs = [
      "prompt-to-profit-holiday",
      "prompt-to-profit-job-seekers",
      "prompt-to-profit-children"
    ]

    return promptToProfitLegacySlugs.flatMap((slug) => [
      {
        source: `/${slug}`,
        destination: "/courses/prompt-to-profit",
        permanent: true
      },
      {
        source: `/courses/${slug}`,
        destination: "/courses/prompt-to-profit",
        permanent: true
      },
      {
        source: `/checkout/${slug}`,
        destination: "/checkout/prompt-to-profit",
        permanent: false
      }
    ])
  },
}

export default function nextConfig(phase: string): NextConfig {
  return {
    ...sharedConfig,
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next"
  }
}
