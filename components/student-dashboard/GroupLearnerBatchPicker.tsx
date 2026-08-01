"use client"

import { ArrowLeftRight, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { PremiumPicker } from "@/components/PremiumPicker"
import { showStudentToast } from "@/components/student-dashboard/StudentActionToaster"

type BatchOption = {
  batchKey: string
  batchLabel: string
  batchStartText: string
}

export function GroupLearnerBatchPicker({
  childId,
  learnerName,
  options
}: {
  childId: number
  learnerName: string
  options: BatchOption[]
}) {
  const router = useRouter()
  const [targetBatchKey, setTargetBatchKey] = useState(options[0]?.batchKey || "")
  const [pending, setPending] = useState(false)

  if (!options.length) return null

  async function changeBatch() {
    if (!targetBatchKey || pending) return
    setPending(true)
    try {
      const response = await fetch("/api/student/group-enrollment/learner-batch", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ childId, targetBatchKey })
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.ok) throw new Error(result?.error || "Could not change the learner's batch.")
      showStudentToast({
        type: "success",
        title: "Learner batch changed",
        message: `${learnerName} is now assigned to ${result.batchLabel || "the selected batch"}.`
      })
      router.refresh()
    } catch (error) {
      showStudentToast({
        type: "error",
        title: "Batch change failed",
        message: error instanceof Error ? error.message : "Could not change the learner's batch."
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mt-5 rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background text-primary shadow-sm">
          <ArrowLeftRight className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Move this learner</p>
          <p className="mt-1 text-xs font-medium leading-relaxed text-muted-foreground">
            Only future batches for this learner&apos;s current course are available.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <PremiumPicker
            value={targetBatchKey}
            onChange={(event) => setTargetBatchKey(event.target.value)}
            options={options.map((option) => ({
              value: option.batchKey,
              label: `${option.batchLabel}${option.batchStartText ? ` · Starts ${option.batchStartText}` : ""}`
            }))}
          />
        </div>
        <button type="button" className="btn-primary w-full justify-center sm:w-auto" onClick={changeBatch} disabled={pending || !targetBatchKey}>
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowLeftRight className="mr-2 h-4 w-4" />}
          {pending ? "Moving..." : "Move Learner"}
        </button>
      </div>
    </div>
  )
}
