import { NextResponse } from "next/server"

import { createBlogLeadEvent } from "@/lib/marketing"

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch (_error) {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 })
  }

  try {
    const event = await createBlogLeadEvent(body)
    return NextResponse.json({ ok: true, event })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not record lead event." },
      { status: 400 }
    )
  }
}
