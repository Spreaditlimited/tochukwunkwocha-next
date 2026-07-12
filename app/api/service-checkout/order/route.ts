import { NextResponse } from "next/server"

import { createServiceCheckout, isServiceCheckoutSlug } from "@/lib/payments/service-checkout"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const slug = String(body.slug || "")
    if (!isServiceCheckoutSlug(slug)) throw new Error("Unknown checkout service.")
    const result = await createServiceCheckout({
      slug,
      leadUuid: String(body.leadUuid || ""),
      country: String(body.country || "NG")
    })
    return NextResponse.json({ ok: true, checkoutUrl: result.checkoutUrl, pricing: result.pricing })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not create service checkout." }, { status: 500 })
  }
}
