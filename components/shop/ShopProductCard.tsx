import Image from "next/image"
import Link from "next/link"
import { ArrowRight, BookOpen, Box, Download } from "lucide-react"

import { formatShopMoney } from "@/lib/shop-format"

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

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg">
      <Link
        href={`/shop/${product.slug}`}
        className="relative block aspect-[4/3] overflow-hidden bg-brand-ink no-underline"
      >
        {product.coverImageUrl ? (
          <Image
            src={product.coverImageUrl}
            alt={`${product.title} cover`}
            fill
            className="object-contain p-5 transition duration-300 group-hover:scale-[1.02]"
            sizes={dashboard ? "(min-width: 1024px) 28vw, 90vw" : "(min-width: 1024px) 30vw, 90vw"}
          />
        ) : (
          <div className="flex h-full flex-col justify-between p-6 text-white">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-sky-300">
              Prompt to Profit™
            </span>
            <BookOpen className="h-12 w-12 text-sky-300" />
            <span className="font-heading text-xl font-black">{product.title}</span>
          </div>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex flex-wrap gap-2">
          {digital ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-sky-700 dark:text-sky-300">
              <Download className="h-3 w-3" /> Digital
            </span>
          ) : null}
          {physical ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
              <Box className="h-3 w-3" /> Printed
            </span>
          ) : null}
        </div>
        <h2 className="font-heading text-xl font-black tracking-tight text-foreground">
          <Link href={`/shop/${product.slug}`} className="no-underline hover:text-primary">
            {product.title}
          </Link>
        </h2>
        {product.subtitle ? (
          <p className="mt-1 text-sm font-bold text-primary">{product.subtitle}</p>
        ) : null}
        <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
          {product.shortDescription}
        </p>
        <div className="mt-5 flex items-end justify-between gap-4 border-t border-border pt-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {nairaPrice ? "Digital workbook" : "Coming soon"}
            </p>
            {nairaPrice ? (
              <p className="mt-1 font-heading text-lg font-black text-foreground">
                {formatShopMoney(nairaPrice.amountMinor, nairaPrice.currency)}
              </p>
            ) : null}
            {internationalPrices.length ? (
              <p className="mt-1 text-[10px] font-bold text-muted-foreground">
                {internationalPrices.map((price) => formatShopMoney(price.amountMinor, price.currency)).join(" · ")}
              </p>
            ) : null}
          </div>
          <Link
            href={`/shop/${product.slug}`}
            className="inline-flex items-center gap-1.5 text-sm font-black text-primary no-underline"
          >
            View details <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  )
}
