"use client"

import { useEffect } from "react"

import { AppErrorFallback } from "@/components/AppErrorFallback"

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("route_render_failed", { digest: error.digest || null, name: error.name })
  }, [error])

  return <AppErrorFallback reset={reset} />
}
