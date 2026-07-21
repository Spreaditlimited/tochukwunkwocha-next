"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Cookie, SlidersHorizontal, X } from "lucide-react"

const STORAGE_KEY = "tochukwu_cookie_consent"
const STATIC_SITE_STORAGE_KEY = "tws_cookie_consent"
const COOKIE_NAME = "tochukwu_cookie_consent"

type ConsentChoice = "accepted" | "rejected"

function readStoredChoice() {
  if (typeof window === "undefined") return ""
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === "accepted" || stored === "rejected") return stored

    const staticSiteChoice = window.localStorage.getItem(STATIC_SITE_STORAGE_KEY)
    if (staticSiteChoice === "granted") return "accepted"
    if (staticSiteChoice === "denied") return "rejected"
  } catch (_error) {}
  const cookie = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${COOKIE_NAME}=`))
  const value = cookie ? decodeURIComponent(cookie.split("=").slice(1).join("=")) : ""
  return value === "accepted" || value === "rejected" ? value : ""
}

function saveChoice(choice: ConsentChoice) {
  try {
    window.localStorage.setItem(STORAGE_KEY, choice)
    window.localStorage.setItem(STATIC_SITE_STORAGE_KEY, choice === "accepted" ? "granted" : "denied")
  } catch (_error) {}
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(choice)}; Max-Age=${60 * 60 * 24 * 180}; Path=/; SameSite=Lax`
  window.dispatchEvent(new CustomEvent("tochukwu-cookie-consent", { detail: { choice } }))
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setVisible(!readStoredChoice())
  }, [])

  function choose(choice: ConsentChoice) {
    saveChoice(choice)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <section
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[70] px-4 pb-4 sm:px-6 sm:pb-6"
    >
      <div className="mx-auto max-w-5xl rounded-xl border border-border bg-card p-4 text-card-foreground shadow-2xl shadow-black/15 backdrop-blur sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Cookie className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-heading text-base font-black text-foreground">
                Cookie preferences
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                We use essential cookies to keep the website working. With your consent, we also use analytics and marketing cookies to understand what people find useful and improve our programmes.
              </p>
              {expanded ? (
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                  <div className="rounded-lg border border-border bg-background p-3">
                    <p className="font-bold text-foreground">Essential</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Required for login, forms, checkout, security, and site preferences.</p>
                  </div>
                  <div className="rounded-lg border border-border bg-background p-3">
                    <p className="font-bold text-foreground">Analytics</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Helps us understand page performance and content usefulness.</p>
                  </div>
                  <div className="rounded-lg border border-border bg-background p-3">
                    <p className="font-bold text-foreground">Marketing</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Helps measure campaigns and improve relevant programme offers.</p>
                  </div>
                </div>
              ) : null}
              <p className="mt-3 text-xs text-muted-foreground">
                Read our{" "}
                <Link href="/privacy-policy" className="font-bold text-primary no-underline hover:underline">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
          </div>

          <div className="grid shrink-0 gap-2 sm:grid-cols-3 lg:w-[27rem]">
            <button
              type="button"
              className="btn-primary justify-center px-4 py-3 text-sm"
              onClick={() => choose("accepted")}
            >
              Accept
            </button>
            <button
              type="button"
              className="btn-secondary justify-center px-4 py-3 text-sm"
              onClick={() => choose("rejected")}
            >
              Reject
            </button>
            <button
              type="button"
              className="btn-secondary justify-center px-4 py-3 text-sm"
              onClick={() => setExpanded((current) => !current)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Manage
            </button>
          </div>
        </div>
        <button
          type="button"
          className="brand-focus absolute right-5 top-5 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={() => choose("rejected")}
          aria-label="Close cookie preferences"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </section>
  )
}
