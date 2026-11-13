"use client"

import { useRef, useState, type FormEvent } from "react"
import { VAULT_FILE_TYPES, VAULT_MAX_FILE_BYTES, type VaultCatalog, type VaultItem } from "@/lib/vault-catalog"

const inputClass = "mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
const blank = (): VaultItem => ({ id: "", title: "", desc: "", category: "", file: "", published: false })

async function api(body: unknown) {
  const res = await fetch("/api/internal/vault", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "The request failed. Please try again.")
  return data
}

function upload(url: string, headers: Record<string, string>, file: File, onProgress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", url)
    xhr.timeout = 300000
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value)
    xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)) }
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload failed. Please try again."))
    xhr.onerror = () => reject(new Error("Could not upload to storage. Check your connection and the bucket upload policy."))
    xhr.ontimeout = () => reject(new Error("Upload timed out. Please try again."))
    xhr.send(file)
  })
}

export function VaultManager({ initialCatalog, initialEtag }: { initialCatalog: VaultCatalog; initialEtag: string | null }) {
  const [catalog, setCatalog] = useState(initialCatalog)
  const [etag, setEtag] = useState(initialEtag)
  const [editing, setEditing] = useState<VaultItem>(blank)
  const [existingId, setExistingId] = useState("")
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const fileInput = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  function reset() {
    setEditing(blank())
    setExistingId("")
    if (fileInput.current) fileInput.current.value = ""
  }

  async function reload() {
    setBusy(true); setError(""); setMessage("")
    try {
      const data = await api({ action: "reload" })
      setCatalog(data.catalog); setEtag(data.etag); reset(); setMessage("Vault refreshed.")
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not refresh the vault.") }
    finally { setBusy(false) }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setError(""); setMessage(""); setProgress(null)
    let fileKey = editing.file
    try {
      const file = fileInput.current?.files?.[0]
      if (file) {
        if (!file.size || file.size > VAULT_MAX_FILE_BYTES) throw new Error("Choose a nonempty document up to 100 MB.")
        const signed = await api({ action: "upload", filename: file.name, size: file.size })
        setProgress(0)
        await upload(signed.url, signed.headers, file, setProgress)
        fileKey = signed.key
        // Retain a completed upload if publishing conflicts, so retry needs no re-upload.
        setEditing(current => ({ ...current, file: fileKey }))
        if (fileInput.current) fileInput.current.value = ""
      }
      if (!fileKey) throw new Error("Select a document to upload.")
      const data = await api({ action: "save", item: { ...editing, file: fileKey }, etag, editingId: existingId })
      setCatalog(data.catalog); setEtag(data.etag)
      setMessage(editing.published ? "Document published to the member vault." : "Document saved as a private draft.")
      reset()
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save this document.") }
    finally { setBusy(false); setProgress(null) }
  }

  return <div className="space-y-6">
    <div aria-live="polite">{message ? <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">{message}</p> : null}</div>
    {error ? <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">{error}</p> : null}
    <form ref={formRef} onSubmit={save} data-toast-managed="true" className="rounded-2xl border border-border bg-card p-6">
      <h3 className="text-xl font-bold">{existingId ? "Edit document" : "Upload a document"}</h3>
      <fieldset disabled={busy} className="mt-5 grid gap-5 md:grid-cols-2">
        <label className="text-sm font-semibold">Title<input required maxLength={200} className={inputClass} value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} /></label>
        <label className="text-sm font-semibold">Category<input required maxLength={80} placeholder="e.g. Business & importing" className={inputClass} value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })} /></label>
        <label className="text-sm font-semibold md:col-span-2">Description<textarea required maxLength={1000} rows={3} className={inputClass} value={editing.desc} onChange={e => setEditing({ ...editing, desc: e.target.value })} /></label>
        <label className="text-sm font-semibold">Document ID<input required readOnly={!!existingId} pattern="[a-z0-9][a-z0-9-]*" maxLength={80} placeholder="e.g. family-budget-tracker" className={inputClass} value={editing.id} onChange={e => setEditing({ ...editing, id: e.target.value })} /><span className="mt-2 block text-xs text-muted-foreground">Used in its download link. Lowercase letters, numbers, and hyphens.</span></label>
        <label className="text-sm font-semibold">{editing.file ? "Replace file (optional)" : "Document file"}<input ref={fileInput} type="file" required={!editing.file} accept={Object.keys(VAULT_FILE_TYPES).map(ext => `.${ext}`).join(",")} className={inputClass} /><span className="mt-2 block break-all text-xs text-muted-foreground">{editing.file ? `Current file: ${editing.file.split("/").pop()}. ` : ""}PDF, Excel, Word, PowerPoint, CSV, ZIP, TXT · Up to 100 MB</span></label>
        <label className="flex items-center gap-3 text-sm font-semibold md:col-span-2"><input type="checkbox" checked={editing.published} onChange={e => setEditing({ ...editing, published: e.target.checked })} />Publish to the member vault</label>
        <p className="text-xs text-muted-foreground md:col-span-2">Uncheck to hide a document. Files stay private, and previously downloaded copies remain with their recipients.</p>
        <div className="flex flex-wrap gap-3 md:col-span-2"><button type="submit" className="btn-primary">{busy ? progress === null ? "Saving…" : `Uploading ${progress}%…` : editing.published ? "Save and publish" : "Save private draft"}</button><button type="button" className="btn-secondary" onClick={reset}>Clear form</button></div>
      </fieldset>
      {progress !== null ? <progress aria-label="Upload progress" value={progress} max={100} className="mt-4 w-full" /> : null}
    </form>
    <section className="space-y-4"><div className="flex items-center justify-between gap-4"><h3 className="text-xl font-bold">Documents ({catalog.templates.length})</h3><button type="button" className="btn-secondary" disabled={busy} onClick={reload}>Refresh</button></div>
      {catalog.templates.length === 0 ? <p className="rounded-xl border border-dashed border-border p-6 text-muted-foreground">No documents yet. Upload your first file above.</p> : catalog.templates.map(item => <article key={item.id} className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-card p-5 sm:flex-row"><div><p className="text-xs text-primary">{item.category} · {item.published ? "Published" : "Private draft"}</p><h4 className="mt-1 font-bold">{item.title}</h4><p className="mt-2 text-sm text-muted-foreground">{item.desc}</p></div><button disabled={busy} type="button" className="btn-secondary self-start" onClick={() => { setEditing({ ...item }); setExistingId(item.id); if (fileInput.current) fileInput.current.value = ""; setError(""); setMessage(""); formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }) }}>Edit</button></article>)}
    </section>
  </div>
}
