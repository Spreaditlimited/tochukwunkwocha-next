import { NextResponse } from "next/server"

import { consumeFamilySeatsForChildren, hasPurchasedFamilySeats, normalizeFamilyChildren, savePendingFamilyChildren } from "@/lib/family-enrollment"
import {
  checkoutContext,
  courseReferencePrefix,
  createCourseOrder,
  familyEnrollmentEnabledForCourse,
  formatMinorAmount,
  initializePaystack,
  initializeStripe,
  normalizeCourse,
  providerForCountry,
  updateCourseOrderProvider
} from "@/lib/payments/course-checkout"
import { getStudentSession } from "@/lib/student-auth"

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

async function groupPurchaseSeatCount(parentAccountId: bigint, requestedSeats: number) {
  const hasPurchasedSeats = await hasPurchasedFamilySeats(parentAccountId)
  const minimumSeatCount = hasPurchasedSeats ? 1 : 2
  return {
    hasPurchasedSeats,
    minimumSeatCount,
    seatCount: Math.max(minimumSeatCount, Math.min(500, Math.round(Number(requestedSeats || 1))))
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getStudentSession()
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    const body = await request.json()
    const courseSlug = normalizeCourse(body.courseSlug || "prompt-to-profit")
    const country = clean(body.country || "NG", 120) || "NG"
    const provider = providerForCountry(country, body.provider)
    if (!familyEnrollmentEnabledForCourse(courseSlug)) {
      return NextResponse.json({ ok: false, error: "Group enrollment is not available for this course." }, { status: 400 })
    }
    const purchase = await groupPurchaseSeatCount(session.account.id, Number(body.seatCount || 1))
    const context = await checkoutContext({
      courseSlug,
      country,
      provider,
      email: session.account.email,
      buyerType: "family",
      seatCount: purchase.seatCount,
      minimumFamilySeats: purchase.minimumSeatCount,
      batchKey: clean(body.batchKey, 64),
      requireActiveBatch: true,
      requireExplicitHolidayBatch: true
    })
    return NextResponse.json({
      ok: true,
      provider,
      seatCount: context.seatCount,
      minimumSeatCount: purchase.minimumSeatCount,
      pricing: {
        ...context.pricing,
        label: formatMinorAmount(context.pricing.finalAmountMinor, context.pricing.currency),
        groupDiscountLabel: formatMinorAmount(Number(context.pricing.groupDiscountMinor || 0), context.pricing.currency),
        groupUnitLabel: context.pricing.groupUnitAmountMinor
          ? formatMinorAmount(Number(context.pricing.groupUnitAmountMinor), context.pricing.currency)
          : null
      }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load group checkout pricing."
    return NextResponse.json(
      { ok: false, error: message },
      { status: /capacity|seat|batch|locked|available|course/i.test(message) ? 400 : 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getStudentSession()
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    const origin = new URL(request.url).origin
    const body = await request.json()
    const courseSlug = normalizeCourse(body.courseSlug || "prompt-to-profit")
    const country = clean(body.country || "NG", 120) || "NG"
    const provider = providerForCountry(country, body.provider)
    const children = normalizeFamilyChildren(body.children)

    if (!children.length) {
      return NextResponse.json({ ok: false, error: "Add at least one learner." }, { status: 400 })
    }
    if (!familyEnrollmentEnabledForCourse(courseSlug)) {
      return NextResponse.json({ ok: false, error: "Group enrollment is not available for this course." }, { status: 400 })
    }

    const requestedBatchKey = clean(body.batchKey, 64)
    const requestedBatchLabel = clean(body.batchLabel, 120)

    try {
      const consumed = await consumeFamilySeatsForChildren({
        parentAccountId: session.account.id,
        parentName: session.account.fullName,
        parentEmail: session.account.email,
        courseSlug,
        batchKey: requestedBatchKey,
        batchLabel: requestedBatchLabel,
        children
      })
      return NextResponse.json({
        ok: true,
        usedExistingSeats: true,
        created: consumed.created,
        seats: {
          purchased: consumed.seatsPurchased,
          used: consumed.seatsUsed,
          available: Math.max(0, consumed.seatsPurchased - consumed.seatsUsed)
        }
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : ""
      if (!message.includes("purchased seat")) throw error
    }

    const purchase = await groupPurchaseSeatCount(session.account.id, children.length)
    const context = await checkoutContext({
      courseSlug,
      country,
      provider,
      email: session.account.email,
      buyerType: "family",
      seatCount: purchase.seatCount,
      minimumFamilySeats: purchase.minimumSeatCount,
      batchKey: requestedBatchKey,
      requireActiveBatch: true,
      requireExplicitHolidayBatch: true
    })
    const batchKey = context.batch?.batchKey || requestedBatchKey
    const batchLabel = context.batch?.batchLabel || requestedBatchLabel

    const orderUuid = await createCourseOrder({
      courseSlug,
      firstName: session.account.fullName,
      email: session.account.email,
      phone: "",
      country,
      provider,
      pricing: context.pricing,
      batch: context.batch,
      buyerType: "family",
      seatCount: context.seatCount
    })

    await savePendingFamilyChildren({
      sourceType: "course_order",
      sourceUuid: orderUuid,
      courseSlug,
      batchKey,
      batchLabel,
      children
    })

    const metadata = {
      order_uuid: orderUuid,
      course_slug: courseSlug,
      checkout_course_slug: courseSlug,
      first_name: session.account.fullName,
      buyer_type: "family",
      seat_count: String(context.seatCount)
    }
    const payment =
      provider === "stripe"
        ? await initializeStripe({
            email: session.account.email,
            amountMinor: context.pricing.finalAmountMinor,
            currency: context.pricing.currency,
            courseName: `${context.courseName} group enrollment`,
            orderUuid,
            courseSlug,
            successUrl: `${origin}/api/payments/stripe/return?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${origin}/dashboard/family?payment=cancelled&order=${orderUuid}`,
            metadata
          })
        : await initializePaystack({
            email: session.account.email,
            amountMinor: context.pricing.finalAmountMinor,
            reference: `${courseReferencePrefix(courseSlug)}_${orderUuid.replace(/-/g, "").slice(0, 24)}`,
            callbackUrl: `${origin}/api/payments/paystack/return`,
            metadata
          })

    await updateCourseOrderProvider(orderUuid, payment.providerReference, payment.providerOrderId)

    return NextResponse.json({
      ok: true,
      usedExistingSeats: false,
      orderUuid,
      provider,
      checkoutUrl: payment.checkoutUrl,
      pricing: context.pricing
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create group enrollment."
    return NextResponse.json(
      { ok: false, error: message },
      { status: /capacity|seat|batch|locked|available|course/i.test(message) ? 400 : 500 }
    )
  }
}
