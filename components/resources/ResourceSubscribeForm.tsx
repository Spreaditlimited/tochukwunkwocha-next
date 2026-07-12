"use client"

import { useState, type FormEvent } from "react"
import { Loader2, Mail } from "lucide-react"

import { getRecaptchaToken } from "@/lib/browser-recaptcha"

function attribution() {
  if (typeof window === "undefined") return {}
  const url = new URL(window.location.href)
  return {
    source: "resource_subscribe",
    pageType: "resource",
    pageUrl: window.location.href,
    pathname: url.pathname,
    referrer: document.referrer || "",
    utmSource: url.searchParams.get("utm_source") || "",
    utmMedium: url.searchParams.get("utm_medium") || "",
    utmCampaign: url.searchParams.get("utm_campaign") || "",
    utmContent: url.searchParams.get("utm_content") || "",
    utmTerm: url.searchParams.get("utm_term") || "",
    fbclid: url.searchParams.get("fbclid") || ""
  }
}

export function ResourceSubscribeForm() {
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
      setMessage("You are subscribed. Watch your inbox for new practical AI resources.")
      setFirstName("")
      setEmail("")
    } catch (error) {
      setStatus("error")
      setMessage(error instanceof Error ? error.message : "Could not subscribe right now.")
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-muted/30 p-5">
      <div className="mb-4 flex items-center gap-3 text-primary">
        <Mail className="h-5 w-5" />
        <p className="eyebrow">Resource Updates</p>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Get practical AI guides, prompts, and learning resources when new materials are published.
      </p>
      <div className="mt-5 space-y-3">
        <input
          type="text"
          name="firstName"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          placeholder="First name"
          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          required
        />
        <input
          type="email"
          name="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email address"
          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          required
        />
        <button type="submit" className="btn-primary w-full justify-center" disabled={status === "submitting"}>
          {status === "submitting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          Subscribe
        </button>
      </div>
      {message ? (
        <p className={status === "error" ? "mt-3 text-sm font-bold text-destructive" : "mt-3 text-sm font-bold text-primary"}>
          {message}
        </p>
      ) : null}
    </form>
  )
}
