import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { buildMetadata } from "@/lib/site-seo"

export const metadata: Metadata = buildMetadata({
  title: "Prompt to Profit for Schools Checkout",
  description: "Redirecting to checkout for Prompt to Profit for Schools.",
  path: "/enrol-prompt-to-profit-schools",
  noIndex: true
})

export default function EnrolPromptToProfitSchoolsPage() {
  redirect("/checkout/prompt-to-profit-schools")
}
