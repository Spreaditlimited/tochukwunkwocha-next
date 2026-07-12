"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"

type CopyButtonProps = {
  value: string
  label?: string
  copiedLabel?: string
  className?: string
}

export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  className = "btn-secondary gap-2"
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button type="button" onClick={copy} className={className}>
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? copiedLabel : label}
    </button>
  )
}
