import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { buildMetadata } from "@/lib/site-seo"

export const metadata: Metadata = buildMetadata({
  title: "Prompt to Profit Checkout",
  description: "Redirecting to checkout for Prompt to Profit.",
  path: "/enrol-prompt-to-profit",
  noIndex: true
})

export default function EnrolPromptToProfitPage() {
  redirect("/checkout/prompt-to-profit")
}
