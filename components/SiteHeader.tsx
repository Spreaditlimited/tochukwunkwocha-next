"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { ArrowRight, ChevronDown, GraduationCap, Menu, School, ShieldCheck, User, X } from "lucide-react"

import { BrandMark } from "@/components/BrandMark"
import { ThemeToggle } from "@/components/ThemeToggle"
import { cn } from "@/lib/utils"

const mainNav = [
  { name: "Schools", href: "/courses/prompt-to-profit-schools" },
  { name: "Build", href: "/build" },
  { name: "Coaching", href: "/private-ai-build-coaching" },
  { name: "Student Projects", href: "/projects" },
  { name: "Resources", href: "/resources" },
  { name: "Blog", href: "/blog" }
]

const mobileNav = [
  { name: "About Us", href: "/about" },
  ...mainNav
]

const portalLinks = [
  { name: "Students", href: "/dashboard/login", icon: GraduationCap },
  { name: "Schools", href: "/schools/login", icon: School },
  { name: "Verify Certificate", href: "/certificates/verify", icon: ShieldCheck }
]

export function SiteHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }

    return () => {
      document.body.style.overflow = ""
    }
  }, [isMobileMenuOpen])

  return (
    <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="site-container flex h-20 items-center justify-between">
        <div className="flex items-center gap-8">
          <BrandMark
            context="public"
            variant="full"
            tone="auto"
            className="h-8 w-[136px] sm:h-9 sm:w-[154px] lg:h-10 lg:w-[170px]"
          />

          <nav className="hidden items-center gap-1 md:flex">
            {mainNav.map((link) => {
              const isActive = pathname.startsWith(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "brand-focus inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold no-underline transition-colors hover:bg-muted hover:text-foreground",
                    isActive ? "bg-muted/50 text-foreground" : "text-muted-foreground"
                  )}
                >
                  {link.name}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 md:flex">
            <ThemeToggle />
            <div className="group relative">
              <button
                className={cn(
                  "brand-focus inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold no-underline transition-colors hover:bg-muted hover:text-foreground",
                  pathname.startsWith("/dashboard") || pathname.startsWith("/schools")
                    ? "bg-muted/50 text-foreground"
                    : "text-muted-foreground"
                )}
                type="button"
                aria-haspopup="menu"
              >
                <User className="h-4 w-4" />
                Portals
                <ChevronDown className="h-4 w-4 transition-transform group-hover:rotate-180" />
              </button>
              <div className="invisible absolute right-0 top-full z-50 min-w-48 translate-y-2 rounded-lg border border-border bg-card p-2 opacity-0 shadow-xl shadow-black/10 transition-all group-hover:visible group-hover:translate-y-1 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-1 group-focus-within:opacity-100">
                {portalLinks.map(({ name, href, icon: Icon }) => {
                  const isActive = pathname.startsWith(href.replace("/login", ""))
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        "brand-focus flex items-center gap-3 rounded-md px-3 py-3 text-sm font-bold no-underline transition-colors",
                        isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                      )}
                      role="menuitem"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      {name}
                    </Link>
                  )
                })}
              </div>
            </div>
            <Link href="/courses" className="btn-primary py-2.5 shadow-sm">
              Explore Programmes
            </Link>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <button
              onClick={() => setIsMobileMenuOpen((current) => !current)}
              className="brand-focus inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:bg-muted"
              aria-label="Toggle menu"
              aria-expanded={isMobileMenuOpen}
              type="button"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {isMobileMenuOpen ? (
        <div className="absolute inset-x-0 top-20 z-50 h-[calc(100vh-80px)] overflow-y-auto border-t border-border bg-background p-5 md:hidden">
          <nav className="flex flex-col gap-2">
            {mobileNav.map((link) => {
              const isActive = pathname.startsWith(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "brand-focus flex items-center justify-between rounded-md px-4 py-4 text-base font-bold no-underline transition-colors",
                    isActive ? "bg-primary/10 text-primary" : "bg-card text-foreground hover:bg-muted"
                  )}
                >
                  {link.name}
                  <ArrowRight className="h-4 w-4 opacity-50" />
                </Link>
              )
            })}
          </nav>

          <div className="mt-8 flex flex-col gap-4 border-t border-border pt-8">
            <div className="grid gap-2">
              <p className="px-1 text-xs font-black uppercase tracking-widest text-muted-foreground">Portals</p>
              {portalLinks.map(({ name, href, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="brand-focus flex items-center justify-between rounded-md border border-border bg-card px-4 py-4 text-base font-bold text-foreground no-underline transition-colors hover:bg-muted"
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    {name}
                  </span>
                  <ArrowRight className="h-4 w-4 opacity-50" />
                </Link>
              ))}
            </div>
            <Link href="/courses" className="btn-primary flex justify-center py-4 text-base shadow-sm">
              Explore Programmes
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  )
}
