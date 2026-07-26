import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  FileText
} from "lucide-react"

import { JsonLd } from "@/components/JsonLd"
import { ProductPurchasePanel } from "@/components/shop/ProductPurchasePanel"
import { ResourceArticleContent } from "@/components/resources/ResourceArticleContent"
import { getPublishedShopProduct, shopFaqs } from "@/lib/shop"
import { shopProductImageUrl } from "@/lib/shop-format"
import {
  breadcrumbJsonLd,
  buildMetadata,
  productJsonLd
} from "@/lib/site-seo"

export const dynamic = "force-dynamic"

type PageProps = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const product = await getPublishedShopProduct(slug)

  if (!product) {
    return buildMetadata({
      title: "Product not found",
      description: "This shop product is not available.",
      path: `/shop/${slug}`,
      noIndex: true
    })
  }

  return buildMetadata({
    title: product.seoTitle || product.title,
    description: product.seoDescription || product.shortDescription,
    path: `/shop/${product.slug}`,
    image: shopProductImageUrl(product.coverImageUrl)
  })
}

const sectionContainer = "site-container"

export default async function ShopProductPage({ params }: PageProps) {
  const { slug } = await params
  const product = await getPublishedShopProduct(slug)

  if (!product) notFound()

  const faqs = shopFaqs(product.faqJson)
  const productImageUrl = shopProductImageUrl(product.coverImageUrl)

  const structuredData: Array<Record<string, unknown>> = [
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Shop", path: "/shop" },
      { name: product.title, path: `/shop/${product.slug}` }
    ]),
    productJsonLd({
      title: product.title,
      description: product.shortDescription,
      path: `/shop/${product.slug}`,
      image: productImageUrl,
      variants: product.variants.flatMap((variant) =>
        variant.prices
          .filter((price) => price.active)
          .map((price) => ({
            variantUuid: `${variant.variantUuid}-${price.currency}`,
            title: `${variant.title} (${price.currency})`,
            priceMinor: price.amountMinor,
            currency: price.currency,
            available:
              !(
                variant.fulfillmentType === "physical" &&
                variant.inventoryPolicy === "deny" &&
                variant.stockQuantity !== null &&
                variant.stockQuantity <= 0
              )
          }))
      )
    })
  ]

  if (faqs.length) {
    structuredData.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer }
      }))
    })
  }

  return (
    <main className="relative bg-background">
      <JsonLd data={structuredData} />

      {/* Editorial Background Grid */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

      <div className={`${sectionContainer} py-12 lg:py-16`}>

        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="mb-8 flex flex-wrap items-center gap-2 text-xs font-bold text-muted-foreground">
          <Link href="/" className="transition-colors hover:text-primary">Home</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href="/shop" className="transition-colors hover:text-primary">Shop</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground">{product.title}</span>
        </nav>

        {/* Main Product Section */}
        <section className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px] lg:items-start lg:gap-16">

          <div className="min-w-0">
            {/* Product Cover Asset */}
            <div className="surface-raised relative aspect-[4/3] w-full overflow-hidden bg-[#eef3fa]">
              {productImageUrl ? (
                <Image
                  src={productImageUrl}
                  alt={`${product.title} workbook mockup`}
                  fill
                  priority
                  className="object-contain"
                  sizes="(min-width: 1024px) 60vw, 100vw"
                />
              ) : (
                <div className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-brand-ink p-8 text-white sm:p-12">
                  <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-[80px]" />
                  <div className="relative z-10 flex h-full flex-col justify-between">
                    <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-sky-300">
                      <BookOpen className="h-4 w-4" /> Prompt to Profit™ Workbook
                    </p>
                    <h1 className="max-w-2xl font-heading text-3xl font-black leading-tight sm:text-5xl">
                      {product.title}
                    </h1>
                  </div>
                </div>
              )}
            </div>

            {/* Product Header Copy */}
            <div className="mt-10 sm:mt-12">
              <span className="eyebrow mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-primary">
                <FileText className="h-3.5 w-3.5" />
                Prompt to Profit™ Software Workbook
              </span>

              <h1 className="font-heading text-4xl font-black leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                {product.title}
              </h1>

              {product.subtitle && (
                <p className="mt-4 text-xl font-bold text-primary">
                  {product.subtitle}
                </p>
              )}

              <p className="mt-6 text-lg leading-relaxed text-muted-foreground sm:text-xl">
                {product.shortDescription}
              </p>

              {/* Feature Pills */}
              <div className="mt-8 flex flex-wrap gap-3">
                {["Beginner friendly", "Complete build prompts", "Practical project outcome"].map((item) => (
                  <div key={item} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs font-bold text-foreground sm:text-sm">
                    <CircleCheck className="h-4 w-4 text-primary" /> {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sticky Checkout Panel */}
          <aside className="lg:sticky lg:top-24">
            <ProductPurchasePanel
              variants={product.variants.map((variant) => ({
                variantUuid: variant.variantUuid,
                title: variant.title,
                fulfillmentType: variant.fulfillmentType,
                priceMinor: variant.priceMinor,
                currency: variant.currency,
                stockQuantity: variant.stockQuantity,
                inventoryPolicy: variant.inventoryPolicy,
                prices: variant.prices.map((price) => ({
                  amountMinor: price.amountMinor,
                  currency: price.currency,
                  active: price.active
                }))
              }))}
              productTitle={product.title}
            />
          </aside>

        </section>

        {/* Long-form Editorial Body Content */}
        {product.bodyContent && (
          <section className="mt-20 grid gap-10 border-t border-border pt-16 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16">
            <div>
              <div className="sticky top-24">
                <p className="eyebrow inline-flex items-center gap-2 text-primary">
                  <BookOpen className="h-4 w-4" /> Inside the Workbook
                </p>
                <h2 className="mt-3 font-heading text-2xl font-black text-foreground">
                  What you'll learn
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  Everything you need to understand what you will build and how the workbook supports your learning process.
                </p>
              </div>
            </div>

            <div className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-heading prose-headings:font-black prose-a:text-primary hover:prose-a:text-primary/80">
              <ResourceArticleContent content={product.bodyContent} />
            </div>
          </section>
        )}

      </div>

      {/* FAQs */}
      {faqs.length > 0 && (
        <section className="mt-20 bg-muted/20 py-20 lg:py-28">
          <div className="mx-auto w-full max-w-3xl px-5 sm:px-6 lg:px-8">
            <div className="mb-12 text-center">
              <h2 className="font-heading text-3xl font-black tracking-tight">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="flex flex-col border-t border-border">
              {faqs.map((faq) => (
                <details
                  key={faq.question}
                  className="group border-b border-border [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="flex cursor-pointer items-center justify-between gap-4 py-6 font-heading text-lg font-bold text-foreground transition-colors hover:text-primary">
                    <span>{faq.question}</span>
                    <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-300 group-open:rotate-180" />
                  </summary>
                  <div className="pb-8 text-base leading-relaxed text-muted-foreground">
                    {faq.answer}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  )
}
