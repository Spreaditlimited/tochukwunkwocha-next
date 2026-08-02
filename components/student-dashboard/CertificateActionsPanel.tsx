"use client"

import Link from "next/link"
import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react"
import { AlertTriangle, Award, CheckCircle2, Link2, Loader2, MessageSquareText, Send, UserCheck, X } from "lucide-react"

import { PremiumPicker } from "@/components/PremiumPicker"
import { showStudentToast } from "@/components/student-dashboard/StudentActionToaster"
import { studentSafeErrorMessage } from "@/lib/student-error-feedback"

type CourseOption = {
  courseSlug: string
  courseName: string
  completedLessons: number
  totalLessons: number
  completionPercent: number
}

type ProofReview = {
  assignmentId: string
  status: string
  websiteUrl: string
  adminFeedback: string
  submittedAt: string | null
  updatedAt: string | null
  reviewedAt: string | null
  messages: Array<{
    id: number
    authorType: "student" | "admin" | "system"
    authorName: string
    messageType: string
    body: string
    createdAt: string | null
  }>
}

export function CertificateActionsPanel({
  certificateNameConfirmedAt,
  certificateName,
  courses,
  initialCourseSlug,
  certificateContent
}: {
  certificateNameConfirmedAt: string | null
  certificateName: string
  courses: CourseOption[]
  initialCourseSlug?: string
  certificateContent?: ReactNode
}) {
  const [confirmedAt, setConfirmedAt] = useState(certificateNameConfirmedAt)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [courseSlug, setCourseSlug] = useState(
    courses.some((course) => course.courseSlug === initialCourseSlug)
      ? initialCourseSlug || ""
      : courses[0]?.courseSlug || ""
  )
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [proof, setProof] = useState<ProofReview | null>(null)
  const [proofLoading, setProofLoading] = useState(false)
  const [studentMessage, setStudentMessage] = useState("")
  const [busy, setBusy] = useState<"name" | "proof" | "message" | null>(null)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const selectedCourse = courses.find((course) => course.courseSlug === courseSlug)
  const selectedCourseComplete = Boolean(
    selectedCourse &&
    selectedCourse.totalLessons > 0 &&
    selectedCourse.completedLessons >= selectedCourse.totalLessons
  )
  const proofStatus = String(proof?.status || "").toLowerCase()
  const canSubmitProof = !proof || ["needs_revision", "rejected"].includes(proofStatus)
  const isRevision = proofStatus === "needs_revision"

  const loadProof = useCallback(async () => {
    if (!courseSlug) {
      setProof(null)
      return
    }
    setProofLoading(true)
    try {
      const response = await fetch(`/api/student/certificate/proof?courseSlug=${encodeURIComponent(courseSlug)}`, {
        cache: "no-store"
      })
      const json = await response.json()
      if (!response.ok || !json.ok) throw new Error(json.error || "Could not load certificate proof review.")
      const nextProof = (json.proof || null) as ProofReview | null
      setProof(nextProof)
      setWebsiteUrl(nextProof && ["needs_revision", "rejected"].includes(nextProof.status) ? nextProof.websiteUrl : "")
    } catch (err) {
      const errorMessage = studentSafeErrorMessage(err, "Could not load certificate proof review.")
      setError(errorMessage)
    } finally {
      setProofLoading(false)
    }
  }, [courseSlug])

  useEffect(() => {
    void loadProof()
  }, [loadProof])

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
      const errorMessage = studentSafeErrorMessage(err, "Could not confirm certificate name.")
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
      const successMessage = json.proof?.resubmitted
        ? "Your revised certificate proof has been submitted for admin review."
        : "Certificate proof submitted for admin review."
      setMessage(successMessage)
      showStudentToast({ type: "success", title: json.proof?.resubmitted ? "Revised proof submitted" : "Certificate proof submitted", message: successMessage })
      await loadProof()
    } catch (err) {
      const errorMessage = studentSafeErrorMessage(err, "Could not submit certificate proof.")
      setError(errorMessage)
      showStudentToast({ type: "error", title: "Certificate proof failed", message: errorMessage })
    } finally {
      setBusy(null)
    }
  }

  async function sendProofMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!studentMessage.trim()) return
    setBusy("message")
    setMessage("")
    setError("")
    try {
      const response = await fetch("/api/student/certificate/proof/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseSlug, message: studentMessage })
      })
      const json = await response.json()
      if (!response.ok || !json.ok) throw new Error(json.error || "Could not send your message.")
      setStudentMessage("")
      setMessage("Your message has been sent to Learning Support.")
      showStudentToast({ type: "success", title: "Message sent", message: "Learning Support has received your message." })
      await loadProof()
    } catch (err) {
      const errorMessage = studentSafeErrorMessage(err, "Could not send your message.")
      setError(errorMessage)
      showStudentToast({ type: "error", title: "Message failed", message: errorMessage })
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
    <div id="proof-review" className="flex flex-col justify-between rounded-xl border border-border bg-background p-6 transition-colors hover:border-primary/20 sm:p-8">
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

            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Learning Support</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Complete all lessons and submit your website link to unlock certificate. Progress:{" "}
                {selectedCourse?.completedLessons || 0}/{selectedCourse?.totalLessons || 0} ({selectedCourse?.completionPercent || 0}%).
              </p>
            </div>

            {proofLoading ? (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/10 p-4 text-sm font-medium text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading your proof review…
              </div>
            ) : proof ? (
              <section className="rounded-xl border border-border bg-card">
                <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Current Review</p>
                    <p className="mt-1 break-all text-sm font-bold text-foreground">{proof.websiteUrl}</p>
                  </div>
                  <span className={`inline-flex w-fit rounded-md border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
                    proofStatus === "approved"
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : proofStatus === "needs_revision"
                        ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : proofStatus === "rejected"
                          ? "border-destructive/20 bg-destructive/10 text-destructive"
                          : "border-primary/20 bg-primary/10 text-primary"
                  }`}>
                    {proofStatus.replace(/_/g, " ")}
                  </span>
                </div>

                {proof.adminFeedback ? (
                  <div className="border-b border-amber-500/20 bg-amber-500/5 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">Latest Admin Feedback</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{proof.adminFeedback}</p>
                  </div>
                ) : null}

                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <MessageSquareText className="h-4 w-4 text-primary" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Private Proof Conversation</p>
                  </div>
                  <div className="mt-3 max-h-72 space-y-3 overflow-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20">
                    {proof.messages.length ? proof.messages.map((threadMessage) => (
                      <article
                        key={threadMessage.id}
                        className={`max-w-[94%] rounded-xl border p-3 ${
                          threadMessage.authorType === "student"
                            ? "ml-auto border-primary/20 bg-primary/5"
                            : threadMessage.authorType === "admin"
                              ? "mr-auto border-emerald-500/20 bg-emerald-500/5"
                              : "mx-auto border-border bg-muted/20"
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                            {threadMessage.authorType === "student"
                              ? "You"
                              : threadMessage.authorType === "admin"
                                ? threadMessage.authorName || "Learning Support"
                                : "System"}
                          </p>
                          {threadMessage.createdAt ? (
                            <span className="text-[9px] font-medium text-muted-foreground">
                              {new Date(threadMessage.createdAt).toLocaleString()}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">{threadMessage.body}</p>
                      </article>
                    )) : (
                      <p className="py-6 text-center text-sm font-medium text-muted-foreground">
                        No conversation messages yet.
                      </p>
                    )}
                  </div>

                  <form onSubmit={sendProofMessage} className="mt-4 border-t border-border pt-4">
                    <label className="block">
                      <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Message Learning Support</span>
                      <textarea
                        value={studentMessage}
                        onChange={(event) => setStudentMessage(event.target.value)}
                        rows={3}
                        required
                        placeholder="Ask a question or respond to the feedback..."
                        disabled={busy !== null}
                        className="w-full resize-none rounded-md border border-input bg-background px-4 py-3 text-sm font-medium text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60"
                      />
                    </label>
                    <button type="submit" disabled={busy !== null || !studentMessage.trim()} className="btn-secondary mt-3 w-full justify-center sm:w-auto">
                      {busy === "message" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Send Message
                    </button>
                  </form>
                </div>
              </section>
            ) : null}
          </div>
        </div>

        <form onSubmit={submitProof} className="mt-6 border-t border-border pt-6">
          {canSubmitProof ? (
            <label className="mb-4 block">
              <span className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <Link2 className="h-3 w-3" /> {isRevision ? "Revised Published Project URL" : "Published Project URL"}
              </span>
              <input
                value={websiteUrl}
                onChange={(event) => setWebsiteUrl(event.target.value)}
                className="w-full rounded-md border border-input bg-background/50 px-4 py-3 text-sm font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="https://your-project.example.com"
                type="url"
                required
                disabled={busy !== null || !confirmedAt || !selectedCourseComplete || proofLoading}
              />
            </label>
          ) : null}
          <button 
            type="submit" 
            disabled={!confirmedAt || !courses.length || !selectedCourseComplete || busy !== null || proofLoading || !canSubmitProof}
            className="btn-secondary flex w-full items-center justify-center sm:w-auto"
          >
            {busy === "proof" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isRevision
              ? "Submit Revised Proof"
              : proofStatus === "approved"
                ? "Proof Approved"
                : ["submitted", "pending", "in_review"].includes(proofStatus)
                  ? "Proof Under Review"
                  : "Submit Project Proof"}
          </button>
          {!confirmedAt && (
            <p className="mt-3 text-xs font-medium text-amber-600 dark:text-amber-400">
              * Please confirm your certificate name first to unlock submissions.
            </p>
          )}
          {confirmedAt && !selectedCourseComplete ? (
            <p className="mt-3 text-xs font-medium text-muted-foreground">
              Finish all lessons to enable proof submission.
            </p>
          ) : null}
          {confirmedAt && selectedCourseComplete && proofStatus === "needs_revision" ? (
            <p className="mt-3 text-xs font-semibold leading-relaxed text-amber-600 dark:text-amber-400">
              Make the requested changes, then submit the revised live project link above.
            </p>
          ) : null}
        </form>
      </div>
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
