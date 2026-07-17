import { NextResponse } from "next/server"

import { checkDomainAvailabilityMany } from "@/lib/student-domain-actions"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const preferredName = String(body.preferredName || body.preferred_name || "")
    if (preferredName.trim().toLowerCase().endsWith(".ng")) throw new Error(".ng extensions are currently not supported.")
    const suggestions = await checkDomainAvailabilityMany(preferredName)
    const firstAvailable = suggestions.find((item) => item.available)?.domainName || ""
    return NextResponse.json({ ok: true, suggestions, firstAvailable })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not suggest domains." }, { status: 503 })
  }
}
