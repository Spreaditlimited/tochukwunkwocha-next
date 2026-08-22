"use client"

import { ArrowUp } from "lucide-react"
import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

const REVEAL_AFTER_PX = 560

export function BackToTopButton() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let frame = 0

    const updateVisibility = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setVisible(window.scrollY > REVEAL_AFTER_PX))
    }

    updateVisibility()
    window.addEventListener("scroll", updateVisibility, { passive: true })

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", updateVisibility)
    }
  }, [])

  const returnToTop = () => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" })
  }

  return (
    <button
      type="button"
      onClick={returnToTop}
      aria-label="Return to top"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      title="Return to top"
      className={cn(
        "brand-focus fixed bottom-6 right-5 z-[70] inline-flex h-12 w-12 items-center justify-center rounded-full border border-primary bg-primary text-primary-foreground shadow-[0_12px_32px_rgba(13,79,154,0.28)] transition duration-200 hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-[0_14px_36px_rgba(6,22,45,0.28)] sm:bottom-7 sm:right-7",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      )}
    >
      <ArrowUp className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
    </button>
  )
}
