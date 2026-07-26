import { NextResponse } from "next/server"

import { initializeShopPayment } from "@/lib/payments/shop-checkout"
import { clientIpFromRequest, verifyRecaptchaToken } from "@/lib/recaptcha"
import {
  createPendingShopOrder,
  recordShopProviderReference
} from "@/lib/shop"
import { getStudentSession } from "@/lib/student-auth"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const recaptcha = await verifyRecaptchaToken({
      token: body.recaptchaToken,
      expectedAction: "shop_order_create",
      remoteip: clientIpFromRequest(request),
      request
    })
    if (!recaptcha.ok) {
      return NextResponse.json(
        { ok: false, error: "We could not verify this checkout. Please try again." },
        { status: 400 }
      )
    }

    const session = await getStudentSession()
    const result = await createPendingShopOrder({
      variantUuid: body.variantUuid,
      currency: body.currency,
      quantity: body.quantity,
      customerName: body.customerName,
      customerEmail: body.customerEmail,
      customerPhone: body.customerPhone,
      customerCountry: body.customerCountry,
      addressLine1: body.addressLine1,
      addressLine2: body.addressLine2,
      city: body.city,
      state: body.state,
      postalCode: body.postalCode,
      studentAccountId: session?.account.id || null
    })
    const payment = await initializeShopPayment({
      provider: result.order.paymentProvider,
      email: result.order.customerEmail,
      amountMinor: result.order.totalMinor,
      currency: result.order.currency,
      orderUuid: result.order.orderUuid,
      orderNumber: result.order.orderNumber,
      productName: `${result.product.title} — ${result.variant.title}`
    })
    await recordShopProviderReference({
      orderUuid: result.order.orderUuid,
      providerReference: payment.providerReference,
      providerOrderId: payment.providerOrderId
    })
    return NextResponse.json({
      ok: true,
      checkoutUrl: payment.checkoutUrl,
      orderUuid: result.order.orderUuid
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Checkout could not be started."
      },
      { status: 400 }
    )
  }
}
