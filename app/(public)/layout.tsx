import type { ReactNode } from "react"

import { Footer } from "@/components/Footer"
import { JsonLd } from "@/components/JsonLd"
import { LeadCapturePopup } from "@/components/LeadCapturePopup"
import { SiteHeader } from "@/components/SiteHeader"
import { WhatsAppButton } from "@/components/WhatsAppButton"
import { organizationJsonLd, websiteJsonLd } from "@/lib/site-seo"

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
      <SiteHeader />
      {children}
      <Footer />
      <LeadCapturePopup />
      <WhatsAppButton
        message="Hello! I'd like to ask about Tochukwu Tech and AI Academy."
        position="bottom-left"
      />
    </>
  )
}
