import { reportPaymentProviderIssue } from "@/lib/payment-provider-alerts"
import { initializePaystack } from "@/lib/payments/course-checkout"
import { absoluteUrl } from "@/lib/site-seo"

export async function initializeShopPayment(input: {
  provider: string
  email: string
  amountMinor: number
  currency: string
  orderUuid: string
  orderNumber: string
  productName: string
}) {
  const metadata = {
    payment_scope: "shop_order",
    order_uuid: input.orderUuid,
    order_number: input.orderNumber
  }
  if (input.provider === "paystack") {
    return initializePaystack({
      email: input.email,
      amountMinor: input.amountMinor,
      reference: `SHOP-${input.orderUuid}`,
      callbackUrl: absoluteUrl(
        `/api/shop/payments/paystack/return?order=${encodeURIComponent(input.orderUuid)}`
      ),
      metadata
    })
  }

  const secret = String(process.env.STRIPE_SECRET_KEY || "").trim()
  const customerMessage = "Card checkout is temporarily unavailable. Please try again shortly."
  if (!secret) {
    await reportPaymentProviderIssue({
      provider: "stripe",
      operation: "shop checkout initialization",
      summary: "STRIPE_SECRET_KEY is missing.",
      reference: input.orderUuid,
      errorCode: "missing_secret_key"
    })
    throw new Error(customerMessage)
  }

  const params = new URLSearchParams()
  params.set("mode", "payment")
  params.set("customer_email", input.email)
  params.set(
    "success_url",
    absoluteUrl(
      `/api/shop/payments/stripe/return?order=${encodeURIComponent(input.orderUuid)}&session_id={CHECKOUT_SESSION_ID}`
    )
  )
  params.set("cancel_url", absoluteUrl(`/shop/checkout?cancelled=1`))
  params.set("line_items[0][quantity]", "1")
  params.set("line_items[0][price_data][currency]", input.currency.toLowerCase())
  params.set("line_items[0][price_data][unit_amount]", String(input.amountMinor))
  params.set("line_items[0][price_data][product_data][name]", input.productName)
  params.set("client_reference_id", input.orderUuid)
  for (const [key, value] of Object.entries(metadata)) {
    params.set(`metadata[${key}]`, value)
    params.set(`payment_intent_data[metadata][${key}]`, value)
  }

  let response: Response
  try {
    response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    })
  } catch (error) {
    await reportPaymentProviderIssue({
      provider: "stripe",
      operation: "shop checkout initialization",
      summary: "The request to Stripe failed.",
      reference: input.orderUuid,
      errorType: "network_error",
      errorMessage: error instanceof Error ? error.message : String(error)
    })
    throw new Error(customerMessage)
  }
  const json = await response.json().catch(() => null)
  if (!response.ok || !json?.id || !json?.url) {
    await reportPaymentProviderIssue({
      provider: "stripe",
      operation: "shop checkout initialization",
      summary: "Stripe rejected the shop checkout initialization request.",
      reference: input.orderUuid,
      status: response.status,
      requestId: response.headers.get("request-id"),
      errorType: json?.error?.type || null,
      errorCode: json?.error?.code || null,
      errorMessage: json?.error?.message || `Stripe Checkout failed (${response.status})`
    })
    throw new Error(customerMessage)
  }
  return {
    checkoutUrl: String(json.url),
    providerReference: String(json.id),
    providerOrderId: null
  }
}
