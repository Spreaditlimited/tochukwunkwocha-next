"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"

import { getRecaptchaToken } from "@/lib/browser-recaptcha"

function cookieValue(name: string) {
  if (typeof document === "undefined") return ""
  const parts = `; ${document.cookie}`.split(`; ${name}=`)
  return parts.length === 2 ? parts.pop()?.split(";").shift() || "" : ""
}

export function ResourceLeadForm({
  resourceUuid
}: {
  resourceUuid: string
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [message, setMessage] = useState("")
  const [downloadUrl, setDownloadUrl] = useState("")

  async function submit(formData: FormData) {
    setStatus("loading")
    setMessage("")
    const recaptchaToken = await getRecaptchaToken("resource_gate")
    const url = new URL(window.location.href)
    const response = await fetch("/api/resources/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resourceUuid,
        firstName: String(formData.get("firstName") || ""),
        email: String(formData.get("email") || ""),
        pageUrl: window.location.href,
        pathname: window.location.pathname,
        fbclid: url.searchParams.get("fbclid") || "",
        fbp: cookieValue("_fbp"),
        fbc: cookieValue("_fbc"),
        recaptchaToken
      })
    })
    const result = await response.json().catch(() => null)
    if (!response.ok || !result?.ok) {
      setStatus("error")
      setMessage(result?.error || "Could not unlock this resource right now.")
      return
    }
    setStatus("ready")
    setDownloadUrl(String(result.downloadUrl || ""))
    setMessage("Unlocked. Your download is ready.")
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-widest text-primary">Free Download</p>
      <h2 className="mt-2 font-heading text-xl font-black text-foreground">Unlock this resource</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Enter your details to access the download and receive practical AI learning updates.
      </p>
      <form action={submit} className="mt-5 space-y-3">
        <input name="firstName" className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary" placeholder="First name" />
        <input name="email" type="email" required className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary" placeholder="Email address" />
        <button className="btn-primary w-full justify-center" type="submit" disabled={status === "loading"}>
          {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Unlock Resource
        </button>
      </form>
      {message ? (
        <p className={status === "error" ? "mt-3 text-sm font-bold text-destructive" : "mt-3 text-sm font-bold text-primary"}>
          {message}
        </p>
      ) : null}
      {status === "ready" && downloadUrl ? (
        <a href={downloadUrl} className="btn-secondary mt-4 w-full justify-center" target="_blank" rel="noreferrer">
          <Download className="h-4 w-4" />
          Download Now
        </a>
      ) : null}
    </div>
  )
}
