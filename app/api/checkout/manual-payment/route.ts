import { after, NextResponse } from "next/server"

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
import { trustedPaymentProof } from "@/lib/payment-proof-upload"
import {
  enqueueManualPaymentNotification,
  processPaymentNotificationOutbox
} from "@/lib/payment-notification-outbox"
import { clientIpFromRequest, verifyRecaptchaToken } from "@/lib/recaptcha"
import { createStudentSessionForAccount, createStudentTemporaryPassword, setStudentSessionCookie } from "@/lib/student-auth"
import {
  assertNoActiveIndividualEnrollment,
  enrollmentConflictPayload,
  isCourseEnrollmentConflict
} from "@/lib/enrollment-guard"

async function existingPaymentForProof(proofPublicId: string) {
  if (!proofPublicId) return null
  const rows = await prisma.$queryRaw<Array<{ paymentUuid: string; buyerType: string | null }>>`
    SELECT payment_uuid AS paymentUuid, buyer_type AS buyerType
    FROM course_manual_payments
    WHERE proof_public_id = ${proofPublicId}
    ORDER BY created_at DESC
    LIMIT 1
  `
  return rows[0] || null
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
  dashboardPath?: string
}) {
  const existingAccount = await prisma.studentAccount.findUnique({ where: { email: input.email } })
  const account = existingAccount || await findOrCreateStudentAccount({
    fullName: input.fullName,
    email: input.email,
    phone: input.phone
  })
  const temporary = existingAccount ? null : await createStudentTemporaryPassword(input.email).catch(() => null)
  const session = await createStudentSessionForAccount(account)
  await setStudentSessionCookie(session.token)
  return {
    accountCreated: !existingAccount,
    temporaryPasswordCreated: Boolean(temporary?.password),
    temporaryPassword: temporary?.password || null
  }
}

async function queueManualPaymentNotifications(input: {
  paymentUuid: string
  email: string
  fullName: string
  phone: string
  courseSlug: string
  dashboardPath: string
  accountCreated: boolean
  temporaryPassword: string | null
}) {
  let eventUuid = ""
  try {
    eventUuid = await enqueueManualPaymentNotification({
      paymentUuid: input.paymentUuid,
      email: input.email,
      fullName: input.fullName,
      phone: input.phone,
      courseSlug: input.courseSlug,
      dashboardPath: input.dashboardPath,
      temporaryPassword: input.temporaryPassword,
      sendEmail: input.accountCreated
    })
  } catch (error) {
    console.error("[manual-payment] could not enqueue notifications", {
      paymentUuid: input.paymentUuid,
      error: error instanceof Error ? error.message : String(error)
    })
    return
  }
  after(async () => {
    await processPaymentNotificationOutbox({ eventUuid }).catch((error) => {
      console.error("[manual-payment] deferred notification delivery failed", {
        eventUuid,
        error: error instanceof Error ? error.message : String(error)
      })
    })
  })
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
    const trustedProof = trustedPaymentProof({
      proofUrl,
      proofPublicId,
      proofResourceType: body.proofResourceType,
      proofVersion: body.proofVersion,
      proofSignature: body.proofSignature,
      proofToken: body.proofToken
    })
    if (!trustedProof) {
      return NextResponse.json({ ok: false, error: "Payment proof validation failed. Upload the file again." }, { status: 400 })
    }

    const existingPayment = await existingPaymentForProof(proofPublicId)
    if (existingPayment?.paymentUuid) {
      const existingGroupEnrollment = String(existingPayment.buyerType || "").toLowerCase() === "family"
      const dashboardPath = existingGroupEnrollment ? "/dashboard/family?manual_payment=pending" : "/dashboard/courses?manual_payment=pending"
      const pendingSession = await openPendingStudentSession({
        fullName: firstName,
        email,
        phone,
        courseSlug,
        dashboardPath
      })
      await queueManualPaymentNotifications({
        paymentUuid: existingPayment.paymentUuid,
        email,
        fullName: firstName,
        phone,
        courseSlug,
        dashboardPath,
        accountCreated: pendingSession.accountCreated,
        temporaryPassword: pendingSession.temporaryPassword
      })
      return NextResponse.json({
        ok: true,
        paymentUuid: existingPayment.paymentUuid,
        alreadySubmitted: true,
        pendingReview: true,
        accountCreated: pendingSession.accountCreated,
        temporaryPasswordCreated: pendingSession.temporaryPasswordCreated
      })
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
    if (result.buyerType !== "family") {
      await assertNoActiveIndividualEnrollment({ email, courseSlug })
    }
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
      userAgent: request.headers.get("user-agent") || "",
      affiliateCode: body.affiliateCode
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
    const affiliateTask = recordAffiliateAttribution({
      sourceUuid: paymentUuid,
      courseSlug,
      affiliateCode: body.affiliateCode,
      buyerEmail: email,
      buyerCountry: country,
      buyerCurrency: result.pricing.currency,
      orderAmountMinor: result.pricing.finalAmountMinor,
      requestHeaders: request.headers
    }).catch((error) => {
      console.error("[manual-payment] affiliate attribution deferred for reconciliation", {
        paymentUuid,
        error: error instanceof Error ? error.message : String(error)
      })
      return null
    })
    const whatsappContactTask = upsertWhatsAppContact({
      email,
      fullName: firstName,
      phone,
      courseSlug,
      source: "manual_enrollment",
      optedIn: body.whatsappOptIn === true
    })
    const isGroupEnrollment = String(result.buyerType || "").toLowerCase() === "family"
    const dashboardPath = isGroupEnrollment ? "/dashboard/family?manual_payment=pending" : "/dashboard/courses?manual_payment=pending"
    const pendingSession = await openPendingStudentSession({
      fullName: firstName,
      email,
      phone,
      courseSlug,
      dashboardPath
    })
    await Promise.all([affiliateTask, whatsappContactTask])
    await queueManualPaymentNotifications({
      paymentUuid,
      email,
      fullName: firstName,
      phone,
      courseSlug,
      dashboardPath,
      accountCreated: pendingSession.accountCreated,
      temporaryPassword: pendingSession.temporaryPassword
    })

    return NextResponse.json({
      ok: true,
      paymentUuid,
      pricing: result.pricing,
      proofFallback: usedProofFallback,
      pendingReview: true,
      accountCreated: pendingSession.accountCreated,
      temporaryPasswordCreated: pendingSession.temporaryPasswordCreated
    })
  } catch (error) {
    if (isCourseEnrollmentConflict(error)) {
      return NextResponse.json(enrollmentConflictPayload(error), { status: 409 })
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not submit manual payment" }, { status: 500 })
  }
}
