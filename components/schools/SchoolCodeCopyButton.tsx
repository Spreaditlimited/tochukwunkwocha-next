"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"

export function SchoolCodeCopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  async function copyCode() {
    if (!code) return
    await navigator.clipboard.writeText(code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <button
      type="button"
      onClick={copyCode}
      className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-[11px] font-bold text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
      aria-label={`Copy student code ${code}`}
      title={copied ? "Copied" : "Copy code"}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  )
}
