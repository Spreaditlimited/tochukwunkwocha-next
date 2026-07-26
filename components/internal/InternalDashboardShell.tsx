"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import {
  BookOpenCheck,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileText,
  Globe,
  GraduationCap,
  Hammer,
  HandCoins,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Megaphone,
  MonitorPlay,
  Percent,
  School,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  MessageCircle,
  UserRound,
  WalletCards
} from "lucide-react"

import { logoutAction } from "@/app/(internal)/internal/actions"
import { BrandMark } from "@/components/BrandMark"
import { ThemeToggle } from "@/components/ThemeToggle"
import { InternalActionToaster } from "@/components/internal/InternalActionToaster"
import type { AdminSession } from "@/lib/auth"
import { canAccessDashboardPath } from "@/lib/admin-permissions"
import { cn } from "@/lib/utils"

const navSections = [
  {
    label: "Command",
    items: [
      { href: "/internal", label: "Overview", icon: LayoutDashboard },
      { href: "/internal/marketing", label: "Marketing", icon: Megaphone },
      { href: "/internal/whatsapp", label: "WhatsApp", icon: MessageCircle },
      { href: "/internal/seo", label: "SEO Queue", icon: Search },
      { href: "/internal/blog", label: "Blog CMS", icon: FileText },
      { href: "/internal/resources", label: "Resources", icon: BookOpenCheck }
    ]
  },
  {
    label: "Revenue",
    items: [
      { href: "/internal/manual-payments", label: "Enrollments", icon: CreditCard },
      { href: "/internal/installments", label: "Installments", icon: WalletCards },
      { href: "/internal/coupons", label: "Coupons", icon: Percent },
      { href: "/internal/affiliates", label: "Affiliates", icon: HandCoins }
    ]
  },
  {
    label: "Learning",
    items: [
      { href: "/internal/video-library", label: "Video Library", icon: MonitorPlay },
      { href: "/internal/learning", label: "Learning Support", icon: GraduationCap },
      { href: "/internal/learning-progress", label: "Learning Progress", icon: ListChecks },
      { href: "/internal/security", label: "Security", icon: Smartphone }
    ]
  },
  {
    label: "Services",
    items: [
      { href: "/internal/schools", label: "Schools", icon: School },
      { href: "/internal/school-scorecards", label: "School Scorecards", icon: ClipboardList },
      { href: "/internal/school-calls", label: "School Calls", icon: CalendarClock },
      { href: "/internal/build-scorecards", label: "Build Scorecards", icon: ClipboardList },
      { href: "/internal/build-calls", label: "Build Calls", icon: Hammer },
      { href: "/internal/private-coaching", label: "Private Coaching", icon: UserRound },
      { href: "/internal/domains", label: "Domains", icon: Globe }
    ]
  },
  {
    label: "System",
    items: [
      { href: "/internal/settings", label: "Settings", icon: Settings },
      { href: "/internal/admin-accounts", label: "Admin Accounts", icon: ShieldCheck }
    ]
  }
]

const STORAGE_KEY = "tochukwu-internal-sidebar-collapsed"

export function InternalDashboardShell({
  session,
  initials,
  children
}: {
  session: AdminSession
  initials: string
  children: ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false)
  const allowedNavSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canAccessDashboardPath(session, item.href))
    }))
    .filter((section) => section.items.length > 0)

  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "true")
  }, [])

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current
      localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }

  return (
    <div data-internal-dashboard-shell className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.08),transparent_34rem),linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.3))] text-foreground selection:bg-primary/30">
      <InternalActionToaster />
      <div className={cn("grid min-h-screen transition-[grid-template-columns] duration-200 lg:h-screen lg:overflow-hidden", collapsed ? "lg:grid-cols-[88px_1fr]" : "lg:grid-cols-[260px_1fr]")}>
        <aside className="relative hidden flex-col border-r border-border bg-card/80 shadow-sm backdrop-blur-xl lg:sticky lg:top-0 lg:flex lg:h-screen">
          <button
            type="button"
            onClick={toggleCollapsed}
            className="absolute right-0 top-20 z-20 inline-flex h-7 w-7 translate-x-1/2 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
            aria-label={collapsed ? "Expand side menu" : "Collapse side menu"}
            title={collapsed ? "Expand menu" : "Collapse menu"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>

          <div className={cn("flex shrink-0 items-center gap-3 border-b border-border py-5", collapsed ? "justify-center px-3" : "px-4")}>
            {collapsed ? (
              <BrandMark href="/internal" context="internal" showWordmark={false} className="justify-center" />
            ) : (
              <BrandMark href="/internal" context="internal" variant="full" tone="auto" className="h-9 w-44" />
            )}
          </div>

          <nav className={cn("flex-1 overflow-y-auto py-5 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20", collapsed ? "space-y-5 px-3" : "space-y-7 px-3")}>
            {allowedNavSections.map((section) => (
              <div key={section.label}>
                {collapsed ? (
                  <div className="mx-auto mb-2 h-px w-8 bg-border" title={section.label} />
                ) : (
                  <p className="mb-3 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                    {section.label}
                  </p>
                )}
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "group flex items-center rounded-xl text-sm font-bold text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary",
                          collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"
                        )}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-all group-hover:scale-105 group-hover:bg-primary/10 group-hover:text-primary">
                          <Icon className="h-4 w-4" />
                        </span>
                        {!collapsed ? <span className="min-w-0 truncate">{item.label}</span> : null}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className={cn("shrink-0 border-t border-border", collapsed ? "p-3" : "p-4")}>
            <div className={cn("mb-4 flex items-center rounded-2xl bg-muted/50 transition-colors hover:bg-muted/80", collapsed ? "justify-center p-2" : "gap-3 p-3")}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 font-heading text-sm font-black text-primary shadow-inner">
                {initials}
              </div>
              {!collapsed ? (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-foreground">{session.fullName}</p>
                  <p className="truncate text-[11px] font-semibold tracking-wide text-muted-foreground">{session.email}</p>
                </div>
              ) : null}
            </div>
            <form action={logoutAction}>
              <button
                className={cn(
                  "group flex w-full items-center justify-center rounded-xl border border-border bg-background text-sm font-black text-muted-foreground shadow-sm transition-all hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive",
                  collapsed ? "h-10 px-0" : "gap-2 px-3 py-3"
                )}
                type="submit"
                title="Secure Sign out"
              >
                <LogOut className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                {!collapsed ? "Secure Sign out" : null}
              </button>
            </form>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col lg:h-screen lg:overflow-y-auto">
          <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
            <div className="flex min-h-[4.5rem] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Internal Console</p>
                <h1 className="mt-0.5 truncate font-heading text-xl font-black tracking-tight text-foreground sm:text-2xl">
                  Operations Workspace
                </h1>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <ThemeToggle />
                <Link
                  href="/"
                  className="hidden rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold text-muted-foreground shadow-sm transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary sm:inline-flex"
                >
                  View Site
                </Link>
                <form action={logoutAction} className="lg:hidden">
                  <button
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-sm transition hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                    type="submit"
                    aria-label="Sign out"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </div>

            <div className="border-t border-border px-4 py-3 sm:px-6 lg:hidden">
              <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {allowedNavSections.flatMap((section) => section.items).map((item) => {
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-bold text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1500px] flex-1 p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
