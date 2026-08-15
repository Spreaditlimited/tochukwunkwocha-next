"use client"

import { Loader2, Sparkles } from "lucide-react"
import { useFormStatus } from "react-dom"

export function GenerateDraftButton() {
  const { pending } = useFormStatus()
  return (
    <div className="w-full min-w-[11rem] space-y-2" aria-live="polite">
      <button type="submit" disabled={pending} aria-busy={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-wait disabled:opacity-80">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {pending ? "Generating Draft" : "Generate Draft"}
      </button>
      {pending ? <>
        <div className="overflow-hidden rounded-full bg-primary/10">
          <div className="h-1.5 w-1/2 animate-[seo-draft-progress_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
        </div>
        <p className="text-center text-[10px] font-semibold leading-relaxed text-primary">Analysing the article and saving a reviewable SEO proposal…</p>
        <style jsx>{`@keyframes seo-draft-progress { 0% { transform: translateX(-100%); } 100% { transform: translateX(220%); } }`}</style>
      </> : <p className="text-center text-[9px] leading-relaxed text-muted-foreground">Creates a reviewable proposal. Nothing is published.</p>}
    </div>
  )
}
