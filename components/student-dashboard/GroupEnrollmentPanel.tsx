"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import { AlertTriangle, CheckCircle2, Plus, Trash2, UsersRound } from "lucide-react"
import Link from "next/link"

import { PremiumPicker } from "@/components/PremiumPicker"
import { showStudentToast } from "@/components/student-dashboard/StudentActionToaster"
import type { FamilySeatRow, LearningCourseOption } from "@/lib/student-dashboard"
import { formatDateTimeWAT } from "@/lib/utils"

type LearnerRow = {
  fullName: string
  age: string
  classLevel: string
  email: string
}

type GroupPricingPreview = {
  currency: string
  finalAmountMinor: number
  label: string
  groupDiscountMinor?: number
  groupDiscountLabel?: string
  groupUnitLabel?: string | null
}

const countryOptions = [
  { value: "NG", label: "Nigeria" },
  { value: "GB", label: "United Kingdom" },
  { value: "US", label: "United States" },
  { value: "IE", label: "Ireland" },
  { value: "CA", label: "Canada" },
  { value: "OTHER", label: "Other" }
]

function emptyLearner(): LearnerRow {
  return { fullName: "", age: "", classLevel: "", email: "" }
}

function groupCourseName(slug: string) {
  const map: Record<string, string> = {
    "prompt-to-profit": "Prompt to Profit",
    "prompt-to-production": "Prompt to Profit Advanced",
    "prompt-to-profit-holiday": "Prompt to Profit Holiday",
    "prompt-to-profit-schools": "Prompt to Profit for Schools",
    "ai-for-everyday-business-owners": "AI for Everyday Business Owners"
  }
  return map[slug] || slug.split("-").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ")
}

async function requestJson<T>(url: string, body: Record<string, unknown>, method = "POST") {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body)
  })
  const json = await response.json().catch(() => null)
  if (!response.ok || !json?.ok) throw new Error(json?.error || "Request failed")
  return json as T
}

export function GroupEnrollmentPanel({ seats, courses }: { seats: FamilySeatRow[]; courses: LearningCourseOption[] }) {
  const firstOpenSeat = seats.find((seat) => seat.seatsAvailable > 0)
  const [courseSlug, setCourseSlug] = useState(firstOpenSeat?.courseSlug || courses[0]?.courseSlug || "")
  const [batchKey, setBatchKey] = useState(firstOpenSeat?.batchKey || "")
  const [country, setCountry] = useState("NG")
  const [learners, setLearners] = useState<LearnerRow[]>([emptyLearner()])
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingPricing, setIsLoadingPricing] = useState(false)
  const [pricing, setPricing] = useState<GroupPricingPreview | null>(null)
  const [pricingProvider, setPricingProvider] = useState("")
  const [pricingSeatCount, setPricingSeatCount] = useState(0)
  const [pricingError, setPricingError] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const courseOptions = useMemo(() => {
    const map = new Map(courses.map((course) => [course.courseSlug, { value: course.courseSlug, label: course.courseTitle }]))
    seats.forEach((seat) => {
      if (seat.courseSlug) map.set(seat.courseSlug, { value: seat.courseSlug, label: groupCourseName(seat.courseSlug) })
    })
    return Array.from(map.values())
  }, [courses, seats])

  const selectedCourse = courses.find((course) => course.courseSlug === courseSlug)

  const batchOptions = useMemo(() => {
    const map = new Map<string, { value: string; label: string; batchLabel: string; purchasedOnly: boolean }>()
    selectedCourse?.batches.filter((batch) => batch.remainingSeats === null || batch.remainingSeats > 0).forEach((batch) => {
      const startLabel = formatDateTimeWAT(batch.batchStartAt)
      map.set(batch.batchKey, {
        value: batch.batchKey,
        label: `${batch.batchLabel}${startLabel ? ` · Starts ${startLabel}` : ""}`,
        batchLabel: batch.batchLabel,
        purchasedOnly: false
      })
    })
    seats
      .filter((seat) => seat.courseSlug === courseSlug && seat.batchKey)
      .forEach((seat) => {
        if (!map.has(seat.batchKey || "")) {
          const matchingBatch = selectedCourse?.batches.find((batch) => batch.batchKey === seat.batchKey)
          const startLabel = formatDateTimeWAT(matchingBatch?.batchStartAt)
          map.set(seat.batchKey || "", {
            value: seat.batchKey || "",
            label: `${seat.batchLabel || seat.batchKey}${startLabel ? ` · Starts ${startLabel}` : ""}`,
            batchLabel: seat.batchLabel || seat.batchKey || "",
            purchasedOnly: true
          })
        }
      })
    const mapped = Array.from(map.values())
    if (!mapped.length && selectedCourse?.enrollmentMode === "immediate") {
      return [{ value: "", label: "Immediate access", batchLabel: "Immediate access", purchasedOnly: false }]
    }
    if (!mapped.length) {
      return [{ value: "", label: "No open batch available", batchLabel: "", purchasedOnly: false }]
    }
    return mapped
  }, [courseSlug, seats, selectedCourse])

  const selectedSeat = seats.find((seat) => seat.courseSlug === courseSlug && (seat.batchKey || "") === batchKey)
  const selectedBatchLabel = batchOptions.find((option) => option.value === batchKey)?.batchLabel || selectedSeat?.batchLabel || ""
  const availableSeats = selectedSeat?.seatsAvailable || 0
  const purchasedSeats = selectedSeat?.seatsPurchased || 0
  const hasPurchasedSeatsForSelection = Boolean(selectedSeat && availableSeats > 0)
  const hasUsedUpPurchasedSeatsForSelection = Boolean(selectedSeat && purchasedSeats > 0 && availableSeats <= 0)
  const learnerCount = learners.length
  const willUseExistingSeats = availableSeats >= learnerCount
  const hasPurchasedGroupSeats = seats.some((seat) => seat.seatsPurchased > 0)
  const purchaseSeatCount = hasPurchasedGroupSeats ? learnerCount : Math.max(2, learnerCount)
  const isImmediateAccess = selectedCourse?.enrollmentMode === "immediate"
  const purchasableBatchOptions = useMemo(() => batchOptions.filter((option) => !option.purchasedOnly), [batchOptions])
  const hasOpenBatch = (willUseExistingSeats ? batchOptions : purchasableBatchOptions).some((option) => option.value) || isImmediateAccess

  useEffect(() => {
    const availableOptions = willUseExistingSeats ? batchOptions : purchasableBatchOptions
    const first = availableOptions.find((option) => option.value)?.value || ""
    if (!availableOptions.some((option) => option.value === batchKey)) setBatchKey(first)
  }, [batchKey, batchOptions, purchasableBatchOptions, willUseExistingSeats])

  useEffect(() => {
    if (!isOpen || willUseExistingSeats || !courseSlug || !hasOpenBatch) {
      setPricing(null)
      setPricingProvider("")
      setPricingError("")
      setIsLoadingPricing(false)
      return
    }
    let cancelled = false
    setIsLoadingPricing(true)
    setPricing(null)
    setPricingProvider("")
    setPricingError("")
    const timer = window.setTimeout(() => {
      requestJson<{ provider: string; seatCount: number; pricing: GroupPricingPreview }>("/api/student/group-enrollment", {
        courseSlug,
        batchKey,
        country,
        seatCount: purchaseSeatCount
      }, "PUT")
        .then((result) => {
          if (cancelled) return
          setPricing(result.pricing)
          setPricingProvider(result.provider)
          setPricingSeatCount(result.seatCount)
        })
        .catch((error) => {
          if (!cancelled) setPricingError(error instanceof Error ? error.message : "Could not load checkout pricing.")
        })
        .finally(() => {
          if (!cancelled) setIsLoadingPricing(false)
        })
    }, 200)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [batchKey, country, courseSlug, hasOpenBatch, isOpen, purchaseSeatCount, willUseExistingSeats])

  function updateLearner(index: number, key: keyof LearnerRow, value: string) {
    setLearners((current) => current.map((learner, idx) => (idx === index ? { ...learner, [key]: value } : learner)))
  }

  function addLearner() {
    setLearners((current) => [...current, emptyLearner()].slice(0, 500))
  }

  function removeLearner(index: number) {
    setLearners((current) => (current.length <= 1 ? current : current.filter((_, idx) => idx !== index)))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setMessage("")
    setError("")
    
    const children = learners.map((learner) => ({
      fullName: learner.fullName.trim(),
      age: learner.age.trim(),
      classLevel: learner.classLevel.trim(),
      email: learner.email.trim()
    }))
    
    if (children.some((child) => !child.fullName)) {
      const errorMessage = "Please ensure each learner has a full name before continuing."
      setError(errorMessage)
      showStudentToast({ type: "error", title: "Group enrollment incomplete", message: errorMessage })
      return
    }
    if (!courseSlug) {
      const errorMessage = "No active course is available for group enrollment."
      setError(errorMessage)
      showStudentToast({ type: "error", title: "Group enrollment unavailable", message: errorMessage })
      return
    }
    if (!hasOpenBatch) {
      const errorMessage = "No open batch is available for this programme."
      setError(errorMessage)
      showStudentToast({ type: "error", title: "Batch unavailable", message: errorMessage })
      return
    }

    setIsSubmitting(true)
    try {
      const result = await requestJson<{ usedExistingSeats?: boolean; checkoutUrl?: string }>("/api/student/group-enrollment", {
        courseSlug,
        batchKey,
        batchLabel: selectedBatchLabel,
        country,
        children
      })
      if (result.usedExistingSeats) {
        setMessage("Learner access successfully assigned from your purchased seats.")
        showStudentToast({ type: "success", title: "Learners assigned", message: "Learner access was assigned from your purchased seats." })
        setLearners([emptyLearner()])
        window.location.reload()
        return
      }
      if (result.checkoutUrl) {
        showStudentToast({ type: "info", title: "Opening checkout", message: "Secure checkout is opening for the selected learners." })
        window.location.href = result.checkoutUrl
        return
      }
      throw new Error("Checkout link was not returned by the server.")
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Could not create group enrollment."
      setError(errorMessage)
      showStudentToast({ type: "error", title: "Group enrollment failed", message: errorMessage })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="surface-raised bg-card p-0 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-border bg-muted/20 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <p className="eyebrow text-primary">Assign Learners</p>
          <h2 className="mt-1 font-heading text-xl font-bold text-foreground sm:text-2xl">Group Enrollment</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Buy seats for multiple learners or assign learners to seats you have already purchased. Existing open seats are used first; otherwise, checkout opens for the selected learners.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <Link href="/dashboard/courses" className="btn-secondary w-full sm:w-auto">My own courses</Link>
          <button
            type="button"
            onClick={() => setIsOpen((current) => !current)}
            className={isOpen ? "btn-secondary w-full sm:w-auto" : "btn-primary w-full sm:w-auto"}
          >
            {isOpen ? "Close Panel" : "Assign Learners"}
          </button>
          {!isOpen ? (
            <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary lg:flex">
              <UsersRound className="h-6 w-6" />
            </div>
          ) : null}
        </div>
      </div>

      {/* Form Body */}
      {isOpen ? <div className="p-6 sm:p-8">
        <form onSubmit={submit} className="grid gap-8">
          
          {/* Program Configuration */}
          <div className="grid gap-6 rounded-xl border border-border bg-background/50 p-5 sm:p-6 md:grid-cols-3">
            {!willUseExistingSeats ? <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Programme</span>
              <div className="mt-1">
                <PremiumPicker value={courseSlug} options={courseOptions} onChange={(event) => setCourseSlug(event.target.value)} />
              </div>
            </label> : null}
            {!willUseExistingSeats && !isImmediateAccess ? (
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Batch Allocation</span>
                <div className="mt-1">
                  <PremiumPicker
                    value={batchKey}
                    options={purchasableBatchOptions}
                    onChange={(event) => setBatchKey(event.target.value)}
                    disabled={!hasOpenBatch}
                  />
                </div>
              </label>
            ) : null}
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Billing Region</span>
              <div className="mt-1">
                <PremiumPicker value={country} options={countryOptions} onChange={(event) => setCountry(event.target.value)} />
              </div>
            </label>
          </div>

          {/* Seat Availability Banner */}
          <div className={`flex items-start gap-4 rounded-xl border p-5 ${
            willUseExistingSeats 
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' 
              : 'border-primary/20 bg-primary/10 text-primary'
          }`}>
            {willUseExistingSeats ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            )}
            <div>
              <p className="font-bold">
                {hasPurchasedSeatsForSelection
                  ? `${availableSeats} purchased seat${availableSeats === 1 ? "" : "s"} available`
                  : hasUsedUpPurchasedSeatsForSelection
                    ? "All purchased seats for this batch have been assigned"
                    : "No purchased seats yet"}
              </p>
              <p className="mt-1 text-sm font-medium opacity-90">
                {willUseExistingSeats
                  ? "This assignment will use your existing purchased seats. No additional payment is required."
                  : hasUsedUpPurchasedSeatsForSelection
                    ? "You can continue to checkout to buy additional group seats for these learners."
                  : hasPurchasedSeatsForSelection
                    ? `You are adding ${learnerCount} learner${learnerCount === 1 ? "" : "s"}, which is more than your available seat balance. Continuing will open checkout for the selected learners.`
                    : "Enter the learner details below. Continuing will open checkout so you can buy the required group seats."}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Checkout Summary</p>
                <p className="mt-2 font-heading text-lg font-black text-foreground">
                  {willUseExistingSeats
                    ? "No additional payment required"
                    : isLoadingPricing
                      ? "Loading checkout total..."
                      : pricing
                        ? `${pricingSeatCount} seat${pricingSeatCount === 1 ? "" : "s"} · ${pricing.label}`
                        : pricingError || "Choose an available batch to see the total."}
                </p>
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                Payment method: {willUseExistingSeats ? "Existing seats" : !pricingProvider ? "Loading..." : pricingProvider === "stripe" ? "Stripe" : "Paystack"}
              </p>
            </div>
            {!willUseExistingSeats && !hasPurchasedGroupSeats && learnerCount === 1 ? (
              <p className="mt-3 text-sm font-medium text-muted-foreground">The initial group purchase has a minimum of 2 seats.</p>
            ) : null}
            {pricing?.groupDiscountMinor ? (
              <p className="mt-3 text-sm font-semibold text-primary">
                Group discount applied: {pricing.groupUnitLabel || "discounted rate"} per seat. You save {pricing.groupDiscountLabel}.
              </p>
            ) : null}
          </div>

          {/* Learner Roster */}
          <div className="grid gap-6">
            <h3 className="font-heading text-lg font-bold text-foreground">Learner Details</h3>
            <div className="grid gap-5">
              {learners.map((learner, index) => (
                <div key={index} className="group relative rounded-xl border border-border bg-background p-5 transition-colors hover:border-primary/30 hover:shadow-sm sm:p-6">
                  <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
                    <h4 className="flex items-center gap-2 font-heading text-sm font-bold text-foreground">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground">
                        {index + 1}
                      </span>
                      Learner Profile
                    </h4>
                    <button
                      type="button"
                      onClick={() => removeLearner(index)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={learners.length <= 1}
                      aria-label="Remove learner"
                      title="Remove learner"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <div className="mt-5 grid gap-5 md:grid-cols-4">
                    <label className="block md:col-span-2">
                      <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Full Name</span>
                      <input 
                        className="w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary" 
                        value={learner.fullName} 
                        onChange={(event) => updateLearner(index, "fullName", event.target.value)} 
                        placeholder="e.g. John Doe" 
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Age</span>
                      <input 
                        className="w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary" 
                        value={learner.age} 
                        onChange={(event) => updateLearner(index, "age", event.target.value)} 
                        inputMode="numeric" 
                        placeholder="e.g. 10" 
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Class / Level</span>
                      <input 
                        className="w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary" 
                        value={learner.classLevel} 
                        onChange={(event) => updateLearner(index, "classLevel", event.target.value)} 
                        placeholder="e.g. Primary 5" 
                      />
                    </label>
                    <label className="block md:col-span-4">
                      <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Email (Optional)</span>
                      <input 
                        className="w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary" 
                        value={learner.email} 
                        onChange={(event) => updateLearner(index, "email", event.target.value)} 
                        type="email" 
                        placeholder="learner@example.com" 
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form Alerts */}
          {message && (
            <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="font-semibold leading-relaxed">{message}</p>
            </div>
          )}
          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="font-semibold leading-relaxed">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-end">
            <button 
              type="button" 
              onClick={addLearner} 
              className="btn-secondary flex w-full items-center justify-center sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4 text-muted-foreground" />
              Add Another Learner
            </button>
            <button 
              type="submit" 
              className="btn-primary flex w-full items-center justify-center shadow-sm sm:w-auto" 
              disabled={isSubmitting || !courseSlug || !hasOpenBatch || (!willUseExistingSeats && (!pricing || Boolean(pricingError)))}
            >
              {isSubmitting 
                ? "Processing..." 
                : willUseExistingSeats 
                  ? "Assign Learners" 
                  : "Continue to Checkout"
              }
            </button>
          </div>
          
        </form>
      </div> : null}
    </section>
  )
}
