"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, ArrowLeftRight, CheckCircle2, Loader2 } from "lucide-react"

import { PremiumPicker } from "@/components/PremiumPicker"
import { showStudentToast } from "@/components/student-dashboard/StudentActionToaster"

export type BatchSwitchEnrollment = {
  sourceType: string
  sourceId: string
  courseSlug: string
  batchKey: string
  batchLabel: string
  batchStartText: string
  currentBatchIsFuture: boolean
  seatCount: number
  canSwitch: boolean
  lockedReason: string
  options: Array<{
    batchKey: string
    batchLabel: string
    batchStartText: string
    remainingSeats: number | null
  }>
}

async function postJson(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Request failed")
  return payload
}

function normalizeSourceType(value: unknown) {
  const source = String(value || "").replace(/-/g, "_").toLowerCase()
  if (source === "card_checkout" || source === "course_order" || source === "order") return "order"
  if (source === "manual" || source === "manual_payment") return "manual_payment"
  return source
}

export function BatchSwitchPanel({
  enrollments,
  sourceType,
  courseSlug,
  batchKey,
  compact = false,
  showUnavailable = false
}: {
  enrollments: BatchSwitchEnrollment[]
  sourceType?: string
  courseSlug: string
  batchKey: string | null
  compact?: boolean
  showUnavailable?: boolean
}) {
  const router = useRouter()
  const enrollment = useMemo(() => {
    const source = normalizeSourceType(sourceType)
    return enrollments.find((item) => {
      const itemSource = normalizeSourceType(item.sourceType)
      return item.courseSlug === courseSlug && item.batchKey === (batchKey || "") && (!source || itemSource === source)
    })
  }, [batchKey, courseSlug, enrollments, sourceType])
  
  const [targetBatchKey, setTargetBatchKey] = useState(enrollment?.options[0]?.batchKey || "")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  if (!enrollment) return null
  if (!enrollment.currentBatchIsFuture) return null

  if (!enrollment.canSwitch || !enrollment.options.length) {
    if (!showUnavailable) return null
    return (
      <div 
        className={`relative overflow-hidden border border-border bg-muted/20 text-muted-foreground ${
          compact ? "mt-4 rounded-lg p-4" : "mt-6 rounded-xl p-5 sm:p-6"
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background shadow-sm">
            <ArrowLeftRight className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground">Batch Change Unavailable</p>
            <p className="mt-1 text-xs font-medium">
              {enrollment.lockedReason || "There is no available batch to switch into right now."}
            </p>
          </div>
        </div>
      </div>
    )
  }

  async function submit() {
    if (!enrollment || !targetBatchKey) return
    setLoading(true)
    setError("")
    setMessage("")
    try {
      await postJson("/api/student/batch-switch", {
        sourceType: enrollment.sourceType,
        sourceId: enrollment.sourceId,
        targetBatchKey
      })
      setMessage("Batch changed successfully.")
      showStudentToast({ type: "success", title: "Batch changed", message: "Your course batch has been updated." })
      router.refresh()
    } catch (requestError) {
      const errorMessage = requestError instanceof Error ? requestError.message : "Could not change batch."
      setError(errorMessage)
      showStudentToast({ type: "error", title: "Batch change failed", message: errorMessage })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div 
      className={`relative overflow-hidden border border-primary/20 bg-primary/5 transition-colors hover:border-primary/30 ${
        compact ? "mt-4 rounded-lg p-4" : "mt-6 rounded-xl p-5 sm:p-6"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary/10 bg-background text-primary shadow-sm">
          <ArrowLeftRight className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Change Batch</p>
          <p className="mt-0.5 text-xs font-medium text-muted-foreground">You can change your batch if your current batch date is no longer convenient.</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <PremiumPicker
            value={targetBatchKey}
            onChange={(event) => setTargetBatchKey(event.target.value)}
            options={enrollment.options.map((option) => ({
              value: option.batchKey,
              label: `${option.batchLabel}${option.batchStartText ? ` - Starts ${option.batchStartText}` : ""}${option.remainingSeats === null ? "" : ` - ${option.remainingSeats} seats left`}`
            }))}
          />
        </div>
        <button 
          className="btn-primary w-full shrink-0 px-6 py-2.5 text-sm shadow-sm sm:w-auto" 
          type="button" 
          onClick={submit} 
          disabled={loading || !targetBatchKey}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Changing...
            </>
          ) : (
            "Switch Batch"
          )}
        </button>
      </div>

      {message && (
        <div className="mt-4 flex items-start gap-2 rounded-md bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>{message}</p>
        </div>
      )}
      
      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}
    </div>
  )
}
