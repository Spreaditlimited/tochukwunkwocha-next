"use client"

import { useState } from "react"
import { RefreshCw } from "lucide-react"

export function DomainPreferenceToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState("")
  const [error, setError] = useState(false)

  async function update(next: boolean) {
    setEnabled(next)
    setSaving(true)
    setError(false)
    setStatus("Saving preference...")
    try {
      const response = await fetch("/api/student/domains/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ autoRenewEnabled: next })
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Could not save preference.")
      setStatus(next ? "Auto-renew enabled for your domain services." : "Auto-renew disabled for your domain services.")
    } catch (reason) {
      setEnabled(!next)
      setError(true)
      setStatus(reason instanceof Error ? reason.message : "Could not save preference.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="surface-raised overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <RefreshCw className={`h-5 w-5 ${saving ? "animate-spin" : ""}`} />
          </div>
          <div>
            <p className="eyebrow text-primary">Domain Preferences</p>
            <h3 className="mt-1 font-heading text-lg font-bold text-foreground">Auto-renew domain services</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Use this as the default for future domain purchases.</p>
          </div>
        </div>
        <label className="inline-flex shrink-0 cursor-pointer items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground">
          <input
            type="checkbox"
            checked={enabled}
            disabled={saving}
            onChange={(event) => void update(event.target.checked)}
            className="h-5 w-5 rounded border-border bg-background text-primary focus:ring-primary"
          />
          {enabled ? "Enabled" : "Disabled"}
        </label>
      </div>
      {status ? <p className={`border-t border-border bg-muted/20 px-6 py-3 text-xs sm:px-8 ${error ? "text-destructive" : "text-muted-foreground"}`}>{status}</p> : null}
    </section>
  )
}
