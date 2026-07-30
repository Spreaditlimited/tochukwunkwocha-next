"use client"

import { FormEvent, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  Globe,
  Loader2,
  LockKeyhole,
  Mail,
  MapPin,
  Package,
  Phone,
  ShieldCheck,
  User
} from "lucide-react"

import { RecaptchaDisclosure } from "@/components/RecaptchaDisclosure"
import { getRecaptchaToken } from "@/lib/browser-recaptcha"
import { formatShopMoney } from "@/lib/shop-format"

type CheckoutVariant = {
  variantUuid: string
  title: string
  fulfillmentType: string
  priceMinor: number
  currency: string
  product: { title: string; shortDescription: string }
}

type ShopPricing = {
  currency: string
  unitPriceMinor: number
  subtotalMinor: number
  vatPercent: number
  vatMinor: number
  processingFeeMinor: number
  totalMinor: number
}

function ShopOrderSummary({
  variant,
  pricing,
  className = ""
}: {
  variant: CheckoutVariant
  pricing: ShopPricing
  className?: string
}) {
  const physical = variant.fulfillmentType === "physical"
  const included = physical
    ? [
        "Physical merchandise",
        "Tracked order in My Purchases",
        "Delivery within Nigeria"
      ]
    : [
        "Protected digital PDF",
        "Access after payment confirmation",
        "Download from My Purchases"
      ]

  return (
    <aside className={`surface-raised overflow-hidden bg-brand-ink text-white ${className}`}>
      <div className="p-6 sm:p-8 lg:p-10">
        <p className="eyebrow text-sky-400">Order Summary</p>
        <h2 className="mt-2 font-heading text-2xl font-black tracking-tight">
          {variant.product.title}
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-slate-300">
          {variant.product.shortDescription}
        </p>

        <div className="mt-8 border-t border-dashed border-white/20 pt-8">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Total Payment
          </p>
          <p className="mt-2 font-heading text-4xl font-black tracking-tight text-white">
            {formatShopMoney(pricing.totalMinor, pricing.currency)}
          </p>

          <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">
              Amount Breakdown
            </p>
            <div className="space-y-2 text-sm text-slate-300">
              <div className="flex items-center justify-between gap-4">
                <span>Workbook price</span>
                <strong className="text-right text-white">
                  {formatShopMoney(pricing.subtotalMinor, pricing.currency)}
                </strong>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>VAT ({pricing.vatPercent.toFixed(2).replace(/\.00$/, "")}%)</span>
                <strong className="text-right text-white">
                  {formatShopMoney(pricing.vatMinor, pricing.currency)}
                </strong>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Processing fee</span>
                <strong className="text-right text-white">
                  {formatShopMoney(pricing.processingFeeMinor, pricing.currency)}
                </strong>
              </div>
              <div className="my-3 h-px bg-white/10" />
              <div className="flex items-center justify-between gap-4 font-black text-sky-300">
                <span>Total</span>
                <span className="text-right">
                  {formatShopMoney(pricing.totalMinor, pricing.currency)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-white/10 pt-8">
          <p className="mb-6 text-xs font-bold uppercase tracking-widest text-slate-400">
            What is included
          </p>
          <div className="grid gap-4">
            {included.map((item) => (
              <div key={item} className="flex gap-3 text-sm font-medium text-slate-200">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                <span className="leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white/5 p-6 sm:px-8 lg:px-10">
        <div className="flex items-center gap-3 text-xs font-medium text-slate-400">
          <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-400" />
          <p>
            Your payment is processed securely. Access is prepared after payment
            confirmation.
          </p>
        </div>
      </div>
    </aside>
  )
}

export function ShopCheckoutForm({
  variant,
  pricing,
  initialCustomer
}: {
  variant: CheckoutVariant
  pricing: {
    currency: string
    unitPriceMinor: number
    subtotalMinor: number
    vatPercent: number
    vatMinor: number
    processingFeeMinor: number
    totalMinor: number
  }
  initialCustomer?: { name: string; email: string } | null
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const physical = variant.fulfillmentType === "physical"

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      const form = new FormData(event.currentTarget)
      const recaptchaToken = await getRecaptchaToken("shop_order_create")
      const response = await fetch("/api/shop/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          variantUuid: variant.variantUuid,
          currency: pricing.currency,
          quantity: Number(form.get("quantity") || 1),
          customerName: form.get("customerName"),
          customerEmail: form.get("customerEmail"),
          customerPhone: form.get("customerPhone"),
          customerCountry: physical ? "Nigeria" : form.get("customerCountry"),
          addressLine1: form.get("addressLine1"),
          addressLine2: form.get("addressLine2"),
          city: form.get("city"),
          state: form.get("state"),
          postalCode: form.get("postalCode"),
          recaptchaToken
        })
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.checkoutUrl) {
        throw new Error(json?.error || "Checkout could not be started.")
      }
      window.location.assign(String(json.checkoutUrl))
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Checkout could not be started."
      )
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-start lg:gap-16">
      <div>
        <div>
          <p className="eyebrow">Secure Checkout</p>
          <h1 className="mt-2 font-heading text-3xl font-black tracking-tight sm:text-4xl">
            Complete Your Purchase
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Enter your details below. You will continue to the secure payment
            provider to complete your purchase.
          </p>
        </div>

        <form onSubmit={submit} className="mt-10 grid gap-8">
          <section className="surface-raised bg-card p-6 sm:p-8">
            <h2 className="font-heading text-lg font-bold">Personal Information</h2>
            <div className="mt-6 grid min-w-0 gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="label flex items-center gap-2">
                  <User className="h-3.5 w-3.5" /> Full name
                </span>
                <input
                  name="customerName"
                  defaultValue={initialCustomer?.name || ""}
                  className="field mt-2"
                  autoComplete="name"
                  placeholder="Your full name"
                  required
                />
              </label>
              <label className="block">
                <span className="label flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" /> Email address
                </span>
                <input
                  name="customerEmail"
                  type="email"
                  defaultValue={initialCustomer?.email || ""}
                  className="field mt-2"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                />
              </label>
              <label className="block">
                <span className="label flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5" /> Phone number
                </span>
                <input
                  name="customerPhone"
                  className="field mt-2"
                  autoComplete="tel"
                  placeholder="+234..."
                  required
                />
              </label>
              {!physical ? (
                <label className="block">
                  <span className="label flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5" /> Country
                  </span>
                  <input
                    name="customerCountry"
                    className="field mt-2"
                    autoComplete="country-name"
                    placeholder="Your country"
                    required
                  />
                </label>
              ) : (
                <label className="block">
                  <span className="label flex items-center gap-2">
                    <Package className="h-3.5 w-3.5" /> Quantity
                  </span>
                  <input
                    name="quantity"
                    type="number"
                    min="1"
                    max="10"
                    defaultValue="1"
                    className="field mt-2"
                    required
                  />
                </label>
              )}
            </div>
            {!physical ? (
              <input name="quantity" type="hidden" value="1" />
            ) : null}
          </section>

          {physical ? (
            <section className="surface-raised bg-card p-6 sm:p-8">
              <h2 className="font-heading text-lg font-bold">Delivery Address</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Physical merchandise is currently delivered within Nigeria.
              </p>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="label flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5" /> Address
                  </span>
                  <input name="addressLine1" className="field mt-2" autoComplete="address-line1" required />
                </label>
                <label className="block sm:col-span-2">
                  <span className="label">Additional address information</span>
                  <input name="addressLine2" className="field mt-2" autoComplete="address-line2" />
                </label>
                <label className="block">
                  <span className="label">City</span>
                  <input name="city" className="field mt-2" autoComplete="address-level2" required />
                </label>
                <label className="block">
                  <span className="label">State</span>
                  <input name="state" className="field mt-2" autoComplete="address-level1" required />
                </label>
                <label className="block">
                  <span className="label">Postal code</span>
                  <input name="postalCode" className="field mt-2" autoComplete="postal-code" />
                </label>
              </div>
            </section>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="flex gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : null}

          <ShopOrderSummary
            variant={variant}
            pricing={pricing}
            className="lg:hidden"
          />

          <div>
            <button
              type="submit"
              disabled={busy}
              className="btn-primary w-full py-4 text-base shadow-lg shadow-primary/20"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {busy
                ? "Preparing secure payment…"
                : `Continue to Payment — ${formatShopMoney(pricing.totalMinor, pricing.currency)}`}
            </button>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground">
              <LockKeyhole className="h-4 w-4" />
              Secure, encrypted transaction.
            </div>
            <RecaptchaDisclosure className="mt-3" />
          </div>
        </form>
      </div>

      <ShopOrderSummary
        variant={variant}
        pricing={pricing}
        className="sticky top-28 hidden lg:block"
      />
    </div>
  )
}
