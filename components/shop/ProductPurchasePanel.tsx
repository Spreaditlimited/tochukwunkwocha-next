"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, Box, CheckCircle2, Download, ShieldCheck } from "lucide-react"

import { formatShopMoney } from "@/lib/shop-format"
import { cn } from "@/lib/utils"

type Variant = {
  variantUuid: string
  title: string
  fulfillmentType: string
  priceMinor: number
  currency: string
  stockQuantity: number | null
  inventoryPolicy: string
  prices: Array<{ amountMinor: number; currency: string; active: boolean }>
}

export function ProductPurchasePanel({
  variants,
  productTitle
}: {
  variants: Variant[]
  productTitle: string
}) {
  const available = useMemo(
    () =>
      variants.filter(
        (variant) =>
          variant.prices.some((price) => price.active && price.amountMinor > 0) &&
          !(
            variant.fulfillmentType === "physical" &&
            variant.inventoryPolicy === "deny" &&
            variant.stockQuantity !== null &&
            variant.stockQuantity <= 0
          )
      ),
    [variants]
  )
  const [selectedUuid, setSelectedUuid] = useState(available[0]?.variantUuid || "")
  const [currency, setCurrency] = useState("NGN")
  const selected = available.find((variant) => variant.variantUuid === selectedUuid)
  const availablePrices = selected?.prices.filter((price) => price.active && price.amountMinor > 0) || []
  const selectedPrice =
    availablePrices.find((price) => price.currency === currency) || availablePrices[0]

  return (
    <aside className="rounded-lg border border-border bg-card p-5 shadow-xl shadow-black/5 sm:p-6">
      <p className="eyebrow text-primary">Choose your format</p>
      <h2 className="mt-2 font-heading text-xl font-black text-foreground">{productTitle}</h2>
      {available.length ? (
        <>
          <div className="mt-5 space-y-3" role="radiogroup" aria-label="Product format">
            {available.map((variant) => {
              const selectedOption = selectedUuid === variant.variantUuid
              const Icon = variant.fulfillmentType === "physical" ? Box : Download
              return (
                <button
                  key={variant.variantUuid}
                  type="button"
                  role="radio"
                  aria-checked={selectedOption}
                  onClick={() => setSelectedUuid(variant.variantUuid)}
                  className={cn(
                    "flex w-full items-center justify-between gap-4 rounded-lg border p-4 text-left transition",
                    selectedOption
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-background hover:border-primary/40"
                  )}
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-black text-foreground">{variant.title}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {variant.fulfillmentType === "digital"
                          ? "Secure download after payment"
                          : "Delivery within Nigeria"}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-black text-foreground">
                    {selectedUuid === variant.variantUuid && selectedPrice
                      ? formatShopMoney(selectedPrice.amountMinor, selectedPrice.currency)
                      : "Choose"}
                  </span>
                </button>
              )
            })}
          </div>
          {availablePrices.length ? (
            <div className="mt-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pay in</p>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {availablePrices.map((price) => (
                  <button
                    key={price.currency}
                    type="button"
                    onClick={() => setCurrency(price.currency)}
                    className={cn(
                      "rounded-md border px-2 py-2 text-xs font-black transition",
                      selectedPrice?.currency === price.currency
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    {price.currency}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {selected && selectedPrice ? (
            <Link
              href={`/shop/checkout?variant=${encodeURIComponent(selected.variantUuid)}&currency=${encodeURIComponent(selectedPrice.currency)}`}
              className="btn-primary mt-5 w-full justify-center py-3.5"
            >
              Continue to checkout <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
          <div className="mt-5 space-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
            <p className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Secure payment with Paystack or Stripe
            </p>
            <p className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" /> Purchase linked to your email
            </p>
          </div>
        </>
      ) : (
        <div className="mt-5 rounded-lg border border-dashed border-border bg-muted/30 p-5 text-sm leading-relaxed text-muted-foreground">
          Purchasing will open soon. This product can be published now while its price and formats are being prepared.
        </div>
      )}
    </aside>
  )
}
