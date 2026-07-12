"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowRight, CheckCircle2, LockKeyhole, Sparkles } from "lucide-react"

import { PremiumPicker } from "@/components/PremiumPicker"
import {
  coachingCountries,
  coachingPlans,
  type CoachingCountry
} from "@/lib/private-ai-coaching"

type CoachingPricing = {
  discovery: {
    label: string
  }
  plans: Array<{
    key: string
    monthlyHours: number
    monthlyLabel: string
    hourlyRateLabel: string
  }>
}

export function CoachingPricingCards() {
  const [country, setCountry] = useState<CoachingCountry>("NG")
  const [pricing, setPricing] = useState<CoachingPricing | null>(null)
  const [pricingError, setPricingError] = useState("")

  useEffect(() => {
    let active = true
    setPricingError("")

    fetch(`/api/private-ai-coaching/pricing?country=${encodeURIComponent(country)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not load pricing.")
        return payload as CoachingPricing
      })
      .then((payload) => {
        if (active) setPricing(payload)
      })
      .catch((error) => {
        if (!active) return
        setPricing(null)
        setPricingError(error instanceof Error ? error.message : "Could not load pricing.")
      })

    return () => {
      active = false
    }
  }, [country])

  return (
    <>
      {/* 1. Premium Region Selector */}
      <div className="mb-12 flex justify-center">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card/50 p-6 shadow-sm backdrop-blur-xl sm:flex-row sm:px-8">
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Select Your Region
          </label>
          <div className="w-full min-w-[200px] sm:w-auto">
            <PremiumPicker
              value={country}
              options={coachingCountries}
              onChange={(event) => setCountry(event.target.value as CoachingCountry)}
            />
          </div>
        </div>
      </div>

      {/* 2. Pricing Grid */}
      <div className="grid gap-8 xl:grid-cols-4 xl:items-start">
        
        {/* Step 01: Discovery Call (Required Entry Point) */}
        <article className="surface-raised group relative flex min-w-0 flex-col overflow-hidden bg-brand-ink p-8 text-white transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_30px_60px_rgba(16,185,129,0.15)] xl:col-span-1">
          <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 opacity-80 transition-opacity group-hover:opacity-100"></div>
          
          <div className="flex-1">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-400">
              <span className="flex h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"></span>
              Step 01
            </p>
            <h3 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">Discovery Call</h3>
            <p className="mt-4 border-b border-white/10 pb-8 text-sm leading-relaxed text-slate-300">
              A paid consultation to map out your project architecture and see if coaching is the right fit.
            </p>
            
            <div className="mt-8">
              <p className="break-words font-heading text-4xl font-black tracking-tight [overflow-wrap:anywhere]">
                {pricing?.discovery.label || (pricingError ? "Configure in admin" : "Loading...")}
              </p>
              <p className="mt-2 text-xs font-medium text-slate-400">One-time payment</p>
            </div>
          </div>
          
          <div className="mt-10 pt-4">
            <Link 
              href="/private-ai-build-coaching/apply" 
              className="btn-primary w-full px-6 py-4 text-sm shadow-lg shadow-primary/20"
            >
              Apply & Book Call <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </article>

        {/* Step 02: Monthly Plans Loop */}
        <div className="grid gap-8 sm:grid-cols-2 xl:col-span-3 xl:grid-cols-3">
          {coachingPlans.map((plan) => {
            const price = pricing?.plans.find((item) => item.key === plan.key)
            const isPopular = plan.popular

            return (
              <article
                key={plan.key}
                className={`surface-raised group relative flex min-w-0 flex-col p-8 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl ${
                  isPopular 
                    ? "border-emerald-500/40 bg-gradient-to-b from-emerald-500/5 to-background shadow-[0_20px_40px_rgba(16,185,129,0.08)] dark:from-emerald-500/10 dark:to-background" 
                    : "bg-card hover:border-primary/30"
                }`}
              >
                {/* Popular Glow Line */}
                {isPopular && (
                  <div className="absolute left-0 top-0 h-1 w-full bg-emerald-500"></div>
                )}

                {/* Badge */}
                <p className={`mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest ${
                  isPopular ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "border border-border bg-muted/50 text-muted-foreground"
                }`}>
                  {isPopular && <Sparkles className="h-3 w-3" />}
                  {plan.badge ?? "Monthly plan"}
                </p>

                <h3 className="font-heading text-2xl font-black tracking-tight">{plan.name}</h3>
                
                <div className="mt-4 flex min-w-0 flex-wrap items-baseline gap-x-1 gap-y-0.5">
                  <p className="break-words font-heading text-3xl font-black leading-tight tracking-tight [overflow-wrap:anywhere]">
                    {price?.monthlyLabel || (pricingError ? "Configure in admin" : "Loading...")}
                  </p>
                  <span className="text-sm font-bold text-muted-foreground">/mo</span>
                </div>

                {/* Metric Blocks */}
                <div className="mt-8 grid gap-3 border-y border-border py-6 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <div className="min-w-0 rounded-xl border border-border bg-background/50 p-4 transition-colors group-hover:border-primary/20">
                    <strong className="block break-words font-heading text-lg font-black leading-tight text-foreground">{price?.monthlyHours || plan.monthlyHours} hrs</strong>
                    <span className="mt-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Private Coaching</span>
                  </div>
                  <div className="min-w-0 rounded-xl border border-border bg-background/50 p-4 transition-colors group-hover:border-primary/20">
                    <strong className="block break-words font-heading text-lg font-black leading-tight text-foreground [overflow-wrap:anywhere]">
                      {price?.hourlyRateLabel || (pricingError ? "Configure in admin" : "Loading...")}
                    </strong>
                    <span className="mt-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Hourly Rate</span>
                  </div>
                </div>

                <div className="mt-6 flex-1 space-y-6">
                  <p className="text-sm leading-relaxed text-muted-foreground">{plan.summary}</p>
                  
                  <div className="rounded-lg bg-muted/30 p-4 text-xs font-semibold leading-relaxed text-foreground">
                    {plan.minimumTerm}
                  </div>

                  <ul className="grid gap-3">
                    {plan.benefits.map((benefit) => (
                      <li key={benefit} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
                        <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${isPopular ? "text-emerald-500" : "text-primary"}`} />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Footer Lock / Outcome */}
                <div className="mt-8 pt-6 border-t border-border">
                  <p className={`text-sm font-bold leading-relaxed ${isPopular ? "text-emerald-600 dark:text-emerald-400" : "text-primary"}`}>
                    {plan.outcome}
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2 rounded-md bg-muted/40 py-2.5 text-xs font-bold text-muted-foreground">
                    <LockKeyhole className="h-3.5 w-3.5" /> Unlocks after discovery
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </>
  )
}
