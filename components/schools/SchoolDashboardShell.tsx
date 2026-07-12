"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Award,
  BookOpen,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Home,
  LogOut,
  UsersRound
} from "lucide-react"

import { schoolLogoutAction } from "@/app/schools/dashboard/actions"
import { BrandMark } from "@/components/BrandMark"
import { ThemeToggle } from "@/components/ThemeToggle"
import type { SchoolAdminSession } from "@/lib/school-auth"
import { cn } from "@/lib/utils"

type SchoolDashboardShellProps = {
  session: SchoolAdminSession
  active: string
  title: string
  eyebrow?: string
  children: ReactNode
}

const navItems = [
  { href: "/schools/dashboard", label: "Overview", key: "overview", icon: Home },
  { href: "/schools/dashboard#students", label: "Students", key: "students", icon: UsersRound },
  { href: "/schools/dashboard#bulk-enroll", label: "Bulk Enroll", key: "bulk", icon: BookOpen },
  { href: "/schools/dashboard#advanced", label: "Advanced", key: "advanced", icon: Award },
  { href: "/schools/book-call", label: "Support Call", key: "support", icon: CalendarClock }
]

const SCHOOL_SIDEBAR_STORAGE_KEY = "tochukwu-school-sidebar-collapsed"

export function SchoolDashboardShell({
  session,
  active,
  title,
  eyebrow = "School Workspace",
  children
}: SchoolDashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setCollapsed(localStorage.getItem(SCHOOL_SIDEBAR_STORAGE_KEY) === "true")
  }, [])

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current
      localStorage.setItem(SCHOOL_SIDEBAR_STORAGE_KEY, String(next))
      return next
    })
  }

  return (
    <div data-school-dashboard-shell className="relative min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]" />
      <div className="pointer-events-none fixed left-0 top-0 h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px]" />

      <div className="relative flex min-h-screen">
        <aside className={cn("relative hidden shrink-0 flex-col border-r border-border bg-card/50 backdrop-blur-xl transition-[width] duration-200 lg:flex", collapsed ? "w-[5.5rem]" : "w-60")}>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="absolute right-0 top-20 z-20 inline-flex h-7 w-7 translate-x-1/2 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
            aria-label={collapsed ? "Expand side menu" : "Collapse side menu"}
            title={collapsed ? "Expand menu" : "Collapse menu"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>

          <div className={cn("flex h-20 items-center border-b border-border/50", collapsed ? "justify-center px-3" : "px-4")}>
            <BrandMark href="/schools/dashboard" context="school" showWordmark={!collapsed} className={collapsed ? "justify-center" : undefined} />
          </div>

          <nav className="flex-1 space-y-1 px-3 py-5">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = active === item.key
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center rounded-md py-2.5 text-sm font-semibold transition-all",
                    collapsed ? "justify-center px-2" : "gap-2.5 px-3",
                    isActive
                      ? "bg-primary/10 text-primary shadow-[inset_2px_0_0_0_hsl(var(--primary))]"
                      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground transition-colors group-hover:text-foreground")} />
                  {!collapsed ? item.label : null}
                </Link>
              )
            })}
          </nav>

          <div className="border-t border-border/50 p-3">
            <div className={cn("flex items-center rounded-md bg-muted/40 p-2.5", collapsed ? "justify-center" : "gap-2.5")}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 font-heading font-bold text-primary">
                {session.schoolName.charAt(0).toUpperCase()}
              </div>
              {!collapsed ? (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">{session.schoolName}</p>
                  <p className="truncate text-xs font-medium text-muted-foreground">{session.email}</p>
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-20 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
              <div className="min-w-0">
                <p className="eyebrow mb-1">{eyebrow}</p>
                <h1 className="truncate font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                  {title}
                </h1>
              </div>

              <div className="flex items-center gap-3">
                <ThemeToggle className="h-10 w-10 border-border bg-card shadow-sm hover:border-primary/30" />
                <form action={schoolLogoutAction}>
                  <button
                    className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card text-muted-foreground shadow-sm transition hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                    type="submit"
                    aria-label="Sign out"
                    title="Sign out"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </div>

            <nav className="flex gap-2 overflow-x-auto border-t border-border/50 bg-muted/20 px-4 py-3 scrollbar-hide sm:px-6 lg:hidden">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = active === item.key
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-bold whitespace-nowrap transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "border border-border bg-card text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </header>

          <main className="w-full px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
            <div className="mx-auto max-w-6xl">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
