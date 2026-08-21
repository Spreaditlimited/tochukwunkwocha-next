import crypto from "crypto"
import { NextResponse } from "next/server"

import { sendEmail } from "@/lib/email"
import { prisma } from "@/lib/prisma"
import { clientIpFromRequest, verifyRecaptchaToken } from "@/lib/recaptcha"
import { consumeServerRateLimit } from "@/lib/server-rate-limit"
import { CANONICAL_SITE_URL } from "@/lib/site-seo"
import { getHireableStudentProfile } from "@/lib/student-public-profile"
import { cleanPortfolioText, STUDENT_OPPORTUNITY_TYPES } from "@/lib/student-portfolio-shared"

const OPPORTUNITY_LABELS = new Map<string, string>(STUDENT_OPPORTUNITY_TYPES.map((item) => [item.value, item.label]))

function escapeHtml(value: unknown) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const profile = await getHireableStudentProfile(slug)
  if (!profile) return NextResponse.json({ ok: false, error: "This student is not currently accepting enquiries." }, { status: 404 })
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "The enquiry could not be processed." }, { status: 400 })
  if (cleanPortfolioText(body.website, 120)) return NextResponse.json({ ok: true, message: "Your enquiry has been received." })

  const fullName = cleanPortfolioText(body.fullName, 180)
  const organisation = cleanPortfolioText(body.organisation, 220)
  const email = cleanPortfolioText(body.email, 190).toLowerCase()
  const opportunityType = cleanPortfolioText(body.opportunityType, 60).toLowerCase()
  const timeline = cleanPortfolioText(body.timeline, 120)
  const budgetRange = cleanPortfolioText(body.budgetRange, 120)
  const message = cleanPortfolioText(body.message, 4000)
  if (!fullName || !email || !OPPORTUNITY_LABELS.has(opportunityType) || message.length < 40 || body.consent !== true) {
    return NextResponse.json({ ok: false, error: "Complete the required enquiry details and consent checkbox." }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ ok: false, error: "Enter a valid work email address." }, { status: 400 })
  if (profile.opportunityTypes.length && !profile.opportunityTypes.includes(opportunityType)) return NextResponse.json({ ok: false, error: "Select an opportunity this student is accepting." }, { status: 400 })

  const ip = clientIpFromRequest(request) || "unknown"
  const ipRateLimit = consumeServerRateLimit({ key: `student-hire-ip:${profile.profileId}:${ip}`, limit: 8, windowMs: 60 * 60 * 1000 })
  const identityRateLimit = consumeServerRateLimit({ key: `student-hire-identity:${profile.profileId}:${ip}:${email}`, limit: 4, windowMs: 60 * 60 * 1000 })
  if (!ipRateLimit.allowed || !identityRateLimit.allowed) {
    const retryAfterSeconds = Math.max(ipRateLimit.retryAfterSeconds, identityRateLimit.retryAfterSeconds)
    return NextResponse.json({ ok: false, error: "Too many enquiries were submitted. Please try again later." }, { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } })
  }
  const recaptcha = await verifyRecaptchaToken({ token: body.recaptchaToken, expectedAction: "student_hire_enquiry", remoteip: ip, request })
  if (!recaptcha.ok) return NextResponse.json({ ok: false, error: "We could not verify this submission. Please try again." }, { status: 400 })

  const now = new Date()
  const enquiryUuid = `she_${crypto.randomUUID().replace(/-/g, "")}`
  const ipHash = crypto.createHash("sha256").update(`${process.env.AUTH_SECRET || "portfolio"}:${ip}`).digest("hex")
  const recentRows = await prisma.$queryRaw<Array<{ total: bigint }>>`
    SELECT COUNT(*) AS total
    FROM student_hire_enquiries
    WHERE profile_id = ${profile.profileId}
      AND ip_hash = ${ipHash}
      AND created_at >= ${new Date(Date.now() - 60 * 60 * 1000)}
  `
  if (Number(recentRows[0]?.total || 0) >= 8) {
    return NextResponse.json({ ok: false, error: "Too many enquiries were submitted. Please try again later." }, { status: 429, headers: { "Retry-After": "3600" } })
  }
  await prisma.studentHireEnquiry.create({ data: {
    enquiryUuid,
    profileId: profile.profileId,
    accountId: profile.accountId,
    enquirerName: fullName,
    organisation: organisation || null,
    enquirerEmail: email,
    opportunityType,
    timeline: timeline || null,
    budgetRange: budgetRange || null,
    message,
    status: "new",
    deliveryStatus: "pending",
    ipHash,
    consentAt: now,
    createdAt: now,
    updatedAt: now
  } })

  const opportunityLabel = OPPORTUNITY_LABELS.get(opportunityType) || "Professional opportunity"
  const profileUrl = `${CANONICAL_SITE_URL}/projects/${encodeURIComponent(profile.publicSlug)}`
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br/>")
  const studentText = [
    `Hello ${profile.displayName},`, "", `You have received a new ${opportunityLabel.toLowerCase()} enquiry through your Academy portfolio.`, "",
    `From: ${fullName}`, `Organisation: ${organisation || "Not provided"}`, `Email: ${email}`, `Timeline: ${timeline || "Not provided"}`, `Budget: ${budgetRange || "Not provided"}`, "", "Enquiry:", message, "", `Your portfolio: ${profileUrl}`, "", "Please assess the opportunity carefully before sharing personal information or agreeing to work. The Academy has forwarded this enquiry but has not verified or endorsed the sender."
  ].join("\n")
  const studentHtml = `<p>Hello ${escapeHtml(profile.displayName)},</p><p>You have received a new <strong>${escapeHtml(opportunityLabel.toLowerCase())}</strong> enquiry through your Academy portfolio.</p><p><strong>From:</strong> ${escapeHtml(fullName)}<br/><strong>Organisation:</strong> ${escapeHtml(organisation || "Not provided")}<br/><strong>Email:</strong> ${escapeHtml(email)}<br/><strong>Timeline:</strong> ${escapeHtml(timeline || "Not provided")}<br/><strong>Budget:</strong> ${escapeHtml(budgetRange || "Not provided")}</p><p><strong>Enquiry:</strong><br/>${safeMessage}</p><p><a href="${profileUrl}">View your public portfolio</a></p><p><strong>Safety note:</strong> Assess the opportunity carefully before sharing personal information or agreeing to work. The Academy has forwarded this enquiry but has not verified or endorsed the sender.</p>`

  let deliveryStatus = "sent"
  let deliveryError: string | null = null
  try {
    await sendEmail({ to: profile.studentEmail, subject: `Important: New opportunity enquiry for ${profile.displayName}`, text: studentText, html: studentHtml })
    await sendEmail({ to: "support@tochukwunkwocha.com", subject: `Student portfolio enquiry: ${profile.displayName}`, text: `${studentText}\n\nEnquiry ID: ${enquiryUuid}`, html: `${studentHtml}<p><strong>Enquiry ID:</strong> ${escapeHtml(enquiryUuid)}</p>` }).catch(() => null)
    await sendEmail({ to: email, subject: `We received your enquiry for ${profile.displayName}`, text: `Hello ${fullName},\n\nYour ${opportunityLabel.toLowerCase()} enquiry for ${profile.displayName} has been received and forwarded privately. Their contact information remains protected, and a response is at their discretion.\n\nReference: ${enquiryUuid}\n\nTochukwu Tech and AI Academy`, html: `<p>Hello ${escapeHtml(fullName)},</p><p>Your ${escapeHtml(opportunityLabel.toLowerCase())} enquiry for <strong>${escapeHtml(profile.displayName)}</strong> has been received and forwarded privately. Their contact information remains protected, and a response is at their discretion.</p><p><strong>Reference:</strong> ${escapeHtml(enquiryUuid)}</p>` }).catch(() => null)
  } catch (error) {
    deliveryStatus = "failed"
    deliveryError = error instanceof Error ? error.message.slice(0, 2000) : "Email delivery failed."
  }
  await prisma.studentHireEnquiry.update({ where: { enquiryUuid }, data: { deliveryStatus, deliveryError, updatedAt: new Date() } })
  return NextResponse.json({ ok: true, message: "Your enquiry has been received and recorded. A response is at the student’s discretion.", reference: enquiryUuid })
}
