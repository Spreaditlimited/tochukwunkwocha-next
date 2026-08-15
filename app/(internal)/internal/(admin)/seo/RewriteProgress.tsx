"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, Clock3, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

type ProgressResponse = { status: string; openAiStatus: string; stage: string; percent: number; elapsedSeconds: number; ready: boolean; message?: string }
function formatElapsed(seconds: number) { const safe = Math.max(0, Math.floor(seconds)); return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}` }

export function RewriteProgress({ pidChange, startedAt, initialStatus, model }: { pidChange: string; startedAt: string | null; initialStatus: string | null; model: string | null }) {
  const router = useRouter()
  const initialElapsed = useMemo(() => { const timestamp = startedAt ? new Date(startedAt).getTime() : Number.NaN; return Number.isFinite(timestamp) ? Math.max(0, Math.floor((Date.now() - timestamp) / 1000)) : 0 }, [startedAt])
  const [elapsedSeconds, setElapsedSeconds] = useState(initialElapsed)
  const [openAiStatus, setOpenAiStatus] = useState(initialStatus || "queued")
  const [stage, setStage] = useState("Waiting for the first OpenAI status update")
  const [serverPercent, setServerPercent] = useState(initialStatus === "in_progress" ? Math.min(88, 22 + Math.floor(initialElapsed / 6)) : 12)
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null)
  const [error, setError] = useState("")

  useEffect(() => { const timer = window.setInterval(() => setElapsedSeconds((value) => value + 1), 1000); return () => window.clearInterval(timer) }, [])
  useEffect(() => {
    let stopped = false, timer: number | undefined
    const poll = async () => {
      try {
        const response = await fetch(`/api/seo/changes/${encodeURIComponent(pidChange)}/rewrite-status`, { method: "POST", cache: "no-store" })
        const data = await response.json() as ProgressResponse & { error?: string }
        if (!response.ok) throw new Error(data.error || "Could not check rewrite status.")
        if (stopped) return
        setOpenAiStatus(data.openAiStatus); setStage(data.stage); setServerPercent(data.percent)
        setElapsedSeconds((value) => Math.max(value, data.elapsedSeconds || 0)); setLastCheckedAt(new Date()); setError("")
        if (data.ready) { window.setTimeout(() => router.refresh(), 600); return }
      } catch (cause) { if (!stopped) setError(cause instanceof Error ? cause.message : "Could not check rewrite status.") }
      if (!stopped) timer = window.setTimeout(poll, 5000)
    }
    timer = window.setTimeout(poll, 800)
    return () => { stopped = true; if (timer) window.clearTimeout(timer) }
  }, [pidChange, router])

  const estimatedPercent = openAiStatus === "in_progress" ? Math.max(serverPercent, Math.min(88, 22 + Math.floor(elapsedSeconds / 6))) : serverPercent
  const steps = [
    { label: "Request checkpointed", complete: true, active: false },
    { label: "OpenAI queue", complete: openAiStatus !== "queued", active: openAiStatus === "queued" },
    { label: "Research and article rewrite", complete: estimatedPercent >= 90, active: openAiStatus === "in_progress" },
    { label: "Citation and link validation", complete: estimatedPercent >= 100, active: estimatedPercent >= 90 && estimatedPercent < 100 }
  ]
  return <section className="rounded-xl border border-blue-500/25 bg-card p-5 shadow-sm" aria-live="polite">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-widest text-blue-700">Background rewrite</p><h2 className="mt-1 text-sm font-bold">{stage}</h2><p className="mt-1 text-xs text-muted-foreground">Actual OpenAI status: <strong className="text-foreground">{openAiStatus.replace(/_/g, " ")}</strong>{model ? ` · ${model}` : ""}</p></div><div className="flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold tabular-nums text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{formatElapsed(elapsedSeconds)} elapsed</div></div>
    <div className="mt-5"><div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground"><span>Estimated progress</span><span className="text-foreground">{estimatedPercent}%</span></div><div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-blue-600 transition-[width] duration-1000 ease-out" style={{ width: `${estimatedPercent}%` }} /></div></div>
    <div className="mt-5 grid gap-2 sm:grid-cols-2">{steps.map((step) => <div key={step.label} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${step.complete ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700" : step.active ? "border-blue-500/25 bg-blue-500/10 text-blue-700" : "border-border bg-muted/20 text-muted-foreground"}`}>{step.complete ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : step.active ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-current opacity-40" />}{step.label}</div>)}</div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground"><span>Status is checked every five seconds without starting another generation.</span><span>{lastCheckedAt ? `Last checked ${lastCheckedAt.toLocaleTimeString()}` : "Connecting…"}</span></div>
    {error ? <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-800">{error} Automatic checking will retry.</p> : null}
  </section>
}
