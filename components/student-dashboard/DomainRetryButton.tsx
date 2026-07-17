"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, RefreshCw } from "lucide-react"

import { showStudentToast } from "@/components/student-dashboard/StudentActionToaster"

export function DomainRetryButton({ orderUuid }: { orderUuid: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function retry() {
    setBusy(true)
    try {
      const response = await fetch("/api/student/domains/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderUuid })
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.ok) throw new Error(result?.error || "Could not retry registration.")
      showStudentToast({ type: "success", title: "Domain registered", message: "Your paid registration was completed." })
      router.refresh()
    } catch (error) {
      showStudentToast({ type: "error", title: "Retry failed", message: error instanceof Error ? error.message : "Could not retry registration." })
    } finally {
      setBusy(false)
    }
  }

  return <button type="button" onClick={retry} disabled={busy} className="btn-secondary px-3 py-2 text-xs">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Retry Registration</button>
}
