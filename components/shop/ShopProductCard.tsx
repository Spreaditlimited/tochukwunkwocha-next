import Image from "next/image"
import Link from "next/link"
import { ArrowRight, BookOpen, Box, Download } from "lucide-react"

import { formatShopMoney, shopProductImageUrl } from "@/lib/shop-format"

type CardProduct = {
  slug: string
  title: string
  subtitle: string | null
  shortDescription: string
  coverImageUrl: string | null
  variants: Array<{
    priceMinor: number
    currency: string
    fulfillmentType: string
    prices: Array<{ amountMinor: number; currency: string; active: boolean }>
  }>
}

export function ShopProductCard({
  product,
  dashboard = false
}: {
  product: CardProduct
  dashboard?: boolean
}) {
  const prices = product.variants
    .flatMap((variant) => variant.prices)
    .filter((price) => price.active && price.amountMinor > 0)

  const nairaPrice = prices.find((price) => price.currency === "NGN")

  const internationalPrices = ["USD", "GBP", "EUR"]
    .map((currency) => prices.find((price) => price.currency === currency))
    .filter((price): price is NonNullable<typeof price> => Boolean(price))

  const digital = product.variants.some((variant) => variant.fulfillmentType === "digital")
  const physical = product.variants.some((variant) => variant.fulfillmentType === "physical")
  const imageUrl = shopProductImageUrl(product.coverImageUrl)

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5">

      {/* Visual / Image Section */}
      <div className="relative aspect-[4/3] overflow-hidden bg-brand-ink">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={`${product.title} workbook mockup`}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
            sizes={dashboard ? "(min-width: 1024px) 28vw, 90vw" : "(min-width: 1024px) 30vw, 90vw"}
          />
        ) : (
          <div className="flex h-full flex-col justify-between p-8 text-white">
            <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-sky-300">
              <BookOpen className="h-3.5 w-3.5" /> Prompt to Profit™
            </span>
            <span className="font-heading text-2xl font-black leading-tight sm:text-3xl">
              {product.title}
            </span>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="flex flex-1 flex-col p-6 sm:p-8">

        {/* Fulfillment Badges */}
        <div className="mb-5 flex flex-wrap gap-2">
          {digital && (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-sky-700 dark:text-sky-400">
                <Download className="h-3 w-3" /> Digital Access
              </span>
              <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                PDF
              </span>
            </>
          )}
          {physical && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">
              <Box className="h-3 w-3" /> Merchandise
            </span>
          )}
        </div>

        {/* Title & Subtitle */}
        <h2 className="font-heading text-xl font-black leading-tight tracking-tight text-foreground transition-colors group-hover:text-primary">
          <Link
            href={`/shop/${product.slug}`}
            className="outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 before:absolute before:inset-0"
          >
            {product.title}
          </Link>
        </h2>

        {product.subtitle && (
          <p className="mt-2 text-sm font-bold text-primary">
            {product.subtitle}
          </p>
        )}

        <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground line-clamp-3">
          {product.shortDescription}
        </p>

        {/* Footer: Pricing & Action */}
        <div className="mt-8 flex items-end justify-between gap-4 border-t border-border/50 pt-6">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {nairaPrice ? "Investment" : "Status"}
            </p>
            {nairaPrice ? (
              <p className="font-heading text-2xl font-black text-foreground">
                {formatShopMoney(nairaPrice.amountMinor, nairaPrice.currency)}
              </p>
            ) : (
              <p className="font-heading text-lg font-black text-foreground">
                Coming Soon
              </p>
            )}

            {internationalPrices.length > 0 && (
              <p className="mt-1 text-[10px] font-bold tracking-widest text-muted-foreground">
                {internationalPrices.map((price) => formatShopMoney(price.amountMinor, price.currency)).join(" · ")}
              </p>
            )}
          </div>

          <div
            aria-hidden="true"
            className="pointer-events-none relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
          >
            <ArrowRight className="h-4 w-4 transition-transform group-hover:-rotate-45" />
          </div>
        </div>

      </div>
    </article>
  )
}
