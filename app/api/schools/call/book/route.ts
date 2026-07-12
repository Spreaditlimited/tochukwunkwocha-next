import { NextResponse } from "next/server"

import { bookPublicCall } from "@/lib/public-call-booking"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 })
  try {
    const booking = await bookPublicCall(body)
    return NextResponse.json({ ok: true, ...booking, meta: { eventId: `lead_school_call_${booking.bookingUuid}`, leadSent: false } })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not create booking." }, { status: 400 })
  }
}
