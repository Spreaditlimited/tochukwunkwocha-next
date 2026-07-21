import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"

import { AffiliateReferralCapture } from "@/components/AffiliateReferralCapture"
import { GoogleAnalytics } from "@/components/GoogleAnalytics"
import { MetaPixel } from "@/components/MetaPixel"
import { RuntimeEventGuard } from "@/components/RuntimeEventGuard"
import { ThemeScript } from "@/components/ThemeScript"
import { brand } from "@/lib/brand"
import { absoluteUrl, getSiteUrl } from "@/lib/site-seo"

import "./globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: `${brand.shortName} | Practical AI Training`,
    template: `%s | ${brand.shortName}`
  },
  description: brand.description,
  alternates: {
    canonical: getSiteUrl()
  },
  openGraph: {
    title: `${brand.shortName} | Practical AI Training`,
    description: brand.description,
    url: getSiteUrl(),
    siteName: brand.name,
    images: [{ url: absoluteUrl(brand.assets.logo) }],
    locale: "en_US",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: `${brand.shortName} | Practical AI Training`,
    description: brand.description,
    images: [absoluteUrl(brand.assets.logo)]
  },
  icons: {
    icon: brand.assets.faviconSource,
    apple: brand.assets.icon
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: brand.colors.paper },
    { media: "(prefers-color-scheme: dark)", color: brand.colors.ink }
  ]
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <AffiliateReferralCapture />
        <GoogleAnalytics />
        <MetaPixel />
        <RuntimeEventGuard />
        {children}
      </body>
    </html>
  )
}
