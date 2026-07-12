import { NextResponse } from "next/server"

import { sendCourseOrderMetaPurchase } from "@/lib/meta-events"
import { markCourseOrderPaid, retrieveStripeSession, siteBaseUrl } from "@/lib/payments/course-checkout"
import { provisionStudentForPaidOrder } from "@/lib/payments/post-payment-student"
import { setStudentSessionCookie } from "@/lib/student-auth"

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
    return NextResponse.redirect(`${siteBaseUrl()}/dashboard?${params.toString()}`)
  } catch (error) {
    return NextResponse.redirect(`${siteBaseUrl()}/checkout/prompt-to-profit?payment=failed&reason=${encodeURIComponent(error instanceof Error ? error.message : "Payment verification failed")}`)
  }
}
