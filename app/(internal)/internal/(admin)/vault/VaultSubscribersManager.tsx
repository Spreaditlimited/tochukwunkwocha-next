"use client"

import { useState } from "react"
import { parseSubscriberCsv, VAULT_SUBSCRIBERS_MAX_BYTES, type VaultSubscribers } from "@/lib/vault-subscribers"

type State = { record: VaultSubscribers | null; etag: string | null }
async function subscriberApi(body: unknown): Promise<State> {
  const response = await fetch("/api/internal/vault", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || "Could not update subscribers.")
  return result
}

export function VaultSubscribersManager({ initialState, initialError }: { initialState: State | null; initialError: string }) {
  const [state, setState] = useState(initialState)
  const [candidate, setCandidate] = useState<{ csv: string; filename: string; emails: string[]; duplicates: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(initialError)
  const [message, setMessage] = useState("")
  const [confirmed, setConfirmed] = useState(false)
  const [inputKey, setInputKey] = useState(0)
  const [search, setSearch] = useState("")
  const current = state?.record?.emails || []
  const currentSet = new Set(current)
  const candidateSet = new Set(candidate?.emails || [])
  const added = candidate?.emails.filter(email => !currentSet.has(email)).length || 0
  const removed = candidate ? current.filter(email => !candidateSet.has(email)).length : 0
  const stale = !!state?.record && Date.now() - Date.parse(state.record.updatedAt) > 36 * 3600000

  async function choose(file: File | undefined) {
    setCandidate(null); setConfirmed(false); setError(""); setMessage("")
    if (!file) return
    if (!file.name.toLowerCase().endsWith(".csv") || file.size > VAULT_SUBSCRIBERS_MAX_BYTES) { setError("Choose Facebook’s subscriber CSV, up to 2 MB."); return }
    setBusy(true)
    try {
      const csv = await file.text()
      const parsed = parseSubscriberCsv(csv)
      // Refresh before calculating removals; the final write also uses an atomic ETag check.
      setState(await subscriberApi({ action: "subscribers-reload" }))
      setCandidate({ csv, filename: file.name, ...parsed })
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not read the CSV.") }
    finally { setBusy(false); setInputKey(value => value + 1) }
  }

  async function replace() {
    if (!candidate || !state || !confirmed) return
    setBusy(true); setError(""); setMessage("")
    try {
      setState(await subscriberApi({ action: "subscribers-replace", csv: candidate.csv, filename: candidate.filename, etag: state.etag }))
      setCandidate(null); setConfirmed(false)
      setMessage("Subscriber list replaced. Only emails in this upload can access the vault; removed emails have lost access.")
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not replace the list.") }
    finally { setBusy(false) }
  }

  async function refresh() {
    setBusy(true); setError(""); setCandidate(null); setConfirmed(false)
    try { setState(await subscriberApi({ action: "subscribers-reload" })) }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load subscribers.") }
    finally { setBusy(false) }
  }

  return <section aria-labelledby="subscribers-title" className="rounded-2xl border border-border bg-card p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow text-primary">Evening update</p><h3 id="subscribers-title" className="mt-2 text-xl font-bold">Subscriber access list</h3><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Export the subscriber email CSV from Facebook and upload it here each evening. Members need an email in this list plus the monthly code to unlock the vault.</p></div><button type="button" className="btn-secondary" disabled={busy} onClick={refresh}>Refresh list</button></div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="rounded-xl border border-border bg-background p-4"><p className="text-sm text-muted-foreground">Approved subscriber emails</p><p className="mt-2 text-3xl font-bold">{state ? current.length : "—"}</p></div><div className="rounded-xl border border-border bg-background p-4"><p className="text-sm text-muted-foreground">Last uploaded</p><p className="mt-2 text-sm font-semibold">{state?.record ? new Date(state.record.updatedAt).toLocaleString("en-GB", { timeZone: "Europe/London" }) + " (UK)" : "No list uploaded yet"}</p>{state?.record ? <p className="mt-2 break-all text-xs text-muted-foreground">{state.record.sourceName}</p> : <p className="mt-2 text-xs text-muted-foreground">Member access stays closed until the first list is uploaded.</p>}</div></div>
    {stale ? <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">This list is over 36 hours old. Upload a fresh Facebook export. Access continues to use the last saved list.</p> : null}
    {error ? <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm">{error}</p> : null}
    <div aria-live="polite">{message ? <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">{message}</p> : null}</div>
    <div className="mt-5 rounded-xl border border-dashed border-primary/40 p-5"><label htmlFor="subscriber-csv" className="block text-sm font-semibold">Upload Facebook subscriber CSV</label><p id="subscriber-csv-help" className="mt-2 text-xs leading-relaxed text-muted-foreground">Use the original export with an “Email address” column. Up to 2 MB / 10,000 rows. Every upload replaces the entire list.</p><input key={inputKey} id="subscriber-csv" type="file" accept=".csv,text/csv" aria-describedby="subscriber-csv-help" disabled={busy} onChange={event => void choose(event.target.files?.[0])} className="mt-4 block w-full text-sm" /></div>
    {candidate ? <div className="mt-5 rounded-xl border border-primary/30 bg-background p-5"><h4 className="font-semibold">Review replacement</h4><p className="mt-2 break-all text-xs text-muted-foreground">{candidate.filename}</p><p className="mt-3 text-sm">{candidate.emails.length} approved emails · {added} added · {removed} removed · {candidate.duplicates} duplicate rows ignored</p>{candidate.emails.length === 0 ? <p className="mt-3 text-sm text-amber-500">This CSV is empty. Applying it will block all member access.</p> : null}<label className="mt-4 flex items-start gap-3 text-sm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy} className="mt-1" /><span>Replace the current list with this export. Emails missing from it will lose access, including existing sessions.</span></label><div className="mt-4 flex flex-wrap gap-3"><button type="button" className="btn-primary" disabled={busy || !confirmed} onClick={replace}>{busy ? "Saving…" : "Replace subscriber list"}</button><button type="button" className="btn-secondary" disabled={busy} onClick={() => { setCandidate(null); setConfirmed(false) }}>Cancel</button></div></div> : null}
    {state?.record ? <div className="mt-5"><label htmlFor="subscriber-search" className="text-sm font-semibold">Check a subscriber email</label><input id="subscriber-search" type="search" autoComplete="off" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search the current list" className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />{search.trim() ? <ul className="mt-3 space-y-1 text-sm">{current.filter(email => email.includes(search.trim().toLowerCase())).slice(0, 20).map(email => <li key={email} className="break-all">{email}</li>)}{!current.some(email => email.includes(search.trim().toLowerCase())) ? <li className="text-muted-foreground">No matching email in the current list.</li> : null}</ul> : null}</div> : null}
    <p className="mt-5 text-xs leading-relaxed text-muted-foreground">Facebook controls the export. A cancellation is reflected here only when the email disappears from a later export and you upload that file.</p>
  </section>
}
