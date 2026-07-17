"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import Link from "next/link"
import { CheckCircle2, CreditCard, ShieldCheck, WalletCards } from "lucide-react"

import { PremiumPicker } from "@/components/PremiumPicker"
import { SeatCountStepper } from "@/components/SeatCountStepper"
import { showStudentToast } from "@/components/student-dashboard/StudentActionToaster"
import type { LearningCourseOption } from "@/lib/student-dashboard"
import type { StudentInstallmentPlan } from "@/lib/student-installments"

type Props = {
  account: {
    fullName: string
    email: string
    phone: string
  }
  courses: LearningCourseOption[]
  plans: StudentInstallmentPlan[]
}

const countryOptions = [
  { value: "NG", label: "Nigeria" },
  { value: "GB", label: "United Kingdom" },
  { value: "US", label: "United States" },
  { value: "IE", label: "Ireland" },
  { value: "CA", label: "Canada" },
  { value: "OTHER", label: "Other" }
]

function isNigeria(value: string) {
  const normalized = value.trim().toLowerCase()
  return normalized === "ng" || normalized === "nga" || normalized === "nigeria"
}

function money(minor: number, currency: string) {
  const locale = currency === "NGN" ? "en-NG" : currency === "GBP" ? "en-GB" : currency === "EUR" ? "en-IE" : "en-US"
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "NGN" ? 0 : 2
  }).format(Number(minor || 0) / 100)
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

export function InstallmentsPanel({ account, courses, plans }: Props) {
  const [courseSlug, setCourseSlug] = useState(courses[0]?.courseSlug || "")
  const [batchKey, setBatchKey] = useState(courses[0]?.batches[0]?.batchKey || "")
  const [country, setCountry] = useState("NG")
  const [buyerType, setBuyerType] = useState<"student" | "family">("student")
  const [seatCount, setSeatCount] = useState(2)
  const [couponCode, setCouponCode] = useState("")
  const [firstAmount, setFirstAmount] = useState("")
  const [topUpAmounts, setTopUpAmounts] = useState<Record<string, string>>({})
  const [busyKey, setBusyKey] = useState("")

  const selectedCourse = courses.find((course) => course.courseSlug === courseSlug)
  const selectedBatchOptions = useMemo<Array<{ value: string; label: string; disabled?: boolean }>>(() => {
    const batches = selectedCourse?.batches || []
    if (!batches.length && selectedCourse?.enrollmentMode === "immediate") return [{ value: "", label: "Immediate access" }]
    if (!batches.length) return [{ value: "", label: "No open batch available", disabled: true }]
    return batches.map((batch) => ({
      value: batch.batchKey,
      label: `${batch.batchLabel}${courseSlug === "prompt-to-profit-holiday" || batch.remainingSeats === null ? "" : ` · ${batch.remainingSeats} seats left`}`
    }))
  }, [courseSlug, selectedCourse])
  const provider = isNigeria(country) ? "paystack" : "stripe"

  useEffect(() => {
    const first = selectedBatchOptions.find((option) => !option.disabled)?.value || ""
    if (!selectedBatchOptions.some((option) => option.value === batchKey)) setBatchKey(first)
  }, [batchKey, selectedBatchOptions])

  async function startPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusyKey("new")
    try {
      const plan = await postJson<{ planUuid: string; pricing: { currency: string; finalAmountMinor: number } }>("/api/checkout/installment-plan", {
        courseSlug,
        returnSlug: courseSlug,
        firstName: account.fullName,
        email: account.email,
        phone: account.phone,
        country,
        provider,
        couponCode,
        batchKey,
        buyerType,
        seatCount: buyerType === "family" ? seatCount : 1,
        whatsappOptIn: true
      })
      const requestedAmount = Math.round(Number(firstAmount || 0) * 100)
      const amountMinor = requestedAmount > 0 ? requestedAmount : Math.ceil(Number(plan.pricing.finalAmountMinor || 0) / 2)
      const payment = await postJson<{ checkoutUrl: string }>("/api/checkout/installment-payment", {
        planUuid: plan.planUuid,
        email: account.email,
        provider,
        currency: plan.pricing.currency,
        amountMinor
      })
      showStudentToast({ type: "success", title: "Installment started", message: "Redirecting to secure payment." })
      window.location.href = payment.checkoutUrl
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start installment."
      showStudentToast({ type: "error", title: "Installment failed", message })
    } finally {
      setBusyKey("")
    }
  }

  async function payPlan(plan: StudentInstallmentPlan) {
    setBusyKey(plan.planUuid)
    try {
      const requestedAmount = Math.round(Number(topUpAmounts[plan.planUuid] || 0) * 100)
      const amountMinor = requestedAmount > 0 ? requestedAmount : plan.remainingMinor
      const payment = await postJson<{ checkoutUrl: string }>("/api/checkout/installment-payment", {
        planUuid: plan.planUuid,
        email: account.email,
        provider: plan.provider,
        currency: plan.currency,
        amountMinor
      })
      showStudentToast({ type: "success", title: "Payment ready", message: "Redirecting to secure payment." })
      window.location.href = payment.checkoutUrl
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start payment."
      showStudentToast({ type: "error", title: "Payment failed", message })
      setBusyKey("")
    }
  }

  return (
    <div className="grid gap-8">
      <section className="surface-raised bg-card p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <WalletCards className="h-5 w-5" />
          </div>
          <div>
            <p className="eyebrow text-primary">Installment Wallet</p>
            <h2 className="mt-1 font-heading text-xl font-bold text-foreground">Start New Installment Plan</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Start a flexible payment plan for an open programme. Your plan stays visible here until it is fully paid and enrolled.
            </p>
          </div>
        </div>

        <form onSubmit={startPlan} className="mt-7 grid min-w-0 gap-5 lg:grid-cols-2">
          <label className="block">
            <span className="label">Select Course</span>
            <PremiumPicker className="mt-2" value={courseSlug} onChange={(event) => setCourseSlug(event.target.value)} options={courses.map((course) => ({ value: course.courseSlug, label: course.courseTitle }))} required />
          </label>
          <label className="block">
            <span className="label">Target Batch</span>
            <PremiumPicker className="mt-2" value={batchKey} onChange={(event) => setBatchKey(event.target.value)} options={selectedBatchOptions} required={selectedCourse?.enrollmentMode !== "immediate"} />
          </label>
          <label className="block">
            <span className="label">Payment Country</span>
            <PremiumPicker className="mt-2" value={country} onChange={(event) => setCountry(event.target.value)} options={countryOptions} required />
          </label>
          <label className="block">
            <span className="label">Enrollment Type</span>
            <PremiumPicker
              className="mt-2"
              value={buyerType}
              onChange={(event) => setBuyerType(event.target.value === "family" ? "family" : "student")}
              options={[
                { value: "student", label: "Single learner" },
                { value: "family", label: "Group enrollment" }
              ]}
            />
          </label>
          {buyerType === "family" ? (
            <div className="min-w-0 max-w-full">
              <span className="label">Number of Seats</span>
              <SeatCountStepper min={2} max={500} value={seatCount} onChange={setSeatCount} />
            </div>
          ) : null}
          <label className="block">
            <span className="label">Coupon Code (Optional)</span>
            <input className="field mt-2" value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} placeholder="Enter coupon code" />
          </label>
          <label className="block">
            <span className="label">First Payment Amount</span>
            <input className="field mt-2" value={firstAmount} onChange={(event) => setFirstAmount(event.target.value)} inputMode="decimal" placeholder="Leave blank to start with 50%" />
          </label>
          <div className="flex items-end">
            <button className="btn-primary w-full" disabled={busyKey === "new" || !courseSlug || (!batchKey && selectedCourse?.enrollmentMode !== "immediate")}>
              {busyKey === "new" ? "Starting..." : "Start Installment"}
            </button>
          </div>
        </form>
      </section>

      <section className="surface-raised bg-card p-6 sm:p-8">
        <p className="eyebrow text-primary">Active Plans</p>
        <h2 className="mt-1 font-heading text-xl font-bold text-foreground">Your Installment Plans</h2>
        <div className="mt-6 grid gap-5">
          {plans.length ? plans.map((plan) => {
            const progress = plan.targetAmountMinor > 0 ? Math.min(100, Math.round((plan.totalPaidMinor / plan.targetAmountMinor) * 100)) : 0
            return (
              <article key={plan.planUuid} className="rounded-xl border border-border bg-background p-5">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-heading text-lg font-bold text-foreground">{plan.courseTitle}</h3>
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-primary">{plan.status}</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {plan.batchLabel || "Immediate access"} • {plan.buyerType === "family" ? `${plan.seatCount} seats` : "Single learner"}
                    </p>
                    <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                      <p><strong className="text-foreground">{money(plan.targetAmountMinor, plan.currency)}</strong><br />Target</p>
                      <p><strong className="text-foreground">{money(plan.totalPaidMinor, plan.currency)}</strong><br />Paid</p>
                      <p><strong className="text-foreground">{money(plan.remainingMinor, plan.currency)}</strong><br />Balance</p>
                    </div>
                  </div>
                  <div className="w-full shrink-0 lg:w-72">
                    {plan.status === "enrolled" ? (
                      <Link href="/dashboard/courses" className="btn-primary inline-flex w-full items-center justify-center gap-2">
                        <CheckCircle2 className="h-4 w-4" /> Open Courses
                      </Link>
                    ) : (
                      <div className="grid gap-3">
                        <input
                          className="field"
                          value={topUpAmounts[plan.planUuid] || ""}
                          onChange={(event) => setTopUpAmounts((current) => ({ ...current, [plan.planUuid]: event.target.value }))}
                          inputMode="decimal"
                          placeholder={`Pay balance: ${money(plan.remainingMinor, plan.currency)}`}
                        />
                        <button className="btn-primary inline-flex w-full items-center justify-center gap-2" onClick={() => payPlan(plan)} disabled={busyKey === plan.planUuid || plan.remainingMinor <= 0}>
                          <CreditCard className="h-4 w-4" /> {busyKey === plan.planUuid ? "Opening..." : "Pay Installment"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {plan.payments.length ? (
                  <div className="mt-5 rounded-lg border border-border bg-muted/30 p-4">
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Payment History</p>
                    <div className="grid gap-2 text-sm">
                      {plan.payments.map((payment) => (
                        <div key={payment.paymentUuid} className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-muted-foreground">{new Date(payment.createdAt).toLocaleDateString("en-GB")} • {payment.status}</span>
                          <strong>{money(payment.amountMinor, payment.currency)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>
            )
          }) : (
            <div className="rounded-xl border border-dashed border-border bg-background p-8 text-center">
              <ShieldCheck className="mx-auto h-9 w-9 text-primary" />
              <h3 className="mt-4 font-heading text-lg font-bold text-foreground">No installment plan yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">Start a plan above and it will appear here immediately.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
