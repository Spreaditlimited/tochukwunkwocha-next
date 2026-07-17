import { NextResponse } from "next/server"

import { createDomainCheckout } from "@/lib/payments/domain-checkout"
import { clientIpFromRequest, verifyRecaptchaToken } from "@/lib/recaptcha"
import { getStudentSession } from "@/lib/student-auth"

export async function POST(request: Request) {
  const session = await getStudentSession()
  if (!session) return NextResponse.json({ ok: false, error: "Sign in to your student dashboard before purchasing a domain." }, { status: 401 })
  try {
    const body = await request.json().catch(() => ({}))
    const fullName = String(body.fullName || session.account.fullName || "").trim().slice(0, 160)
    const email = String(body.email || session.account.email || "").trim().toLowerCase().slice(0, 254)
    if (!fullName) return NextResponse.json({ ok: false, error: "Enter your full name." }, { status: 400 })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 })
    }
    const recaptcha = await verifyRecaptchaToken({
      token: body.recaptchaToken,
      expectedAction: "domain_create_payment",
      remoteip: clientIpFromRequest(request),
      request
    })
    if (!recaptcha.ok) {
      return NextResponse.json({ ok: false, error: "We could not verify this checkout. Please try again." }, { status: 400 })
    }
    const result = await createDomainCheckout({
      accountId: session.account.id,
      email,
      fullName,
      body
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not initialize payment." }, { status: 400 })
  }
}
