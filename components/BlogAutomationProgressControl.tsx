"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, Clock3, FileText, ImageIcon, Loader2, RotateCcw, XCircle } from "lucide-react"
import { useRouter } from "next/navigation"

type AutomationType = "image" | "leadMagnet" | "leadMagnetLayout"
type Job = { jobUuid: string; status: string; stage: string; progress: number; errorMessage: string | null; startedAt: string | null; finishedAt: string | null; ready: boolean }

const stepSets = {
  image: [{ at: 10, label: "Article context loaded" }, { at: 20, label: "Image brief prepared" }, { at: 35, label: "OpenAI image generation" }, { at: 72, label: "Cloudinary upload" }, { at: 92, label: "Save image to blog" }],
  leadMagnet: [{ at: 10, label: "Article context loaded" }, { at: 25, label: "OpenAI lead magnet copy" }, { at: 60, label: "Save copy and delivery settings" }, { at: 78, label: "Apply branded two-page PDF design" }, { at: 90, label: "Activate lead capture offer" }],
  leadMagnetLayout: [{ at: 10, label: "Article context loaded" }, { at: 30, label: "Saved copy loaded (no OpenAI)" }, { at: 65, label: "Rebuild fixed two-page design" }, { at: 90, label: "Replace PDF file" }]
} satisfies Record<AutomationType, Array<{ at: number; label: string }>>

function elapsed(startedAt: string | null, finishedAt: string | null, now: number) {
  if (!startedAt) return 0
  const end = finishedAt ? new Date(finishedAt).getTime() : now
  return Math.max(0, Math.floor((end - new Date(startedAt).getTime()) / 1000))
}
function elapsedLabel(seconds: number) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` }

export function BlogAutomationProgressControl({ pidBlog, type }: { pidBlog: string; type: AutomationType }) {
  const router = useRouter(), Icon = type === "image" ? ImageIcon : type === "leadMagnetLayout" ? RotateCcw : FileText
  const [job, setJob] = useState<Job | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(""), [now, setNow] = useState(Date.now())
  const running = Boolean(job && ["queued", "running"].includes(job.status))
  const endpoint = `/api/internal/blog/${encodeURIComponent(pidBlog)}/automation`
  const load = useCallback(async (jobUuid?: string) => {
    const params = new URLSearchParams({ type }); if (jobUuid) params.set("jobUuid", jobUuid)
    const response = await fetch(`${endpoint}?${params}`, { cache: "no-store" }), data = await response.json()
    if (!response.ok) throw new Error(data.error || "Could not load progress.")
    setJob(data); return data as Job | null
  }, [endpoint, type])

  useEffect(() => { let stopped = false; load().catch((cause) => { if (!stopped) setError(cause instanceof Error ? cause.message : "Could not load progress.") }).finally(() => { if (!stopped) setLoading(false) }); return () => { stopped = true } }, [load])
  useEffect(() => { if (!running) return; const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer) }, [running])
  useEffect(() => {
    if (!running || !job?.jobUuid) return
    let stopped = false, timer: number | undefined
    const poll = async () => { try { const next = await load(job.jobUuid); if (stopped) return; setError(""); if (next?.ready) { window.setTimeout(() => router.refresh(), 500); return } } catch (cause) { if (!stopped) setError(cause instanceof Error ? cause.message : "Progress check failed.") } if (!stopped) timer = window.setTimeout(poll, 2500) }
    timer = window.setTimeout(poll, 800)
    return () => { stopped = true; if (timer) window.clearTimeout(timer) }
  }, [job?.jobUuid, load, router, running])

  const start = async () => {
    setLoading(true); setError("")
    try { const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type }) }), data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not start generation."); setJob(data); setNow(Date.now()) }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not start generation.") }
    finally { setLoading(false) }
  }
  const seconds = useMemo(() => elapsed(job?.startedAt || null, job?.finishedAt || null, now), [job?.finishedAt, job?.startedAt, now])
  const progress = Math.max(0, Math.min(100, Number(job?.progress || 0))), steps = stepSets[type]
  const buttonLabel = running
    ? type === "leadMagnetLayout" ? "PDF rebuild in progress" : "Generation in progress"
    : job?.status === "failed"
      ? `Retry ${type === "image" ? "image" : type === "leadMagnetLayout" ? "PDF rebuild" : "PDF"}`
      : type === "leadMagnetLayout"
        ? "Rebuild PDF design — no OpenAI"
        : `${job?.status === "succeeded" ? "Regenerate" : "Generate"} ${type === "image" ? "image" : "lead magnet copy + PDF"}`

  return <div className="mt-4 space-y-3" aria-live="polite">
    <button type="button" onClick={start} disabled={loading || running} aria-busy={loading || running} className="btn-primary min-h-11 justify-center gap-2 disabled:pointer-events-none disabled:opacity-80">
      {running || loading ? <Loader2 className="h-4 w-4 animate-spin" /> : job?.status === "failed" ? <RotateCcw className="h-4 w-4" /> : <Icon className="h-4 w-4" />}{buttonLabel}
    </button>
    {job ? <div className={`rounded-xl border p-3 ${job.status === "failed" ? "border-destructive/20 bg-destructive/5" : job.status === "succeeded" ? "border-emerald-500/20 bg-emerald-500/5" : "border-primary/20 bg-background"}`}>
      <div className="flex items-center justify-between gap-3 text-xs"><span className="flex items-center gap-2 font-bold">{job.status === "succeeded" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : job.status === "failed" ? <XCircle className="h-4 w-4 text-destructive" /> : <Loader2 className="h-4 w-4 animate-spin text-primary" />}{job.stage}</span><span className="flex shrink-0 items-center gap-1 tabular-nums text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{elapsedLabel(seconds)}</span></div>
      <div className="mt-3 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full transition-[width] duration-500 ${job.status === "failed" ? "bg-destructive" : job.status === "succeeded" ? "bg-emerald-500" : "bg-primary"}`} style={{ width: `${progress}%` }} /></div><span className="w-9 text-right text-xs font-black tabular-nums">{progress}%</span></div>
      {running ? <div className="mt-3 grid gap-1.5">{steps.map((step, index) => { const complete = progress > step.at || index < steps.length - 1 && progress >= steps[index + 1].at; const active = !complete && progress >= step.at; return <div key={step.label} className={`flex items-center gap-2 text-[11px] ${complete ? "font-bold text-emerald-700" : active ? "font-bold text-primary" : "text-muted-foreground"}`}>{complete ? <CheckCircle2 className="h-3.5 w-3.5" /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-3.5 w-3.5 rounded-full border border-current opacity-40" />}{step.label}</div> })}</div> : null}
      {job.errorMessage ? <p className="mt-3 text-xs font-semibold text-destructive">{job.errorMessage}</p> : null}
      {running ? <p className="mt-3 text-[10px] text-muted-foreground">Progress is saved on the server. You can refresh or leave this page and reconnect later.</p> : null}
    </div> : <p className="text-xs font-medium text-muted-foreground">{type === "image" ? "Uses OpenAI image generation, Cloudinary upload, and a saved blog update." : type === "leadMagnetLayout" ? "Reuses saved copy and rebuilds only the PDF layout. No OpenAI request is made." : "Generates new copy with OpenAI, builds the PDF, saves delivery settings, and activates the offer."}</p>}
    {error ? <p className="text-xs font-semibold text-destructive">{error}</p> : null}
  </div>
}
