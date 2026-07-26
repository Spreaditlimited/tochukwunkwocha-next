import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, BookOpenCheck, PackageCheck, ShieldCheck } from "lucide-react"

import { ShopProductCard } from "@/components/shop/ShopProductCard"
import { listPublishedShopProducts } from "@/lib/shop"
import { buildMetadata } from "@/lib/site-seo"

export const dynamic = "force-dynamic"

export const metadata: Metadata = buildMetadata({
  title: "Shop | Practical AI Workbooks and Learning Products",
  description:
    "Shop practical Prompt to Profit workbooks and learning products from Tochukwu Tech and AI Academy.",
  path: "/shop"
})

export default async function ShopPage() {
  const products = await listPublishedShopProducts()

  return (
    <main>
      <section className="border-b border-border bg-muted/25 py-16 sm:py-20">
        <div className="site-container">
          <div className="max-w-3xl">
            <p className="eyebrow text-primary">Tochukwu Tech and AI Academy Shop</p>
            <h1 className="mt-4 font-heading text-4xl font-black tracking-tight text-foreground sm:text-5xl">
              Practical tools for people who want to build.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Learn at your own pace with beginner-friendly workbooks that guide you from an idea to a working business application.
            </p>
            <div className="mt-8 flex flex-wrap gap-5 text-sm font-bold text-muted-foreground">
              <span className="inline-flex items-center gap-2"><BookOpenCheck className="h-4 w-4 text-primary" /> Step-by-step guidance</span>
              <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Secure checkout</span>
              <span className="inline-flex items-center gap-2"><PackageCheck className="h-4 w-4 text-primary" /> Digital and printed formats</span>
            </div>
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-18">
        <div className="site-container">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow text-primary">Prompt to Profit™ Series</p>
              <h2 className="mt-2 font-heading text-3xl font-black text-foreground">Software workbooks</h2>
            </div>
            <Link href="/courses/prompt-to-profit" className="inline-flex items-center gap-2 text-sm font-black text-primary no-underline">
              Explore the complete programme <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {products.length ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => (
                <ShopProductCard key={product.productUuid} product={product} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
              <BookOpenCheck className="mx-auto h-10 w-10 text-primary" />
              <h2 className="mt-4 font-heading text-xl font-black text-foreground">Products are being prepared</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                The first Prompt to Profit™ workbooks will appear here as soon as pricing and availability are confirmed.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
