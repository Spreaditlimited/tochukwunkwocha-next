"use client"

import { useEffect } from "react"

import { AppErrorFallback } from "@/components/AppErrorFallback"

export default function StudentDashboardError({
  error,
  reset
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("student_dashboard_render_failed", { digest: error.digest || null, name: error.name })
  }, [error])

  return <AppErrorFallback area="student" reset={reset} />
}
