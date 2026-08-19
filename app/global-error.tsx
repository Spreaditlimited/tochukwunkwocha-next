"use client"

import { useEffect } from "react"

import { AppErrorFallback } from "@/components/AppErrorFallback"

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("global_render_failed", { digest: error.digest || null, name: error.name })
  }, [error])

  return (
    <html lang="en">
      <body>
        <AppErrorFallback reset={reset} />
      </body>
    </html>
  )
}
