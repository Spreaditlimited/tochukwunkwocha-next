import { Play } from "lucide-react"

import type { PublicVideoSlot } from "@/lib/public-video-slots"

export function PublicVideoSlotPlayer({
  slot,
  emptyMessage,
  className = ""
}: {
  slot: PublicVideoSlot | null
  emptyMessage: string
  className?: string
}) {
  if (slot) {
    return (
      <div className={`overflow-hidden bg-brand-ink ${className}`}>
        <iframe
          src={slot.embedUrl}
          title={slot.headline || slot.slotLabel}
          className="h-full w-full"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }

  return (
    <div className={`relative flex items-center justify-center overflow-hidden border border-border bg-muted/40 p-6 text-center ${className}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-muted/50 to-transparent opacity-50" />
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
          <Play className="ml-1 h-6 w-6" />
        </div>
        <p className="max-w-[300px] text-sm font-medium text-foreground/80">{emptyMessage}</p>
      </div>
    </div>
  )
}
