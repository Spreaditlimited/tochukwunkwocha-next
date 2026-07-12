import type { Metadata } from "next"
import type { ReactNode } from "react"

import { buildMetadata } from "@/lib/site-seo"

export const metadata: Metadata = buildMetadata({
  title: "Internal Dashboard",
  description: "Protected internal administration dashboard.",
  path: "/internal",
  noIndex: true
})

export default function InternalRootLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-muted/30">{children}</div>
}
