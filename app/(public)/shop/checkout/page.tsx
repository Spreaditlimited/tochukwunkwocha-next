import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { ShopCheckoutForm } from "@/components/shop/ShopCheckoutForm"
import { calculateShopPricing, getPublishedShopVariant } from "@/lib/shop"
import { buildMetadata } from "@/lib/site-seo"
import { getStudentSession } from "@/lib/student-auth"

export const dynamic = "force-dynamic"

export const metadata: Metadata = buildMetadata({
  title: "Secure Shop Checkout",
  description: "Complete your shop purchase securely.",
  path: "/shop/checkout",
  noIndex: true
})

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ShopCheckoutPage({ searchParams }: PageProps) {
  const params = await searchParams
  const variantUuid = Array.isArray(params.variant) ? params.variant[0] : params.variant
  const currencyParam = Array.isArray(params.currency) ? params.currency[0] : params.currency
  const variant = variantUuid ? await getPublishedShopVariant(variantUuid) : null
  const currency =
    String(currencyParam || "NGN").toUpperCase()
  const pricing = variant
    ? await calculateShopPricing({ variant, currency, quantity: 1 })
    : null
  const session = await getStudentSession()

  return (
    <main className="min-h-screen bg-muted/20 pb-24 pt-10 lg:pt-14">
      <div className="site-container">
        <Link href={variant ? `/shop/${variant.product.slug}` : "/shop"} className="group inline-flex items-center text-sm font-bold text-muted-foreground no-underline transition-colors hover:text-primary">
          <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to {variant ? "Product Details" : "Shop"}
        </Link>
        <div className="mt-8">
          {variant && pricing ? (
            <ShopCheckoutForm
              variant={variant}
              pricing={pricing}
              initialCustomer={
                session
                  ? { name: session.account.fullName, email: session.account.email }
                  : null
              }
            />
          ) : (
            <div className="rounded-lg border border-border bg-card p-10 text-center shadow-sm">
              <h1 className="font-heading text-2xl font-black text-foreground">Choose a product first</h1>
              <p className="mt-3 text-sm text-muted-foreground">Your checkout link is incomplete or the selected format is no longer available.</p>
              <Link href="/shop" className="btn-primary mt-6">Return to the shop</Link>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
