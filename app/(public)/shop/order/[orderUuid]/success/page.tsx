import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  PackageCheck,
  ShoppingBag
} from "lucide-react"

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
    <main className="relative flex min-h-[80vh] items-center justify-center bg-background py-16 lg:py-24">
      {/* Editorial Background Grid */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

      <div className="site-container relative z-10 w-full max-w-3xl">
        <section className="surface-raised bg-card px-6 py-12 text-center sm:px-12 sm:py-16">
          {order?.paymentStatus === "paid" ? (
            <>
              <div className="mx-auto mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-10 w-10" />
              </div>

              <p className="eyebrow inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-500"></span>
                </span>
                Payment Confirmed
              </p>

              <h1 className="mt-4 font-heading text-4xl font-black tracking-tight text-foreground sm:text-5xl">
                Thank you for your order.
              </h1>

              <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Your order number is <strong className="rounded bg-muted px-2 py-0.5 font-mono text-foreground">{order.orderNumber}</strong>. A receipt has been sent to your purchase email.
              </p>

              {/* Fulfillment Instructions Grid */}
              <div className="mx-auto mt-10 grid max-w-2xl gap-5 text-left sm:grid-cols-2">
                {hasDigital && (
                  <div
                    className={`rounded-2xl border border-border/60 bg-muted/30 p-6 text-center ${
                      !hasPhysical ? "sm:col-span-2 sm:mx-auto sm:w-full sm:max-w-sm" : ""
                    }`}
                  >
                    <div className="mx-auto mb-4 inline-flex rounded-lg bg-primary/10 p-2.5 text-primary">
                      <Download className="h-5 w-5" />
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <h3 className="font-heading text-lg font-black text-foreground">Digital Access</h3>
                      <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        PDF
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      Sign in with your purchase email to access and download your workbook instantly.
                    </p>
                  </div>
                )}

                {hasPhysical && (
                  <div className="rounded-2xl border border-border/60 bg-muted/30 p-6">
                    <div className="mb-4 inline-flex rounded-lg bg-emerald-500/10 p-2.5 text-emerald-600 dark:text-emerald-400">
                      <PackageCheck className="h-5 w-5" />
                    </div>
                    <h3 className="font-heading text-lg font-black text-foreground">Merchandise Order</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      Your order is currently being prepared. Delivery and tracking information will follow shortly.
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link href="/dashboard/purchases" className="btn-primary w-full justify-center px-8 py-4 text-base sm:w-auto">
                  View My Purchases <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link href="/shop" className="btn-secondary w-full justify-center px-8 py-4 text-base sm:w-auto">
                  <ShoppingBag className="mr-2 h-4 w-4" /> Continue Shopping
                </Link>
              </div>
            </>
          ) : (
            <>
              {/* Pending / Failed State */}
              <div className="mx-auto mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Clock className="h-10 w-10" />
              </div>
              <h1 className="font-heading text-3xl font-black tracking-tight text-foreground sm:text-4xl">
                We are confirming your order.
              </h1>
              <p className="mx-auto mt-4 max-w-lg text-lg leading-relaxed text-muted-foreground">
                This confirmation may take a moment. Please check your email or contact support with your order reference if you were charged but haven't received access.
              </p>
              <div className="mt-10">
                <Link href="/shop" className="btn-secondary inline-flex items-center px-8 py-4 text-base">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Return to the Shop
                </Link>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
