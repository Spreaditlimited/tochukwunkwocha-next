"use client"

import { useEffect, useId, useRef, useState } from "react"
import { ArrowUpRight, Check, Copy } from "lucide-react"

const path = "/ask/question"

export function QuestionShareLink() {
  const fieldId = useId()
  const input = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState("")
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => { setUrl(new URL(path, window.location.origin).href) }, [])
  const local = url ? ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname) : false

  async function copy() {
    setError("")
    setCopied(false)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      input.current?.focus()
      input.current?.select()
      setError("Copy the selected link manually.")
    }
  }

  return <section className="admin-card min-w-0 space-y-3">
    <label htmlFor={fieldId} className="label block">Invite anonymous questions</label>
    <p id={`${fieldId}-help`} className="text-xs leading-5 text-muted-foreground">Share this link in Facebook comments or anywhere else. Visitors see a simple question form. Questions arrive under Visitor questions with public visibility off.</p>
    <input ref={input} id={fieldId} type="url" readOnly value={url} onFocus={(event) => event.currentTarget.select()} className="field min-w-0 font-mono text-xs" aria-describedby={`${fieldId}-help`} />
    <div className="flex flex-wrap items-start gap-3 [&>button]:min-h-11 [&>a]:min-h-11">
      <button type="button" onClick={copy} disabled={!url} className="btn-primary gap-2 disabled:opacity-50">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Link copied" : "Copy question link"}</button>
      <a href={path} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">Open question form <ArrowUpRight className="h-4 w-4" /><span className="sr-only"> (opens in a new tab)</span></a>
    </div>
    {local ? <p className="text-xs leading-5 text-muted-foreground">This is a local test link. Copy from the deployed dashboard before sharing on Facebook.</p> : null}
    <p role="status" className="text-xs text-primary">{error || (copied ? "Question link copied to clipboard." : "")}</p>
  </section>
}
