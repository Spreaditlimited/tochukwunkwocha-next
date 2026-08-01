import { NextResponse } from "next/server"

import { sendInstallmentStartedEmail, syncEnrollmentToBrevo } from "@/lib/enrollment-notifications"
import {
  checkoutContext,
  createInstallmentPlan,
  findOrCreateStudentAccount,
  formatMinorAmount,
  normalizeCourse,
  normalizeEmail,
  providerForCountry,
  recordAffiliateAttribution,
  upsertWhatsAppContact
} from "@/lib/payments/course-checkout"
import { createStudentSessionForAccount, setStudentSessionCookie } from "@/lib/student-auth"
import {
  assertNoActiveIndividualEnrollment,
  enrollmentConflictPayload,
  isCourseEnrollmentConflict
} from "@/lib/enrollment-guard"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const firstName = String(body.firstName || "").trim().slice(0, 160)
    const email = normalizeEmail(body.email)
    const phone = String(body.phone || "").trim().slice(0, 40)
    const country = String(body.country || "NG").trim().slice(0, 120)
    const courseSlug = normalizeCourse(body.courseSlug)
    const provider = providerForCountry(country, body.provider)

    if (!firstName || !email || !phone) {
      return NextResponse.json({ ok: false, error: "Full name, valid email, and phone number are required." }, { status: 400 })
    }

    const account = await findOrCreateStudentAccount({ fullName: firstName, email, phone })
    const session = await createStudentSessionForAccount(account)
    await setStudentSessionCookie(session.token)
    const context = await checkoutContext({
      courseSlug,
      country,
      provider,
      email,
      couponCode: body.couponCode,
      buyerType: body.buyerType,
      seatCount: body.seatCount,
      batchKey: body.batchKey,
      installment: true
    })
    if (!context.batch) {
      return NextResponse.json({ ok: false, error: "No open batch is available for this course." }, { status: 409 })
    }
    if (context.buyerType !== "family") {
      await assertNoActiveIndividualEnrollment({ email, courseSlug })
    }

    const plan = await createInstallmentPlan({
      accountId: account.id,
      courseSlug,
      country,
      provider,
      pricing: context.pricing,
      batch: context.batch,
      buyerType: context.buyerType,
      seatCount: context.seatCount
    })
    if (plan.created) {
      await recordAffiliateAttribution({
        sourceUuid: plan.planUuid,
        courseSlug,
        affiliateCode: body.affiliateCode,
        buyerEmail: email,
        buyerCountry: country,
        buyerCurrency: context.pricing.currency,
        orderAmountMinor: context.pricing.finalAmountMinor,
        requestHeaders: request.headers
      })
    }
    await upsertWhatsAppContact({
      email,
      fullName: firstName,
      phone,
      courseSlug,
      source: "installment_enrollment",
      optedIn: body.whatsappOptIn === true
    })
    if (plan.created) {
      await syncEnrollmentToBrevo({
        fullName: firstName,
        email,
        phone,
        courseSlug,
        batchKey: context.batch.batchKey,
        batchLabel: context.batch.batchLabel,
        listId: context.batch.brevoListId,
        source: "installment_started"
      }).catch(() => null)
      await sendInstallmentStartedEmail({
        email,
        fullName: firstName,
        courseSlug
      }).catch(() => null)
    }

    return NextResponse.json({
      ok: true,
      planUuid: plan.planUuid,
      reusedExistingPlan: !plan.created,
      pricing: {
        ...context.pricing,
        currency: plan.currency,
        finalAmountMinor: plan.targetAmountMinor,
        label: formatMinorAmount(plan.targetAmountMinor, plan.currency),
        baseLabel: formatMinorAmount(context.pricing.baseAmountMinor, context.pricing.currency),
        courseAmountLabel: formatMinorAmount(Number(context.pricing.courseAmountMinor || 0), context.pricing.currency),
        vatLabel: formatMinorAmount(Number(context.pricing.vatAmountMinor || 0), context.pricing.currency),
        subtotalLabel: formatMinorAmount(Number(context.pricing.subtotalAmountMinor || 0), context.pricing.currency),
        processingFeeLabel: formatMinorAmount(Number(context.pricing.processingFeeMinor || 0), context.pricing.currency),
        discountLabel: formatMinorAmount(context.pricing.discountMinor, context.pricing.currency),
        groupDiscountLabel: formatMinorAmount(Number(context.pricing.groupDiscountMinor || 0), context.pricing.currency),
        groupUnitLabel: context.pricing.groupUnitAmountMinor ? formatMinorAmount(Number(context.pricing.groupUnitAmountMinor), context.pricing.currency) : null
      },
      batch: context.batch
    })
  } catch (error) {
    if (isCourseEnrollmentConflict(error)) {
      return NextResponse.json(enrollmentConflictPayload(error), { status: 409 })
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not create installment plan" }, { status: 500 })
  }
}
