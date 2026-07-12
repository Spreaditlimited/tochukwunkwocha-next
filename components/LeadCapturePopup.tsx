"use client"

import { FormEvent, useEffect, useRef, useState } from "react"
import { Download, Mail, X } from "lucide-react"
import { usePathname } from "next/navigation"

import { getRecaptchaToken } from "@/lib/browser-recaptcha"

type LeadMagnetConfig = {
  blogSlug?: string
  blogTitle?: string
  leadMagnet?: {
    slug: string
    title?: string
    offerHeadline?: string
    description?: string
    buttonText?: string
    bullets?: string[]
    pdfUrl?: string
  }
}

const localKeys = {
  firstSeen: "tn_lead_first_seen_at",
  subscribed: "tn_lead_subscribed",
  dismissCount: "tn_lead_dismiss_count",
  lastDismissed: "tn_lead_last_dismissed_at",
  sessionDismissed: "tn_lead_dismissed_this_session"
}

const excludedPrefixes = [
  "/dashboard",
  "/internal",
  "/admin",
  "/schools/login",
  "/dashboard/login",
  "/invoice",
  "/checkout"
]

function storageGet(storage: Storage | undefined, key: string) {
  try {
    return storage?.getItem(key) || ""
  } catch (_error) {
    return ""
  }
}

function storageSet(storage: Storage | undefined, key: string, value: string) {
  try {
    storage?.setItem(key, value)
  } catch (_error) {}
}

function cookieValue(name: string) {
  const parts = `; ${document.cookie}`.split(`; ${name}=`)
  return parts.length === 2 ? parts.pop()?.split(";").shift() || "" : ""
}

function readConfig(): LeadMagnetConfig | null {
  const el = document.getElementById("tnBlogLeadMagnetConfig")
  if (!el) return null
  try {
    const parsed = JSON.parse(el.textContent || "{}")
    return parsed && typeof parsed === "object" ? parsed : null
  } catch (_error) {
    return null
  }
}

function pageType(pathname: string) {
  if (pathname.startsWith("/blog")) return "blog"
  return "site"
}

function normalizePdfUrl(value: string | undefined) {
  const raw = String(value || "").trim()
  if (!raw) return ""
  try {
    const parsed = new URL(raw, window.location.origin)
    if (parsed.pathname === "/.netlify/functions/blog-lead-magnet-download") {
      const slug = parsed.searchParams.get("slug") || ""
      const version = parsed.searchParams.get("v") || ""
      const params = new URLSearchParams()
      if (slug) params.set("slug", slug)
      if (version) params.set("v", version)
      return `/api/blog/lead-magnet/download?${params.toString()}`
    }
  } catch (_error) {}
  return raw
}

function eventId(prefix: string) {
  const randomPart = globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`
  return `tt_${prefix}_${randomPart}`
}

export function LeadCapturePopup() {
  const routePathname = usePathname()
  const [open, setOpen] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState("")
  const [successText, setSuccessText] = useState("You are subscribed. Watch your inbox for the next practical lesson.")
  
  const configRef = useRef<LeadMagnetConfig | null>(null)
  const triggeredRef = useRef(false)

  const leadMagnet = configRef.current?.leadMagnet

  function currentLeadMagnet() {
    return configRef.current?.leadMagnet || null
  }

  function magnetKeys() {
    const activeLeadMagnet = currentLeadMagnet()
    const suffix = activeLeadMagnet?.slug ? `_${activeLeadMagnet.slug}` : ""
    return {
      suffix,
      claimed: `tn_lead_magnet_claimed${suffix}`,
      claimedData: `tn_lead_magnet_claimed_data${suffix}`
    }
  }

  function closePopup() {
    const keys = magnetKeys()
    const currentDismissCount = Number(storageGet(window.localStorage, localKeys.dismissCount) || "0")
    storageSet(window.localStorage, localKeys.dismissCount, String(currentDismissCount + 1))
    storageSet(window.localStorage, localKeys.lastDismissed, new Date().toISOString())
    storageSet(window.sessionStorage, `${localKeys.sessionDismissed}${keys.suffix}`, "true")
    setOpen(false)
  }

  function attribution() {
    const pathname = window.location.pathname || "/"
    const params = new URLSearchParams(window.location.search || "")
    const config = configRef.current
    
    return {
      source: config?.leadMagnet ? "blog_lead_magnet" : "lead_capture_popup",
      pageType: pageType(pathname),
      pageUrl: window.location.href,
      pathname,
      blogSlug: config?.blogSlug || "",
      blogTitle: config?.blogTitle || "",
      leadMagnetSlug: config?.leadMagnet?.slug || "",
      referrer: document.referrer || "",
      utmSource: params.get("utm_source") || "",
      utmMedium: params.get("utm_medium") || "",
      utmCampaign: params.get("utm_campaign") || "",
      utmContent: params.get("utm_content") || "",
      utmTerm: params.get("utm_term") || "",
      fbclid: params.get("fbclid") || "",
      fbp: cookieValue("_fbp"),
      fbc: cookieValue("_fbc")
    }
  }

  function claimedMagnet() {
    const activeLeadMagnet = currentLeadMagnet()
    if (!activeLeadMagnet) return null
    const keys = magnetKeys()
    const subscribed = storageGet(window.localStorage, localKeys.subscribed) === "true"
    const claimed = storageGet(window.localStorage, keys.claimed) === "true"
    
    if (!subscribed && !claimed) return null
    
    try {
      const parsed = JSON.parse(storageGet(window.localStorage, keys.claimedData) || "{}")
      if (claimed && parsed?.pdfUrl) return { ...parsed, alreadyClaimed: true }
    } catch (_error) {}
    
    return activeLeadMagnet.pdfUrl 
      ? { slug: activeLeadMagnet.slug, title: activeLeadMagnet.title || "", pdfUrl: normalizePdfUrl(activeLeadMagnet.pdfUrl), alreadyClaimed: claimed } 
      : null
  }

  function rememberClaim(pdfUrl: string) {
    const activeLeadMagnet = currentLeadMagnet()
    if (!activeLeadMagnet || !pdfUrl) return
    const keys = magnetKeys()
    storageSet(window.localStorage, localKeys.subscribed, "true")
    storageSet(window.localStorage, keys.claimed, "true")
    storageSet(window.localStorage, keys.claimedData, JSON.stringify({
      slug: activeLeadMagnet.slug,
      title: activeLeadMagnet.title || "",
      pdfUrl,
      claimedAt: new Date().toISOString()
    }))
  }

  function openPopup(options?: { forceDownload?: boolean }) {
    recordLeadEvent("popup_open")
    const claimed = options?.forceDownload ? claimedMagnet() : null
    
    if (claimed?.pdfUrl) {
      rememberClaim(claimed.pdfUrl)
      setDownloadUrl(claimed.pdfUrl)
      setSuccessText(claimed.alreadyClaimed 
        ? "You already requested this PDF. Download it again below." 
        : "Your details are already saved. Download this PDF below."
      )
      setSuccess(true)
    } else {
      setSuccess(false)
      setDownloadUrl("")
      setSuccessText("You are subscribed. Watch your inbox for the next practical lesson.")
    }
    
    setError("")
    setOpen(true)
  }

  function recordLeadEvent(eventName: string) {
    const leadMagnet = configRef.current?.leadMagnet
    if (!leadMagnet?.slug) return
    const payload = { ...attribution(), eventName, leadMagnetSlug: leadMagnet.slug }
    fetch("/api/blog/lead-event", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => null)
  }

  useEffect(() => {
    const pathname = window.location.pathname || "/"
    if (excludedPrefixes.some((prefix) => pathname.startsWith(prefix))) return
    
    triggeredRef.current = false
    setOpen(false)
    setSuccess(false)
    setError("")
    setLoading(false)
    setDownloadUrl("")
    configRef.current = readConfig()
    const config = configRef.current
    const suffix = config?.leadMagnet?.slug ? `_${config.leadMagnet.slug}` : ""
    const hasLeadMagnet = Boolean(config?.leadMagnet?.slug)

    const autoSuppressed = (
      (!hasLeadMagnet && storageGet(window.localStorage, localKeys.subscribed) === "true") ||
      Boolean(hasLeadMagnet && storageGet(window.localStorage, `tn_lead_magnet_claimed${suffix}`) === "true") ||
      storageGet(window.sessionStorage, `${localKeys.sessionDismissed}${suffix}`) === "true"
    )
    if (!storageGet(window.localStorage, localKeys.firstSeen)) storageSet(window.localStorage, localKeys.firstSeen, new Date().toISOString())

    const openFromTrigger = () => {
      if (triggeredRef.current) return
      if (autoSuppressed) return
      triggeredRef.current = true
      openPopup()
    }

    const timeout = window.setTimeout(openFromTrigger, 7000)
    let scrollTimer = 0
    
    const onScroll = () => {
      if (triggeredRef.current || scrollTimer) return
      scrollTimer = window.setTimeout(() => {
        const scrollable = document.documentElement.scrollHeight - window.innerHeight
        if (scrollable > 0 && window.scrollY / scrollable >= 0.35) openFromTrigger()
        scrollTimer = 0
      }, 150)
    }
    window.addEventListener("scroll", onScroll, { passive: true })

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const trigger = target?.closest("[data-lead-magnet-open]") as HTMLElement | null
      if (!trigger) return
      const triggerSlug = String(trigger.getAttribute("data-lead-magnet-slug") || "").trim()
      if (config?.leadMagnet?.slug && triggerSlug && triggerSlug !== config.leadMagnet.slug) return
      
      event.preventDefault()
      recordLeadEvent("cta_click")
      storageSet(window.sessionStorage, `${localKeys.sessionDismissed}${magnetKeys().suffix}`, "")
      openPopup({ forceDownload: true })
    }
    document.addEventListener("click", onClick)

    const claimed = claimedMagnet()
    if (config?.leadMagnet && claimed?.alreadyClaimed) {
      document.querySelectorAll("[data-lead-magnet-open]").forEach((el) => {
        el.textContent = "Download PDF again"
      })
    }

    let observer: IntersectionObserver | null = null
    if (config?.leadMagnet && document.querySelector("[data-blog-lead-cta], [data-lead-magnet-open]")) {
      if ("IntersectionObserver" in window) {
        let viewed = false
        const activeObserver = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (viewed || !entry.isIntersecting) return
            viewed = true
            recordLeadEvent("cta_view")
            activeObserver.disconnect()
          })
        }, { threshold: 0.35 })
        observer = activeObserver
        document.querySelectorAll("[data-blog-lead-cta], [data-lead-magnet-open]").forEach((el) => activeObserver.observe(el))
      } else {
        globalThis.setTimeout(() => recordLeadEvent("cta_view"), 1200)
      }
    }

    return () => {
      window.clearTimeout(timeout)
      if (scrollTimer) window.clearTimeout(scrollTimer)
      window.removeEventListener("scroll", onScroll)
      document.removeEventListener("click", onClick)
      observer?.disconnect()
    }
  }, [routePathname])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const firstName = String(formData.get("firstName") || "").trim()
    const email = String(formData.get("email") || "").trim().toLowerCase()
    
    setError("")
    setLoading(true)
    
    try {
      const metaEventId = eventId("lead")
      const recaptchaToken = await getRecaptchaToken("marketing_lead_capture")
      const response = await fetch("/api/marketing/lead-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, email, ...attribution(), recaptchaToken, metaEventId })
      })
      const json = await response.json().catch(() => null)
      
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Unable to subscribe right now. Please try again.")
      
      storageSet(window.localStorage, localKeys.subscribed, "true")

      const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq
      if (typeof fbq === "function") {
        fbq("track", "Lead", {
          content_name: leadMagnet ? leadMagnet.title || "Blog Lead Magnet" : "Tochukwu Website Lead Capture Popup",
          content_category: pageType(window.location.pathname || "/")
        }, { eventID: metaEventId })
      }
      
      if (json.leadMagnet?.pdfUrl) {
        const pdfUrl = normalizePdfUrl(json.leadMagnet.pdfUrl)
        rememberClaim(pdfUrl)
        setDownloadUrl(pdfUrl)
        setSuccessText(json.leadMagnet.deliveryEmailSent 
          ? "The PDF has been emailed to you. You can also download it now." 
          : "You can download the PDF now. I will also send practical notes after this."
        )
      } else {
        window.setTimeout(closePopup, 2600)
      }
      
      setSuccess(true)
      form.reset()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to subscribe right now.")
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const headline = leadMagnet?.offerHeadline || leadMagnet?.title || "Practical AI and building lessons, minus the noise."
  const kicker = leadMagnet ? "Free PDF" : "Weekly practical notes"
  const bullets = Array.isArray(leadMagnet?.bullets) ? leadMagnet.bullets.slice(0, 4) : []
  const description = leadMagnet?.description || (pageType(typeof window !== "undefined" ? window.location.pathname : "/") === "blog"
    ? "Get practical AI and business-building insights sent directly to your inbox."
    : "Join practical builders getting clear AI lessons, tools, and updates from Tochukwu.")
  const buttonText = leadMagnet?.buttonText || (leadMagnet ? "Send me the PDF" : "Subscribe to Insights")

  return (
    <div className="fixed inset-x-4 bottom-4 z-[80] pointer-events-none animate-in slide-in-from-bottom-8 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[420px]">
      <section className="pointer-events-auto overflow-hidden rounded-2xl border border-white/10 bg-brand-ink/95 text-white shadow-2xl backdrop-blur-md">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-white/5 px-6 py-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-sky-400">{kicker}</p>
            <h2 className="mt-1.5 font-heading text-lg font-black leading-snug tracking-tight text-white sm:text-xl">
              {headline}
            </h2>
          </div>
          <button 
            className="shrink-0 rounded-full p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white" 
            type="button" 
            onClick={closePopup} 
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {success ? (
            <div className="flex flex-col gap-5 animate-in fade-in">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <p className="text-sm font-medium leading-relaxed text-emerald-100">{successText}</p>
              </div>
              {downloadUrl && (
                <a href={downloadUrl} target="_blank" rel="noreferrer" className="btn-inverse w-full justify-center shadow-lg shadow-white/10">
                  <Download className="mr-2 h-4 w-4" /> Download PDF Now
                </a>
              )}
            </div>
          ) : (
            <form className="flex flex-col gap-4 animate-in fade-in" onSubmit={submit}>
              <p className="text-sm font-medium leading-relaxed text-slate-300">
                {description}
              </p>
              {bullets.length > 0 && (
                <ul className="grid gap-2">
                  {bullets.map((item, index) => (
                    <li key={`${index}-${item}`} className="flex gap-2 text-xs font-medium leading-relaxed text-slate-300">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-300" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
              
              <div className="flex flex-col gap-3">
                <label className="sr-only" htmlFor="firstName">First name</label>
                <input 
                  id="firstName"
                  name="firstName" 
                  required 
                  placeholder="First name" 
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-medium text-white outline-none transition-colors placeholder:text-slate-500 focus:border-sky-500/50 focus:bg-black/60 focus:ring-1 focus:ring-sky-500/50" 
                />
                
                <label className="sr-only" htmlFor="email">Email address</label>
                <input 
                  id="email"
                  name="email" 
                  required 
                  type="email" 
                  placeholder="Email address" 
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-medium text-white outline-none transition-colors placeholder:text-slate-500 focus:border-sky-500/50 focus:bg-black/60 focus:ring-1 focus:ring-sky-500/50" 
                />
              </div>
              
              {error && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3">
                  <p className="text-xs font-bold text-rose-400">{error}</p>
                </div>
              )}
              
              <button 
                disabled={loading} 
                className="btn-inverse mt-2 w-full justify-center shadow-lg shadow-white/5 transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50" 
                type="submit"
              >
                <Mail className="mr-2 h-4 w-4" /> {loading ? "Processing..." : buttonText}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  )
}
