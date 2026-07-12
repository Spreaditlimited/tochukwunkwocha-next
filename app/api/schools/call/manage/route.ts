import { NextResponse } from "next/server"

import { getManagedBooking } from "@/lib/public-call-booking"

export async function GET(request: Request) {
  const url = new URL(request.url)
  try {
    const booking = await getManagedBooking(url.searchParams.get("manage") || "")
    return NextResponse.json({ ok: true, booking })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not load booking." }, { status: 400 })
  }
}
