export type CoursePriceValues = {
  priceNgnMinor?: number | null
  priceUsdMinor?: number | null
  priceGbpMinor?: number | null
  priceEurMinor?: number | null
}

export type CoursePriceItem = {
  currency: "NGN" | "USD" | "GBP" | "EUR"
  amountMinor: number
  label: string
}

const currencyOrder: Array<{ currency: CoursePriceItem["currency"]; key: keyof CoursePriceValues; locale: string }> = [
  { currency: "NGN", key: "priceNgnMinor", locale: "en-NG" },
  { currency: "USD", key: "priceUsdMinor", locale: "en-US" },
  { currency: "GBP", key: "priceGbpMinor", locale: "en-GB" },
  { currency: "EUR", key: "priceEurMinor", locale: "en-IE" }
]

export function coursePriceItems(prices?: CoursePriceValues | null): CoursePriceItem[] {
  if (!prices) return []
  return currencyOrder.flatMap(({ currency, key, locale }) => {
    const amountMinor = Math.round(Number(prices[key] || 0))
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) return []
    return [{
      currency,
      amountMinor,
      label: new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        maximumFractionDigits: 0
      }).format(amountMinor / 100)
    }]
  })
}

export function courseOffers(prices?: CoursePriceValues | null) {
  return coursePriceItems(prices).map((price) => ({
    "@type": "Offer",
    price: (price.amountMinor / 100).toFixed(2),
    priceCurrency: price.currency,
    availability: "https://schema.org/InStock"
  }))
}
