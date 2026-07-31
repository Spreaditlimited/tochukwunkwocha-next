import { NextResponse } from "next/server"

import { sendCourseOrderMetaPurchase } from "@/lib/meta-events"
import { createAffiliateCommissionForOrder, markCourseOrderPaid, siteBaseUrl, verifyPaystackTransaction } from "@/lib/payments/course-checkout"
import { provisionStudentForPaidOrder } from "@/lib/payments/post-payment-student"
import { recordPaystackAuditEvent, validateCourseOrderPaystackPayment } from "@/lib/payments/paystack-audit"
import { setStudentSessionCookie } from "@/lib/student-auth"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const reference = url.searchParams.get("reference") || url.searchParams.get("trxref") || ""
  let orderUuid = ""

  try {
    if (!reference) throw new Error("Missing Paystack reference.")
    const verified = await verifyPaystackTransaction(reference)
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
    await createAffiliateCommissionForOrder(orderUuid)
    const provisioned = await provisionStudentForPaidOrder(order)
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
    const successPath = String(order?.buyer_type || "").toLowerCase() === "family" ? "/dashboard/family" : "/dashboard"
    return NextResponse.redirect(`${siteBaseUrl()}${successPath}?${params.toString()}`)
  } catch (error) {
    await recordPaystackAuditEvent({
      orderUuid: orderUuid || null,
      providerReference: reference || null,
      source: "return",
      eventType: "transaction.return",
      outcome: "failed",
      errorCode: "return_verification_failed",
      errorMessage: error instanceof Error ? error.message : String(error)
    })
    return NextResponse.redirect(`${siteBaseUrl()}/checkout/prompt-to-profit?payment=failed&reason=${encodeURIComponent(error instanceof Error ? error.message : "Payment verification failed")}`)
  }
}
