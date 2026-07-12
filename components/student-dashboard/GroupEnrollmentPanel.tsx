"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import { AlertTriangle, CheckCircle2, Plus, Trash2, UsersRound } from "lucide-react"

import { PremiumPicker } from "@/components/PremiumPicker"
import { showStudentToast } from "@/components/student-dashboard/StudentActionToaster"
import type { FamilySeatRow, LearningCourseOption } from "@/lib/student-dashboard"

type LearnerRow = {
  fullName: string
  age: string
  classLevel: string
  email: string
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

export function GroupEnrollmentPanel({ seats, courses }: { seats: FamilySeatRow[]; courses: LearningCourseOption[] }) {
  const firstOpenSeat = seats.find((seat) => seat.seatsAvailable > 0)
  const [courseSlug, setCourseSlug] = useState(firstOpenSeat?.courseSlug || courses[0]?.courseSlug || "")
  const [batchKey, setBatchKey] = useState(firstOpenSeat?.batchKey || "")
  const [country, setCountry] = useState("NG")
  const [learners, setLearners] = useState<LearnerRow[]>([emptyLearner()])
  
  const [isSubmitting, setIsSubmitting] = useState(false)
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
    const map = new Map<string, { value: string; label: string }>()
    const hideBatchSeatBalance = courseSlug === "prompt-to-profit-holiday"
    selectedCourse?.batches.forEach((batch) => {
      map.set(batch.batchKey, {
        value: batch.batchKey,
        label: `${batch.batchLabel}${hideBatchSeatBalance || batch.remainingSeats === null ? "" : ` · ${batch.remainingSeats} seats left`}`
      })
    })
    seats
      .filter((seat) => seat.courseSlug === courseSlug && seat.batchKey)
      .forEach((seat) => {
        if (!map.has(seat.batchKey || "")) {
          map.set(seat.batchKey || "", {
            value: seat.batchKey || "",
            label: `${seat.batchLabel || seat.batchKey} · ${seat.seatsAvailable} purchased seats open`
          })
        }
      })
    const mapped = Array.from(map.values())
    if (!mapped.length && selectedCourse?.enrollmentMode === "immediate") return [{ value: "", label: "Immediate access" }]
    if (!mapped.length) return [{ value: "", label: "No open batch available" }]
    return mapped
  }, [courseSlug, seats, selectedCourse])

  useEffect(() => {
    const first = batchOptions[0]?.value || ""
    if (!batchOptions.some((option) => option.value === batchKey)) setBatchKey(first)
  }, [batchKey, batchOptions])

  const selectedSeat = seats.find((seat) => seat.courseSlug === courseSlug && (seat.batchKey || "") === batchKey)
  const selectedBatchLabel = batchOptions.find((option) => option.value === batchKey)?.label?.split(" · ")[0] || selectedSeat?.batchLabel || ""
  const availableSeats = selectedSeat?.seatsAvailable || 0
  const hasPurchasedSeatsForSelection = Boolean(selectedSeat && availableSeats > 0)
  const learnerCount = learners.length
  const willUseExistingSeats = availableSeats >= learnerCount
  const isImmediateAccess = selectedCourse?.enrollmentMode === "immediate"
  const hasOpenBatch = batchOptions.some((option) => option.value) || isImmediateAccess

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
      const result = await postJson<{ usedExistingSeats?: boolean; checkoutUrl?: string }>("/api/student/group-enrollment", {
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
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <UsersRound className="h-6 w-6" />
        </div>
      </div>

      {/* Form Body */}
      <div className="p-6 sm:p-8">
        <form onSubmit={submit} className="grid gap-8">
          
          {/* Program Configuration */}
          <div className="grid gap-6 rounded-xl border border-border bg-background/50 p-5 sm:p-6 md:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Programme</span>
              <div className="mt-1">
                <PremiumPicker value={courseSlug} options={courseOptions} onChange={(event) => setCourseSlug(event.target.value)} />
              </div>
            </label>
            {!isImmediateAccess ? (
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Batch Allocation</span>
                <div className="mt-1">
                  <PremiumPicker
                    value={batchKey}
                    options={batchOptions}
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
                  : "No purchased seats yet"}
              </p>
              <p className="mt-1 text-sm font-medium opacity-90">
                {willUseExistingSeats
                  ? "This assignment will use your existing purchased seats. No additional payment is required."
                  : hasPurchasedSeatsForSelection
                    ? `You are adding ${learnerCount} learner${learnerCount === 1 ? "" : "s"}, which is more than your available seat balance. Continuing will open checkout for the selected learners.`
                    : "Enter the learner details below. Continuing will open checkout so you can buy the required group seats."}
              </p>
            </div>
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
              disabled={isSubmitting || !courseSlug || !hasOpenBatch}
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
      </div>
    </section>
  )
}
