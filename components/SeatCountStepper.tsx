"use client"

import { Minus, Plus } from "lucide-react"

import { cn } from "@/lib/utils"

export function SeatCountStepper({
  value,
  onChange,
  min = 1,
  max = 500,
  className
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  className?: string
}) {
  const clamp = (nextValue: number) => Math.max(min, Math.min(max, Math.round(Number(nextValue) || min)))
  const currentValue = clamp(value)

  return (
    <div className={cn("mt-2 flex h-12 min-w-0 max-w-full items-stretch overflow-hidden rounded-md border border-input bg-card shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20", className)}>
      <button
        type="button"
        onClick={() => onChange(clamp(currentValue - 1))}
        disabled={currentValue <= min}
        className="flex w-11 shrink-0 touch-manipulation items-center justify-center border-r border-input text-foreground transition hover:bg-muted active:bg-muted disabled:cursor-not-allowed disabled:opacity-40 sm:w-14"
        aria-label="Decrease number of seats"
      >
        <Minus className="h-5 w-5" aria-hidden="true" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={currentValue}
        onChange={(event) => onChange(clamp(Number(event.target.value.replace(/\D/g, ""))))}
        className="w-0 min-w-0 flex-1 bg-transparent px-2 text-center text-base font-bold text-foreground outline-none sm:px-3"
        aria-label="Number of seats"
      />
      <button
        type="button"
        onClick={() => onChange(clamp(currentValue + 1))}
        disabled={currentValue >= max}
        className="flex w-11 shrink-0 touch-manipulation items-center justify-center border-l border-input text-foreground transition hover:bg-muted active:bg-muted disabled:cursor-not-allowed disabled:opacity-40 sm:w-14"
        aria-label="Increase number of seats"
      >
        <Plus className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  )
}
