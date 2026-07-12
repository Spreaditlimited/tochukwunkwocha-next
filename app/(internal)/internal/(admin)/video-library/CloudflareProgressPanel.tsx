"use client"

import { useMemo, useState } from "react"
import { Cloud, Key, LockKeyhole, UploadCloud } from "lucide-react"

type JobStatus = "idle" | "running" | "success" | "error"

type ProgressState = {
  status: JobStatus
  message: string
  current: number
  total: number
}

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  })
  const json = await response.json().catch(() => null)
  if (!response.ok || !json?.ok) throw new Error(json?.error || `Request failed (${response.status})`)
  return json as T
}

function progressWidth(current: number, total: number) {
  if (total <= 0) return "0%"
  return `${Math.max(0, Math.min(100, Math.round((current / total) * 100)))}%`
}

function defaultRecentSince() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
}

export function CloudflareProgressPanel() {
  const [maxPages, setMaxPages] = useState(20)
  const [signingScope, setSigningScope] = useState<"all" | "recent">("recent")
  const [batchSize, setBatchSize] = useState(10)
  const [recentSince, setRecentSince] = useState<string>(defaultRecentSince)
  const [syncProgress, setSyncProgress] = useState<ProgressState>({
    status: "idle",
    message: "Ready to sync Cloudflare Stream assets.",
    current: 0,
    total: 0
  })
  const [signProgress, setSignProgress] = useState<ProgressState>({
    status: "idle",
    message: "Choose the videos to sign, then start signing.",
    current: 0,
    total: 0
  })
  const [failures, setFailures] = useState<Array<{ videoUid: string; error: string }>>([])

  const busy = syncProgress.status === "running" || signProgress.status === "running"
  const recentLabel = useMemo(() => {
    const date = new Date(recentSince)
    return Number.isNaN(date.getTime()) ? "last 24 hours" : date.toLocaleString()
  }, [recentSince])

  async function runSync() {
    if (busy) return
    const startedAt = new Date().toISOString()
    setRecentSince(startedAt)
    setFailures([])
    setSyncProgress({ status: "running", message: "Starting Cloudflare sync...", current: 0, total: 0 })
    let page = 1
    let fetched = 0
    let upserted = 0
    let scannedPages = 0
    try {
      for (;;) {
        const result = await postJson<{
          page: number
          totalPages: number
          maxPages: number
          fetched: number
          upserted: number
          nextPage: number | null
          done: boolean
        }>("/api/internal/video-library/cloudflare-sync-step", { page, maxPages })
        fetched += Number(result.fetched || 0)
        upserted += Number(result.upserted || 0)
        scannedPages = Number(result.page || page)
        const total = Math.min(Number(result.totalPages || 1), Number(result.maxPages || maxPages))
        setSyncProgress({
          status: "running",
          message: `Synced page ${scannedPages} of ${total}. Found ${fetched} videos and refreshed ${upserted} library records so far.`,
          current: scannedPages,
          total
        })
        if (result.done || !result.nextPage) break
        page = result.nextPage
      }
      setSyncProgress({
        status: "success",
        message: `Sync complete. Checked ${scannedPages} page${scannedPages === 1 ? "" : "s"}, found ${fetched} video${fetched === 1 ? "" : "s"}, and refreshed ${upserted} library record${upserted === 1 ? "" : "s"}.`,
        current: scannedPages,
        total: Math.max(scannedPages, 1)
      })
    } catch (error) {
      setSyncProgress({
        status: "error",
        message: error instanceof Error ? error.message : "Cloudflare sync failed.",
        current: scannedPages,
        total: Math.max(scannedPages, 1)
      })
    }
  }

  async function runSigning() {
    if (busy) return
    const since = signingScope === "recent" ? recentSince || defaultRecentSince() : null
    setFailures([])
    setSignProgress({ status: "running", message: "Counting videos to sign...", current: 0, total: 0 })
    let processed = 0
    let protectedCount = 0
    let failedCount = 0
    try {
      const plan = await postJson<{ totalVideos: number }>("/api/internal/video-library/signing", {
        mode: "plan",
        scope: signingScope,
        since
      })
      const totalVideos = Number(plan.totalVideos || 0)
      if (totalVideos <= 0) {
        setSignProgress({
          status: "success",
          message: signingScope === "recent" ? "No recently synced videos need signing." : "No synced videos need signing.",
          current: 0,
          total: 0
        })
        return
      }
      while (processed < totalVideos) {
        const limit = Math.max(1, Math.min(batchSize, 25))
        const doneAfterThisBatch = processed + limit >= totalVideos ? 1 : 0
        const result = await postJson<{
          totalVideos: number
          processedVideos: number
          protectedVideos: number
          failedVideos: number
          keySource: string
          failures?: Array<{ videoUid: string; error: string }>
        }>("/api/internal/video-library/signing", {
          mode: "batch",
          scope: signingScope,
          since,
          offset: processed,
          limit,
          forceRotate: processed === 0,
          doneAfterThisBatch
        })
        const batchProcessed = Number(result.processedVideos || 0)
        if (batchProcessed <= 0) break
        processed += batchProcessed
        protectedCount += Number(result.protectedVideos || 0)
        failedCount += Number(result.failedVideos || 0)
        if (Array.isArray(result.failures) && result.failures.length) {
          setFailures((current) => [...current, ...result.failures!.slice(0, 5)].slice(0, 10))
        }
        setSignProgress({
          status: "running",
          message: `Signed ${protectedCount} of ${totalVideos} video${totalVideos === 1 ? "" : "s"}. Checked ${processed}; failed ${failedCount}. Signing key: ${result.keySource}.`,
          current: processed,
          total: totalVideos
        })
      }
      setSignProgress({
        status: failedCount > 0 ? "error" : "success",
        message: failedCount > 0
          ? `Signing finished with errors. Protected ${protectedCount} of ${totalVideos}; ${failedCount} failed.`
          : `Signing complete. Protected ${protectedCount} of ${totalVideos} video${totalVideos === 1 ? "" : "s"}.`,
        current: totalVideos,
        total: totalVideos
      })
    } catch (error) {
      setSignProgress({
        status: "error",
        message: error instanceof Error ? error.message : "Could not enable signed playback protection.",
        current: processed,
        total: Math.max(processed, 1)
      })
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <UploadCloud className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-heading text-xl font-black text-foreground">Cloudflare Stream Sync</h2>
              <p className="mt-1 text-sm text-muted-foreground">Pull uploaded Stream assets into the internal video database with page-by-page progress.</p>
            </div>
          </div>
          <div className="flex w-full gap-3 sm:w-auto">
            <input
              type="number"
              min="1"
              max="50"
              value={maxPages}
              onChange={(event) => setMaxPages(Math.max(1, Math.min(Number(event.target.value || 20), 50)))}
              className="h-11 w-24 rounded-xl border border-input bg-background px-3 text-sm font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              aria-label="Maximum Cloudflare pages to sync"
            />
            <button className="btn-primary h-11 justify-center" type="button" onClick={runSync} disabled={busy}>
              <Cloud className="h-4 w-4" />
              {syncProgress.status === "running" ? "Syncing" : "Sync"}
            </button>
          </div>
        </div>
        <div className="mt-5">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: progressWidth(syncProgress.current, syncProgress.total) }} />
          </div>
          <p className={`mt-3 text-sm font-semibold ${syncProgress.status === "error" ? "text-destructive" : syncProgress.status === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
            {syncProgress.message}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Key className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-heading text-xl font-black text-foreground">Signed Playback</h2>
              <p className="mt-1 text-sm text-muted-foreground">Enforce signed Cloudflare playback and watch each batch complete.</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="grid gap-2 rounded-xl border border-border bg-background p-3">
              <label className="flex items-start gap-2 text-sm font-bold text-foreground">
                <input type="radio" name="signingScope" value="recent" checked={signingScope === "recent"} onChange={() => setSigningScope("recent")} className="mt-1 h-4 w-4 border-input text-primary focus:ring-primary" />
                <span>
                  Recently synced videos
                  <span className="block text-xs font-medium text-muted-foreground">Updated since {recentLabel}</span>
                </span>
              </label>
              <label className="flex items-center gap-2 text-sm font-bold text-foreground">
                <input type="radio" name="signingScope" value="all" checked={signingScope === "all"} onChange={() => setSigningScope("all")} className="h-4 w-4 border-input text-primary focus:ring-primary" />
                All synced videos
              </label>
            </div>
            <div className="flex gap-3">
              <input
                type="number"
                min="1"
                max="25"
                value={batchSize}
                onChange={(event) => setBatchSize(Math.max(1, Math.min(Number(event.target.value || 10), 25)))}
                className="h-11 w-20 rounded-xl border border-input bg-background px-3 text-sm font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                aria-label="Videos per signing batch"
              />
              <button className="btn-secondary h-11 justify-center" type="button" onClick={runSigning} disabled={busy}>
                <LockKeyhole className="h-4 w-4" />
                {signProgress.status === "running" ? "Signing" : "Sign"}
              </button>
            </div>
          </div>

          <div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: progressWidth(signProgress.current, signProgress.total) }} />
            </div>
            <p className={`mt-3 text-sm font-semibold ${signProgress.status === "error" ? "text-destructive" : signProgress.status === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
              {signProgress.message}
            </p>
            {failures.length ? (
              <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs font-medium text-destructive">
                {failures.map((failure) => (
                  <p key={`${failure.videoUid}-${failure.error}`} className="break-words">{failure.videoUid}: {failure.error}</p>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
