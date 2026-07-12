import { NextResponse } from "next/server"

import { rescheduleManagedBooking } from "@/lib/public-call-booking"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 })
  try {
    const result = await rescheduleManagedBooking({
      manageToken: String(body.manageToken || ""),
      slotStartIso: String(body.slotStartIso || ""),
      note: String(body.note || "")
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not reschedule booking." }, { status: 400 })
  }
}
