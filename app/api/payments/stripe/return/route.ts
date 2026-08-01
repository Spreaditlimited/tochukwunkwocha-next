import { NextResponse } from "next/server"

import { sendCourseOrderMetaPurchase } from "@/lib/meta-events"
import { createAffiliateCommissionForOrder, markCourseOrderPaid, retrieveStripeSession, siteBaseUrl } from "@/lib/payments/course-checkout"
import { provisionStudentForPaidOrder } from "@/lib/payments/post-payment-student"
import { setStudentSessionCookie } from "@/lib/student-auth"
import { isCourseEnrollmentConflict } from "@/lib/enrollment-guard"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const sessionId = url.searchParams.get("session_id") || ""

  try {
    if (!sessionId) throw new Error("Missing Stripe session.")
    const session = await retrieveStripeSession(sessionId)
    if (!session.orderUuid) throw new Error("Stripe session is missing order UUID.")
    const order = await markCourseOrderPaid({
      orderUuid: session.orderUuid,
      providerReference: session.id,
      providerOrderId: session.id
    })
    const provisioned = await provisionStudentForPaidOrder(order)
    if (!provisioned?.account) throw new Error("The paid enrollment account could not be provisioned.")
    await createAffiliateCommissionForOrder(session.orderUuid).catch((error) => {
      console.error("[stripe-return] affiliate commission failed after enrollment provisioning", {
        orderUuid: session.orderUuid,
        error: error instanceof Error ? error.message : String(error)
      })
    })
    await sendCourseOrderMetaPurchase({
      orderUuid: session.orderUuid,
      eventSourceUrl: `${siteBaseUrl()}/checkout/${String(order?.course_slug || session.courseSlug || "prompt-to-profit")}`
    }).catch(() => null)
    if (provisioned?.token) await setStudentSessionCookie(provisioned.token)

    const params = new URLSearchParams({
      payment: "success",
      course_slug: String(order?.course_slug || session.courseSlug || "prompt-to-profit"),
      order: session.orderUuid
    })
    const successPath = String(order?.buyer_type || "").toLowerCase() === "family" ? "/dashboard/family" : "/dashboard"
    return NextResponse.redirect(`${siteBaseUrl()}${successPath}?${params.toString()}`)
  } catch (error) {
    const paymentState = isCourseEnrollmentConflict(error) ? "duplicate_review" : "failed"
    return NextResponse.redirect(`${siteBaseUrl()}/checkout/prompt-to-profit?payment=${paymentState}&reason=${encodeURIComponent(error instanceof Error ? error.message : "Payment verification failed")}`)
  }
}
