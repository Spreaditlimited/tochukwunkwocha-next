"use client"

import { useState } from "react"
import { AlertTriangle, CheckCircle2, Loader2, Radio, ShieldCheck } from "lucide-react"

type ConnectionResult = {
  ok: boolean
  error?: string
  apiVersion?: string
  budgetPolicy?: {
    currency: "NGN"
    maxDailyBudgetMinor: number
  } | null
  account?: {
    id: string
    name: string
    businessName: string
    status: number
    currency: string
    timezone: string
  }
}

export function MetaAdsConnectionCard() {
  const [result, setResult] = useState<ConnectionResult | null>(null)
  const [checking, setChecking] = useState(false)

  async function checkConnection() {
    setChecking(true)
    setResult(null)
    try {
      const response = await fetch("/api/internal/meta-ads/health", { method: "GET", headers: { Accept: "application/json" }, cache: "no-store" })
      const payload = await response.json().catch(() => null) as ConnectionResult | null
      setResult(payload || { ok: false, error: "The Meta Ads connection check returned an invalid response." })
    } catch {
      setResult({ ok: false, error: "The Meta Ads connection check could not be completed." })
    } finally {
      setChecking(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Radio className="h-5 w-5" /></span>
          <div>
            <p className="eyebrow text-primary">Meta Marketing API</p>
            <h2 className="mt-1 font-heading text-xl font-black text-foreground">Read-only connection check</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Confirms the production credential can read the assigned ad account. This check cannot create, edit, publish, pause or delete adverts.</p>
          </div>
        </div>
        <button type="button" onClick={() => void checkConnection()} disabled={checking} className="btn-secondary shrink-0 justify-center">
          {checking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
          {checking ? "Checking…" : "Test Connection"}
        </button>
      </div>

      {result ? (
        <div className={`border-t p-5 sm:px-8 ${result.ok ? "border-emerald-500/20 bg-emerald-500/5" : "border-amber-500/20 bg-amber-500/5"}`}>
          {result.ok && result.account ? (
            <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" /><div><p className="font-heading text-sm font-bold text-foreground">Connected to {result.account.name}</p><p className="mt-1 text-xs text-muted-foreground">{result.account.businessName ? `${result.account.businessName} · ` : ""}{result.account.currency || "Currency unavailable"} · {result.account.timezone || "Timezone unavailable"} · API {result.apiVersion || "App default"}</p><p className={`mt-2 text-xs font-bold ${result.budgetPolicy ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>{result.budgetPolicy ? `Hard daily limit: ${new Intl.NumberFormat("en-NG", { style: "currency", currency: result.budgetPolicy.currency }).format(result.budgetPolicy.maxDailyBudgetMinor / 100)}` : "Publishing locked: hard daily budget limit is not configured."}</p></div></div>
          ) : (
            <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" /><div><p className="font-heading text-sm font-bold text-foreground">Connection not ready</p><p className="mt-1 text-xs text-muted-foreground">{result.error || "Review the Meta configuration and try again."}</p></div></div>
          )}
        </div>
      ) : null}
    </section>
  )
}
