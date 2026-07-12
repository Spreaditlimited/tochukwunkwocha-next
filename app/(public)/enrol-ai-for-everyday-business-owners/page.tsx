import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { buildMetadata } from "@/lib/site-seo"

export const metadata: Metadata = buildMetadata({
  title: "AI for Everyday Business Owners Checkout",
  description: "Redirecting to checkout for AI for Everyday Business Owners.",
  path: "/enrol-ai-for-everyday-business-owners",
  noIndex: true
})

export default function EnrolAiBusinessOwnersPage() {
  redirect("/checkout/ai-for-everyday-business-owners")
}
