"use client"

import { CheckCircle2, Info, Loader2, X, XCircle } from "lucide-react"
import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

const COOKIE_NAME = "tochukwu_internal_toast"
const EVENT_NAME = "tochukwu:internal-toast"

type ToastType = "success" | "error" | "info" | "loading"

type Toast = {
  id: number
  type: ToastType
  title: string
  message?: string
}

export function showInternalToast(input: Omit<Toast, "id">) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: input }))
}

function readCookieToast() {
  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${COOKIE_NAME}=`))

  if (!cookie) return null
  document.cookie = `${COOKIE_NAME}=; Max-Age=0; path=/internal; SameSite=Lax`

  try {
    const raw = decodeURIComponent(cookie.slice(COOKIE_NAME.length + 1))
    const parsed = JSON.parse(raw) as { type?: ToastType; title?: string; message?: string }
    if (!parsed.title) return null
    return {
      type: parsed.type || "success",
      title: parsed.title,
      message: parsed.message || ""
    }
  } catch {
    return null
  }
}

function labelFromSubmitter(submitter: HTMLElement | null) {
  const explicit = submitter?.getAttribute("data-toast")
  if (explicit) return explicit.trim()
  const text = submitter?.textContent?.replace(/\s+/g, " ").trim()
  return text || "Action"
}

function loadingTitle(label: string) {
  return /^\w+ing\b/i.test(label.trim()) || label.toLowerCase().startsWith("saving ")
    ? label
    : `${label} in progress`
}

export function InternalActionToaster() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [toast, setToast] = useState<Toast | null>(null)
  const idRef = useRef(1)

  function show(input: Omit<Toast, "id">) {
    setToast({ ...input, id: idRef.current++ })
  }

  useEffect(() => {
    const fromCookie = readCookieToast()
    if (fromCookie) show(fromCookie)
  }, [pathname, searchParams])

  useEffect(() => {
    function onToast(event: Event) {
      const detail = (event as CustomEvent<Omit<Toast, "id">>).detail
      if (!detail?.title) return
      show(detail)
    }

    window.addEventListener(EVENT_NAME, onToast)
    return () => window.removeEventListener(EVENT_NAME, onToast)
  }, [])

  useEffect(() => {
    if (!toast || toast.type === "loading") return
    const timer = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    function checkForServerToast() {
      const fromCookie = readCookieToast()
      if (fromCookie) {
        show(fromCookie)
        return true
      }
      return false
    }

    function onSubmit(event: SubmitEvent) {
      const form = event.target instanceof HTMLFormElement ? event.target : null
      if (!form || !form.closest("[data-internal-dashboard-shell]")) return
      const submitter = event.submitter instanceof HTMLElement ? event.submitter : null
      const label = labelFromSubmitter(submitter)
      const maxAttempts = submitter?.getAttribute("data-toast-long") === "true" ? 1200 : 24
      show({
        type: "loading",
        title: loadingTitle(label),
        message: "This may take a moment. Please keep this page open."
      })

      let attempts = 0
      const timer = window.setInterval(() => {
        attempts += 1
        if (checkForServerToast()) {
          window.clearInterval(timer)
          return
        }
        if (attempts >= maxAttempts) {
          window.clearInterval(timer)
          setToast((current) => (current?.type === "loading" ? null : current))
        }
      }, 250)
    }

    document.addEventListener("submit", onSubmit, true)
    return () => document.removeEventListener("submit", onSubmit, true)
  }, [])

  if (!toast) return null

  const Icon = toast.type === "loading" ? Loader2 : toast.type === "error" ? XCircle : toast.type === "info" ? Info : CheckCircle2

  return (
    <div className="fixed right-4 top-4 z-[100] w-[calc(100vw-2rem)] max-w-sm sm:right-6 sm:top-6">
      <div
        className={cn(
          "flex gap-3 rounded-2xl border bg-card p-4 text-card-foreground shadow-2xl shadow-slate-950/15 backdrop-blur-xl",
          toast.type === "error" ? "border-destructive/30" : toast.type === "loading" ? "border-primary/30" : "border-emerald-500/30"
        )}
      >
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            toast.type === "error" ? "bg-destructive/10 text-destructive" : toast.type === "loading" ? "bg-primary/10 text-primary" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          )}
        >
          <Icon className={cn("h-5 w-5", toast.type === "loading" && "animate-spin")} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-sm font-black text-foreground">{toast.title}</p>
          {toast.message ? <p className="mt-1 text-xs font-medium leading-relaxed text-muted-foreground">{toast.message}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => setToast(null)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
