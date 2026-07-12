import { NextResponse } from "next/server"

import { sendCourseOrderMetaPurchase } from "@/lib/meta-events"
import { markCourseOrderPaid, siteBaseUrl, verifyPaystackTransaction } from "@/lib/payments/course-checkout"
import { provisionStudentForPaidOrder } from "@/lib/payments/post-payment-student"
import { setStudentSessionCookie } from "@/lib/student-auth"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const reference = url.searchParams.get("reference") || url.searchParams.get("trxref") || ""

  try {
    if (!reference) throw new Error("Missing Paystack reference.")
    const verified = await verifyPaystackTransaction(reference)
    const orderUuid = String(verified.metadata?.order_uuid || verified.metadata?.orderUuid || "")
    const courseSlug = String(verified.metadata?.course_slug || verified.metadata?.courseSlug || "")
    if (!orderUuid) throw new Error("Payment metadata is missing order UUID.")
    const order = await markCourseOrderPaid({
      orderUuid,
      providerReference: verified.reference,
      providerOrderId: verified.providerOrderId
    })
    const provisioned = await provisionStudentForPaidOrder(order)
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
    return NextResponse.redirect(`${siteBaseUrl()}/dashboard?${params.toString()}`)
  } catch (error) {
    return NextResponse.redirect(`${siteBaseUrl()}/checkout/prompt-to-profit?payment=failed&reason=${encodeURIComponent(error instanceof Error ? error.message : "Payment verification failed")}`)
  }
}
