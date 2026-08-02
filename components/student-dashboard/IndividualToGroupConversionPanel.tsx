"use client"

import { useState, type FormEvent } from "react"
import { AlertTriangle, ArrowLeftRight } from "lucide-react"

import { PremiumPicker } from "@/components/PremiumPicker"
import { showStudentToast } from "@/components/student-dashboard/StudentActionToaster"
import type { ConvertibleIndividualEnrollment } from "@/lib/group-enrollment-conversion"

const inputClass = "w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary"
const labelClass = "mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground"

export function IndividualToGroupConversionPanel({
  enrollments
}: {
  enrollments: ConvertibleIndividualEnrollment[]
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [sourceKey, setSourceKey] = useState(enrollments[0] ? `${enrollments[0].sourceType}:${enrollments[0].sourceUuid}` : "")
  const [childName, setChildName] = useState("")
  const [childAge, setChildAge] = useState("")
  const [childClassLevel, setChildClassLevel] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [confirmed, setConfirmed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  if (!enrollments.length) return null

  const selected = enrollments.find((item) => `${item.sourceType}:${item.sourceUuid}` === sourceKey) || enrollments[0]
  const enrollmentOptions = enrollments.map((item) => ({
    value: `${item.sourceType}:${item.sourceUuid}`,
    label: `${item.courseName} · ${item.batchLabel}`
  }))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    if (!selected || !childName.trim() || !currentPassword || !confirmed) {
      const message = "Complete the learner details, password, and confirmation."
      setError(message)
      showStudentToast({ type: "error", title: "Conversion incomplete", message })
      return
    }
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/student/group-enrollment/convert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceType: selected.sourceType,
          sourceUuid: selected.sourceUuid,
          childName: childName.trim(),
          childAge: childAge.trim(),
          childClassLevel: childClassLevel.trim(),
          currentPassword,
          confirmConversion: true
        })
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.ok) throw new Error(result?.error || "Could not move this enrollment to Group Enrollment.")
      showStudentToast({
        type: "success",
        title: "Enrollment moved",
        message: result.message || "The learner is now in your group workspace."
      })
      window.location.reload()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not move this enrollment to Group Enrollment."
      setError(message)
      showStudentToast({ type: "error", title: "Conversion failed", message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="surface-raised mb-8 overflow-hidden bg-card p-0">
      <div className="flex flex-col gap-4 border-b border-border bg-muted/20 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ArrowLeftRight className="h-5 w-5" />
          </div>
          <div>
            <p className="eyebrow text-primary">Existing Learner Enrollment</p>
            <h2 className="mt-1 font-heading text-xl font-bold text-foreground">Move a Learner to Group Enrollment</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              If you originally enrolled as an individual on behalf of someone else, move that paid enrollment here before adding another learner.
            </p>
          </div>
        </div>
        <button type="button" onClick={() => setIsOpen((current) => !current)} className={isOpen ? "btn-secondary" : "btn-primary"}>
          {isOpen ? "Close Panel" : "Move Enrollment"}
        </button>
      </div>

      {isOpen ? (
        <form onSubmit={submit} data-toast-managed="true" className="grid gap-6 p-6 sm:p-8">
          <div className="flex items-start gap-4 rounded-xl border border-primary/20 bg-primary/10 p-5 text-primary">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">This moves the learner access, not the payment.</p>
              <p className="mt-1 text-sm font-medium opacity-90">
                The original payment remains on your account. Course access and learning progress move to a managed learner with a separate group access code.
              </p>
            </div>
          </div>

          <div className="grid gap-5 rounded-xl border border-border bg-background/50 p-5 sm:p-6 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className={labelClass}>Enrollment to move</span>
              <PremiumPicker value={sourceKey} options={enrollmentOptions} onChange={(event) => setSourceKey(event.target.value)} />
            </label>
            <label className="block md:col-span-2">
              <span className={labelClass}>Learner&apos;s full name</span>
              <input className={inputClass} value={childName} onChange={(event) => setChildName(event.target.value)} required />
            </label>
            <label className="block">
              <span className={labelClass}>Age (Optional)</span>
              <input className={inputClass} value={childAge} onChange={(event) => setChildAge(event.target.value)} inputMode="numeric" />
            </label>
            <label className="block">
              <span className={labelClass}>Class or Level (Optional)</span>
              <input className={inputClass} value={childClassLevel} onChange={(event) => setChildClassLevel(event.target.value)} />
            </label>
            <label className="block md:col-span-2">
              <span className={labelClass}>Current password</span>
              <input className={inputClass} type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
            </label>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-5 text-sm font-medium text-foreground">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-primary" />
            <span>
              I confirm this course was purchased for the learner named above. I understand that my individual learner access for this course will move to the learner&apos;s group access code.
            </span>
          </label>

          {error ? (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="font-semibold leading-relaxed">{error}</p>
            </div>
          ) : null}

          <div className="flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-end">
            <button type="submit" className="btn-primary w-full sm:w-auto" disabled={isSubmitting || !childName.trim() || !currentPassword || !confirmed}>
              {isSubmitting ? "Moving Enrollment..." : "Confirm and Move Enrollment"}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  )
}
