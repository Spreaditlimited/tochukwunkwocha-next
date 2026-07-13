"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { CheckCircle2, Loader2, X } from "lucide-react"

type ProgressState = {
  running: boolean
  processed: number
  total: number
  updated: number
  captionsFound: number
  captionsStarted: number
  transcriptsReady: number
  transcriptsGenerated: number
  missingCaptions: number
  missingTranscripts: number
  message: string
  detail: string
}

const initialProgress: ProgressState = {
  running: false,
  processed: 0,
  total: 0,
  updated: 0,
  captionsFound: 0,
  captionsStarted: 0,
  transcriptsReady: 0,
  transcriptsGenerated: 0,
  missingCaptions: 0,
  missingTranscripts: 0,
  message: "",
  detail: ""
}

function toNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function AccessibilityGenerateButton({
  moduleId,
  moduleTitle
}: {
  moduleId: string
  moduleTitle: string
}) {
  const router = useRouter()
  const [progress, setProgress] = useState<ProgressState>(initialProgress)
  const [confirmOpen, setConfirmOpen] = useState(false)

  async function runGeneration() {
    if (progress.running) return
    setConfirmOpen(false)

    let offset = 0
    let hasMore = true
    let rounds = 0
    const totals = {
      updated: 0,
      captionsFound: 0,
      captionsStarted: 0,
      transcriptsReady: 0,
      transcriptsGenerated: 0,
      missingCaptions: 0,
      missingTranscripts: 0
    }
    setProgress({ ...initialProgress, running: true, message: "Starting accessibility generation..." })

    try {
      while (hasMore && rounds < 80) {
        rounds += 1
        const response = await fetch("/api/internal/video-library/accessibility-autofill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            moduleId,
            offset,
            limit: 3,
            includeAudioDescription: false
          })
        })
        const json = await response.json().catch(() => null)
        if (!response.ok || !json?.ok) throw new Error(json?.error || "Accessibility generation failed.")

        const summary = json.summary || {}
        const scanned = toNumber(summary.scanned)
        const totalMatching = toNumber(json.totalMatching)
        const processed = Math.min(offset + scanned, totalMatching || offset + scanned)

        totals.updated += toNumber(summary.updated)
        totals.captionsFound += toNumber(summary.captionsFound)
        totals.captionsStarted += toNumber(summary.captionGenerationStarted)
        totals.transcriptsReady += toNumber(summary.transcriptsReady)
        totals.transcriptsGenerated += toNumber(summary.transcriptsGenerated)
        totals.missingCaptions += toNumber(summary.missingCaptions)
        totals.missingTranscripts += toNumber(summary.missingTranscripts)

        setProgress({
          running: true,
          processed,
          total: totalMatching,
          updated: totals.updated,
          captionsFound: totals.captionsFound,
          captionsStarted: totals.captionsStarted,
          transcriptsReady: totals.transcriptsReady,
          transcriptsGenerated: totals.transcriptsGenerated,
          missingCaptions: totals.missingCaptions,
          missingTranscripts: totals.missingTranscripts,
          message: `Processing ${processed}${totalMatching ? ` of ${totalMatching}` : ""} lessons...`,
          detail: `Captions ready: ${totals.captionsFound}. Caption jobs started: ${totals.captionsStarted}. Transcripts ready: ${totals.transcriptsReady}.`
        })

        hasMore = json.hasMore === true && json.nextOffset !== null && json.nextOffset !== undefined
        offset = toNumber(json.nextOffset)
        if (!scanned) break
      }

      setProgress((current) => ({
        ...current,
        running: false,
        message: current.missingCaptions === 0 && current.missingTranscripts === 0
          ? "Finished. Module accessibility fields are ready."
          : `Finished. Still pending: ${current.missingCaptions} missing captions, ${current.missingTranscripts} missing transcript.`,
        detail: `Captions ready: ${current.captionsFound}. Caption jobs started: ${current.captionsStarted}. Transcripts ready: ${current.transcriptsReady}. Newly generated transcripts: ${current.transcriptsGenerated}.`
      }))
      router.refresh()
    } catch (error) {
      setProgress((current) => ({
        ...current,
        running: false,
        message: error instanceof Error ? error.message : "Accessibility generation failed.",
        detail: ""
      }))
    }
  }

  return (
    <div className="relative w-[12rem] shrink-0">
      <button className="btn-secondary h-10 w-full shrink-0 gap-2 px-4 text-xs" type="button" onClick={() => setConfirmOpen(true)} disabled={progress.running}>
        {progress.running ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        {progress.running
          ? `${progress.processed}${progress.total ? `/${progress.total}` : ""}`
          : "Generate A11y"}
      </button>
      {progress.message ? (
        <div className="absolute right-0 top-12 z-30 w-[min(24rem,80vw)] rounded-xl border border-border bg-card px-3 py-2 text-[11px] font-semibold leading-relaxed text-muted-foreground shadow-xl shadow-black/15">
          <p className="break-words">{progress.message}</p>
          {progress.detail ? <p className="mt-1 break-words text-primary">{progress.detail}</p> : null}
        </div>
      ) : null}
      {confirmOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-2xl shadow-black/30">
            <button
              type="button"
              className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => setConfirmOpen(false)}
              aria-label="Close confirmation"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-3 pr-8">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-heading text-lg font-black text-foreground">Generate A11y</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Generate captions and transcript accessibility fields for <span className="font-bold text-foreground">"{moduleTitle}"</span>?
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button type="button" className="btn-secondary justify-center" onClick={() => setConfirmOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn-primary justify-center" onClick={runGeneration}>
                Start Generation
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
