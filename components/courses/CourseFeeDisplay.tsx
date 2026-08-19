import { Globe2 } from "lucide-react"

import { coursePriceItems, type CoursePriceValues } from "@/lib/course-price-display"

export function CourseFeeDisplay({
  prices,
  tone = "light",
  compact = false,
  perLearner = false,
  centered = false,
  statCard = false,
  className = "",
  showCheckoutNote = false
}: {
  prices?: CoursePriceValues | null
  tone?: "light" | "dark"
  compact?: boolean
  perLearner?: boolean
  centered?: boolean
  statCard?: boolean
  className?: string
  showCheckoutNote?: boolean
}) {
  const items = coursePriceItems(prices)
  const dark = tone === "dark"
  if (!items.length) {
    return (
      <div className={className}>
        <p className={dark ? "text-sm font-semibold text-slate-300" : "text-sm font-semibold text-muted-foreground"}>
          Pricing is confirmed at checkout.
        </p>
      </div>
    )
  }

  if (statCard) {
    const primaryPrice = items.find((item) => item.currency === "NGN") || items[0]
    const internationalPrices = items.filter((item) => item.currency !== primaryPrice.currency)

    return (
      <div className={className}>
        <Globe2 className={`mb-3 h-6 w-6 ${dark ? "text-sky-300" : "text-sky-500"}`} />
        <p className={`font-heading font-bold ${dark ? "text-white" : "text-foreground"}`}>
          {primaryPrice.label}
        </p>
        {internationalPrices.length ? (
          <p className={`mt-1 text-xs font-semibold leading-relaxed ${dark ? "text-slate-300" : "text-muted-foreground"}`}>
            {internationalPrices.map((item) => `${item.label} ${item.currency}`).join(" · ")}
          </p>
        ) : null}
        <p className={`mt-1 text-xs font-bold uppercase tracking-widest ${dark ? "text-slate-400" : "text-muted-foreground"}`}>
          {perLearner ? "Course fee per learner" : "Course fee"}
        </p>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${centered ? "justify-center" : ""} ${dark ? "text-sky-300" : "text-primary"}`}>
        <Globe2 className="h-4 w-4" />
        {perLearner ? "Course fee per learner" : "Course fee · International payments supported"}
      </div>
      <div className={`mt-3 flex flex-wrap ${centered ? "justify-center" : ""} ${compact ? "gap-2" : "gap-2.5"}`}>
        {items.map((item) => (
          <span
            key={item.currency}
            className={`inline-flex items-baseline gap-1 rounded-lg border px-3 py-2 font-heading font-black ${
              dark
                ? "border-white/15 bg-white/[0.07] text-white"
                : "border-border bg-background text-foreground shadow-sm"
            } ${compact ? "text-sm" : "text-base"}`}
          >
            {item.label}
            <span className={`font-sans text-[9px] font-black tracking-wider ${dark ? "text-slate-400" : "text-muted-foreground"}`}>
              {item.currency}
            </span>
          </span>
        ))}
      </div>
      {showCheckoutNote ? (
        <p className={`mt-3 text-xs leading-relaxed ${centered ? "text-center" : ""} ${dark ? "text-slate-400" : "text-muted-foreground"}`}>
          Checkout uses your billing currency. Applicable taxes, processing charges, coupons, group pricing, or installment charges are shown before payment.
        </p>
      ) : null}
    </div>
  )
}
