"use client"

import { useEffect } from "react"

import { AppErrorFallback } from "@/components/AppErrorFallback"

export default function AdminDashboardError({
  error,
  reset
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("admin_dashboard_render_failed", { digest: error.digest || null, name: error.name })
  }, [error])

  return <AppErrorFallback area="admin" reset={reset} />
}
