import { NextResponse } from "next/server"

import { sendStudentPendingManualPaymentEmail } from "@/lib/enrollment-notifications"
import {
  checkoutContext,
  createManualPayment,
  findOrCreateStudentAccount,
  manualTransferAllowedForCountry,
  normalizeCourse,
  normalizeEmail,
  recordAffiliateAttribution,
  upsertWhatsAppContact
} from "@/lib/payments/course-checkout"
import { prisma } from "@/lib/prisma"
import { clientIpFromRequest, verifyRecaptchaToken } from "@/lib/recaptcha"
import { createStudentPasswordResetToken, createStudentSessionForAccount, setStudentSessionCookie } from "@/lib/student-auth"

function trustedUploadedProof(proofUrl: string, proofPublicId: string) {
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim()
  if (!cloudName || !proofPublicId.startsWith("tochukwunkwocha-site/manual-payments/")) return false
  try {
    const url = new URL(proofUrl)
    return url.protocol === "https:" && url.hostname === "res.cloudinary.com" && url.pathname.startsWith(`/${cloudName}/`)
  } catch {
    return false
  }
}

async function existingPaymentForProof(proofPublicId: string) {
  if (!proofPublicId) return null
  const rows = await prisma.$queryRaw<Array<{ paymentUuid: string }>>`
    SELECT payment_uuid AS paymentUuid
    FROM course_manual_payments
    WHERE proof_public_id = ${proofPublicId}
    ORDER BY created_at DESC
    LIMIT 1
  `
  return rows[0]?.paymentUuid || null
}

async function proofFallbackWithinRateLimit(email: string) {
  const rows = await prisma.$queryRaw<Array<{ total: number | bigint }>>`
    SELECT COUNT(*) AS total
    FROM course_manual_payments
    WHERE email = ${email}
      AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
  `
  return Number(rows[0]?.total || 0) < 3
}

async function openPendingStudentSession(input: {
  fullName: string
  email: string
  phone: string
  courseSlug: string
}) {
  const existingAccount = await prisma.studentAccount.findUnique({ where: { email: input.email } })
  const account = existingAccount || await findOrCreateStudentAccount({
    fullName: input.fullName,
    email: input.email,
    phone: input.phone
  })
  const reset = existingAccount ? null : await createStudentPasswordResetToken(input.email, { neverExpires: true }).catch(() => null)
  if (!existingAccount) {
    await sendStudentPendingManualPaymentEmail({
      email: input.email,
      fullName: input.fullName,
      courseSlug: input.courseSlug,
      resetToken: reset?.token || null
    }).catch(() => null)
  }
  const session = await createStudentSessionForAccount(account)
  await setStudentSessionCookie(session.token)
  return { accountCreated: !existingAccount, resetTokenCreated: Boolean(reset?.token) }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const firstName = String(body.firstName || "").trim().slice(0, 160)
    const email = normalizeEmail(body.email)
    const phone = String(body.phone || "").trim().slice(0, 40)
    const country = String(body.country || "").trim().slice(0, 120)
    const courseSlug = normalizeCourse(body.courseSlug)
    const proofUrl = String(body.proofUrl || "").trim()
    const proofPublicId = String(body.proofPublicId || "").trim().slice(0, 255)
    const transferReference = String(body.transferReference || "").trim().slice(0, 190)

    if (!firstName || !email || !phone) {
      return NextResponse.json({ ok: false, error: "Full name, valid email, and phone number are required." }, { status: 400 })
    }
    if (!/^https:\/\//i.test(proofUrl)) {
      return NextResponse.json({ ok: false, error: "Upload a valid payment proof before submitting." }, { status: 400 })
    }

    const existingPaymentUuid = await existingPaymentForProof(proofPublicId)
    if (existingPaymentUuid) {
      const pendingSession = await openPendingStudentSession({ fullName: firstName, email, phone, courseSlug })
      return NextResponse.json({ ok: true, paymentUuid: existingPaymentUuid, alreadySubmitted: true, pendingReview: true, ...pendingSession })
    }

    const recaptcha = await verifyRecaptchaToken({
      token: body.recaptchaToken,
      expectedAction: "course_order_create",
      remoteip: clientIpFromRequest(request),
      request
    })
    let usedProofFallback = false
    if (!recaptcha.ok) {
      const reason = "reason" in recaptcha ? recaptcha.reason : "unknown"
      const score = "score" in recaptcha ? recaptcha.score : undefined
      const action = "action" in recaptcha ? recaptcha.action : undefined
      console.warn("[manual-payment] reCAPTCHA verification failed", {
        reason,
        score,
        action,
        requestId: request.headers.get("x-vercel-id") || request.headers.get("x-nf-request-id") || undefined
      })

      const fallbackRequested = body.allowProofFallback === true
      const trustedProof = trustedUploadedProof(proofUrl, proofPublicId)
      const withinRateLimit = fallbackRequested && trustedProof
        ? await proofFallbackWithinRateLimit(email)
        : false

      if (!fallbackRequested || !trustedProof || !withinRateLimit) {
        return NextResponse.json(
          { ok: false, code: "recaptcha_failed", error: "We could not verify this submission. Please try again." },
          { status: fallbackRequested && trustedProof && !withinRateLimit ? 429 : 400 }
        )
      }

      usedProofFallback = true
      console.warn("[manual-payment] accepting proof-backed reCAPTCHA fallback", {
        reason,
        requestId: request.headers.get("x-vercel-id") || request.headers.get("x-nf-request-id") || undefined
      })
    }
    if (!manualTransferAllowedForCountry(country)) {
      return NextResponse.json({ ok: false, error: "Bank transfer is only available for Nigeria checkout." }, { status: 400 })
    }

    const result = await checkoutContext({
      courseSlug,
      country,
      provider: "paystack",
      email,
      couponCode: body.couponCode,
      buyerType: body.buyerType,
      seatCount: body.seatCount,
      batchKey: body.batchKey,
      manualTransfer: true
    })
    const paymentUuid = await createManualPayment({
      courseSlug,
      firstName,
      email,
      phone,
      country,
      pricing: result.pricing,
      transferReference,
      proofUrl,
      proofPublicId,
      batch: result.batch,
      buyerType: result.buyerType,
      seatCount: result.seatCount,
      fbp: String(body.fbp || ""),
      fbc: String(body.fbc || ""),
      fbclid: String(body.fbclid || ""),
      clientIp: clientIpFromRequest(request),
      userAgent: request.headers.get("user-agent") || ""
    })
    if (usedProofFallback) {
      await prisma.$executeRaw`
        UPDATE course_manual_payments
        SET review_note = 'Proof-backed recovery: reCAPTCHA failed after a client retry; manual verification required.',
            updated_at = ${new Date()}
        WHERE payment_uuid = ${paymentUuid}
        LIMIT 1
      `.catch(() => undefined)
    }
    await recordAffiliateAttribution({
      sourceUuid: paymentUuid,
      courseSlug,
      affiliateCode: body.affiliateCode,
      buyerEmail: email,
      buyerCountry: country,
      buyerCurrency: result.pricing.currency,
      orderAmountMinor: result.pricing.finalAmountMinor
    })
    await upsertWhatsAppContact({
      email,
      fullName: firstName,
      phone,
      courseSlug,
      source: "manual_enrollment",
      optedIn: body.whatsappOptIn === true
    })
    const pendingSession = await openPendingStudentSession({ fullName: firstName, email, phone, courseSlug })

    return NextResponse.json({ ok: true, paymentUuid, pricing: result.pricing, proofFallback: usedProofFallback, pendingReview: true, ...pendingSession })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not submit manual payment" }, { status: 500 })
  }
}
