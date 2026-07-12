import type { Metadata } from "next"
import type { ReactNode } from "react"

import { buildMetadata } from "@/lib/site-seo"

export const metadata: Metadata = buildMetadata({
  title: "Build Scorecard",
  description: "Complete the build scorecard to check whether your project is a fit for the monthly build service.",
  path: "/build-scorecard",
  noIndex: true
})

export default function BuildScorecardLayout({ children }: { children: ReactNode }) {
  return children
}
