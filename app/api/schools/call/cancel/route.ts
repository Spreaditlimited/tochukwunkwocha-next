import { NextResponse } from "next/server"

import { cancelManagedBooking } from "@/lib/public-call-booking"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 })
  try {
    await cancelManagedBooking({ manageToken: String(body.manageToken || ""), reason: String(body.reason || "") })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not cancel booking." }, { status: 400 })
  }
}
