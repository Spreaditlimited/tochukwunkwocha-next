import type { Metadata } from "next"

import { buildMetadata } from "@/lib/site-seo"
import { CallBookingClient } from "./CallBookingClient"

export const metadata: Metadata = buildMetadata({
  title: "Schedule a Call | Tochukwu Tech and AI Academy",
  description: "Book or manage a school, build, or private coaching discovery call.",
  path: "/schools/book-call",
  noIndex: true
})

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Helper utility to safely extract a scalar string value from Next.js dynamic search parameters.
 */
function extractParam(value: string | string[] | undefined): string {
  if (!value) return ""
  return Array.isArray(value) ? value[0] || "" : value
}

export default async function SchoolBookCallPage({ searchParams }: PageProps) {
  // Await the dynamic search params per Next.js 15+ asynchronous patterns
  const params = (await searchParams) || {}
  
  return (
    <CallBookingClient
      source={extractParam(params.source)}
      manageToken={extractParam(params.manage)}
      buildAccessToken={extractParam(params.build_access)}
      coachingAccessToken={extractParam(params.coaching_access)}
    />
  )
}
