"use client"

import { useEffect, useMemo, useState } from "react"
import { BarChart3, CheckCircle2, Loader2, Play, TriangleAlert } from "lucide-react"
import { useRouter } from "next/navigation"

type Run = { runUuid: string; startDate: string; endDate: string; rowCount: number; status: string; error?: string | null; elapsedSeconds?: number; percent?: number; stage?: string; ready?: boolean }

function daysAgo(days: number) { const value = new Date(); value.setUTCDate(value.getUTCDate() - days); return value.toISOString().slice(0, 10) }
function dayAfter(value: string | null) { if (!value) return daysAgo(31); const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + 1); return date.toISOString().slice(0, 10) }
function elapsed(seconds = 0) { return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}` }

export function GscImportControl({ latestCompletedEndDate, initialRun }: { latestCompletedEndDate: string | null; initialRun: Run | null }) {
  const router = useRouter(), latest = useMemo(() => daysAgo(2), []), suggested = useMemo(() => { const next = dayAfter(latestCompletedEndDate); return next <= latest ? next : daysAgo(4) }, [latest, latestCompletedEndDate])
  const [startDate, setStartDate] = useState(suggested), [endDate, setEndDate] = useState(latest), [run, setRun] = useState(initialRun), [starting, setStarting] = useState(false), [error, setError] = useState("")
  const running = Boolean(run && run.status === "started" && !run.ready)
  useEffect(() => {
    if (!running || !run?.runUuid) return
    let stopped = false, timer: number | undefined
    const poll = async () => {
      try {
        const response = await fetch(`/api/seo/search-console/import?runUuid=${encodeURIComponent(run.runUuid)}`, { cache: "no-store" }), result = await response.json()
        if (!response.ok) throw new Error(result.error || "Could not check import status.")
        if (!stopped) { setRun(result); setError(""); if (result.ready) { router.refresh(); return } }
      } catch (cause) { if (!stopped) setError(cause instanceof Error ? cause.message : "Could not check import status.") }
      if (!stopped) timer = window.setTimeout(poll, 3000)
    }
    timer = window.setTimeout(poll, 700); return () => { stopped = true; if (timer) clearTimeout(timer) }
  }, [run?.runUuid, running, router])
  async function start() {
    setStarting(true); setError("")
    try {
      const response = await fetch("/api/seo/search-console/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ startDate, endDate }) }), result = await response.json()
      if (!response.ok && !result.runUuid) throw new Error(result.error || "Could not start GSC import.")
      setRun({ ...result, status: "started", ready: false, percent: 8, stage: result.alreadyRunning ? "Reconnected to the import already in progress" : "Manual import accepted" })
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not start GSC import.") } finally { setStarting(false) }
  }
  return <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><div className="max-w-2xl"><h2 className="flex items-center gap-2 text-sm font-bold"><BarChart3 className="h-4 w-4 text-primary" />Manual Search Console Import</h2><p className="mt-2 text-xs text-muted-foreground">Import a date range directly from Google, save daily query dimensions, and refresh the opportunity queue. The saved job survives page refreshes and does not call OpenAI.</p></div>
    <div className="flex flex-wrap items-end gap-3"><label className="grid gap-1 text-[10px] font-bold uppercase text-muted-foreground">Start date<input type="date" value={startDate} max={endDate} disabled={running || starting} onChange={(e) => setStartDate(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-xs" /></label><label className="grid gap-1 text-[10px] font-bold uppercase text-muted-foreground">End date<input type="date" value={endDate} min={startDate} max={latest} disabled={running || starting} onChange={(e) => setEndDate(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-xs" /></label><button type="button" onClick={start} disabled={running || starting || !startDate || !endDate || startDate > endDate} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-50">{running || starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{running ? "Import Running" : starting ? "Starting" : "Import GSC Data"}</button></div></div>
    {run && <div className={`mt-5 rounded-lg border p-4 ${run.status === "failed" ? "border-destructive/20 bg-destructive/10" : run.status === "completed" ? "border-emerald-500/20 bg-emerald-500/10" : "border-blue-500/20 bg-blue-500/10"}`}><div className="flex gap-3">{run.status === "failed" ? <TriangleAlert className="h-4 w-4 text-destructive" /> : run.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}<div className="flex-1"><div className="flex justify-between gap-2"><p className="text-xs font-bold">{run.stage}</p><span className="text-xs text-muted-foreground">{Number(run.rowCount || 0).toLocaleString()} rows · {elapsed(run.elapsedSeconds)}</span></div><p className="mt-1 text-[10px] text-muted-foreground">{run.startDate} through {run.endDate} · {run.runUuid}</p>{running && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-blue-500/15"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(5, Number(run.percent || 8))}%` }} /></div>}{run.error && <p className="mt-2 text-xs text-destructive">{run.error}</p>}</div></div></div>}
    {error && <p className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">{error}</p>}
  </section>
}
