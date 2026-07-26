import type { Metadata } from "next"
import Link from "next/link"
import { CheckCircle2, Download, PackageCheck } from "lucide-react"

import { getShopOrderConfirmation } from "@/lib/shop"
import { buildMetadata } from "@/lib/site-seo"

export const dynamic = "force-dynamic"

export const metadata: Metadata = buildMetadata({
  title: "Shop Order Confirmation",
  description: "Your shop order confirmation.",
  path: "/shop/order/success",
  noIndex: true
})

export default async function ShopOrderSuccessPage({
  params
}: {
  params: Promise<{ orderUuid: string }>
}) {
  const { orderUuid } = await params
  const order = await getShopOrderConfirmation(orderUuid)
  const hasDigital = order?.items.some((item) => item.fulfillmentTypeSnapshot === "digital")
  const hasPhysical = order?.items.some((item) => item.fulfillmentTypeSnapshot === "physical")

  return (
    <main className="bg-muted/25 py-16">
      <div className="site-container max-w-3xl">
        <section className="rounded-lg border border-border bg-card p-7 text-center shadow-lg sm:p-10">
          {order?.paymentStatus === "paid" ? (
            <>
              <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
              <p className="eyebrow mt-5 text-primary">Payment confirmed</p>
              <h1 className="mt-2 font-heading text-3xl font-black text-foreground">Thank you for your order</h1>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Your order number is <strong className="text-foreground">{order.orderNumber}</strong>. A confirmation has been sent to your purchase email.
              </p>
              <div className="mx-auto mt-7 grid max-w-xl gap-4 text-left sm:grid-cols-2">
                {hasDigital ? (
                  <div className="rounded-lg border border-border bg-muted/25 p-4">
                    <Download className="h-5 w-5 text-primary" />
                    <p className="mt-2 text-sm font-black text-foreground">Digital access</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Sign in with your purchase email to download your workbook.</p>
                  </div>
                ) : null}
                {hasPhysical ? (
                  <div className="rounded-lg border border-border bg-muted/25 p-4">
                    <PackageCheck className="h-5 w-5 text-primary" />
                    <p className="mt-2 text-sm font-black text-foreground">Printed order</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Your order is being prepared. Delivery information will follow.</p>
                  </div>
                ) : null}
              </div>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link href="/dashboard/purchases" className="btn-primary">View My Purchases</Link>
                <Link href="/shop" className="btn-secondary">Continue shopping</Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="font-heading text-2xl font-black text-foreground">We are confirming your order</h1>
              <p className="mt-3 text-sm text-muted-foreground">The confirmation may take a moment. Check your email or contact support with your order reference if you were charged.</p>
              <Link href="/shop" className="btn-secondary mt-6">Return to the shop</Link>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
