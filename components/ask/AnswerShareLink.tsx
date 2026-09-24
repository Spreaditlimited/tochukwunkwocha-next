"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Check, Copy, ArrowUpRight } from "lucide-react"
import { askAnswerPath, isQuestionPublished } from "@/lib/ask-validation"

export function AnswerShareLink({ id, status, acceptingAnswers }: { id: string; status: string; acceptingAnswers: boolean }) {
  const fieldId = useId()
  const input = useRef<HTMLInputElement>(null)
  const path = askAnswerPath(id)
  const [url, setUrl] = useState("")
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState("")
  const ready = isQuestionPublished(status)
  useEffect(() => { setUrl(new URL(path, window.location.origin).href) }, [path])
  const local = url ? ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname) : false

  async function copy() {
    setError("")
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      input.current?.focus()
      input.current?.select()
      setError("Copy the selected link manually.")
    }
  }

  return <div className="mt-5 space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
    <label htmlFor={fieldId} className="block text-sm font-bold">Anonymous answer link</label>
    <p className="text-xs leading-5 text-muted-foreground">Copy and share this link whether public visibility is on or off. It opens just your question and an anonymous answer form. No Facebook post link is required.</p>
    <input ref={input} id={fieldId} type="url" readOnly value={url} onFocus={(event) => event.currentTarget.select()} className="field text-sm" aria-describedby={`${fieldId}-status`} />
    <div className="flex flex-wrap items-center gap-4">
      <button type="button" onClick={copy} disabled={!ready || !url} className="btn-primary gap-2 disabled:opacity-50">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Link copied" : "Copy answer link"}</button>
      {ready ? <a href={path} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">Open answer form <ArrowUpRight className="h-4 w-4" /><span className="sr-only"> (opens in a new tab)</span></a> : null}
    </div>
    <p id={`${fieldId}-status`} className="text-xs leading-5 text-muted-foreground">{!isQuestionPublished(status) ? "Publish this question to activate the link." : !acceptingAnswers ? "Enable anonymous answers to reopen this link." : local ? "This is a local test link. Copy the link from your deployed website before sharing it on Facebook." : "Anyone with this link can answer without signing in."}</p>
    {status === "unlisted" ? <p className="text-xs leading-5 text-muted-foreground">This question is hidden from public pages. Only the answer form is accessible through this link.</p> : null}
    <p role="status" className="text-xs text-primary">{error || (copied ? "Answer link copied to clipboard." : "")}</p>
  </div>
}
