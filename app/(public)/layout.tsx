import type { ReactNode } from "react"

import { Footer } from "@/components/Footer"
import { JsonLd } from "@/components/JsonLd"
import { LeadCapturePopup } from "@/components/LeadCapturePopup"
import { SiteHeader } from "@/components/SiteHeader"
import { organizationJsonLd, websiteJsonLd } from "@/lib/site-seo"

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
      <SiteHeader />
      {children}
      <Footer />
      <LeadCapturePopup />
    </>
  )
}
