import { NextResponse } from "next/server"

import { createDomainCheckout } from "@/lib/payments/domain-checkout"
import { getStudentSession } from "@/lib/student-auth"

export async function POST(request: Request) {
  const session = await getStudentSession()
  if (!session) return NextResponse.json({ ok: false, error: "Sign in to your student dashboard before purchasing a domain." }, { status: 401 })
  try {
    const body = await request.json().catch(() => ({}))
    const result = await createDomainCheckout({
      accountId: session.account.id,
      email: session.account.email,
      fullName: session.account.fullName,
      body
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not initialize payment." }, { status: 400 })
  }
}
