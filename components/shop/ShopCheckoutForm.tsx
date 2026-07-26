"use client"

import { FormEvent, useState } from "react"
import { AlertCircle, Loader2, LockKeyhole } from "lucide-react"

import { getRecaptchaToken } from "@/lib/browser-recaptcha"
import { formatShopMoney } from "@/lib/shop-format"

type CheckoutVariant = {
  variantUuid: string
  title: string
  fulfillmentType: string
  priceMinor: number
  currency: string
  product: { title: string }
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

  const fieldClass =
    "mt-2 w-full rounded-md border border-input bg-background px-3.5 py-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
  const labelClass = "block text-xs font-black uppercase tracking-wider text-muted-foreground"

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="space-y-6 rounded-lg border border-border bg-card p-5 shadow-sm sm:p-7">
        <div>
          <p className="eyebrow text-primary">Contact details</p>
          <h1 className="mt-2 font-heading text-2xl font-black text-foreground">Secure checkout</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your receipt and purchase access will be sent to this email address.
          </p>
        </div>
        {error ? (
          <div role="alert" className="flex gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        ) : null}
        <div className="grid gap-5 sm:grid-cols-2">
          <label className={labelClass}>
            Full name
            <input
              name="customerName"
              defaultValue={initialCustomer?.name || ""}
              className={fieldClass}
              autoComplete="name"
              required
            />
          </label>
          <label className={labelClass}>
            Email address
            <input
              name="customerEmail"
              type="email"
              defaultValue={initialCustomer?.email || ""}
              className={fieldClass}
              autoComplete="email"
              required
            />
          </label>
          <label className={labelClass}>
            Phone number
            <input name="customerPhone" className={fieldClass} autoComplete="tel" required />
          </label>
          {physical ? (
            <label className={labelClass}>
              Quantity
              <input
                name="quantity"
                type="number"
                min="1"
                max="10"
                defaultValue="1"
                className={fieldClass}
                required
              />
            </label>
          ) : (
            <input name="quantity" type="hidden" value="1" />
          )}
          {!physical ? (
            <label className={`${labelClass} sm:col-span-2`}>
              Country
              <input name="customerCountry" className={fieldClass} autoComplete="country-name" required />
            </label>
          ) : null}
        </div>

        {physical ? (
          <div className="border-t border-border pt-6">
            <p className="eyebrow text-primary">Delivery address</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Printed workbooks are currently delivered within Nigeria.
            </p>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <label className={`${labelClass} sm:col-span-2`}>
                Address
                <input name="addressLine1" className={fieldClass} autoComplete="address-line1" required />
              </label>
              <label className={`${labelClass} sm:col-span-2`}>
                Additional address information
                <input name="addressLine2" className={fieldClass} autoComplete="address-line2" />
              </label>
              <label className={labelClass}>
                City
                <input name="city" className={fieldClass} autoComplete="address-level2" required />
              </label>
              <label className={labelClass}>
                State
                <input name="state" className={fieldClass} autoComplete="address-level1" required />
              </label>
              <label className={labelClass}>
                Postal code
                <input name="postalCode" className={fieldClass} autoComplete="postal-code" />
              </label>
            </div>
          </div>
        ) : null}
      </section>

      <aside className="h-fit rounded-lg border border-border bg-card p-5 shadow-sm lg:sticky lg:top-28">
        <p className="eyebrow text-primary">Order summary</p>
        <h2 className="mt-3 font-heading text-lg font-black text-foreground">{variant.product.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{variant.title}</p>
        <div className="mt-5 flex items-center justify-between border-y border-border py-4">
          <span className="text-sm font-bold text-muted-foreground">Item price</span>
          <span className="font-heading text-lg font-black text-foreground">
            {formatShopMoney(pricing.subtotalMinor, pricing.currency)}
          </span>
        </div>
        <div className="space-y-3 border-b border-border py-4 text-sm">
          <p className="flex items-center justify-between gap-4 text-muted-foreground">
            <span>VAT ({pricing.vatPercent.toFixed(2).replace(/\.00$/, "")}%)</span>
            <span className="font-bold text-foreground">{formatShopMoney(pricing.vatMinor, pricing.currency)}</span>
          </p>
          <p className="flex items-center justify-between gap-4 text-muted-foreground">
            <span>Payment processing</span>
            <span className="font-bold text-foreground">{formatShopMoney(pricing.processingFeeMinor, pricing.currency)}</span>
          </p>
          <p className="flex items-center justify-between gap-4 pt-1">
            <span className="font-black text-foreground">Total</span>
            <span className="font-heading text-xl font-black text-foreground">{formatShopMoney(pricing.totalMinor, pricing.currency)}</span>
          </p>
        </div>
        {physical ? (
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            The configured delivery charge will be added before you enter payment details.
          </p>
        ) : null}
        <button type="submit" disabled={busy} className="btn-primary mt-5 w-full justify-center py-3.5">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
          {busy ? "Preparing secure payment…" : "Continue to secure payment"}
        </button>
        <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
          Prices and availability are confirmed securely on the server.
        </p>
      </aside>
    </form>
  )
}
