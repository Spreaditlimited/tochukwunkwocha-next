import { NextResponse } from "next/server"

import { requireStudent } from "@/lib/student-auth"

export async function POST(request: Request) {
  await requireStudent()
  await request.json().catch(() => null)
  return NextResponse.json(
    { ok: false, error: "Domain registration requires payment. Continue from the domain registration checkout." },
    { status: 409 }
  )
}
