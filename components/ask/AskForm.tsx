"use client"

import { useId, useRef, useState, type FormEvent } from "react"
import { ArrowUpRight, Loader2, Send } from "lucide-react"
import Link from "next/link"
import { getRecaptchaToken } from "@/lib/browser-recaptcha"
import { RecaptchaDisclosure } from "@/components/RecaptchaDisclosure"
import { ASK_MAX_LENGTH } from "@/lib/ask-validation"

export function AskForm({ questionId, compact = false }: { questionId?: string; compact?: boolean }) {
  const id = useId()
  const busyRef = useRef(false)
  const [body, setBody] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busyRef.current) return
    busyRef.current = true
    setPending(true)
    setError("")
    setMessage("")
    const form = new FormData(event.currentTarget)
    try {
      const recaptchaToken = await getRecaptchaToken("ask_submit")
      const response = await fetch("/api/ask", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, questionId, website: form.get("website"), recaptchaToken })
      })
      const result = await response.json()
      if (!response.ok || !result.ok) throw new Error(result.error || "Please try again later.")
      setBody("")
      setMessage(result.message)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not send. Please try again.")
    } finally {
      busyRef.current = false
      setPending(false)
    }
  }

  if (compact && message) {
    return <div role="status" className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-5">
      <p className="font-bold">Thank you for sharing.</p>
      <p className="text-sm leading-6 text-muted-foreground">{questionId ? "Your answer has been sent for review. You can return to Facebook now." : "Your question has been sent privately to Tochukwu. It will only appear publicly if he chooses to share it. You can close this page now."}</p>
    </div>
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <input type="text" name="website" hidden tabIndex={-1} aria-hidden="true" autoComplete="off" />
      <label htmlFor={id} className="block text-sm font-bold">{questionId ? "Your anonymous answer" : "Your anonymous question"}</label>
      <textarea id={id} name="body" className="field min-h-40 resize-y" required minLength={5} maxLength={ASK_MAX_LENGTH}
        value={body} onChange={(event) => setBody(event.target.value)} disabled={pending}
        aria-describedby={`${id}-privacy ${id}-count`} placeholder={questionId ? "Share your experience or perspective…" : "What would you like to ask Tochukwu?"} />
      <p id={`${id}-count`} className="text-right text-xs text-muted-foreground">{body.length} / {ASK_MAX_LENGTH}</p>
      {!compact ? <p id={`${id}-privacy`} className="text-sm leading-6 text-muted-foreground">
        No name, email, or account required. Avoid identifying details. By submitting, you agree that your contribution may be shared anonymously here and on Facebook after review.
      </p> : null}
      <button type="submit" disabled={pending} className="btn-primary w-full gap-2 disabled:opacity-60" aria-busy={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {pending ? "Sending…" : questionId ? "Send anonymous answer" : "Send anonymous question"}
      </button>
      {error ? <p role="alert" className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">{error}</p> : null}
      {message ? <p role="status" className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">{message}</p> : null}
      {compact ? <p id={`${id}-privacy`} className="text-xs leading-5 text-muted-foreground">No name or login needed. Avoid identifying details. Your {questionId ? "answer" : "question"} may be shared anonymously here or on Facebook after review.</p> : null}
      <details className="text-xs leading-5 text-muted-foreground">
        <summary className="cursor-pointer">About anonymity</summary>
        <p className="mt-2">We do not attach names, accounts, or IP addresses to submissions. Temporary security counters help prevent spam. Hosting providers and reCAPTCHA may process technical request data. Facebook uses its own accounts and privacy settings.</p>
        <Link href="/privacy-policy" className="mt-2 inline-flex items-center gap-1 underline">Privacy policy <ArrowUpRight className="h-3 w-3" /></Link>
      </details>
      <RecaptchaDisclosure className="text-left" />
    </form>
  )
}
