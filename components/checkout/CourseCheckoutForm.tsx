"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Globe,
  Landmark,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  UploadCloud,
  Users,
  User
} from "lucide-react"

import { PremiumPicker } from "@/components/PremiumPicker"
import { SeatCountStepper } from "@/components/SeatCountStepper"
import { AFFILIATE_REF_STORAGE_KEY } from "@/components/AffiliateReferralCapture"
import { TrademarkText } from "@/components/TrademarkText"
import { getRecaptchaToken } from "@/lib/browser-recaptcha"
import { resolveCheckoutCourseSlug, type Course } from "@/lib/public-offers"

type Provider = "paystack" | "stripe" | "manual_transfer" | "installment"

type PricingPayload = {
  currency: string
  baseAmountMinor: number
  courseAmountMinor?: number
  vatPercent?: number
  vatAmountMinor?: number
  subtotalAmountMinor?: number
  processingFeeMinor?: number
  discountMinor: number
  finalAmountMinor: number
  label?: string
  baseLabel?: string
  courseAmountLabel?: string
  vatLabel?: string
  subtotalLabel?: string
  processingFeeLabel?: string
  discountLabel?: string
  groupDiscountMinor?: number
  groupDiscountLabel?: string
  groupUnitLabel?: string | null
  couponCode?: string | null
}

function CheckoutAmountBreakdown({ pricing }: { pricing: PricingPayload | null }) {
  if (!pricing) return null
  const vatPercent = Number(pricing.vatPercent || 0)
  const processingFeeMinor = Number(pricing.processingFeeMinor || 0)
  const discountMinor = Number(pricing.discountMinor || 0)

  const rows = [
    {
      label: "Course price",
      value: pricing.courseAmountLabel || formatMinor(Number(pricing.courseAmountMinor || 0), pricing.currency),
      show: Number(pricing.courseAmountMinor || 0) > 0
    },
    {
      label: vatPercent ? `VAT (${vatPercent.toFixed(2).replace(/\.00$/, "")}%)` : "VAT",
      value: pricing.vatLabel || formatMinor(Number(pricing.vatAmountMinor || 0), pricing.currency),
      show: Number(pricing.vatAmountMinor || 0) > 0 || vatPercent > 0
    },
    {
      label: "Discount",
      value: `-${pricing.discountLabel || formatMinor(discountMinor, pricing.currency)}`,
      show: discountMinor > 0
    },
    {
      label: "Processing fee",
      value: pricing.processingFeeLabel || formatMinor(processingFeeMinor, pricing.currency),
      show: processingFeeMinor > 0
    }
  ].filter((row) => row.show)

  if (!rows.length) return null

  return (
    <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">Amount Breakdown</p>
      <div className="space-y-2 text-sm text-slate-300">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4">
            <span>{row.label}</span>
            <strong className="text-right text-white">{row.value}</strong>
          </div>
        ))}
        <div className="my-3 h-px bg-white/10" />
        <div className="flex items-center justify-between gap-4 font-black text-sky-300">
          <span>Total</span>
          <span className="text-right">{pricing.label || formatMinor(pricing.finalAmountMinor, pricing.currency)}</span>
        </div>
      </div>
    </div>
  )
}

function PriceSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <span role="status" aria-label="Loading confirmed price" className={`inline-block animate-pulse rounded-md bg-current/20 align-middle ${compact ? "h-4 w-20" : "h-10 w-40"}`}>
      <span className="sr-only">Loading confirmed price</span>
    </span>
  )
}

type ManualDetails = {
  bankName: string
  accountName: string
  accountNumber: string
  note: string
  amountLabel: string
  pricing: PricingPayload
  coupon?: { code: string } | null
}

type CheckoutBatch = {
  batchKey: string
  batchLabel: string
  remainingSeats: number | null
  batchStartAt: string | null
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

function formatMinor(minor: number, currency: string) {
  const locale = currency === "NGN" ? "en-NG" : currency === "GBP" ? "en-GB" : currency === "EUR" ? "en-IE" : "en-US"
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "NGN" ? 0 : 2
  }).format(minor / 100)
}

function formatBatchStart(value: string | null) {
  if (!value) return ""
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  const date = match
    ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5])))
    : new Date(value)
  if (!Number.isFinite(date.getTime())) return ""
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: match ? "UTC" : "Africa/Lagos"
  }).format(date) + " WAT"
}

function cookieValue(name: string) {
  if (typeof document === "undefined") return ""
  const parts = `; ${document.cookie}`.split(`; ${name}=`)
  return parts.length === 2 ? parts.pop()?.split(";").shift() || "" : ""
}

function metaAttribution() {
  if (typeof window === "undefined") return { fbp: "", fbc: "", fbclid: "" }
  const params = new URLSearchParams(window.location.search || "")
  return {
    fbp: cookieValue("_fbp"),
    fbc: cookieValue("_fbc"),
    fbclid: params.get("fbclid") || ""
  }
}

class CheckoutRequestError extends Error {
  code: string

  constructor(message: string, code = "") {
    super(message)
    this.name = "CheckoutRequestError"
    this.code = code
  }
}

async function postJson<T>(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body)
  })
  const json = await response.json().catch(() => null)
  if (!response.ok || !json?.ok) {
    throw new CheckoutRequestError(json?.error || "Request failed", String(json?.code || ""))
  }
  return json as T
}

export function CourseCheckoutForm({ course }: { course: Course }) {
  const checkoutCourseSlug = resolveCheckoutCourseSlug(course)
  const publicCourseSlug = course.slug
  const [firstName, setFirstName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [country, setCountry] = useState("NG")
  const [provider, setProvider] = useState<Provider>("paystack")
  const [batches, setBatches] = useState<CheckoutBatch[]>([])
  const [batchKey, setBatchKey] = useState("")
  const [buyerType, setBuyerType] = useState<"student" | "family">("student")
  const [seatCount, setSeatCount] = useState(2)
  const [whatsappOptIn, setWhatsappOptIn] = useState(true)
  const [affiliateCode, setAffiliateCode] = useState("")
  const [couponCode, setCouponCode] = useState("")
  const [couponMessage, setCouponMessage] = useState("")
  const [pricing, setPricing] = useState<PricingPayload | null>(null)
  const [manualDetails, setManualDetails] = useState<ManualDetails | null>(null)
  const [transferReference, setTransferReference] = useState("")
  const [proofUrl, setProofUrl] = useState("")
  const [proofPublicId, setProofPublicId] = useState("")
  const [proofFileName, setProofFileName] = useState("")
  const [isUploadingProof, setIsUploadingProof] = useState(false)
  const [installmentAmount, setInstallmentAmount] = useState("")
  const [statusMessage, setStatusMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isNigeriaCheckout = isNigeriaCountry(country)

  const paymentOptions = useMemo(
    () =>
      isNigeriaCheckout
        ? [
            { value: "paystack" as const, title: "Paystack", desc: "Naira card, bank transfer, or USSD checkout.", icon: CreditCard },
            { value: "manual_transfer" as const, title: "Bank Transfer", desc: "Submit proof for admin review.", icon: Landmark },
            { value: "installment" as const, title: "Installments", desc: "Start a naira payment plan and pay over time.", icon: ShieldCheck }
          ]
        : [
            { value: "stripe" as const, title: "Stripe", desc: "International card checkout.", icon: CreditCard },
            { value: "installment" as const, title: "Installments", desc: "Start an international payment plan and pay over time.", icon: ShieldCheck }
          ],
    [isNigeriaCheckout]
  )

  const cardProvider = useMemo(() => {
    if (provider === "manual_transfer" || provider === "installment") return isNigeriaCheckout ? "paystack" : "stripe"
    return provider
  }, [isNigeriaCheckout, provider])

  useEffect(() => {
    if (isNigeriaCheckout && provider === "stripe") {
      setProvider("paystack")
      return
    }
    if (!isNigeriaCheckout && (provider === "paystack" || provider === "manual_transfer")) {
      setProvider("stripe")
    }
  }, [isNigeriaCheckout, provider])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get("ref") || params.get("affiliate") || params.get("affiliateCode") || ""
    try {
      if (code) window.localStorage.setItem(AFFILIATE_REF_STORAGE_KEY, code.toUpperCase())
      setAffiliateCode((code || window.localStorage.getItem(AFFILIATE_REF_STORAGE_KEY) || "").trim().toUpperCase().slice(0, 40))
    } catch {
      if (code) setAffiliateCode(code.toUpperCase().slice(0, 40))
    }
  }, [])

  useEffect(() => {
    setPricing(null)
    setManualDetails(null)
  }, [batchKey, buyerType, country, couponCode, provider, seatCount])

  useEffect(() => {
    if (provider === "manual_transfer") return
    let cancelled = false
    postJson<{ batches: CheckoutBatch[]; pricing: PricingPayload }>("/api/checkout/config", {
      courseSlug: checkoutCourseSlug,
      returnSlug: publicCourseSlug,
      country,
      provider: cardProvider,
      email,
      couponCode,
      buyerType,
      seatCount: buyerType === "family" ? seatCount : 1,
      batchKey,
      installment: provider === "installment"
    })
      .then((result) => {
        if (cancelled) return
        setBatches(result.batches || [])
        setPricing(result.pricing)
        if (!batchKey && result.batches?.[0]?.batchKey) setBatchKey(result.batches[0].batchKey)
      })
      .catch((error) => {
        if (!cancelled) setErrorMessage(error.message)
      })
    return () => {
      cancelled = true
    }
  }, [batchKey, buyerType, cardProvider, checkoutCourseSlug, country, couponCode, email, provider, publicCourseSlug, seatCount])

  useEffect(() => {
    if (provider !== "manual_transfer") return
    if (!isNigeriaCheckout) return
    let cancelled = false
    postJson<{ details: ManualDetails }>("/api/checkout/manual-config", {
      courseSlug: checkoutCourseSlug,
      returnSlug: publicCourseSlug,
      country,
      email,
      couponCode,
      buyerType,
      seatCount: buyerType === "family" ? seatCount : 1,
      batchKey
    })
      .then((result) => {
        if (!cancelled) {
          setManualDetails(result.details)
          setPricing(result.details.pricing)
        }
      })
      .catch((error) => {
        if (!cancelled) setErrorMessage(error.message)
      })
    return () => {
      cancelled = true
    }
  }, [batchKey, buyerType, checkoutCourseSlug, country, couponCode, email, isNigeriaCheckout, provider, publicCourseSlug, seatCount])

  const applyCoupon = async () => {
    setCouponMessage("")
    setErrorMessage("")
    if (!couponCode.trim()) {
      setErrorMessage("Enter a coupon code first.")
      return
    }
    try {
      if (provider === "manual_transfer") {
        const result = await postJson<{ details: ManualDetails }>("/api/checkout/manual-config", {
          courseSlug: checkoutCourseSlug,
          returnSlug: publicCourseSlug,
          country,
          email,
          couponCode,
          buyerType,
          seatCount: buyerType === "family" ? seatCount : 1,
          batchKey
        })
        setManualDetails(result.details)
        setPricing(result.details.pricing)
        setCouponMessage(`${result.details.coupon?.code || couponCode.toUpperCase()} applied.`)
        return
      }
      const result = await postJson<{ pricing: PricingPayload; coupon: { code: string } }>("/api/checkout/coupon", {
        courseSlug: checkoutCourseSlug,
        returnSlug: publicCourseSlug,
        country,
        provider: cardProvider,
        email,
        couponCode,
        buyerType,
        seatCount: buyerType === "family" ? seatCount : 1,
        batchKey,
        installment: provider === "installment"
      })
      setPricing(result.pricing)
      setCouponMessage(`${result.coupon.code} applied.`)
    } catch (error) {
      setPricing(null)
      setErrorMessage(error instanceof Error ? error.message : "Could not apply coupon.")
    }
  }

  const uploadProof = async (file: File) => {
    setErrorMessage("")
    setStatusMessage("")
    setProofFileName(file.name)
    setProofUrl("")
    setProofPublicId("")
    setIsUploadingProof(true)
    try {
      const body = new FormData()
      body.set("file", file)
      const response = await fetch("/api/uploads/payment-proof", {
        method: "POST",
        body
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Could not upload payment proof.")
      setProofUrl(String(json.url || ""))
      setProofPublicId(String(json.publicId || ""))
      setStatusMessage("Payment proof uploaded.")
    } catch (error) {
      setProofFileName("")
      setErrorMessage(error instanceof Error ? error.message : "Could not upload payment proof.")
    } finally {
      setIsUploadingProof(false)
    }
  }

  const submitCheckout = async (event: FormEvent) => {
    event.preventDefault()
    setErrorMessage("")
    setStatusMessage("")
    setIsSubmitting(true)

    try {
      if (provider === "manual_transfer") {
        let result: { paymentUuid: string; pendingReview?: boolean } | null = null
        let lastError: unknown = null

        for (let attempt = 1; attempt <= 2; attempt += 1) {
          let recaptchaToken = ""
          try {
            recaptchaToken = await getRecaptchaToken("course_order_create")
          } catch (error) {
            lastError = error
            if (attempt === 1) continue
          }

          try {
            result = await postJson<{ paymentUuid: string; pendingReview?: boolean }>("/api/checkout/manual-payment", {
              courseSlug: checkoutCourseSlug,
              returnSlug: publicCourseSlug,
              firstName,
              email,
              phone,
              country,
              couponCode,
              transferReference,
              proofUrl,
              proofPublicId,
              batchKey,
              buyerType,
              seatCount: buyerType === "family" ? seatCount : 1,
              affiliateCode,
              whatsappOptIn,
              ...metaAttribution(),
              recaptchaToken,
              allowProofFallback: attempt === 2
            })
            break
          } catch (error) {
            lastError = error
            if (!(error instanceof CheckoutRequestError) || error.code !== "recaptcha_failed" || attempt === 2) throw error
          }
        }

        if (!result) throw lastError instanceof Error ? lastError : new Error("Could not submit manual payment.")
        setStatusMessage(`Manual payment submitted for review. Reference: ${result.paymentUuid}`)
        const pendingPath = buyerType === "family" ? "/dashboard/family" : "/dashboard/courses"
        window.location.href = `${pendingPath}?manual_payment=pending&payment=${encodeURIComponent(result.paymentUuid)}`
        return
      }

      if (provider === "installment") {
        const plan = await postJson<{ planUuid: string; pricing: PricingPayload }>("/api/checkout/installment-plan", {
          courseSlug: checkoutCourseSlug,
          returnSlug: publicCourseSlug,
          firstName,
          email,
          phone,
          country,
          provider: cardProvider,
          couponCode,
          batchKey,
          buyerType,
          seatCount: buyerType === "family" ? seatCount : 1,
          affiliateCode,
          whatsappOptIn
        })
        const targetAmount = Number(plan.pricing.finalAmountMinor || pricing?.finalAmountMinor || 0)
        const requestedAmount = Math.round(Number(installmentAmount || 0) * 100)
        const amountMinor = requestedAmount > 0 ? requestedAmount : Math.ceil(targetAmount / 2)
        const payment = await postJson<{ checkoutUrl: string }>("/api/checkout/installment-payment", {
          planUuid: plan.planUuid,
          email,
          provider: cardProvider,
          currency: plan.pricing.currency,
          amountMinor
        })
        window.location.href = payment.checkoutUrl
        return
      }

      const recaptchaToken = await getRecaptchaToken("course_order_create")
      const result = await postJson<{ checkoutUrl: string }>("/api/checkout/order", {
        courseSlug: checkoutCourseSlug,
        returnSlug: publicCourseSlug,
        firstName,
        email,
        phone,
        country,
        provider: cardProvider,
        couponCode,
        batchKey,
        buyerType,
        seatCount: buyerType === "family" ? seatCount : 1,
        affiliateCode,
        whatsappOptIn,
        ...metaAttribution(),
        recaptchaToken
      })
      window.location.href = result.checkoutUrl
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not complete checkout.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const displayPrice =
    pricing?.label ||
    (pricing ? formatMinor(pricing.finalAmountMinor, pricing.currency) : provider === "manual_transfer" ? manualDetails?.amountLabel || null : null)
  const selectedSeatCount = buyerType === "family" ? Math.max(2, Math.min(500, seatCount)) : 1
  const hideBatchSeatBalance = checkoutCourseSlug === "prompt-to-profit-holiday"
  const selectedBatch = useMemo(() => batches.find((batch) => batch.batchKey === batchKey) || null, [batchKey, batches])
  const selectedBatchStart = selectedBatch ? formatBatchStart(selectedBatch.batchStartAt) : ""

  return (
    <main className="min-h-screen bg-muted/20 pb-24 pt-10 lg:pt-14">
      <div className="site-container">
        <Link href={course.href} className="group inline-flex items-center text-sm font-bold text-muted-foreground no-underline transition-colors hover:text-primary">
          <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to Programme Details
        </Link>

        <div className="mt-8 grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-start lg:gap-16">
          <div>
            <div className="mb-10">
              <p className="eyebrow">Secure Checkout</p>
              <h1 className="mt-2 font-heading text-3xl font-black tracking-tight sm:text-4xl">Complete Your Enrolment</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Enter your details below. Card checkout redirects to the payment provider; bank transfer submissions go to the internal verification queue.
              </p>
            </div>

            <form onSubmit={submitCheckout} className="grid gap-8">
              <div className="surface-raised bg-card p-6 sm:p-8">
                <h2 className="font-heading text-lg font-bold">Personal Information</h2>
                <div className="mt-6 grid min-w-0 gap-5 sm:grid-cols-2">
                  <label className="block">
                    <span className="label flex items-center gap-2"><User className="h-3.5 w-3.5" /> Full name</span>
                    <input className="field mt-2" name="firstName" value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Your full name" required />
                  </label>
                  <label className="block">
                    <span className="label flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> Email address</span>
                    <input className="field mt-2" name="email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="you@example.com" required />
                  </label>
                  <label className="block">
                    <span className="label flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> WhatsApp phone</span>
                    <input className="field mt-2" name="phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+234..." required />
                  </label>
                  <label className="block">
                    <span className="label flex items-center gap-2"><Globe className="h-3.5 w-3.5" /> Country</span>
                    <PremiumPicker className="mt-2" name="country" value={country} options={countryOptions} onChange={(event) => setCountry(event.target.value)} required />
                  </label>
                </div>
              </div>

              <div className="surface-raised bg-card p-6 sm:p-8">
                <h2 className="font-heading text-lg font-bold">Payment Method</h2>
                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {paymentOptions.map((option) => {
                    const Icon = option.icon
                    return (
                      <label key={option.value} className="group relative cursor-pointer">
                        <input className="peer sr-only" type="radio" name="paymentMethod" checked={provider === option.value} value={option.value} onChange={() => setProvider(option.value as Provider)} />
                        <div className="h-full rounded-lg border-2 border-border bg-background p-5 transition-all hover:border-primary/50 peer-checked:border-primary peer-checked:bg-primary/5">
                          <span className="flex items-center gap-3 font-bold text-foreground">
                            <Icon className="h-5 w-5 text-primary" />
                            {option.title}
                          </span>
                          <span className="mt-3 block text-xs leading-relaxed text-muted-foreground">{option.desc}</span>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="surface-raised bg-card p-6 sm:p-8">
                <h2 className="font-heading text-lg font-bold">Enrollment Options</h2>
                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  {batches.length ? (
                    <label className="block">
                      <span className="label flex min-h-5 items-center gap-2"><CalendarDays className="h-3.5 w-3.5" /> Batch</span>
                      <PremiumPicker
                        className="mt-2"
                        name="batchKey"
                        value={batchKey}
                        onChange={(event) => setBatchKey(event.target.value)}
                        options={batches.map((batch) => ({
                          value: batch.batchKey,
                          label: `${batch.batchLabel}${hideBatchSeatBalance || batch.remainingSeats === null ? "" : ` · ${batch.remainingSeats} seats left`}`
                        }))}
                      />
                      {selectedBatchStart ? (
                        <span className="mt-3 flex items-center gap-2 rounded-lg border border-primary/15 bg-primary/5 px-4 py-3 text-sm font-semibold text-foreground">
                          <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
                          <span>
                            Starts <span className="text-primary">{selectedBatchStart}</span>
                          </span>
                        </span>
                      ) : null}
                    </label>
                  ) : null}
                  <label className="block">
                    <span className="label flex min-h-5 items-center gap-2"><Users className="h-3.5 w-3.5" /> Enrollment type</span>
                    <PremiumPicker
                      className="mt-2"
                      name="buyerType"
                      value={buyerType}
                      onChange={(event) => setBuyerType(event.target.value === "family" ? "family" : "student")}
                      options={[
                        { value: "student", label: "Single learner" },
                        { value: "family", label: "Group seats" }
                      ]}
                    />
                  </label>
                  {buyerType === "family" ? (
                    <>
                      <div className="min-w-0 max-w-full">
                        <span className="label">Number of seats</span>
                        <SeatCountStepper
                          min={2}
                          max={500}
                          value={seatCount}
                          onChange={setSeatCount}
                        />
                      </div>
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed text-muted-foreground sm:col-span-2">
                        <p className="font-bold text-foreground">
                          {selectedSeatCount} seats selected • Total: {displayPrice || <PriceSkeleton compact />}
                        </p>
                        <p className="mt-2">
                          Buy multiple seats now under one account. After payment, the seats become available in your dashboard so you can assign them to the right learners.
                        </p>
                        {pricing?.groupDiscountMinor ? (
                          <p className="mt-3 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 font-semibold leading-snug text-primary">
                            <span>Group discount applied:</span>
                            <span>{pricing.groupUnitLabel || "discounted rate"} per seat.</span>
                            <span>You save {pricing.groupDiscountLabel || formatMinor(pricing.groupDiscountMinor, pricing.currency)}.</span>
                          </p>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                  <label className="flex items-start gap-3 rounded-lg border border-border bg-background p-4 text-sm font-medium leading-relaxed text-muted-foreground">
                    <input className="mt-1 h-4 w-4 accent-primary" type="checkbox" checked={whatsappOptIn} onChange={(event) => setWhatsappOptIn(event.target.checked)} />
                    <span>Send enrollment updates and class reminders to my WhatsApp number.</span>
                  </label>
                  {affiliateCode ? (
                    <input type="hidden" name="affiliateCode" value={affiliateCode} />
                  ) : null}
                </div>
              </div>

              <div className="surface-raised bg-card p-6 sm:p-8">
                <label className="block">
                  <span className="label">Have a coupon code?</span>
                  <div className="mt-2 flex gap-3">
                    <input className="field" value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} name="couponCode" placeholder="Enter code" />
                    <button type="button" onClick={applyCoupon} className="btn-secondary shrink-0">Apply</button>
                  </div>
                </label>
                {couponMessage ? <p className="mt-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400">{couponMessage}</p> : null}
              </div>

              {provider === "installment" ? (
                <div className="surface-raised bg-card p-6 sm:p-8">
                  <h2 className="font-heading text-lg font-bold">Installment Plan</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Your plan target is {displayPrice || <PriceSkeleton compact />}. Enter the amount you want to pay now. Leave blank to start with 50%.
                  </p>
                  <label className="mt-5 block">
                    <span className="label">First payment amount</span>
                    <input className="field mt-2" value={installmentAmount} onChange={(event) => setInstallmentAmount(event.target.value)} inputMode="decimal" placeholder="Example: 50000" />
                  </label>
                </div>
              ) : null}

              {provider === "manual_transfer" && manualDetails ? (
                <div className="surface-raised bg-card p-6 sm:p-8">
                  <h2 className="font-heading text-lg font-bold">Bank Transfer Details</h2>
                  <div className="mt-5 grid gap-3 rounded-lg bg-muted/50 p-4 text-sm">
                    <p><strong>Bank:</strong> {manualDetails.bankName || "Not configured"}</p>
                    <p><strong>Account name:</strong> {manualDetails.accountName || "Not configured"}</p>
                    <p><strong>Account number:</strong> {manualDetails.accountNumber || "Not configured"}</p>
                    <div className="mt-2 border-t border-border pt-3">
                      <p className="flex justify-between gap-4">
                        <strong>Course price:</strong>
                        <span>{manualDetails.pricing.courseAmountLabel || formatMinor(Number(manualDetails.pricing.courseAmountMinor || 0), manualDetails.pricing.currency)}</span>
                      </p>
                      <p className="mt-2 flex justify-between gap-4">
                        <strong>VAT:</strong>
                        <span>{manualDetails.pricing.vatLabel || formatMinor(Number(manualDetails.pricing.vatAmountMinor || 0), manualDetails.pricing.currency)}</span>
                      </p>
                      {manualDetails.pricing.discountMinor ? (
                        <p className="mt-2 flex justify-between gap-4">
                          <strong>Discount:</strong>
                          <span>-{manualDetails.pricing.discountLabel || formatMinor(manualDetails.pricing.discountMinor, manualDetails.pricing.currency)}</span>
                        </p>
                      ) : null}
                      <p className="mt-3 flex justify-between gap-4 text-base">
                        <strong>Amount:</strong>
                        <strong>{manualDetails.amountLabel}</strong>
                      </p>
                    </div>
                    {manualDetails.note ? <p className="text-muted-foreground">{manualDetails.note}</p> : null}
                  </div>
                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <label className="block">
                      <span className="label">Transfer reference</span>
                      <input className="field mt-2" value={transferReference} onChange={(event) => setTransferReference(event.target.value)} placeholder="Bank transaction reference" />
                    </label>
                    <label className="block">
                      <span className="label">Payment proof</span>
                      <span className="mt-2 flex min-h-12 items-center gap-3 rounded-md border border-dashed border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                        <UploadCloud className="h-5 w-5 text-primary" />
                        <span className="min-w-0 flex-1 truncate">{proofFileName || "Upload receipt, screenshot, or PDF"}</span>
                        <input
                          className="sr-only"
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          onChange={(event) => {
                            const file = event.target.files?.[0]
                            if (file) void uploadProof(file)
                          }}
                        />
                      </span>
                      {isUploadingProof ? <p className="mt-2 text-xs font-semibold text-muted-foreground">Uploading proof...</p> : null}
                      {proofUrl ? <p className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">Proof uploaded and ready to submit.</p> : null}
                    </label>
                  </div>
                </div>
              ) : null}

              {errorMessage ? <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">{errorMessage}</div> : null}
              {statusMessage ? <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">{statusMessage}</div> : null}

              <section className="surface-raised overflow-hidden bg-brand-ink text-white lg:hidden">
                <div className="p-6 sm:p-8">
                  <p className="eyebrow text-sky-400">Order Summary</p>
                  <h2 className="mt-2 font-heading text-2xl font-black tracking-tight"><TrademarkText text={course.title} /></h2>
                  <p className="mt-4 text-sm leading-relaxed text-slate-300">{course.description}</p>

                  <div className="mt-8 border-t border-dashed border-white/20 pt-8">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Investment</p>
                    <p className="mt-2 font-heading text-4xl font-black tracking-tight text-white">{displayPrice || <PriceSkeleton />}</p>
                    {pricing?.groupDiscountMinor ? <p className="mt-2 text-sm text-sky-300">Group savings: {pricing.groupDiscountLabel || formatMinor(pricing.groupDiscountMinor, pricing.currency)}</p> : null}
                    {pricing?.discountMinor ? <p className="mt-2 text-sm text-emerald-300">Discount: {pricing.discountLabel || formatMinor(pricing.discountMinor, pricing.currency)}</p> : null}
                    <CheckoutAmountBreakdown pricing={pricing} />
                  </div>

                  <div className="mt-8 border-t border-white/10 pt-8">
                    <p className="mb-6 text-xs font-bold uppercase tracking-widest text-slate-400">What is included</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {course.includes.map((item) => (
                        <div key={item} className="flex gap-3 text-sm font-medium text-slate-200">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                          <span className="leading-relaxed">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 p-6 sm:px-8">
                  <div className="flex items-center gap-3 text-xs font-medium text-slate-400">
                    <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-400" />
                    <p>Your payment is processed securely. Once confirmed, your learning account access is prepared immediately.</p>
                  </div>
                </div>
              </section>

              <div>
                <button className="btn-primary w-full py-4 text-base shadow-lg shadow-primary/20" type="submit" disabled={isSubmitting || !displayPrice} aria-busy={!displayPrice || isSubmitting}>
                  {isSubmitting
                    ? "Processing..."
                    : !displayPrice
                      ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />
                    : provider === "manual_transfer"
                      ? "Submit Manual Payment"
                      : provider === "installment"
                        ? `Start Installment Plan — ${displayPrice}`
                        : `Continue to Payment — ${displayPrice}`}
                </button>
                <div className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground">
                  <LockKeyhole className="h-4 w-4" />
                  Secure, encrypted transaction.
                </div>
              </div>
            </form>
          </div>

          <aside className="surface-raised sticky top-28 hidden overflow-hidden bg-brand-ink text-white lg:block">
            <div className="p-8 sm:p-10">
              <p className="eyebrow text-sky-400">Order Summary</p>
              <h2 className="mt-2 font-heading text-2xl font-black tracking-tight"><TrademarkText text={course.title} /></h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-300">{course.description}</p>

              <div className="mt-8 border-t border-dashed border-white/20 pt-8">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Investment</p>
                <p className="mt-2 font-heading text-4xl font-black tracking-tight text-white">{displayPrice || <PriceSkeleton />}</p>
                {pricing?.groupDiscountMinor ? <p className="mt-2 text-sm text-sky-300">Group savings: {pricing.groupDiscountLabel || formatMinor(pricing.groupDiscountMinor, pricing.currency)}</p> : null}
                {pricing?.discountMinor ? <p className="mt-2 text-sm text-emerald-300">Discount: {pricing.discountLabel || formatMinor(pricing.discountMinor, pricing.currency)}</p> : null}
                <CheckoutAmountBreakdown pricing={pricing} />
              </div>

              <div className="mt-8 border-t border-white/10 pt-8">
                <p className="mb-6 text-xs font-bold uppercase tracking-widest text-slate-400">What is included</p>
                <div className="grid gap-4">
                  {course.includes.map((item) => (
                    <div key={item} className="flex gap-3 text-sm font-medium text-slate-200">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                      <span className="leading-relaxed">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white/5 p-6 sm:px-10">
              <div className="flex items-center gap-3 text-xs font-medium text-slate-400">
                <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-400" />
                <p>Your payment is processed securely. Once confirmed, your learning account access is prepared immediately.</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
