import { NextResponse } from "next/server"

import { sendEmail } from "@/lib/email"
import { clientIpFromRequest, verifyRecaptchaToken } from "@/lib/recaptcha"

function clean(value: unknown, max = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max)
}

function escapeHtml(value: unknown) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  if (clean(body.website, 120)) return NextResponse.json({ ok: true })

  const fullName = clean(body.fullName, 140)
  const email = clean(body.email, 190).toLowerCase()
  const purpose = clean(body.purpose, 80)
  const message = clean(body.message, 4000)
  if (!fullName || !email || !purpose || !message) {
    return NextResponse.json({ ok: false, error: "Full Name, Email, Purpose, and Message are required." }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Please enter a valid email address." }, { status: 400 })
  }

  const recaptcha = await verifyRecaptchaToken({
    token: body.recaptchaToken,
    expectedAction: "contact_submit",
    remoteip: clientIpFromRequest(request),
    request
  })
  if (!recaptcha.ok) {
    return NextResponse.json({ ok: false, error: "We could not verify this submission. Please try again." }, { status: 400 })
  }

  const safeName = escapeHtml(fullName)
  const safeEmail = escapeHtml(email)
  const safePurpose = escapeHtml(purpose)
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br/>")
  const html = [
    "<h2>New Contact Form Submission</h2>",
    `<p><strong>Full Name:</strong> ${safeName}</p>`,
    `<p><strong>Email:</strong> ${safeEmail}</p>`,
    `<p><strong>Purpose:</strong> ${safePurpose}</p>`,
    "<p><strong>Message:</strong></p>",
    `<p>${safeMessage}</p>`
  ].join("")
  const text = ["New Contact Form Submission", `Full Name: ${fullName}`, `Email: ${email}`, `Purpose: ${purpose}`, "", "Message:", message].join("\n")

  try {
    await sendEmail({ to: "support@tochukwunkwocha.com", subject: `New Contact Form Submission - ${purpose}`, html, text })
    const ackText = [
      `Hello ${fullName},`,
      "",
      "Thank you for contacting Tochukwu Tech and AI Academy.",
      "We have received your message and our support team will get back to you shortly.",
      "",
      `Purpose: ${purpose}`,
      `Message: ${message}`,
      "",
      "Support email: support@tochukwunkwocha.com",
      "",
      "Regards,",
      "Tochukwu Tech and AI Academy"
    ].join("\n")
    await sendEmail({
      to: email,
      subject: "We received your message - Tochukwu Tech and AI Academy",
      text: ackText,
      html: ackText.replace(/\n/g, "<br/>")
    }).catch(() => null)
    return NextResponse.json({ ok: true, message: "Your message has been sent successfully." })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not send message." }, { status: 500 })
  }
}
