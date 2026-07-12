"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import Link from "next/link"
import { ArrowLeft, CreditCard, Globe, LockKeyhole, Mail, Phone, ShieldCheck, User } from "lucide-react"

import { PremiumPicker } from "@/components/PremiumPicker"
import type { ServiceCheckoutDetails } from "@/lib/payments/service-checkout"

type Provider = "paystack" | "stripe"

type PricingPayload = {
  provider: Provider
  currency: string
  baseAmountMinor: number
  vatAmountMinor: number
  finalAmountMinor: number
  label: string
  baseLabel: string
}

const countryOptions = [
  { value: "NG", label: "Nigeria" },
  { value: "GB", label: "United Kingdom" },
  { value: "US", label: "United States" },
  { value: "IE", label: "Ireland" },
  { value: "CA", label: "Canada" },
  { value: "OTHER", label: "Other" }
]

function isNigeriaCountry(value: string) {
  const normalized = value.trim().toLowerCase()
  return normalized === "ng" || normalized === "nga" || normalized === "nigeria"
}

async function postJson<T>(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body)
  })
  const json = await response.json().catch(() => null)
  if (!response.ok || !json?.ok) throw new Error(json?.error || "Request failed")
  return json as T
}

export function ServiceCheckoutForm({ details }: { details: ServiceCheckoutDetails }) {
  const [country, setCountry] = useState(details.country || "NG")
  const [pricing, setPricing] = useState<PricingPayload | null>(null)
  const [errorMessage, setErrorMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const provider: Provider = useMemo(() => isNigeriaCountry(country) ? "paystack" : "stripe", [country])

  useEffect(() => {
    let cancelled = false
    setErrorMessage("")
    postJson<{ pricing: PricingPayload }>("/api/service-checkout/config", {
      slug: details.slug,
      leadUuid: details.leadUuid,
      country
    })
      .then((result) => {
        if (!cancelled) setPricing(result.pricing)
      })
      .catch((error) => {
        if (!cancelled) setErrorMessage(error instanceof Error ? error.message : "Could not load checkout pricing.")
      })
    return () => {
      cancelled = true
    }
  }, [country, details.leadUuid, details.slug])

  const submitCheckout = async (event: FormEvent) => {
    event.preventDefault()
    setErrorMessage("")
    setIsSubmitting(true)
    try {
      const result = await postJson<{ checkoutUrl: string }>("/api/service-checkout/order", {
        slug: details.slug,
        leadUuid: details.leadUuid,
        country
      })
      window.location.href = result.checkoutUrl
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not create checkout.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-muted/20 pb-24 pt-10 lg:pt-14">
      <div className="site-container">
        <Link href={details.sourcePath} className="group inline-flex items-center text-sm font-bold text-muted-foreground no-underline transition-colors hover:text-primary">
          <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back
        </Link>

        <div className="mt-8 grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-start lg:gap-16">
          <form onSubmit={submitCheckout} className="grid gap-8">
            <div>
              <p className="eyebrow">Secure Checkout</p>
              <h1 className="mt-2 font-heading text-3xl font-black tracking-tight sm:text-4xl">{details.title}</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{details.description}</p>
            </div>

            <div className="surface-raised bg-card p-6 sm:p-8">
              <h2 className="font-heading text-lg font-bold">Your Details</h2>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <span className="label flex items-center gap-2"><User className="h-3.5 w-3.5" /> Full name</span>
                  <p className="mt-2 rounded-md border border-border bg-muted/30 px-4 py-3 text-sm font-semibold text-foreground">{details.fullName}</p>
                </div>
                <div>
                  <span className="label flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> Email</span>
                  <p className="mt-2 rounded-md border border-border bg-muted/30 px-4 py-3 text-sm font-semibold text-foreground">{details.email}</p>
                </div>
                <div>
                  <span className="label flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> Phone</span>
                  <p className="mt-2 rounded-md border border-border bg-muted/30 px-4 py-3 text-sm font-semibold text-foreground">{details.phone || "-"}</p>
                </div>
                <label className="block">
                  <span className="label flex items-center gap-2"><Globe className="h-3.5 w-3.5" /> Paying from</span>
                  <PremiumPicker className="mt-2" name="country" value={country} options={countryOptions} onChange={(event) => setCountry(event.target.value)} required />
                </label>
              </div>
            </div>

            <div className="surface-raised bg-card p-6 sm:p-8">
              <h2 className="font-heading text-lg font-bold">Payment Method</h2>
              <div className="mt-6 rounded-lg border-2 border-primary bg-primary/5 p-5">
                <span className="flex items-center gap-3 font-bold text-foreground">
                  <CreditCard className="h-5 w-5 text-primary" />
                  {provider === "paystack" ? "Paystack" : "Stripe"}
                </span>
                <span className="mt-3 block text-xs leading-relaxed text-muted-foreground">
                  {provider === "paystack" ? "Naira card, bank transfer, or USSD checkout." : "International card checkout."}
                </span>
              </div>
            </div>

            {errorMessage ? <p className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm font-bold text-destructive">{errorMessage}</p> : null}

            <button className="btn-primary w-full px-8 py-4 text-base shadow-lg shadow-primary/20 disabled:pointer-events-none disabled:opacity-60" type="submit" disabled={isSubmitting || !pricing}>
              {isSubmitting ? "Opening secure checkout..." : "Continue to Payment"}
            </button>
          </form>

          <aside className="surface-raised sticky top-24 bg-card p-6 sm:p-8">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <p className="eyebrow">Order Summary</p>
            <h2 className="mt-2 font-heading text-2xl font-black">{details.title}</h2>
            <div className="mt-6 space-y-4 border-t border-border pt-6">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Base amount</span>
                <span className="font-bold text-foreground">{pricing?.baseLabel || "-"}</span>
              </div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Provider</span>
                <span className="font-bold capitalize text-foreground">{provider}</span>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
                <span className="font-bold text-foreground">Total due</span>
                <span className="font-heading text-2xl font-black text-primary">{pricing?.label || "-"}</span>
              </div>
            </div>
            <p className="mt-6 flex gap-2 rounded-lg border border-border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Payment is completed securely through the selected payment provider. After successful payment, you will be redirected to book your call.
            </p>
          </aside>
        </div>
      </div>
    </main>
  )
}
