"use client"

import { useState, type FormEvent } from "react"
import { Loader2 } from "lucide-react"

import { getRecaptchaToken } from "@/lib/browser-recaptcha"

function cookieValue(name: string) {
  if (typeof document === "undefined") return ""
  const parts = `; ${document.cookie}`.split(`; ${name}=`)
  return parts.length === 2 ? parts.pop()?.split(";").shift() || "" : ""
}

function attribution() {
  if (typeof window === "undefined") return {}
  const url = new URL(window.location.href)
  return {
    source: "blog_newsletter",
    pageType: "blog",
    pageUrl: window.location.href,
    pathname: url.pathname,
    referrer: document.referrer || "",
    utmSource: url.searchParams.get("utm_source") || "",
    utmMedium: url.searchParams.get("utm_medium") || "",
    utmCampaign: url.searchParams.get("utm_campaign") || "",
    utmContent: url.searchParams.get("utm_content") || "",
    utmTerm: url.searchParams.get("utm_term") || "",
    fbclid: url.searchParams.get("fbclid") || "",
    fbp: cookieValue("_fbp"),
    fbc: cookieValue("_fbc")
  }
}

export function BlogNewsletterForm() {
  const [firstName, setFirstName] = useState("")
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle")
  const [message, setMessage] = useState("")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus("submitting")
    setMessage("")

    try {
      const recaptchaToken = await getRecaptchaToken("marketing_lead_capture")
      const response = await fetch("/api/marketing/lead-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          email,
          recaptchaToken,
          ...attribution()
        })
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Could not subscribe right now.")
      setStatus("success")
      setMessage("You are subscribed. Watch your inbox for the next practical lesson.")
      setFirstName("")
      setEmail("")
    } catch (error) {
      setStatus("error")
      setMessage(error instanceof Error ? error.message : "Could not subscribe right now.")
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 grid gap-3">
      <input
        type="text"
        name="firstName"
        value={firstName}
        onChange={(event) => setFirstName(event.target.value)}
        placeholder="First name"
        className="w-full rounded-md border border-white/20 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
        required
      />
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          name="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Enter your email address"
          className="w-full rounded-md border border-white/20 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
          required
        />
        <button type="submit" className="btn-inverse shrink-0 px-6 py-3 text-sm" disabled={status === "submitting"}>
          {status === "submitting" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Subscribe
        </button>
      </div>
      {message ? (
        <p className={status === "error" ? "text-sm font-semibold text-rose-300" : "text-sm font-semibold text-emerald-300"}>
          {message}
        </p>
      ) : null}
    </form>
  )
}
