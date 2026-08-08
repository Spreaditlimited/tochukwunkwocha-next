"use client"

import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

type DashboardModalSize = "sm" | "md" | "lg" | "xl"

type DashboardModalProps = {
  title: string
  eyebrow?: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
  closeDisabled?: boolean
  closeLabel?: string
  size?: DashboardModalSize
  fullHeight?: boolean
  bodyClassName?: string
  panelClassName?: string
}

const sizeClasses: Record<DashboardModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-5xl"
}

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']"
].join(",")

export function DashboardModal({
  title,
  eyebrow,
  description,
  children,
  footer,
  onClose,
  closeDisabled = false,
  closeLabel = "Close dialog",
  size = "md",
  fullHeight = false,
  bodyClassName,
  panelClassName
}: DashboardModalProps) {
  const [mounted, setMounted] = useState(false)
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLDivElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const closeDisabledRef = useRef(closeDisabled)
  const onCloseRef = useRef(onClose)

  closeDisabledRef.current = closeDisabled
  onCloseRef.current = onClose

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current
      if (!panel) return
      const preferred = panel.querySelector<HTMLElement>("[data-modal-autofocus]")
      const firstFocusable = panel.querySelector<HTMLElement>(focusableSelector)
      ;(preferred || firstFocusable || panel).focus({ preventScroll: true })
    }, 0)

    function onKeyDown(event: KeyboardEvent) {
      const panel = panelRef.current
      if (!panel) return

      if (event.key === "Escape") {
        if (!closeDisabledRef.current) {
          event.preventDefault()
          onCloseRef.current()
        }
        return
      }

      if (event.key !== "Tab") return
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((element) => element.getClientRects().length > 0)
      if (!focusable.length) {
        event.preventDefault()
        panel.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!panel.contains(document.activeElement)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocusRef.current?.focus({ preventScroll: true })
    }
  }, [mounted])

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !closeDisabled) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl shadow-black/20 outline-none",
          sizeClasses[size],
          fullHeight && "h-[calc(100dvh-2rem)]",
          panelClassName
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border p-5 sm:p-6">
          <div className="min-w-0">
            {eyebrow ? <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{eyebrow}</p> : null}
            <h2 id={titleId} className={cn("font-heading text-lg font-black text-foreground", eyebrow && "mt-1")}>{title}</h2>
            {description ? <div id={descriptionId} className="mt-2 text-sm leading-6 text-muted-foreground">{description}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            className="btn-secondary h-9 shrink-0 gap-2 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={closeLabel}
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">Close</span>
          </button>
        </div>

        <div className={cn("min-h-0 flex-1 overflow-y-auto p-5 sm:p-6", bodyClassName)}>{children}</div>

        {footer ? (
          <div className="shrink-0 border-t border-border bg-muted/10 p-5 sm:p-6">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body
  )
}
