"use client"

import { Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

type Theme = "light" | "dark"

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light")

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark")
    setTheme(isDark ? "dark" : "light")
  }, [])

  function toggleTheme() {
    const nextTheme = document.documentElement.classList.contains("dark") ? "light" : "dark"
    document.documentElement.classList.toggle("dark", nextTheme === "dark")
    document.documentElement.dataset.theme = nextTheme
    document.documentElement.style.colorScheme = nextTheme
    localStorage.setItem("tochukwu-theme", nextTheme)
    setTheme(nextTheme)
  }

  const Icon = theme === "dark" ? Sun : Moon

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "brand-focus inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card text-foreground transition hover:bg-muted",
        className
      )}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}
