"use client"

import { useState } from "react"

import { TrademarkText } from "@/components/TrademarkText"

const COLLAPSIBLE_QUOTE_LENGTH = 260

export function TestimonialQuote({ quote }: { quote: string }) {
  const [expanded, setExpanded] = useState(false)
  const collapsible = quote.trim().length > COLLAPSIBLE_QUOTE_LENGTH

  return (
    <div className="md:min-h-[13.5rem]">
      <p className={`whitespace-pre-line text-base leading-relaxed text-slate-300 sm:text-lg ${collapsible && !expanded ? "line-clamp-6" : ""}`}>
        &ldquo;<TrademarkText text={quote} />&rdquo;
      </p>
      {collapsible ? (
        <button
          type="button"
          className="mt-4 text-sm font-bold text-sky-400 transition-colors hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-ink"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      ) : null}
    </div>
  )
}
