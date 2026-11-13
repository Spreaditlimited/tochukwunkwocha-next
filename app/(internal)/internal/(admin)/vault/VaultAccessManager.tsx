"use client"

import { useState } from "react"

type Status = { configured: boolean; updatedAt: string | null; updatedBy: string | null }
type AccessState = { record: { code: string; updatedAt: string; updatedBy: string } | null; etag: string | null }

async function accessApi(body: unknown) {
  const response = await fetch("/api/internal/vault", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || "The access code could not be updated.")
  return result
}

export function VaultAccessManager({ initialStatus, initialError }: { initialStatus: Status | null; initialError: string }) {
  const [status, setStatus] = useState(initialStatus)
  const [activeCode, setActiveCode] = useState("")
  const [visible, setVisible] = useState(false)
  const [candidate, setCandidate] = useState<{ code: string; etag: string | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(initialError)
  const [message, setMessage] = useState("")

  function applyState(state: AccessState) {
    setStatus({ configured: !!state.record, updatedAt: state.record?.updatedAt || null, updatedBy: state.record?.updatedBy || null })
    setActiveCode(state.record?.code || "")
  }

  async function reveal() {
    setBusy(true); setError(""); setMessage("")
    try { applyState(await accessApi({ action: "access-reveal" })); setVisible(true) }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load the active code.") }
    finally { setBusy(false) }
  }

  async function generate() {
    setBusy(true); setError(""); setMessage("")
    try { setCandidate(await accessApi({ action: "access-generate" })) }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not generate a code.") }
    finally { setBusy(false) }
  }

  async function activate() {
    if (!candidate) return
    setBusy(true); setError(""); setMessage("")
    try {
      applyState(await accessApi({ action: "access-activate", code: candidate.code, etag: candidate.etag }))
      setCandidate(null); setVisible(true)
      setMessage("New code activated. Copy it into the pinned Facebook Group post. Members must sign in again.")
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not activate the code. Refresh to check the active code.") }
    finally { setBusy(false) }
  }

  async function copy(post: boolean) {
    if (!activeCode) return
    const text = post ? `INNER CIRCLE — VAULT ACCESS\n\nYour monthly access code: ${activeCode}\n\nOpen https://vault.tochukwunkwocha.com and enter the email address tied to your Facebook account plus this code.\n\nNew subscribers are added to the vault each evening. If your email is not recognised after the next update, please contact us in the group.\n\nPlease keep this code inside our private subscribers’ group.` : activeCode
    try { await navigator.clipboard.writeText(text); setMessage(post ? "Pinned-post text copied." : "Active code copied."); setError("") }
    catch { setError("Clipboard access is unavailable. Select and copy the displayed code instead.") }
  }

  return <section aria-labelledby="monthly-code-title" className="rounded-2xl border border-primary/25 bg-card p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow text-primary">Member access</p><h3 id="monthly-code-title" className="mt-2 text-xl font-bold">Monthly access code</h3><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Generate a code, activate it, then pin it in the private Facebook Group. Activating a new code replaces the previous one and signs members out.</p></div><button type="button" className="btn-primary" disabled={busy} onClick={generate}>{busy ? "Please wait…" : "Generate new code"}</button></div>
    {error ? <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm">{error}</p> : null}
    <div aria-live="polite">{message ? <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">{message}</p> : null}</div>
    <div className="mt-5 rounded-xl border border-border bg-background p-5">
      <p className="text-sm font-semibold">Active code</p>
      {status?.configured ? <>
        <div className="mt-3 flex flex-wrap items-center gap-3"><code className="break-all rounded-lg bg-muted px-4 py-3 text-lg tracking-wider select-all">{visible && activeCode ? activeCode : "•••••–•••••–•••••"}</code><button type="button" disabled={busy} className="btn-secondary" onClick={visible ? () => { setVisible(false); setActiveCode("") } : reveal}>{visible ? "Hide code" : "Show current code"}</button></div>
        <p className="mt-3 text-xs text-muted-foreground">Last activated {status.updatedAt ? new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(status.updatedAt)) : "—"}{status.updatedBy ? ` by ${status.updatedBy}` : ""}.</p>
        {visible && activeCode ? <div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={busy} className="btn-secondary" onClick={() => copy(false)}>Copy code</button><button type="button" disabled={busy} className="btn-secondary" onClick={() => copy(true)}>Copy Facebook pinned post</button></div> : null}
      </> : <p className="mt-2 text-sm text-muted-foreground">{status ? "No monthly code has been activated from this dashboard yet. Generate one when you’re ready." : "Refresh to check the active code before making changes."}</p>}
    </div>
    {candidate ? <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5"><p className="text-sm font-semibold">New code — not active yet</p><code className="mt-3 block break-all font-mono text-xl tracking-wider select-all">{candidate.code}</code><p className="mt-3 text-sm text-muted-foreground">Activate this code before posting it in the group. The previous code will stop working immediately.</p><div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={busy} className="btn-primary" onClick={activate}>Activate new code</button><button type="button" disabled={busy} className="btn-secondary" onClick={() => setCandidate(null)}>Discard</button></div></div> : null}
    <p className="mt-4 text-xs text-muted-foreground">Only the account owner can view or rotate access codes. Codes stay active until you rotate them; this does not schedule an automatic monthly change.</p>
  </section>
}
