"use client"

import { usePathname } from "next/navigation"
import { useCallback, useEffect, useRef } from "react"

const STATIC_SITE_MEASUREMENT_ID = "G-K09N39FSXZ"
const CURRENT_CONSENT_KEY = "tochukwu_cookie_consent"
const STATIC_SITE_CONSENT_KEY = "tws_cookie_consent"
const SCRIPT_ID = "google-analytics-gtag"

const COURSE_NAMES: Record<string, string> = {
  "prompt-to-profit": "Prompt to Profit",
  "prompt-to-production": "Prompt to Profit Advanced",
  "prompt-to-profit-holiday": "Prompt to Profit Holiday"
}

type Gtag = (...args: unknown[]) => void

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: Gtag
  }
}

function measurementId() {
  return String(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || STATIC_SITE_MEASUREMENT_ID).trim()
}

function consentGranted() {
  try {
    const currentChoice = window.localStorage.getItem(CURRENT_CONSENT_KEY)
    if (currentChoice === "accepted") return true
    if (currentChoice === "rejected") return false

    const staticSiteChoice = window.localStorage.getItem(STATIC_SITE_CONSENT_KEY)
    if (staticSiteChoice === "granted") return true
    if (staticSiteChoice === "denied") return false
  } catch (_error) {
    // Fall through to the consent cookie used by the Next site.
  }

  const cookieChoice = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${CURRENT_CONSENT_KEY}=`))
    ?.split("=")
    .slice(1)
    .join("=")
  try {
    return decodeURIComponent(cookieChoice || "") === "accepted"
  } catch (_error) {
    return false
  }
}

function pageViewTrackingAllowed(pathname: string) {
  return ![
    "/internal",
    "/dashboard",
    "/schools/dashboard",
    "/schools/login",
    "/schools/reset-password",
    "/schools/certificate",
    "/build-scorecard"
  ].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

function initializeGoogleAnalytics(id: string, sendPageView: boolean) {
  if (!id || window.gtag) return false

  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args)
  }
  window.gtag("js", new Date())
  if (sendPageView) window.gtag("config", id)
  else window.gtag("config", id, { send_page_view: false })

  if (!document.getElementById(SCRIPT_ID)) {
    const script = document.createElement("script")
    script.id = SCRIPT_ID
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`
    const firstScript = document.getElementsByTagName("script")[0]
    if (firstScript?.parentNode) firstScript.parentNode.insertBefore(script, firstScript)
    else document.head.appendChild(script)
  }

  return true
}

function currentPageLocation() {
  return `${window.location.pathname}${window.location.search}`
}

async function trackCurrentPagePurchase() {
  const search = new URLSearchParams(window.location.search)
  if (search.get("payment") !== "success") return

  const orderUuid = String(search.get("order") || search.get("order_uuid") || "").trim()
  if (!orderUuid || typeof window.gtag !== "function") return

  const storageKey = `ga_purchase_sent_${orderUuid}`
  try {
    if (window.localStorage.getItem(storageKey) === "1") return
  } catch (_error) {}

  const response = await fetch(`/api/analytics/order-summary?order_uuid=${encodeURIComponent(orderUuid)}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store"
  })
  if (!response.ok) return

  const json = await response.json().catch(() => null)
  const order = json?.order
  if (!json?.ok || !order || !Number.isFinite(Number(order.value)) || !order.currency) return

  const courseSlug = String(order.course_slug || "prompt-to-profit")
  window.gtag("event", "purchase", {
    transaction_id: orderUuid,
    value: Number(order.value),
    currency: String(order.currency).toUpperCase(),
    items: [
      {
        item_id: courseSlug,
        item_name: COURSE_NAMES[courseSlug] || "Course"
      }
    ]
  })

  try {
    window.localStorage.setItem(storageKey, "1")
  } catch (_error) {}
}

export function GoogleAnalytics() {
  const pathname = usePathname()
  const lastTrackedPage = useRef("")
  const purchaseAttempt = useRef("")
  const id = measurementId()

  const activate = useCallback(() => {
    if (!id || !consentGranted()) return

    const search = new URLSearchParams(window.location.search)
    const orderUuid = String(search.get("order") || search.get("order_uuid") || "").trim()
    const isPaidOrderReturn = search.get("payment") === "success" && Boolean(orderUuid)
    const trackPageView = pageViewTrackingAllowed(window.location.pathname)
    if (!trackPageView && !isPaidOrderReturn) return

    const initialized = initializeGoogleAnalytics(id, trackPageView)
    const location = currentPageLocation()

    if (trackPageView && !lastTrackedPage.current) {
      // The initial gtag config call sends the first page_view, matching the static site.
      if (!initialized && typeof window.gtag === "function") {
        window.gtag("event", "page_view", {
          page_path: location,
          page_location: window.location.href,
          page_title: document.title
        })
      }
      lastTrackedPage.current = location
    } else if (trackPageView && !initialized && lastTrackedPage.current !== location && typeof window.gtag === "function") {
      window.gtag("event", "page_view", {
        page_path: location,
        page_location: window.location.href,
        page_title: document.title
      })
      lastTrackedPage.current = location
    }

    if (isPaidOrderReturn && purchaseAttempt.current !== orderUuid) {
      purchaseAttempt.current = orderUuid
      void trackCurrentPagePurchase().catch(() => undefined)
    }
  }, [id])

  useEffect(() => {
    activate()
  }, [activate, pathname])

  useEffect(() => {
    function handleConsent(event: Event) {
      const choice = (event as CustomEvent<{ choice?: string }>).detail?.choice
      if (choice === "accepted" || choice === "granted") activate()
    }

    window.addEventListener("tochukwu-cookie-consent", handleConsent)
    return () => window.removeEventListener("tochukwu-cookie-consent", handleConsent)
  }, [activate])

  return null
}
