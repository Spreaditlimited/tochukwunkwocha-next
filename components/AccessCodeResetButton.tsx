"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { KeyRound, Loader2, RotateCcw } from "lucide-react"

import { DashboardModal } from "@/components/dashboard/DashboardModal"

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
  const [modalOpen, setModalOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

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
        <DashboardModal
          title="Reset learner access code"
          eyebrow="Security action"
          description="The current code will stop working immediately and this learner will be signed out. You will need to share the new access code with them."
          onClose={() => setModalOpen(false)}
          closeDisabled={pending}
          closeLabel="Close access-code reset confirmation"
          footer={
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
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
          }
        >
          <div className="flex items-center gap-4 rounded-lg border border-input bg-background p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <KeyRound className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Learner</p>
              <p className="mt-1 truncate font-heading text-xl font-black text-foreground">{learnerName}</p>
            </div>
          </div>

          {error ? (
            <p className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm font-semibold text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </DashboardModal>
      ) : null}
    </div>
  )
}
