"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2, Clock3, Loader2, RotateCcw, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"

type ProgressResponse = {
  status: string
  openAiStatus: string
  stage: string
  percent: number
  elapsedSeconds: number
  ready: boolean
  editUrl?: string
  message?: string
  error?: string
}

function elapsedLabel(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds))
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`
}

export function GenerateArticleButton({ pidOpportunity, initialStatus }: { pidOpportunity: string; initialStatus?: string | null }) {
  const router = useRouter()
  const [phase, setPhase] = useState<"idle" | "starting" | "processing" | "failed">(
    initialStatus === "writing" ? "processing" : initialStatus === "failed" ? "failed" : "idle"
  )
  const [openAiStatus, setOpenAiStatus] = useState(initialStatus === "writing" ? "queued" : "not_started")
  const [stage, setStage] = useState(initialStatus === "writing" ? "Reconnecting to the saved research job" : "")
  const [percent, setPercent] = useState(initialStatus === "writing" ? 12 : 0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [message, setMessage] = useState("")
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (phase !== "processing" && phase !== "starting") return
    const timer = window.setInterval(() => setElapsedSeconds((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [phase])

  useEffect(() => {
    if (phase !== "processing") return
    let stopped = false
    const poll = async () => {
      try {
        const response = await fetch(`/api/seo/opportunities/${encodeURIComponent(pidOpportunity)}/article-status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "status" }),
          cache: "no-store"
        })
        const data = await response.json() as ProgressResponse
        if (!response.ok) throw new Error(data.error || "Could not check article progress.")
        if (stopped) return
        setOpenAiStatus(data.openAiStatus)
        setStage(data.stage)
        setPercent(data.percent)
        setElapsedSeconds((value) => Math.max(value, data.elapsedSeconds || 0))
        if (data.ready && data.editUrl) {
          setPercent(100)
          setStage("Opening the completed draft")
          router.push(data.editUrl)
          return
        }
        if (data.status === "failed") {
          setMessage(data.message || "Article generation failed. You can retry safely.")
          setPhase("failed")
          return
        }
      } catch (error) {
        if (!stopped) setMessage(error instanceof Error ? error.message : "Could not check article progress. Retrying…")
      }
      if (!stopped) timerRef.current = window.setTimeout(poll, 5000)
    }
    timerRef.current = window.setTimeout(poll, 700)
    return () => {
      stopped = true
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [phase, pidOpportunity, router])

  async function start() {
    setPhase("starting")
    setMessage("")
    setStage("Starting first-class SEO research")
    setPercent(6)
    setElapsedSeconds(0)
    try {
      const response = await fetch(`/api/seo/opportunities/${encodeURIComponent(pidOpportunity)}/article-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
        cache: "no-store"
      })
      const data = await response.json() as ProgressResponse
      if (!response.ok) throw new Error(data.error || "Could not start article generation.")
      if (data.ready && data.editUrl) {
        router.push(data.editUrl)
        return
      }
      if (data.status === "failed") throw new Error(data.message || "Article generation failed.")
      setOpenAiStatus(data.openAiStatus)
      setStage(data.stage)
      setPercent(data.percent)
      setElapsedSeconds(data.elapsedSeconds || 0)
      setPhase("processing")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start article generation.")
      setPhase("failed")
    }
  }

  if (phase === "idle" || phase === "failed") {
    return (
      <div className="w-full min-w-[13rem] space-y-2" aria-live="polite">
        <button type="button" onClick={() => void start()} className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90">
          {phase === "failed" ? <RotateCcw className="mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}
          {phase === "failed" ? "Retry Research & Writing" : "Research & Write Article"}
        </button>
        <p className="text-center text-[9px] leading-relaxed text-muted-foreground">Creates a complete unpublished CMS draft for your review.</p>
        {message ? <p className="rounded-lg border border-destructive/20 bg-destructive/10 p-2 text-[10px] leading-relaxed text-destructive">{message}</p> : null}
      </div>
    )
  }

  return (
    <div className="w-full min-w-[16rem] rounded-xl border border-blue-500/20 bg-blue-500/5 p-3" aria-live="polite">
      <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-blue-700">
        <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" />{phase === "starting" ? "Starting" : openAiStatus.replace(/_/g, " ")}</span>
        <span className="inline-flex items-center gap-1 tabular-nums"><Clock3 className="h-3.5 w-3.5" />{elapsedLabel(elapsedSeconds)}</span>
      </div>
      <p className="mt-2 text-xs font-semibold leading-relaxed text-foreground">{stage}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-500/10"><div className="h-full rounded-full bg-blue-600 transition-[width] duration-1000" style={{ width: `${Math.max(4, percent)}%` }} /></div>
      <div className="mt-3 grid gap-1.5 text-[9px] font-semibold text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-600" />Request checkpointed—clicking again cannot duplicate it</span>
        <span>Research → full article → citations → metadata → CMS draft</span>
      </div>
      {message ? <p className="mt-2 text-[10px] text-amber-700">{message}</p> : null}
    </div>
  )
}
