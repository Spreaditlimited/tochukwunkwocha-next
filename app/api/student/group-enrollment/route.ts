import { NextResponse } from "next/server"

import {
  availableFamilySeatsForCourse,
  consumeFamilySeatsForChildren,
  hasPurchasedFamilySeats,
  normalizeFamilyChildren,
  prepareFamilyLearnerAssignments,
  savePendingFamilyChildren
} from "@/lib/family-enrollment"
import { enrollmentConflictPayload, isCourseEnrollmentConflict } from "@/lib/enrollment-guard"
import { studentApiErrorResponse } from "@/lib/student-api-error"
import {
  checkoutContext,
  beginCourseOrderProviderInitialization,
  courseReferencePrefix,
  createCourseOrder,
  failCourseOrderProviderInitialization,
  familyEnrollmentEnabledForCourse,
  formatMinorAmount,
  initializePaystack,
  initializeStripe,
  normalizeCourse,
  providerForCountry,
  PaystackInitializationError,
  siteBaseUrl,
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
    if (!session) return NextResponse.json({ ok: false, error: "Please sign in to continue." }, { status: 401 })
    const body = await request.json()
    const courseSlug = normalizeCourse(body.courseSlug || "prompt-to-profit")
    const country = clean(body.country || "NG", 120) || "NG"
    const provider = providerForCountry(country, body.provider)
    if (!familyEnrollmentEnabledForCourse(courseSlug)) {
      return NextResponse.json({ ok: false, error: "Group enrollment is not available for this course." }, { status: 400 })
    }
    const availableSeats = await availableFamilySeatsForCourse(session.account.id, courseSlug)
    if (availableSeats > 0) {
      return NextResponse.json(
        { ok: false, error: "Assign your available learner seats before purchasing another seat." },
        { status: 409 }
      )
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
    return studentApiErrorResponse(error, "Could not load group checkout pricing.", {
      status: /capacity|seat|batch|locked|available|course/i.test(message) ? 400 : 500,
      context: "student_group_pricing_failed"
    })
  }
}

export async function POST(request: Request) {
  let createdOrderUuid = ""
  let createdProvider = ""
  let providerInitialized = false
  try {
    const session = await getStudentSession()
    if (!session) return NextResponse.json({ ok: false, error: "Please sign in to continue." }, { status: 401 })
    const origin = siteBaseUrl()
    const body = await request.json()
    const courseSlug = normalizeCourse(body.courseSlug || "prompt-to-profit")
    const country = clean(body.country || "NG", 120) || "NG"
    const provider = providerForCountry(country, body.provider)
    const batchKey = clean(body.batchKey, 64)
    const children = normalizeFamilyChildren(body.children).map((child) => ({ ...child, batchKey }))

    if (!children.length) {
      return NextResponse.json({ ok: false, error: "Add at least one learner." }, { status: 400 })
    }
    if (!familyEnrollmentEnabledForCourse(courseSlug)) {
      return NextResponse.json({ ok: false, error: "Group enrollment is not available for this course." }, { status: 400 })
    }
    const availableSeats = await availableFamilySeatsForCourse(session.account.id, courseSlug)
    if (availableSeats > 0) {
      if (children.length > availableSeats) {
        return NextResponse.json(
          {
            ok: false,
            error: `You have ${availableSeats} available seat${availableSeats === 1 ? "" : "s"}. Assign those seats before purchasing another seat.`
          },
          { status: 409 }
        )
      }
      const consumed = await consumeFamilySeatsForChildren({
        parentAccountId: session.account.id,
        parentName: session.account.fullName,
        parentEmail: session.account.email,
        courseSlug,
        batchKey,
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
    }

    const assignments = await prepareFamilyLearnerAssignments(children, courseSlug)
    const purchase = await groupPurchaseSeatCount(session.account.id, assignments.length)
    const context = await checkoutContext({
      courseSlug,
      country,
      provider,
      email: session.account.email,
      buyerType: "family",
      seatCount: purchase.seatCount,
      minimumFamilySeats: purchase.minimumSeatCount,
      batchKey,
      requireActiveBatch: true,
      requireExplicitHolidayBatch: true
    })
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
    createdOrderUuid = orderUuid
    createdProvider = provider

    await savePendingFamilyChildren({
      sourceType: "course_order",
      sourceUuid: orderUuid,
      courseSlug,
      batchKey: context.batch?.batchKey || null,
      batchLabel: context.batch?.batchLabel || null,
      children: assignments
    })

    const metadata = {
      payment_scope: "course_checkout",
      order_uuid: orderUuid,
      course_slug: courseSlug,
      checkout_course_slug: courseSlug,
      first_name: session.account.fullName,
      buyer_type: "family",
      seat_count: String(context.seatCount)
    }
    const paystackReference = `${courseReferencePrefix(courseSlug)}_${orderUuid.replace(/-/g, "").slice(0, 24)}`
    if (provider === "paystack") await beginCourseOrderProviderInitialization(orderUuid, paystackReference)
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
            reference: paystackReference,
            callbackUrl: `${origin}/api/payments/paystack/return`,
            metadata,
            currency: context.pricing.currency
          })

    await updateCourseOrderProvider(orderUuid, payment.providerReference, payment.providerOrderId)
    providerInitialized = true

    return NextResponse.json({
      ok: true,
      usedExistingSeats: false,
      orderUuid,
      provider,
      checkoutUrl: payment.checkoutUrl,
      pricing: context.pricing
    })
  } catch (error) {
    if (createdOrderUuid && createdProvider === "paystack" && !providerInitialized) {
      await failCourseOrderProviderInitialization(createdOrderUuid, error).catch(() => null)
    }
    if (isCourseEnrollmentConflict(error)) {
      return NextResponse.json(enrollmentConflictPayload(error), { status: 409 })
    }
    const message = error instanceof Error ? error.message : "Could not create group enrollment."
    return studentApiErrorResponse(error, "Could not create group enrollment.", {
      status: error instanceof PaystackInitializationError ? error.status : /capacity|seat|batch|locked|available|course/i.test(message) ? 400 : 500,
      context: "student_group_enrollment_failed"
    })
  }
}
