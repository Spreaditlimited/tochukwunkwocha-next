import type { Metadata } from "next"

import { buildMetadata } from "@/lib/site-seo"
import { ApplyForm } from "./ApplyForm"

export const metadata: Metadata = buildMetadata({
  title: "Apply | Private AI Build Coaching",
  description: "Apply for private one-on-one coaching and book your discovery call.",
  path: "/private-ai-build-coaching/apply",
  noIndex: true
})

export default function PrivateCoachingApplyPage() {
  return <ApplyForm />
}
