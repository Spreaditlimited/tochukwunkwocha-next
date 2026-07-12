"use client"

import { FormEvent, ReactNode, useState } from "react"
import { AlertTriangle, Award, CheckCircle2, Link2, Loader2, UserCheck } from "lucide-react"

import { PremiumPicker } from "@/components/PremiumPicker"
import { showStudentToast } from "@/components/student-dashboard/StudentActionToaster"

type CourseOption = {
  courseSlug: string
  courseName: string
}

export function CertificateActionsPanel({
  certificateNameConfirmedAt,
  courses,
  certificateContent
}: {
  certificateNameConfirmedAt: string | null
  courses: CourseOption[]
  certificateContent?: ReactNode
}) {
  const [confirmedAt, setConfirmedAt] = useState(certificateNameConfirmedAt)
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
            Please verify that your profile name matches your legal identification exactly. This name will be permanently printed on your official academy certificates.
          </p>
        </div>

        <div className="mt-6 border-t border-border pt-6">
          <button
            type="button"
            onClick={confirmName}
            disabled={Boolean(confirmedAt) || busy !== null}
            className={`inline-flex w-full items-center justify-center rounded-md px-6 py-3 text-sm font-bold transition-all sm:w-auto ${
              confirmedAt 
                ? "cursor-not-allowed border border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400" 
                : "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:-translate-y-0.5"
            }`}
          >
            {busy === "name" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : confirmedAt ? (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            ) : null}
            {confirmedAt ? "Name Confirmed" : "Confirm Name for Certificates"}
          </button>
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
      {nameCard}
      {proofCard}
      <div className="lg:col-span-2">{alerts}</div>
    </div>
  )
}
