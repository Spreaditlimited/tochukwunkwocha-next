import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, BookOpenCheck, PackageCheck, ShieldCheck, ShoppingBag } from "lucide-react"

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

const sectionContainer = "site-container"

export default async function ShopPage() {
  const products = await listPublishedShopProducts()

  return (
    <main className="bg-background">

      {/* Editorial Hero Section */}
      <section className="relative overflow-hidden bg-brand-ink pt-16 text-white lg:pt-24">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-sky/15 blur-[150px]" />

        <div className={`${sectionContainer} relative z-10 pb-16 lg:pb-24`}>
          <div className="mx-auto max-w-4xl text-center">
            <p className="eyebrow mb-6 inline-flex items-center gap-2 rounded-full border border-brand-sky/30 bg-brand-sky/10 px-4 py-1.5 text-brand-sky">
              <ShoppingBag className="h-4 w-4" />
              Academy Shop
            </p>
            <h1 className="font-heading text-5xl font-black tracking-tighter text-white sm:text-6xl lg:text-7xl lg:leading-[1.1]">
              Practical tools for people who want to{" "}
              <span className="bg-gradient-to-r from-brand-sky to-primary bg-clip-text text-transparent">
                build.
              </span>
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-slate-300 sm:text-xl">
              Learn at your own pace with beginner-friendly workbooks that guide you from an idea to a working business application.
            </p>

            {/* Trust Indicators */}
            <div className="mt-10 flex flex-wrap justify-center gap-4 sm:gap-6">
              <div className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200">
                <BookOpenCheck className="h-4 w-4 text-brand-sky" />
                Step-by-step guidance
              </div>
              <div className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200">
                <PackageCheck className="h-4 w-4 text-brand-sky" />
                Digital format
              </div>
              <div className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200">
                <ShieldCheck className="h-4 w-4 text-brand-sky" />
                Secure checkout
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Products Grid */}
      <section className="py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="mb-12 flex flex-col items-start justify-between gap-6 border-b border-border pb-6 md:flex-row md:items-end">
            <div>
              <p className="eyebrow">Prompt to Profit™ Series</p>
              <h2 className="mt-3 font-heading text-3xl font-black tracking-tight lg:text-4xl">
                Software Workbooks
              </h2>
            </div>
            <Link
              href="/courses/prompt-to-profit"
              className="group inline-flex items-center text-sm font-bold text-foreground transition-colors hover:text-primary"
            >
              Explore the complete programme <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          {products.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <ShopProductCard key={product.productUuid} product={product} />
              ))}
            </div>
          ) : (
            <div className="surface-raised flex flex-col items-center justify-center bg-card p-16 text-center">
              <BookOpenCheck className="mb-4 h-10 w-10 text-muted-foreground/50" />
              <p className="font-heading text-xl font-bold">Products are being prepared.</p>
              <p className="mt-2 max-w-md text-muted-foreground">
                The first Prompt to Profit™ workbooks will appear here as soon as pricing and availability are confirmed.
              </p>
            </div>
          )}
        </div>
      </section>

    </main>
  )
}
