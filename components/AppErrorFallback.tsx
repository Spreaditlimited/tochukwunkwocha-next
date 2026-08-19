"use client"

import { AlertTriangle, RotateCcw } from "lucide-react"

type AppErrorFallbackProps = {
  reset: () => void
  area?: "site" | "student" | "admin"
}

const COPY = {
  site: {
    eyebrow: "Temporary service issue",
    title: "This page could not be loaded",
    message: "We could not complete that request just now. Please try again in a moment."
  },
  student: {
    eyebrow: "Student dashboard",
    title: "We could not load this section",
    message: "Your account and progress are safe. Please try loading this section again."
  },
  admin: {
    eyebrow: "Admin dashboard",
    title: "This dashboard section is temporarily unavailable",
    message: "Please retry the request. The technical details have been kept out of the page and remain available in server logs."
  }
} as const

export function AppErrorFallback({ reset, area = "site" }: AppErrorFallbackProps) {
  const copy = COPY[area]

  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-background px-5 py-16 text-foreground">
      <section
        role="alert"
        aria-live="assertive"
        className="w-full max-w-xl rounded-2xl border border-border bg-card p-7 shadow-sm sm:p-10"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-primary">{copy.eyebrow}</p>
        <h1 className="mt-2 font-heading text-2xl font-black tracking-tight sm:text-3xl">{copy.title}</h1>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">{copy.message}</p>
        <button type="button" onClick={reset} className="btn-primary mt-7 inline-flex items-center gap-2">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>
      </section>
    </main>
  )
}
