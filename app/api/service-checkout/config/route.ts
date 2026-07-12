import { NextResponse } from "next/server"

import { getServiceCheckoutDetails, isServiceCheckoutSlug, serviceCheckoutPricing } from "@/lib/payments/service-checkout"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const slug = String(body.slug || "")
    const leadUuid = String(body.leadUuid || "")
    const country = String(body.country || "NG")
    if (!isServiceCheckoutSlug(slug)) throw new Error("Unknown checkout service.")
    const details = await getServiceCheckoutDetails(slug, leadUuid)
    if (!details) throw new Error("Checkout record not found.")
    const pricing = await serviceCheckoutPricing({ slug, country })
    return NextResponse.json({ ok: true, pricing })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not load service checkout." }, { status: 400 })
  }
}
