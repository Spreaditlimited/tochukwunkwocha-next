"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react"

import { PremiumPicker } from "@/components/PremiumPicker"
import { getRecaptchaToken } from "@/lib/browser-recaptcha"

const purposeOptions = [
  { value: "course", label: "Course enquiry" },
  { value: "domain", label: "Domain enquiry" },
  { value: "school-or-team-training", label: "School or team training" },
  { value: "private-ai-build-coaching", label: "Private AI build coaching" },
  { value: "partnerships", label: "Partnerships" },
  { value: "other", label: "Other support" }
]

async function postContact(body: Record<string, unknown>) {
  const response = await fetch("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body)
  })
  const json = await response.json().catch(() => null)
  if (!response.ok || !json?.ok) throw new Error(json?.error || "Could not send message.")
  return json as { message?: string }
}

export function ContactForm() {
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus("")
    setError("")
    setIsSubmitting(true)
    const form = event.currentTarget
    const data = new FormData(form)
    try {
      const recaptchaToken = await getRecaptchaToken("contact_submit")
      const result = await postContact({
        website: data.get("website"),
        fullName: data.get("fullName"),
        email: data.get("email"),
        purpose: data.get("purpose"),
        message: data.get("message"),
        recaptchaToken
      })
      form.reset()
      setStatus(result.message || "Your message has been sent successfully.")
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not send message.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 grid gap-6">
      <input type="text" name="website" className="hidden" tabIndex={-1} aria-hidden="true" autoComplete="off" />

      <div className="grid gap-6 sm:grid-cols-2">
        <label className="block">
          <span className="label mb-2 block">Full name</span>
          <input className="field" name="fullName" placeholder="e.g. Jane Doe" required />
        </label>
        <label className="block">
          <span className="label mb-2 block">Email address</span>
          <input className="field" name="email" type="email" placeholder="you@example.com" required />
        </label>
      </div>

      <label className="block">
        <span className="label mb-2 block">How can we help you?</span>
        <PremiumPicker className="w-full" name="purpose" placeholder="Select a purpose" options={purposeOptions} />
      </label>

      <label className="block">
        <span className="label mb-2 block">Message</span>
        <textarea className="field min-h-[160px] resize-y" name="message" placeholder="Provide details about your enquiry here..." required />
      </label>

      {error ? (
        <div className="flex items-start gap-3 rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="font-medium leading-relaxed">{error}</p>
        </div>
      ) : null}
      {status ? (
        <div className="flex items-start gap-3 rounded-md border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="font-medium leading-relaxed">{status}</p>
        </div>
      ) : null}

      <div className="mt-2">
        <button className="btn-primary w-full py-4 text-base shadow-lg shadow-primary/20 sm:w-auto sm:px-10" type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
          {isSubmitting ? "Sending..." : "Send Message"}
        </button>

        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          By submitting this form, you agree to our{" "}
          <Link href="/privacy-policy" className="font-bold text-foreground underline decoration-primary/30 transition-colors hover:decoration-primary">
            privacy policy
          </Link>{" "}
          and consent to being contacted regarding your enquiry.
        </p>
      </div>
    </form>
  )
}
