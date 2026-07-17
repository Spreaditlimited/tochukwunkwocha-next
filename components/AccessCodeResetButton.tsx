"use client"

import { useEffect, useId, useState } from "react"
import { useRouter } from "next/navigation"
import { KeyRound, Loader2, RotateCcw, X } from "lucide-react"

type AccessCodeResetButtonProps = {
  endpoint: string
  payload: Record<string, string | number>
  learnerName: string
  className?: string
}

export function AccessCodeResetButton({
  endpoint,
  payload,
  learnerName,
  className = "btn-secondary px-3 py-2 text-xs"
}: AccessCodeResetButtonProps) {
  const router = useRouter()
  const titleId = useId()
  const descriptionId = useId()
  const [modalOpen, setModalOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!modalOpen) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) setModalOpen(false)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [modalOpen, pending])

  function openResetModal() {
    setError("")
    setModalOpen(true)
  }

  async function resetCode() {
    setPending(true)
    setError("")
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      const result = (await response.json().catch(() => null)) as { ok?: boolean; newCode?: string; error?: string } | null
      if (!response.ok || !result?.ok) throw new Error(result?.error || "Could not reset the access code.")
      setModalOpen(false)
      router.refresh()
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Could not reset the access code.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button className={className} type="button" onClick={openResetModal} disabled={pending}>
        <RotateCcw className="mr-1 h-3 w-3" />
        Reset code
      </button>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          onClick={pending ? undefined : () => setModalOpen(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card text-left shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border p-5 sm:p-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Security action</p>
                <h2 id={titleId} className="mt-1 font-heading text-lg font-black text-foreground">Reset learner access code</h2>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={pending}
                className="btn-secondary h-9 px-3 text-xs disabled:opacity-60"
                aria-label="Close confirmation"
              >
                <X className="h-4 w-4" />
                Close
              </button>
            </div>

            <div className="p-5 sm:p-6">
              <div className="flex items-center gap-4 rounded-lg border border-input bg-background p-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Learner</p>
                  <p className="mt-1 truncate font-heading text-xl font-black text-foreground">{learnerName}</p>
                </div>
              </div>

              <p id={descriptionId} className="mt-5 text-sm leading-relaxed text-muted-foreground">
                The current code will stop working immediately and this learner will be signed out. You will need to share the new access code with them.
              </p>

              {error ? (
                <p className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm font-semibold text-destructive" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setModalOpen(false)} disabled={pending} className="btn-secondary justify-center disabled:opacity-50">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={resetCode}
                  disabled={pending}
                  className="btn-primary justify-center bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                >
                  {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                  {pending ? "Resetting..." : "Yes, reset code"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
