import { NextResponse } from "next/server"

import { buildDomainQuote } from "@/lib/payments/domain-checkout"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const quote = await buildDomainQuote(body.domainName || body.domain_name, body.years, body.country || body.registrantCountry || "NG")
    return NextResponse.json({ ok: true, domainName: body.domainName || body.domain_name, quote })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not load domain pricing." }, { status: 503 })
  }
}
