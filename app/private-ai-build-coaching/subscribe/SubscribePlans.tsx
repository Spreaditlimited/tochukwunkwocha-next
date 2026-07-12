"use client"

import { useState } from "react"
import { CheckCircle2 } from "lucide-react"

import { PremiumPicker } from "@/components/PremiumPicker"
import {
  coachingCountries,
  coachingPlans,
  planPriceForCountry,
  type CoachingCountry
} from "@/lib/private-ai-coaching"

export function SubscribePlans() {
  const [country, setCountry] = useState<CoachingCountry>("NG")

  return (
    <>
      <form className="surface-raised relative mb-10 overflow-hidden border-white/10 bg-white/[0.04] p-6 text-white shadow-2xl sm:p-8">
        <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-emerald-400 to-cyan-500" />
        <div className="grid gap-6 md:grid-cols-3 md:items-end">
          <label className="block">
            <span className="label text-slate-300">Full Name</span>
            <input className="field mt-2 border-white/10 bg-white/5 text-white placeholder:text-slate-500" name="fullName" placeholder="Jane Doe" required />
          </label>
          <label className="block">
            <span className="label text-slate-300">Email Address</span>
            <input className="field mt-2 border-white/10 bg-white/5 text-white placeholder:text-slate-500" name="email" type="email" placeholder="you@example.com" required />
          </label>
          <label className="block">
            <span className="label mb-2 block text-slate-300">Paying From</span>
            <PremiumPicker
              name="country"
              value={country}
              options={coachingCountries}
              tone="dark"
              required
              onChange={(event) => setCountry(event.target.value as CoachingCountry)}
            />
          </label>
        </div>
      </form>

      <div className="grid gap-6 md:grid-cols-3">
        {coachingPlans.map((plan) => {
          const price = planPriceForCountry(plan, country)

          return (
            <article
              key={plan.key}
              className={`surface-raised flex min-w-0 flex-col border-white/10 p-7 text-white ${
                plan.popular ? "bg-emerald-500/15 shadow-[0_24px_54px_rgba(16,185,129,0.16)]" : "bg-white/[0.04]"
              }`}
            >
              <p className="eyebrow text-emerald-400">{plan.badge ?? "Monthly plan"}</p>
              <h2 className="mt-4 font-heading text-3xl font-black tracking-tight">{plan.name}</h2>
              <p className="mt-3 break-words font-heading text-4xl font-black leading-tight tracking-tight [overflow-wrap:anywhere]">
                {price.label}
                <span className="ml-1 text-sm font-bold text-slate-400">/mo</span>
              </p>
              <p className="mt-5 text-sm leading-relaxed text-slate-300">{plan.summary}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div className="min-w-0 rounded-lg border border-white/10 bg-white/5 p-3">
                  <strong className="block break-words text-sm leading-tight">{plan.monthlyHours} hrs</strong>
                  <span className="text-xs text-slate-400">Private coaching per month</span>
                </div>
                <div className="min-w-0 rounded-lg border border-white/10 bg-white/5 p-3">
                  <strong className="block break-words text-sm leading-tight [overflow-wrap:anywhere]">{price.hourlyRateLabel}</strong>
                  <span className="text-xs text-slate-400">Configured hourly rate</span>
                </div>
              </div>
              <p className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3 text-xs font-bold leading-relaxed text-slate-200">{plan.minimumTerm}</p>
              <ul className="mt-5 grid gap-3">
                {plan.benefits.map((benefit) => (
                  <li key={benefit} className="flex gap-2 text-sm leading-relaxed text-slate-400">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
              <button className="btn-primary mt-auto px-5 py-3" type="button">
                Start this plan
              </button>
            </article>
          )
        })}
      </div>

      <p className="mt-6 text-center text-sm text-slate-400">
        Subscription payment wiring will connect to the existing private coaching backend in the next integration pass.
      </p>
    </>
  )
}
