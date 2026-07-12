"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"

export function ResourcePromptBlock({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false)

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-sm">
      <div className="flex items-center justify-between gap-4 bg-muted/60 px-4 py-3">
        <span className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Prompt
        </span>
        <button
          type="button"
          onClick={copyPrompt}
          className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 font-mono text-xs font-semibold text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label={copied ? "Prompt copied" : "Copy prompt"}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-[42rem] overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words p-4 text-[13px] leading-6 sm:p-5 sm:text-sm">
        <code className="whitespace-pre-wrap break-words font-mono text-foreground">{prompt}</code>
      </pre>
    </div>
  )
}
