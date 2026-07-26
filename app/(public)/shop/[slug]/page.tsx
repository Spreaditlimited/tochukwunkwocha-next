import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { BookOpen, ChevronRight, CircleCheck } from "lucide-react"

import { JsonLd } from "@/components/JsonLd"
import { ProductPurchasePanel } from "@/components/shop/ProductPurchasePanel"
import { ResourceArticleContent } from "@/components/resources/ResourceArticleContent"
import { getPublishedShopProduct, shopFaqs } from "@/lib/shop"
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
    image: product.coverImageUrl
  })
}

export default async function ShopProductPage({ params }: PageProps) {
  const { slug } = await params
  const product = await getPublishedShopProduct(slug)
  if (!product) notFound()
  const faqs = shopFaqs(product.faqJson)
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
      image: product.coverImageUrl,
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
    <main>
      <JsonLd data={structuredData} />
      <div className="site-container py-8 sm:py-12">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs font-bold text-muted-foreground">
          <Link href="/" className="no-underline hover:text-primary">Home</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href="/shop" className="no-underline hover:text-primary">Shop</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground">{product.title}</span>
        </nav>

        <section className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
          <div>
            <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-brand-ink">
              {product.coverImageUrl ? (
                <Image src={product.coverImageUrl} alt={`${product.title} cover`} fill priority className="object-contain p-6 sm:p-10" sizes="(min-width: 1024px) 60vw, 100vw" />
              ) : (
                <div className="flex h-full flex-col justify-between p-8 text-white sm:p-12">
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-sky-300">Prompt to Profit™ Workbook</p>
                  <BookOpen className="h-16 w-16 text-sky-300" />
                  <h1 className="max-w-2xl font-heading text-3xl font-black sm:text-5xl">{product.title}</h1>
                </div>
              )}
            </div>
            <div className="mt-8">
              <p className="eyebrow text-primary">Prompt to Profit™ Software Workbook</p>
              <h1 className="mt-3 font-heading text-3xl font-black tracking-tight text-foreground sm:text-5xl">
                {product.title}
              </h1>
              {product.subtitle ? <p className="mt-3 text-lg font-bold text-primary">{product.subtitle}</p> : null}
              <p className="mt-5 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                {product.shortDescription}
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {["Beginner friendly", "Complete build prompts", "Practical project outcome"].map((item) => (
                  <p key={item} className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <CircleCheck className="h-4 w-4 text-primary" /> {item}
                  </p>
                ))}
              </div>
            </div>
          </div>
          <div className="lg:sticky lg:top-28">
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
          </div>
        </section>

        {product.bodyContent ? (
          <section className="mt-14 grid gap-8 border-t border-border pt-12 lg:grid-cols-[220px_minmax(0,760px)]">
            <div>
              <p className="eyebrow text-primary">Inside the workbook</p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Everything you need to understand what you will build and how the workbook supports you.</p>
            </div>
            <ResourceArticleContent content={product.bodyContent} />
          </section>
        ) : null}

        {faqs.length ? (
          <section className="mt-14 max-w-4xl border-t border-border pt-12">
            <p className="eyebrow text-primary">Frequently asked questions</p>
            <h2 className="mt-2 font-heading text-3xl font-black text-foreground">Before you buy</h2>
            <div className="mt-6 divide-y divide-border rounded-lg border border-border bg-card px-5 sm:px-7">
              {faqs.map((faq) => (
                <details key={faq.question} className="group py-5">
                  <summary className="cursor-pointer list-none pr-8 text-sm font-black text-foreground">{faq.question}</summary>
                  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  )
}
