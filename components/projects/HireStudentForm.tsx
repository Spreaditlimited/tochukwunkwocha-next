"use client"

import { useState, type FormEvent } from "react"
import { CheckCircle2, Loader2, Send } from "lucide-react"

import { getRecaptchaToken, preloadRecaptcha } from "@/lib/browser-recaptcha"
import { STUDENT_OPPORTUNITY_TYPES } from "@/lib/student-portfolio-shared"

export function HireStudentForm({ studentName, profileSlug, opportunityTypes }: {
  studentName: string
  profileSlug: string
  opportunityTypes: string[]
}) {
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")
  const allowedOptions = STUDENT_OPPORTUNITY_TYPES.filter((item) => !opportunityTypes.length || opportunityTypes.includes(item.value))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError("")
    setSuccess("")
    const form = event.currentTarget
    const data = new FormData(form)
    try {
      const recaptchaToken = await getRecaptchaToken("student_hire_enquiry")
      const response = await fetch(`/api/projects/${encodeURIComponent(profileSlug)}/hire`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: data.get("fullName"),
          organisation: data.get("organisation"),
          email: data.get("email"),
          opportunityType: data.get("opportunityType"),
          timeline: data.get("timeline"),
          budgetRange: data.get("budgetRange"),
          message: data.get("message"),
          consent: data.get("consent") === "on",
          website: data.get("website"),
          recaptchaToken
        })
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.ok) throw new Error(result?.error || "The enquiry could not be sent.")
      form.reset()
      setSuccess(result.message || `Your enquiry has been sent for ${studentName}.`)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The enquiry could not be sent.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} onFocus={() => void preloadRecaptcha()} className="grid gap-5 rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-7">
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block"><span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-300">Your name</span><input name="fullName" required maxLength={180} className="w-full rounded-md border border-white/15 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/20" /></label>
        <label className="block"><span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-300">Work email</span><input name="email" type="email" required maxLength={190} className="w-full rounded-md border border-white/15 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/20" /></label>
        <label className="block"><span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-300">Organisation</span><input name="organisation" maxLength={220} className="w-full rounded-md border border-white/15 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/20" /></label>
        <label className="block"><span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-300">Opportunity</span><select name="opportunityType" required className="w-full rounded-md border border-white/15 bg-brand-ink px-4 py-3 text-sm text-white outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-300/20"><option value="">Select one</option>{allowedOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className="block"><span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-300">Expected timeline</span><input name="timeline" maxLength={120} placeholder="For example: 4–6 weeks" className="w-full rounded-md border border-white/15 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/20" /></label>
        <label className="block"><span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-300">Budget range (optional)</span><input name="budgetRange" maxLength={120} placeholder="Currency and range" className="w-full rounded-md border border-white/15 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/20" /></label>
      </div>
      <label className="block"><span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-300">Project or role details</span><textarea name="message" required minLength={40} maxLength={4000} rows={6} className="w-full resize-y rounded-md border border-white/15 bg-white/10 px-4 py-3 text-sm leading-relaxed text-white outline-none placeholder:text-slate-500 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/20" placeholder={`Explain the opportunity you would like ${studentName} to consider.`} /></label>
      <label className="flex items-start gap-3 text-xs leading-relaxed text-slate-300"><input name="consent" type="checkbox" required className="mt-0.5 h-4 w-4 accent-sky-300" /><span>I consent to the Academy storing this enquiry and sharing it with the student for the purpose of responding to this opportunity.</span></label>
      {success ? <p role="status" className="flex items-start gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm text-emerald-100"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{success}</p> : null}
      {error ? <p role="alert" className="rounded-xl border border-red-400/25 bg-red-400/10 p-4 text-sm text-red-100">{error}</p> : null}
      <button type="submit" disabled={busy} className="btn-inverse w-full gap-2 sm:w-fit">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{busy ? "Sending enquiry…" : `Send enquiry for ${studentName.split(/\s+/)[0]}`}</button>
    </form>
  )
}
