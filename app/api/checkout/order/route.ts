import { NextResponse } from "next/server"

import {
  checkoutContext,
  courseReferencePrefix,
  createCourseOrder,
  initializePaystack,
  initializeStripe,
  normalizeCourse,
  normalizeEmail,
  recordAffiliateAttribution,
  providerForCountry,
  upsertWhatsAppContact,
  updateCourseOrderProvider
} from "@/lib/payments/course-checkout"
import { clientIpFromRequest, verifyRecaptchaToken } from "@/lib/recaptcha"
import { ServerTiming } from "@/lib/server-timing"
import { studentApiErrorResponse } from "@/lib/student-api-error"
import { enqueueAbandonedEnrollmentFollowup } from "@/lib/abandoned-enrollment-followups"
import {
  assertNoActiveIndividualEnrollment,
  enrollmentConflictPayload,
  isCourseEnrollmentConflict
} from "@/lib/enrollment-guard"

export async function POST(request: Request) {
  const timing = new ServerTiming()
  try {
    const origin = new URL(request.url).origin
    const body = await request.json()
    const firstName = String(body.firstName || "").trim().slice(0, 160)
    const email = normalizeEmail(body.email)
    const phone = String(body.phone || "").trim().slice(0, 40)
    const country = String(body.country || "").trim().slice(0, 120)
    const courseSlug = normalizeCourse(body.courseSlug)
    const returnSlug = normalizeCourse(body.returnSlug || courseSlug)
    const provider = providerForCountry(country, body.provider)

    if (!firstName || !email || !phone) {
      return NextResponse.json({ ok: false, error: "Full name, valid email, and phone number are required." }, { status: 400 })
    }
    const recaptcha = await verifyRecaptchaToken({
      token: body.recaptchaToken,
      expectedAction: "course_order_create",
      remoteip: clientIpFromRequest(request),
      request
    })
    if (!recaptcha.ok) {
      timing.mark("recaptcha")
      return NextResponse.json(
        { ok: false, error: "We could not verify this checkout. Please try again." },
        { status: 400, headers: timing.headers() }
      )
    }
    timing.mark("recaptcha")

    const result = await checkoutContext({
      courseSlug,
      country,
      provider,
      email,
      couponCode: body.couponCode,
      buyerType: body.buyerType,
      seatCount: body.seatCount,
      batchKey: body.batchKey,
      requireActiveBatch: true
    })
    if (result.buyerType !== "family") {
      await assertNoActiveIndividualEnrollment({ email, courseSlug })
    }
    timing.mark("pricing")
    const orderUuid = await createCourseOrder({
      courseSlug,
      firstName,
      email,
      phone,
      country,
      provider,
      pricing: result.pricing,
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
    await enqueueAbandonedEnrollmentFollowup({
      orderUuid,
      whatsappOptedIn: body.whatsappOptIn === true
    }).catch((error) => {
      console.error("[checkout] abandoned enrollment follow-up could not be queued", {
        orderUuid,
        error: error instanceof Error ? error.message : String(error)
      })
    })
    timing.mark("order")
    const metadata = { order_uuid: orderUuid, course_slug: returnSlug, checkout_course_slug: courseSlug, first_name: firstName }
    const affiliateTask = recordAffiliateAttribution({
      sourceUuid: orderUuid,
      courseSlug,
      affiliateCode: body.affiliateCode,
      buyerEmail: email,
      buyerCountry: country,
      buyerCurrency: result.pricing.currency,
      orderAmountMinor: result.pricing.finalAmountMinor,
      requestHeaders: request.headers
    }).catch((error) => {
      console.error("[checkout] affiliate attribution deferred for reconciliation", {
        orderUuid,
        error: error instanceof Error ? error.message : String(error)
      })
      return null
    })
    const whatsappTask = upsertWhatsAppContact({
      email,
      fullName: firstName,
      phone,
      courseSlug,
      source: "course_checkout",
      optedIn: body.whatsappOptIn === true
    })
    const payment =
      provider === "stripe"
        ? await initializeStripe({
            email,
            amountMinor: result.pricing.finalAmountMinor,
            currency: result.pricing.currency,
            courseName: result.courseName,
            orderUuid,
            courseSlug: returnSlug,
            successUrl: `${origin}/api/payments/stripe/return?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${origin}/checkout/${returnSlug}?payment=cancelled&order=${orderUuid}`,
            metadata: {
              checkout_course_slug: courseSlug
            }
          })
        : await initializePaystack({
            email,
            amountMinor: result.pricing.finalAmountMinor,
            reference: `${courseReferencePrefix(courseSlug)}_${orderUuid.replace(/-/g, "").slice(0, 24)}`,
            callbackUrl: `${origin}/api/payments/paystack/return`,
            metadata
          })
    timing.mark("provider")

    await updateCourseOrderProvider(orderUuid, payment.providerReference, payment.providerOrderId)
    timing.mark("provider_save")
    await Promise.all([affiliateTask, whatsappTask])
    timing.mark("attribution")

    return NextResponse.json({
      ok: true,
      orderUuid,
      provider,
      checkoutUrl: payment.checkoutUrl,
      pricing: result.pricing
    }, { headers: timing.headers() })
  } catch (error) {
    timing.mark("failed")
    if (isCourseEnrollmentConflict(error)) {
      return NextResponse.json(enrollmentConflictPayload(error), { status: 409, headers: timing.headers() })
    }
    return studentApiErrorResponse(error, "Could not create your checkout. Please try again.", {
      status: 503,
      headers: timing.headers(),
      context: "course_checkout_order_failed"
    })
  }
}
