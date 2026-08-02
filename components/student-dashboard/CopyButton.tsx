"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"

import { showStudentToast } from "@/components/student-dashboard/StudentActionToaster"

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
      showStudentToast({ type: "success", title: copiedLabel, message: "Copied to your clipboard." })
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
      showStudentToast({ type: "error", title: "Copy failed", message: "Could not copy this value. Please select and copy it manually." })
    }
  }

  return (
    <button type="button" onClick={copy} className={className}>
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? copiedLabel : label}
    </button>
  )
}
