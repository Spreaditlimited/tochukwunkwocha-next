"use client"

import { AlertCircle, Loader2, UserPlus } from "lucide-react"
import { useActionState, useEffect, useMemo, useRef, useState } from "react"

import { PremiumPicker } from "@/components/PremiumPicker"
import { showInternalToast } from "@/components/internal/InternalActionToaster"
import type { AffiliateAdminOption } from "@/lib/admin-affiliates"
import type { EnrollmentBatchOption, EnrollmentCourseOption } from "@/lib/admin-enrollments"
import {
  addExternalStudentPaymentAction,
  type ExternalStudentPaymentActionState
} from "./actions"
import { ExternalGroupAssignmentFields } from "./ExternalGroupAssignmentFields"

const inputClass =
  "h-12 w-full rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground shadow-sm outline-none transition hover:border-primary/40 hover:bg-background focus:border-primary focus:bg-background focus:shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]"
const labelClass = "mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
const initialActionState: ExternalStudentPaymentActionState = {
  status: "idle",
  title: "",
  message: "",
  submittedAt: 0
}

function batchCanReceiveEnrollment(batch: EnrollmentBatchOption) {
  return batch.isActive || (batch.courseSlug === "prompt-to-profit-holiday" && batch.status.toLowerCase() === "open")
}

export function AddExternalStudentForm({
  courses,
  batches,
  affiliateOptions
}: {
  courses: EnrollmentCourseOption[]
  batches: EnrollmentBatchOption[]
  affiliateOptions: AffiliateAdminOption[]
}) {
  const [state, formAction, pending] = useActionState(
    addExternalStudentPaymentAction,
    initialActionState
  )
  const [courseSlug, setCourseSlug] = useState("")
  const [batchKey, setBatchKey] = useState("")
  const formRef = useRef<HTMLFormElement>(null)
  const selectedCourse = courses.find((course) => course.slug === courseSlug) || null
  const immediateAccess = selectedCourse?.enrollmentMode === "immediate"
  const batchOptions = useMemo(
    () => batches
      .filter((batch) => batch.courseSlug === courseSlug && batchCanReceiveEnrollment(batch))
      .map((batch) => ({
        key: `${batch.courseSlug}-${batch.batchKey}`,
        value: batch.batchKey,
        label: `${batch.batchLabel}${batch.remainingSeats === null ? "" : ` · ${batch.remainingSeats} seats left`}`
      })),
    [batches, courseSlug]
  )
  const batchRequiredButUnavailable = Boolean(courseSlug && !immediateAccess && !batchOptions.length)

  useEffect(() => {
    setBatchKey("")
  }, [courseSlug])

  useEffect(() => {
    if (state.status === "idle") return
    showInternalToast({
      type: state.status,
      title: state.title,
      message: state.message
    })
    if (state.status === "success") {
      formRef.current?.reset()
      setCourseSlug("")
      setBatchKey("")
    }
  }, [state.message, state.status, state.submittedAt, state.title])

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border bg-muted/20 p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-heading text-xl font-black text-foreground">Add External Student</h2>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              Provision access for a verified offline payment. Programme and batch allocation are confirmed before any record is created.
            </p>
          </div>
        </div>
      </div>

      <form ref={formRef} action={formAction} data-toast-managed="true" className="p-6 sm:p-8">
        {state.status === "error" ? (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-heading text-sm font-black">{state.title}</p>
              <p className="mt-1 text-sm font-medium leading-relaxed">{state.message}</p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className={labelClass}>Enrollment Source</span>
            <PremiumPicker
              name="sourceType"
              defaultValue="manual"
              options={[{ value: "manual", label: "Verified Offline Payment" }]}
              required
            />
          </label>
          <label className="block">
            <span className={labelClass}>Programme</span>
            <PremiumPicker
              name="courseSlug"
              value={courseSlug}
              onChange={(event) => setCourseSlug(event.target.value)}
              options={courses.map((course) => ({ value: course.slug, label: course.label }))}
              placeholder="Select a programme"
              required
            />
          </label>
          <label className="block">
            <span className={labelClass}>Batch Allocation</span>
            {immediateAccess ? (
              <>
                <input type="hidden" name="batchKey" value="" />
                <PremiumPicker value="immediate" options={[{ value: "immediate", label: "Immediate access" }]} disabled />
              </>
            ) : (
              <PremiumPicker
                name="batchKey"
                value={batchKey}
                onChange={(event) => setBatchKey(event.target.value)}
                options={batchOptions}
                placeholder={batchRequiredButUnavailable ? "No active batch available" : "Select a batch"}
                disabled={!courseSlug || batchRequiredButUnavailable}
                required
              />
            )}
            {batchRequiredButUnavailable ? (
              <p className="mt-2 text-xs font-semibold text-destructive">Create or activate a batch before provisioning access.</p>
            ) : null}
          </label>
          <label className="block">
            <span className={labelClass}>Full Name</span>
            <input name="firstName" required placeholder="Learner&apos;s full name" className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Email Address</span>
            <input name="email" type="email" required placeholder="student@example.com" className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Phone Number</span>
            <input name="phone" required placeholder="+234..." className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Country</span>
            <input name="country" defaultValue="Nigeria" required placeholder="Nigeria" className={inputClass} />
          </label>
          <ExternalGroupAssignmentFields key={state.status === "success" ? state.submittedAt : 0} />
          <label className="block">
            <span className={labelClass}>Coupon Code</span>
            <input name="couponCode" placeholder="Optional" className={`${inputClass} uppercase`} />
          </label>
          <label className="block">
            <span className={labelClass}>Affiliate</span>
            <PremiumPicker
              name="affiliateCode"
              defaultValue=""
              options={affiliateOptions.map((affiliate) => ({
                value: affiliate.code,
                label: `${affiliate.fullName} · ${affiliate.email} · ${affiliate.code}`
              }))}
              placeholder="No affiliate"
            />
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              Optional. Group sales credit one commission for every purchased seat.
            </p>
          </label>
          <label className="block">
            <span className={labelClass}>Bank Reference</span>
            <input name="transferReference" placeholder="e.g. TXN-123456" className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Proof URL</span>
            <input name="proofUrl" placeholder="Optional" className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Proof Public ID</span>
            <input name="proofPublicId" placeholder="Optional Cloudinary ID" className={inputClass} />
          </label>
          <label className="block md:col-span-2 xl:col-span-4">
            <span className={labelClass}>Admin Note</span>
            <textarea name="adminNote" rows={2} placeholder="Optional internal notes" className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
          </label>
          <div className="flex justify-stretch border-t border-border pt-5 md:col-span-2 md:justify-end xl:col-span-4">
            <button
              className="btn-primary w-full justify-center shadow-sm md:w-auto"
              type="submit"
              disabled={pending || !courseSlug || (!immediateAccess && (!batchKey || batchRequiredButUnavailable))}
              aria-busy={pending}
            >
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              {pending ? "Provisioning..." : "Provision Access"}
            </button>
          </div>
        </div>
      </form>
    </section>
  )
}
