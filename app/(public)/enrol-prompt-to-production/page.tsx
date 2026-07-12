import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { buildMetadata } from "@/lib/site-seo"

export const metadata: Metadata = buildMetadata({
  title: "Prompt to Profit Advanced Checkout",
  description: "Redirecting to checkout for Prompt to Profit Advanced.",
  path: "/enrol-prompt-to-production",
  noIndex: true
})

export default function EnrolPromptToProductionPage() {
  redirect("/checkout/prompt-to-production")
}
