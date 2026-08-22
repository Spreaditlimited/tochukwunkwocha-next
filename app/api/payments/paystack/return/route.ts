import { NextResponse } from "next/server"

import { sendCourseOrderMetaPurchase } from "@/lib/meta-events"
import { createAffiliateCommissionForOrder, markCourseOrderPaid, PaystackVerificationRequestError, siteBaseUrl, verifyPaystackTransaction } from "@/lib/payments/course-checkout"
import { provisionStudentForPaidOrder } from "@/lib/payments/post-payment-student"
import { recordPaystackAuditEvent, validateCourseOrderPaystackPayment } from "@/lib/payments/paystack-audit"
import { setStudentSessionCookie } from "@/lib/student-auth"
import { isCourseEnrollmentConflict } from "@/lib/enrollment-guard"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const requestIsLocal = ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
  const returnBaseUrl = process.env.NODE_ENV !== "production" && requestIsLocal
    ? url.origin
    : siteBaseUrl()
  const reference = url.searchParams.get("reference") || url.searchParams.get("trxref") || ""
  let orderUuid = ""
  let paymentVerified = false

  try {
    if (!reference) throw new Error("Missing Paystack reference.")
    const verified = await verifyPaystackTransaction(reference)
    paymentVerified = true
    orderUuid = String(verified.metadata?.order_uuid || verified.metadata?.orderUuid || "")
    const courseSlug = String(verified.metadata?.course_slug || verified.metadata?.courseSlug || "")
    if (!orderUuid) throw new Error("Payment metadata is missing order UUID.")
    const validation = await validateCourseOrderPaystackPayment({
      orderUuid,
      providerReference: verified.reference,
      receivedAmountMinor: verified.amountMinor,
      receivedCurrency: verified.currency
    })
    if (!validation.ok) {
      await recordPaystackAuditEvent({
        orderUuid,
        providerReference: verified.reference,
        providerEventId: verified.providerOrderId,
        source: "return",
        eventType: "transaction.verify",
        outcome: "mismatch",
        providerStatus: verified.providerStatus,
        expectedAmountMinor: validation.expected?.expectedAmountMinor,
        receivedAmountMinor: verified.amountMinor,
        expectedCurrency: validation.expected?.expectedCurrency,
        receivedCurrency: verified.currency,
        errorCode: validation.reason,
        errorMessage: "Paystack amount or currency did not match the course order."
      })
      throw new Error("The verified payment did not match this order. Please contact support.")
    }
    await recordPaystackAuditEvent({
      orderUuid,
      providerReference: verified.reference,
      providerEventId: verified.providerOrderId,
      source: "return",
      eventType: "transaction.verify",
      outcome: "verified",
      providerStatus: verified.providerStatus,
      expectedAmountMinor: validation.expected.expectedAmountMinor,
      receivedAmountMinor: verified.amountMinor,
      expectedCurrency: validation.expected.expectedCurrency,
      receivedCurrency: verified.currency
    })
    const order = await markCourseOrderPaid({
      orderUuid,
      providerReference: verified.reference,
      providerOrderId: verified.providerOrderId
    })
    const provisioned = await provisionStudentForPaidOrder(order)
    if (!provisioned?.account) throw new Error("The paid enrollment account could not be provisioned.")
    await createAffiliateCommissionForOrder(orderUuid).catch((error) => {
      console.error("[paystack-return] affiliate commission failed after enrollment provisioning", {
        orderUuid,
        error: error instanceof Error ? error.message : String(error)
      })
    })
    await recordPaystackAuditEvent({
      orderUuid,
      providerReference: verified.reference,
      providerEventId: verified.providerOrderId,
      source: "return",
      eventType: "student.provision",
      outcome: "provisioned",
      providerStatus: verified.providerStatus
    })
    await sendCourseOrderMetaPurchase({
      orderUuid,
      eventSourceUrl: `${siteBaseUrl()}/checkout/${String(order?.course_slug || courseSlug || "prompt-to-profit")}`
    }).catch(() => null)
    if (provisioned?.token) await setStudentSessionCookie(provisioned.token)

    const params = new URLSearchParams({
      payment: "success",
      course_slug: String(order?.course_slug || courseSlug || "prompt-to-profit"),
      order: orderUuid
    })
    const successPath = String(order?.buyer_type || "").toLowerCase() === "family" ? "/dashboard/family" : "/dashboard/courses"
    return NextResponse.redirect(`${returnBaseUrl}${successPath}?${params.toString()}`)
  } catch (error) {
    const verificationRequestFailed = error instanceof PaystackVerificationRequestError
    const auditMessage = verificationRequestFailed
      ? error.providerMessage || error.message
      : error instanceof Error ? error.message : String(error)
    await recordPaystackAuditEvent({
      orderUuid: orderUuid || null,
      providerReference: reference || null,
      source: "return",
      eventType: "transaction.return",
      outcome: "failed",
      errorCode: verificationRequestFailed ? error.code || "return_verification_failed" : "return_verification_failed",
      errorMessage: auditMessage
    })
    const duplicate = isCourseEnrollmentConflict(error)
    const needsReview = !duplicate && (verificationRequestFailed || paymentVerified)
    const paymentState = duplicate ? "duplicate_review" : needsReview ? "verification_pending" : "failed"
    const reason = needsReview
      ? `We are still confirming your payment and activating your course access. Please do not make another payment. Save your payment reference: ${reference}. We'll complete your enrolment as soon as confirmation is received. If you need help, contact support and share this reference.`
      : error instanceof Error ? error.message : "Payment verification failed"
    const params = new URLSearchParams({ payment: paymentState, reason })
    if (reference) params.set("reference", reference)
    return NextResponse.redirect(`${returnBaseUrl}/checkout/prompt-to-profit?${params.toString()}`)
  }
}
