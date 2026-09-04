import { NextResponse } from "next/server"

import { sendEmail } from "@/lib/email"
import { publicActionLinkVariants } from "@/lib/public-site-url"
import { allowStudentPasswordResetRequest, createStudentPasswordResetToken } from "@/lib/student-auth"

function clean(value: unknown, max = 1000) {
  return String(value || "").trim().slice(0, max)
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character)
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: "The request could not be processed. Please try again." }, { status: 400 })

  const email = clean(body.email, 190).toLowerCase()
  if (!email) return NextResponse.json({ ok: false, error: "Email is required" }, { status: 400 })
  const context = clean(body.context, 20).toLowerCase() === "affiliate" ? "affiliate" : "student"

  const allowed = await allowStudentPasswordResetRequest(email)
  const reset = allowed ? await createStudentPasswordResetToken(email) : null
  if (reset?.token) {
    const resetPath = context === "affiliate" ? "/affiliate/reset-password" : "/dashboard/reset-password"
    const links = publicActionLinkVariants(`${resetPath}?token=${encodeURIComponent(reset.token)}`)
    const greeting = clean(reset.fullName, 120) || "there"
    const safeGreeting = escapeHtml(greeting)
    const safePrimaryLink = escapeHtml(links.primary)
    const safeAlternativeLink = escapeHtml(links.alternative)
    await sendEmail({
      to: email,
      subject: context === "affiliate" ? "Reset Your Affiliate Password" : "Reset Your Dashboard Password",
      html: [
        `<p>Hello ${safeGreeting},</p>`,
        `<p>Use either link below to reset your ${context === "affiliate" ? "affiliate account" : "dashboard"} password:</p>`,
        `<p><strong>Primary link:</strong><br/><a href="${safePrimaryLink}">${safePrimaryLink}</a></p>`,
        `<p><strong>Alternative link:</strong> <span style="color:#64748b;">Use this if the primary website does not open.</span><br/><a href="${safeAlternativeLink}">${safeAlternativeLink}</a></p>`,
        "<p>This link expires in 1 hour.</p>"
      ].join("\n"),
      text: [
        `Hello ${greeting},`,
        "",
        `Use either link below to reset your ${context === "affiliate" ? "affiliate account" : "dashboard"} password:`,
        `Primary link: ${links.primary}`,
        `Alternative link (if the primary website does not open): ${links.alternative}`,
        "",
        "Both links perform the same secure action. This link expires in 1 hour."
      ].join("\n")
    }).catch(() => null)
  }

  return NextResponse.json(
    { ok: true, message: "If an account exists for this email, a reset link has been sent." },
    { headers: { "Cache-Control": "no-store" } }
  )
}
