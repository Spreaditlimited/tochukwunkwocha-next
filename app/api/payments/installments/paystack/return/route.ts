import { NextResponse } from "next/server"

import { markInstallmentPaymentPaid, siteBaseUrl, verifyPaystackTransaction } from "@/lib/payments/course-checkout"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const reference = String(url.searchParams.get("reference") || url.searchParams.get("trxref") || "").trim()
  if (!reference) return NextResponse.redirect(`${siteBaseUrl()}/dashboard/installments?payment=failed`)
  try {
    const tx = await verifyPaystackTransaction(reference)
    await markInstallmentPaymentPaid(tx.reference, tx.providerOrderId)
    return NextResponse.redirect(`${siteBaseUrl()}/dashboard/installments?payment=success`)
  } catch (_error) {
    return NextResponse.redirect(`${siteBaseUrl()}/dashboard/installments?payment=failed`)
  }
}
