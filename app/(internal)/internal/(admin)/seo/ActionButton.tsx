"use client"
import { useFormStatus } from "react-dom"
import { Loader2 } from "lucide-react"
export function ActionButton({ label, pendingLabel = "Working", pendingMessage }: { label: string; pendingLabel?: string; pendingMessage?: string }) {
  const { pending } = useFormStatus()
  return <div className="min-w-[11rem] space-y-2" aria-live="polite">
    <button type="submit" disabled={pending} aria-busy={pending} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:cursor-wait disabled:opacity-70">
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}{pending ? pendingLabel : label}
    </button>
    {pending && pendingMessage ? <>
      <div className="overflow-hidden rounded-full bg-primary/10"><div className="h-1.5 w-1/2 animate-[seo-action-progress_1.2s_ease-in-out_infinite] rounded-full bg-primary" /></div>
      <p className="text-[10px] font-semibold leading-relaxed text-primary">{pendingMessage}</p>
      <style jsx>{`@keyframes seo-action-progress { 0% { transform: translateX(-100%); } 100% { transform: translateX(220%); } }`}</style>
    </> : null}
  </div>
}
