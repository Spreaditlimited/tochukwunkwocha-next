"use client"

import { useState, type FormEvent } from "react"
import { AlertCircle, ArrowRight, KeyRound, Loader2, UserRound } from "lucide-react"

import { showStudentToast } from "@/components/student-dashboard/StudentActionToaster"

type ChallengeState = {
  challenge: string
  maskedName: string
  familyName: string
}

async function postJson<T>(body: Record<string, unknown>) {
  const response = await fetch("/api/student/group-code-login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body)
  })
  const json = await response.json().catch(() => null)
  if (!response.ok || !json?.ok) throw new Error(json?.error || "Request failed")
  return json as T
}

export function GroupCodeLoginForm() {
  const [code, setCode] = useState("")
  const [confirmName, setConfirmName] = useState("")
  const [challenge, setChallenge] = useState<ChallengeState | null>(null)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError("")
    setIsSubmitting(true)
    try {
      if (!challenge) {
        const result = await postJson<{
          needsConfirm?: boolean
          challenge?: string
          student?: { maskedName?: string; familyName?: string }
        }>({ code })
        if (result.needsConfirm && result.challenge) {
          setChallenge({
            challenge: result.challenge,
            maskedName: result.student?.maskedName || "Student",
            familyName: result.student?.familyName || "Group"
          })
          showStudentToast({ type: "info", title: "Confirm learner identity", message: "Enter the learner name to complete group access." })
          return
        }
      } else {
        await postJson({
          code,
          confirm: true,
          confirmName,
          challenge: challenge.challenge
        })
        showStudentToast({ type: "success", title: "Group access confirmed", message: "Opening the student dashboard." })
        window.location.href = "/dashboard"
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Could not sign in with group code."
      setError(errorMessage)
      showStudentToast({ type: "error", title: "Group access failed", message: errorMessage })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-colors hover:border-primary/20">
      
      {/* Header section */}
      <div className="flex items-center gap-4 border-b border-border bg-muted/20 p-5 sm:p-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <KeyRound className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-heading text-sm font-bold text-foreground">Group Access Code</h2>
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            Learners assigned through a school or group can sign in here.
          </p>
        </div>
      </div>

      {/* Form section */}
      <div className="p-5 sm:p-6">
        <form onSubmit={submit} className="grid gap-5">
          
          <label className="block">
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Access Code
            </span>
            <input
              className="w-full rounded-md border border-input bg-background px-4 py-3 font-mono text-sm font-medium uppercase tracking-[0.2em] text-foreground outline-none transition-colors placeholder:tracking-normal placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary"
              value={code}
              onChange={(event) => {
                setCode(event.target.value.toUpperCase())
                setChallenge(null)
              }}
              placeholder="e.g. ABCDE23456"
              required
            />
          </label>

          {/* Step 2: Challenge Confirmation */}
          {challenge && (
            <div className="animate-in slide-in-from-top-2 fade-in duration-300">
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <UserRound className="h-3 w-3" /> Confirm Learner Name
                </span>
                <input
                  className="w-full rounded-md border border-input bg-background px-4 py-3 text-sm font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary"
                  value={confirmName}
                  onChange={(event) => setConfirmName(event.target.value)}
                  placeholder={`e.g. ${challenge.maskedName}`}
                  required
                />
              </label>
              
              <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                Assigned Group: <span className="font-bold text-foreground">{challenge.familyName}</span>
              </div>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div className="flex items-start gap-3 rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="font-medium leading-relaxed">{error}</p>
            </div>
          )}

          <button 
            className="inline-flex w-full items-center justify-center rounded-md border border-border bg-muted/20 px-4 py-3 text-sm font-bold text-foreground transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary disabled:pointer-events-none disabled:opacity-70" 
            type="submit" 
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking...
              </>
            ) : challenge ? (
              <>
                Complete Sign In <ArrowRight className="ml-2 h-4 w-4" />
              </>
            ) : (
              "Verify Code"
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
