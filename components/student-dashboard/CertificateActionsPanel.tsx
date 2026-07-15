"use client"

import Link from "next/link"
import { FormEvent, ReactNode, useState } from "react"
import { AlertTriangle, Award, CheckCircle2, Link2, Loader2, UserCheck, X } from "lucide-react"

import { PremiumPicker } from "@/components/PremiumPicker"
import { showStudentToast } from "@/components/student-dashboard/StudentActionToaster"

type CourseOption = {
  courseSlug: string
  courseName: string
}

export function CertificateActionsPanel({
  certificateNameConfirmedAt,
  certificateName,
  courses,
  certificateContent
}: {
  certificateNameConfirmedAt: string | null
  certificateName: string
  courses: CourseOption[]
  certificateContent?: ReactNode
}) {
  const [confirmedAt, setConfirmedAt] = useState(certificateNameConfirmedAt)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [courseSlug, setCourseSlug] = useState(courses[0]?.courseSlug || "")
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [busy, setBusy] = useState<"name" | "proof" | null>(null)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  async function confirmName() {
    setBusy("name")
    setMessage("")
    setError("")
    try {
      const response = await fetch("/api/student/certificate/name/confirm", { method: "POST" })
      const json = await response.json()
      if (!response.ok || !json.ok) throw new Error(json.error || "Could not confirm certificate name.")
      setConfirmedAt(json.certificateNameConfirmedAt || new Date().toISOString())
      const successMessage = json.message || "Certificate name confirmed."
      setMessage(successMessage)
      showStudentToast({ type: "success", title: "Certificate name confirmed", message: successMessage })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Could not confirm certificate name."
      setError(errorMessage)
      showStudentToast({ type: "error", title: "Certificate action failed", message: errorMessage })
    } finally {
      setBusy(null)
      setConfirmModalOpen(false)
    }
  }

  async function submitProof(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy("proof")
    setMessage("")
    setError("")
    try {
      const response = await fetch("/api/student/certificate/proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseSlug, websiteUrl })
      })
      const json = await response.json()
      if (!response.ok || !json.ok) throw new Error(json.error || "Could not submit certificate proof.")
      setWebsiteUrl("")
      setMessage("Certificate proof submitted for admin review.")
      showStudentToast({ type: "success", title: "Certificate proof submitted", message: "Your project proof has been sent for admin review." })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Could not submit certificate proof."
      setError(errorMessage)
      showStudentToast({ type: "error", title: "Certificate proof failed", message: errorMessage })
    } finally {
      setBusy(null)
    }
  }

  const nameCard = (
    <div className="flex flex-col justify-between rounded-xl border border-border bg-background p-6 transition-colors hover:border-primary/20 sm:p-8">
        <div>
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${confirmedAt ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-primary/10 text-primary'}`}>
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Certificate Identity</p>
              <h3 className="font-heading text-lg font-bold text-foreground">Confirm Your Name</h3>
            </div>
          </div>
          
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Please verify that the name below is exactly how it should appear on your official academy certificates.
          </p>
          <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Current certificate name</p>
            <p className="mt-2 font-heading text-2xl font-black leading-tight text-foreground">{certificateName || "Name not set"}</p>
            {!confirmedAt ? (
              <p className="mt-3 text-xs font-semibold leading-relaxed text-muted-foreground">
                If this is not correct, edit your profile name before confirming. Once confirmed, your certificate name is locked.
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 border-t border-border pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setConfirmModalOpen(true)}
              disabled={Boolean(confirmedAt) || busy !== null || !certificateName}
              className={`inline-flex w-full items-center justify-center rounded-md px-6 py-3 text-sm font-bold transition-all sm:w-auto ${
                confirmedAt 
                  ? "cursor-not-allowed border border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400" 
                  : "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-60"
              }`}
            >
              {busy === "name" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : confirmedAt ? (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              ) : null}
              {confirmedAt ? "Name Confirmed" : "Confirm This Name"}
            </button>
            {!confirmedAt ? (
              <Link href="/dashboard/profile" className="btn-secondary w-full sm:w-auto">
                Edit Name First
              </Link>
            ) : null}
          </div>
        </div>
      </div>
  )

  const proofCard = (
    <form onSubmit={submitProof} className="flex flex-col justify-between rounded-xl border border-border bg-background p-6 transition-colors hover:border-primary/20 sm:p-8">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Project Verification</p>
              <h3 className="font-heading text-lg font-bold text-foreground">Submit Project Proof</h3>
            </div>
          </div>
          
          <div className="mt-6 grid gap-5">
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Select Programme</span>
              <PremiumPicker
                value={courseSlug}
                onChange={(event) => setCourseSlug(event.target.value)}
                options={courses.length ? courses.map((course, index) => ({ value: course.courseSlug, label: course.courseName, key: `${course.courseSlug}-${index}` })) : [{ value: "", label: "No eligible courses found" }]}
                disabled={!courses.length || busy !== null}
              />
            </label>
            
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <Link2 className="h-3 w-3" /> Published Project URL
              </span>
              <input
                value={websiteUrl}
                onChange={(event) => setWebsiteUrl(event.target.value)}
                className="w-full rounded-md border border-input bg-background/50 px-4 py-3 text-sm font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="https://your-project.example.com"
                type="url"
                required
                disabled={busy !== null}
              />
            </label>
          </div>
        </div>

        <div className="mt-6 border-t border-border pt-6">
          <button 
            type="submit" 
            disabled={!confirmedAt || !courses.length || busy !== null} 
            className="btn-secondary flex w-full items-center justify-center sm:w-auto"
          >
            {busy === "proof" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Submit Project Proof
          </button>
          {!confirmedAt && (
            <p className="mt-3 text-xs font-medium text-amber-600 dark:text-amber-400">
              * Please confirm your certificate name first to unlock submissions.
            </p>
          )}
        </div>
      </form>
  )

  const alerts = (
    <div>
        {message ? (
          <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400 animate-in fade-in slide-in-from-bottom-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="font-semibold leading-relaxed">{message}</p>
          </div>
        ) : null}
        
        {error ? (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive animate-in fade-in slide-in-from-bottom-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="font-semibold leading-relaxed">{error}</p>
          </div>
        ) : null}
      </div>
  )

  if (certificateContent) {
    return (
      <div className="grid gap-6">
        {confirmModalOpen ? (
          <CertificateNameConfirmModal
            name={certificateName}
            busy={busy === "name"}
            onCancel={() => setConfirmModalOpen(false)}
            onConfirm={confirmName}
          />
        ) : null}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.8fr)] xl:items-start">
          <div className="min-w-0">{certificateContent}</div>
          {proofCard}
        </div>
        {alerts}
        <div className="max-w-3xl">{nameCard}</div>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      {confirmModalOpen ? (
        <CertificateNameConfirmModal
          name={certificateName}
          busy={busy === "name"}
          onCancel={() => setConfirmModalOpen(false)}
          onConfirm={confirmName}
        />
      ) : null}
      {nameCard}
      {proofCard}
      <div className="lg:col-span-2">{alerts}</div>
    </div>
  )
}

function CertificateNameConfirmModal({
  name,
  busy,
  onCancel,
  onConfirm
}: {
  name: string
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm certificate name"
      onClick={busy ? undefined : onCancel}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-5 sm:p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Final confirmation</p>
            <h2 className="mt-1 font-heading text-lg font-black text-foreground">Confirm certificate name</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="btn-secondary h-9 px-3 text-xs disabled:opacity-60"
            aria-label="Close confirmation"
          >
            <X className="h-4 w-4" />
            Close
          </button>
        </div>

        <div className="p-5 sm:p-6">
          <div className="rounded-lg border border-input bg-background p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">This is the name that will appear</p>
            <p className="mt-2 font-heading text-3xl font-black leading-tight text-foreground">{name}</p>
          </div>

          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
            Confirm only if this name is correct. After confirmation, your certificate name is locked and cannot be edited from your profile.
          </p>

          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary justify-center">
              Go Back
            </button>
            <button type="button" onClick={onConfirm} disabled={busy} className="btn-primary justify-center">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Yes, Confirm Name
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
