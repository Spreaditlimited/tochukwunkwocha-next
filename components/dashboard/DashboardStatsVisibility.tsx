"use client"

import { createContext, type ReactNode, useContext, useEffect, useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"

type VisibilityState = {
  defaultVisible: boolean
  overrides: Record<string, boolean>
}

type StatsVisibilityContextValue = {
  isVisible: (statKey: string) => boolean
  toggleStat: (statKey: string) => void
}

const StatsVisibilityContext = createContext<StatsVisibilityContextValue>({
  isVisible: () => true,
  toggleStat: () => undefined
})

type DashboardStatsVisibilityProps = {
  storageKey: string
  children: ReactNode
}

export function DashboardStatsVisibility({
  storageKey,
  children
}: DashboardStatsVisibilityProps) {
  const [visibility, setVisibility] = useState<VisibilityState | null>(null)

  useEffect(() => {
    function readVisibility(value: string | null): VisibilityState {
      if (!value) return { defaultVisible: true, overrides: {} }
      if (value === "hidden") return { defaultVisible: false, overrides: {} }
      if (value === "visible") return { defaultVisible: true, overrides: {} }
      try {
        const parsed = JSON.parse(value) as Partial<VisibilityState>
        return {
          defaultVisible: parsed.defaultVisible !== false,
          overrides: parsed.overrides && typeof parsed.overrides === "object" ? parsed.overrides : {}
        }
      } catch (_error) {
        return { defaultVisible: true, overrides: {} }
      }
    }

    setVisibility(readVisibility(window.localStorage.getItem(storageKey)))

    function syncVisibility(event: StorageEvent) {
      if (event.key === storageKey) setVisibility(readVisibility(event.newValue))
    }

    window.addEventListener("storage", syncVisibility)
    return () => window.removeEventListener("storage", syncVisibility)
  }, [storageKey])

  const statsAreVisible = visibility?.defaultVisible === true

  function saveVisibility(next: VisibilityState) {
    window.localStorage.setItem(storageKey, JSON.stringify(next))
    return next
  }

  function toggleVisibility() {
    setVisibility((current) => {
      const next = {
        defaultVisible: current?.defaultVisible !== true,
        overrides: {}
      }
      return saveVisibility(next)
    })
  }

  function statIsVisible(statKey: string) {
    if (!visibility) return false
    return visibility.overrides[statKey] ?? visibility.defaultVisible
  }

  function toggleStat(statKey: string) {
    setVisibility((current) => {
      const base = current || { defaultVisible: true, overrides: {} }
      const currentValue = base.overrides[statKey] ?? base.defaultVisible
      return saveVisibility({
        ...base,
        overrides: {
          ...base.overrides,
          [statKey]: !currentValue
        }
      })
    })
  }

  return (
    <StatsVisibilityContext.Provider value={{ isVisible: statIsVisible, toggleStat }}>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={toggleVisibility}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-bold text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          aria-label={statsAreVisible ? "Hide dashboard statistics" : "Reveal dashboard statistics"}
          aria-pressed={!statsAreVisible}
          title={statsAreVisible ? "Hide stats" : "Reveal stats"}
        >
          {statsAreVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          <span>{statsAreVisible ? "Hide stats" : "Reveal stats"}</span>
        </button>
      </div>
      {children}
    </StatsVisibilityContext.Provider>
  )
}

export function DashboardStatValue({
  statKey,
  children
}: {
  statKey: string
  children: ReactNode
}) {
  const { isVisible } = useContext(StatsVisibilityContext)
  const visible = isVisible(statKey)

  return (
    <span className={visible ? "" : "select-none tracking-widest"} aria-label={visible ? undefined : "Statistic hidden"}>
      {visible ? children : "••••"}
    </span>
  )
}

export function DashboardStatToggle({ statKey }: { statKey: string }) {
  const { isVisible, toggleStat } = useContext(StatsVisibilityContext)
  const visible = isVisible(statKey)

  return (
    <button
      type="button"
      onClick={() => toggleStat(statKey)}
      className="pointer-events-auto relative z-20 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background/90 text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      aria-label={visible ? "Hide this statistic" : "Reveal this statistic"}
      title={visible ? "Hide this stat" : "Reveal this stat"}
    >
      {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  )
}

export function DashboardStatCard({
  statKey,
  label,
  value,
  icon,
  description,
  className,
  iconClassName,
  valueClassName
}: {
  statKey: string
  label: ReactNode
  value: ReactNode
  icon?: ReactNode
  description?: ReactNode
  className?: string
  iconClassName?: string
  valueClassName?: string
}) {
  return (
    <article className={cn(
      "group relative flex min-h-36 flex-col justify-between rounded-xl border border-border bg-card p-6 pr-20 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg",
      className
    )}>
      <div className="flex items-start justify-between gap-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
        {icon ? (
          <span className={cn(
            "absolute right-5 top-5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-110",
            iconClassName
          )}>
            {icon}
          </span>
        ) : null}
      </div>
      <div className="mt-5">
        <p className={cn("font-heading text-3xl font-black text-foreground", valueClassName)}>
          <DashboardStatValue statKey={statKey}>{value}</DashboardStatValue>
        </p>
        {description ? <p className="mt-1.5 text-xs font-medium text-muted-foreground">{description}</p> : null}
      </div>
      <div className="absolute bottom-5 right-5 z-20">
        <DashboardStatToggle statKey={statKey} />
      </div>
    </article>
  )
}
