import { NextResponse } from "next/server"

import { sendEmail } from "@/lib/email"
import { allowStudentPasswordResetRequest, createStudentPasswordResetToken } from "@/lib/student-auth"

function clean(value: unknown, max = 1000) {
  return String(value || "").trim().slice(0, max)
}

function siteBaseUrl() {
  return clean(process.env.SITE_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://tochukwunkwocha.com", 1000).replace(/\/$/, "")
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character)
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })

  const email = clean(body.email, 190).toLowerCase()
  if (!email) return NextResponse.json({ ok: false, error: "Email is required" }, { status: 400 })

  const allowed = await allowStudentPasswordResetRequest(email)
  const reset = allowed ? await createStudentPasswordResetToken(email) : null
  if (reset?.token) {
    const link = `${siteBaseUrl()}/dashboard/reset-password?token=${encodeURIComponent(reset.token)}`
    const greeting = clean(reset.fullName, 120) || "there"
    const safeGreeting = escapeHtml(greeting)
    const safeLink = escapeHtml(link)
    await sendEmail({
      to: email,
      subject: "Reset Your Dashboard Password",
      html: [
        `<p>Hello ${safeGreeting},</p>`,
        "<p>Use the link below to reset your dashboard password:</p>",
        `<p><a href="${safeLink}">${safeLink}</a></p>`,
        "<p>This link expires in 1 hour.</p>"
      ].join("\n"),
      text: [`Hello ${greeting},`, "", "Use the link below to reset your dashboard password:", link, "", "This link expires in 1 hour."].join("\n")
    }).catch(() => null)
  }

  return NextResponse.json(
    { ok: true, message: "If an account exists for this email, a reset link has been sent." },
    { headers: { "Cache-Control": "no-store" } }
  )
}
