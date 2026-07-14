"use client"

import { useEffect, useMemo, useState } from "react"
import { useFormStatus } from "react-dom"
import { CheckCircle2, FileText, ImageIcon, Loader2 } from "lucide-react"

type AutomationType = "image" | "leadMagnet"

const steps = {
  image: [
    "Preparing post context",
    "Generating image with OpenAI",
    "Uploading image to Cloudinary",
    "Saving image to blog post"
  ],
  leadMagnet: [
    "Reading article context",
    "Generating lead magnet copy",
    "Building PDF file",
    "Activating lead capture offer"
  ]
} satisfies Record<AutomationType, string[]>

export function BlogAutomationSubmitButton({ type }: { type: AutomationType }) {
  const { pending } = useFormStatus()
  const [elapsed, setElapsed] = useState(0)
  const Icon = type === "image" ? ImageIcon : FileText
  const labels = steps[type]
  const activeIndex = Math.min(labels.length - 1, Math.floor(elapsed / 7))
  const progress = pending ? Math.min(92, 18 + elapsed * 5) : 0
  const buttonText = type === "image" ? "Generate image" : "Generate lead magnet"

  const helperText = useMemo(() => {
    if (!pending) return type === "image"
      ? "This may take a minute because it uses OpenAI image generation and Cloudinary upload."
      : "This may take a minute because it generates copy, a PDF, and lead capture settings."
    return labels[activeIndex]
  }, [activeIndex, labels, pending, type])

  useEffect(() => {
    if (!pending) {
      setElapsed(0)
      return
    }
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [pending])

  return (
    <div className="space-y-3">
      <button className="btn-primary min-h-11 justify-center gap-2 disabled:pointer-events-none disabled:opacity-80" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
        {pending ? "Working..." : buttonText}
      </button>

      <div className={pending ? "block" : "hidden"}>
        <div className="h-2 overflow-hidden rounded-full bg-background ring-1 ring-border">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-3 grid gap-2">
          {labels.map((label, index) => (
            <div key={label} className={index <= activeIndex ? "flex items-center gap-2 text-xs font-bold text-foreground" : "flex items-center gap-2 text-xs font-semibold text-muted-foreground"}>
              {index < activeIndex ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              ) : index === activeIndex ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              ) : (
                <span className="h-3.5 w-3.5 rounded-full border border-border" />
              )}
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs font-medium text-muted-foreground">{helperText}</p>
    </div>
  )
}
