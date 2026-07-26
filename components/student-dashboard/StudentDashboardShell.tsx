"use client"

import type { ReactNode } from "react"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  Award,
  AlertTriangle,
  Banknote,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  Globe,
  Link2,
  Home,
  LockKeyhole,
  LogOut,
  Network,
  UserRound,
  WalletCards,
  UsersRound
} from "lucide-react"

import { BrandMark } from "@/components/BrandMark"
import { ThemeToggle } from "@/components/ThemeToggle"
import { studentLogoutAction } from "@/app/(student)/dashboard/actions"
import { StudentActionToaster } from "@/components/student-dashboard/StudentActionToaster"
import { StudentSidebarAvatar } from "@/components/student-dashboard/StudentSidebarAvatar"
import type { StudentSessionAccount } from "@/lib/student-auth"
import { cn } from "@/lib/utils"

type StudentDashboardShellProps = {
  account: StudentSessionAccount
  active: string
  title: string
  eyebrow?: string
  children: ReactNode
}

const navItems = [
  { href: "/dashboard", label: "Overview", key: "overview", icon: Home },
  { href: "/dashboard/courses", label: "Courses", key: "courses", icon: BookOpen },
  { href: "/dashboard/installments", label: "Installments", key: "installments", icon: WalletCards },
  { href: "/dashboard/family", label: "Group Enrollment", key: "family", icon: UsersRound },
  { href: "/dashboard/domains", label: "Domains", key: "domains", icon: Globe },
  { href: "/dashboard/certificate", label: "Certificates", key: "certificate", icon: Award },
  { href: "/dashboard/affiliate", label: "Affiliate", key: "affiliate", icon: Network },
  { href: "/dashboard/profile", label: "Profile", key: "profile", icon: UserRound }
]

const STUDENT_SIDEBAR_STORAGE_KEY = "tochukwu-student-sidebar-collapsed"

const emptyStateIcons = {
  alert: AlertTriangle,
  award: Award,
  banknote: Banknote,
  book: BookOpen,
  creditCard: CreditCard,
  file: FileText,
  globe: Globe,
  link: Link2,
  lock: LockKeyhole,
  network: Network,
  user: UserRound,
  users: UsersRound
}

export type EmptyStudentStateIcon = keyof typeof emptyStateIcons

export function StudentDashboardShell({
  account,
  active,
  title,
  eyebrow = "Student Workspace",
  children
}: StudentDashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileAccountMenuOpen, setMobileAccountMenuOpen] = useState(false)
  const mobileAccountMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setCollapsed(localStorage.getItem(STUDENT_SIDEBAR_STORAGE_KEY) === "true")
  }, [])

  useEffect(() => {
    if (!mobileAccountMenuOpen) return

    function closeOnOutsideClick(event: MouseEvent) {
      if (!mobileAccountMenuRef.current?.contains(event.target as Node)) {
        setMobileAccountMenuOpen(false)
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileAccountMenuOpen(false)
    }

    document.addEventListener("mousedown", closeOnOutsideClick)
    document.addEventListener("keydown", closeOnEscape)
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick)
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [mobileAccountMenuOpen])

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current
      localStorage.setItem(STUDENT_SIDEBAR_STORAGE_KEY, String(next))
      return next
    })
  }

  return (
    <div data-student-dashboard-shell className="relative min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      <StudentActionToaster />
      {/* Subtle Workspace Grid Background */}
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]" />
      <div className="pointer-events-none fixed left-0 top-0 h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px]" />

      <div className="relative flex min-h-screen lg:h-screen lg:overflow-hidden">
        {/* Sidebar Navigation */}
        <aside className={cn("relative hidden h-screen shrink-0 flex-col border-r border-border bg-card/50 backdrop-blur-xl transition-[width] duration-200 lg:flex", collapsed ? "w-[5.5rem]" : "w-60")}>
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
            {collapsed ? (
              <BrandMark
                href="/dashboard"
                context="student"
                showWordmark={false}
                className="justify-center"
              />
            ) : (
              <BrandMark
                href="/dashboard"
                context="student"
                showWordmark={true}
              />
            )}
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

          {/* Sidebar Footer User Profile */}
          <div className="border-t border-border/50 p-3">
            <div className={cn("flex items-center rounded-md bg-muted/40 p-2.5", collapsed ? "justify-center" : "gap-2.5")}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-heading font-bold text-primary">
                <StudentSidebarAvatar fullName={account.fullName} initialUrl={account.profilePictureUrl} />
              </div>
              {!collapsed ? (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">{account.fullName}</p>
                  <p className="truncate text-xs font-medium text-muted-foreground">{account.email}</p>
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex min-w-0 flex-1 flex-col lg:h-screen lg:overflow-y-auto">
          {/* Header */}
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
                <div ref={mobileAccountMenuRef} className="relative lg:hidden">
                  <button
                    type="button"
                    onClick={() => setMobileAccountMenuOpen((current) => !current)}
                    className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border bg-card shadow-sm transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    aria-label="Open account menu"
                    aria-haspopup="menu"
                    aria-expanded={mobileAccountMenuOpen}
                  >
                    <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-heading font-bold text-primary">
                      <StudentSidebarAvatar fullName={account.fullName} initialUrl={account.profilePictureUrl} />
                    </span>
                  </button>

                  {mobileAccountMenuOpen ? (
                    <div
                      role="menu"
                      className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-lg border border-border bg-card p-1.5 shadow-xl"
                    >
                      <div className="border-b border-border px-3 py-2.5">
                        <p className="truncate text-sm font-bold text-foreground">{account.fullName}</p>
                        <p className="truncate text-xs text-muted-foreground">{account.email}</p>
                      </div>
                      <Link
                        href="/dashboard/profile"
                        role="menuitem"
                        onClick={() => setMobileAccountMenuOpen(false)}
                        className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted"
                      >
                        <UserRound className="h-4 w-4 text-muted-foreground" />
                        Profile
                      </Link>
                      <form action={studentLogoutAction}>
                        <button
                          type="submit"
                          role="menuitem"
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm font-semibold text-destructive transition hover:bg-destructive/10"
                        >
                          <LogOut className="h-4 w-4" />
                          Sign out
                        </button>
                      </form>
                    </div>
                  ) : null}
                </div>
                <form action={studentLogoutAction} className="hidden lg:block">
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

            {/* Mobile Navigation Row */}
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
                        : "bg-card border border-border text-muted-foreground hover:bg-muted"
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

export function StudentDashboardCard({
  children,
  className
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("surface-raised bg-card p-6 sm:p-8", className)}>
      {children}
    </section>
  )
}

export function EmptyStudentState({
  icon = "file",
  title,
  description,
  action
}: {
  icon?: EmptyStudentStateIcon
  title: string
  description: string
  action?: ReactNode
}) {
  const Icon = emptyStateIcons[icon] || FileText
  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-card/30 p-10 text-center sm:p-14">
      {/* Subtle center glow for empty state */}
      <div className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[50px] pointer-events-none" />
      
      <div className="relative z-10 mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
        <Icon className="h-7 w-7 text-muted-foreground/60" />
      </div>
      
      <h2 className="relative z-10 font-heading text-xl font-bold text-foreground">
        {title}
      </h2>
      <p className="relative z-10 mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      
      {action ? (
        <div className="relative z-10 mt-8">
          {action}
        </div>
      ) : null}
    </div>
  )
}
