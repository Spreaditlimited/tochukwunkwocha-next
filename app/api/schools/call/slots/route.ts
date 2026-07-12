import { NextResponse } from "next/server"

import { assertCanViewSlots, listAvailableCallSlots, type BookingSource } from "@/lib/public-call-booking"
import { SCHOOL_CALL_TIMEZONE } from "@/lib/admin-build-service"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const source = (url.searchParams.get("source") || "school") as BookingSource
  try {
    await assertCanViewSlots({
      source,
      buildAccessToken: url.searchParams.get("build_access") || "",
      coachingAccessToken: url.searchParams.get("coaching_access") || ""
    })
    const slots = await listAvailableCallSlots()
    return NextResponse.json({ ok: true, timezone: SCHOOL_CALL_TIMEZONE, durationMinutes: 30, slots })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not load slots." }, { status: 400 })
  }
}
