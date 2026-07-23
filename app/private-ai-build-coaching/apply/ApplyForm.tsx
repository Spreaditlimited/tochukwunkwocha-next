"use client"

import Image from "next/image"
import Link from "next/link"
import { FormEvent, useEffect, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  MessageSquare
} from "lucide-react"

import { PremiumPicker } from "@/components/PremiumPicker"
import { brand } from "@/lib/brand"
import { coachingCountries } from "@/lib/private-ai-coaching"

const DRAFT_KEY = "private_ai_coaching_apply_draft_v1"
const TOTAL_STEPS = 4

type CoachingApplyData = {
  fullName: string
  email: string
  phone: string
  country: string
  goalText: string
  currentStage: string
  experienceLevel: string
  availability: string
  commitment: string
  acknowledged: boolean
}

const initialData: CoachingApplyData = {
  fullName: "",
  email: "",
  phone: "",
  country: "",
  goalText: "",
  currentStage: "",
  experienceLevel: "",
  availability: "",
  commitment: "",
  acknowledged: false
}

export function ApplyForm() {
  const [step, setStep] = useState(0)
  const [formData, setFormData] = useState<CoachingApplyData>(initialData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    try {
      const draft = sessionStorage.getItem(DRAFT_KEY)
      if (draft) setFormData(JSON.parse(draft))
    } catch (_error) {}
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(formData))
    } catch (_error) {}
  }, [formData])

  const handleNext = () => setStep((current) => Math.min(current + 1, TOTAL_STEPS))
  const handlePrev = () => setStep((current) => Math.max(current - 1, 0))

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, type, value } = event.target
    const checked = (event.target as HTMLInputElement).checked
    setFormData((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value
    }))
  }

  const isStepValid = () => {
    if (step === 1) return formData.fullName && formData.email && formData.phone && formData.country
    if (step === 2) return formData.goalText && formData.currentStage
    if (step === 3) return formData.experienceLevel && formData.availability
    if (step === 4) return formData.commitment && formData.acknowledged
    return true
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage("")

    try {
      const response = await fetch("/api/private-ai-coaching/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(formData)
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Could not submit application.")
      sessionStorage.removeItem(DRAFT_KEY)
      window.location.href = String(json.checkoutUrl || "/checkout/private-ai-coaching-discovery")
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not submit application.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col bg-brand-ink text-white selection:bg-primary selection:text-white">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px]" />
      <div className="pointer-events-none fixed -left-[10%] -top-[10%] z-0 h-[50%] w-[60%] rounded-full bg-primary/10 blur-[150px]" />
      <div className="pointer-events-none fixed -bottom-[10%] -right-[10%] z-0 h-[60%] w-[50%] rounded-full bg-brand-sky/10 blur-[150px]" />

      <div className="fixed left-0 top-0 z-50 h-1.5 w-full bg-white/5">
        <div
          className="h-full bg-gradient-to-r from-primary to-brand-sky shadow-[0_0_10px_hsl(var(--brand-sky)/0.45)] transition-all duration-500 ease-out"
          style={{ width: `${step === 0 ? 10 : (step / TOTAL_STEPS) * 100}%` }}
        />
      </div>

      <header className="relative z-20 flex w-full items-center justify-between px-6 py-6 lg:px-8">
        <Link
          href="/"
          className="inline-flex h-10 w-[170px] items-center justify-start no-underline transition-opacity hover:opacity-80 sm:h-11 sm:w-[188px]"
          aria-label={brand.name}
        >
          <Image
            src={brand.assets.logoReverse}
            alt={brand.name}
            width={2127}
            height={499}
            className="h-full w-full object-contain"
            priority
          />
        </Link>
        <Link href="/private-ai-build-coaching" className="text-xs font-bold uppercase tracking-widest text-slate-500 no-underline transition-colors hover:text-white">
          Cancel & Exit
        </Link>
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-3xl">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-brand-navy/80 p-6 shadow-2xl backdrop-blur-2xl sm:p-10 lg:p-12">
            <form onSubmit={handleSubmit} className="relative">
                {step === 0 && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 text-center duration-500">
                    <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-sky">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-sky opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                      </span>
                      Coaching Application
                    </span>
                    <h1 className="font-heading text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                      Let’s understand what you want to build.
                    </h1>
                    <p className="mx-auto mt-6 max-w-lg text-lg text-slate-400">
                      This short application helps confirm whether private coaching is the right fit before you pay for a discovery call.
                    </p>
                    <div className="mt-8 flex flex-col items-center justify-center gap-3 text-xs font-bold uppercase tracking-widest text-slate-500 sm:flex-row sm:gap-6">
                      <span className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-brand-sky" /> 3-5 minutes
                      </span>
                      <span className="hidden h-1.5 w-1.5 rounded-full bg-white/20 sm:block" />
                      <span>Reviewed before coaching</span>
                    </div>
                    <button type="button" onClick={handleNext} className="btn-inverse mt-10 px-8 py-4 text-base">
                      Start Application <ArrowRight className="ml-2 h-5 w-5" />
                    </button>
                  </div>
                )}

                {step === 1 && (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                    <h2 className="font-heading text-2xl font-black">The Basics</h2>
                    <div className="mt-8 grid gap-6 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-slate-300">Full Name</span>
                        <input name="fullName" value={formData.fullName} onChange={handleChange} required className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Jane Doe" />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-slate-300">Email Address</span>
                        <input name="email" type="email" value={formData.email} onChange={handleChange} required className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" placeholder="you@example.com" />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-slate-300">Phone Number</span>
                        <input name="phone" value={formData.phone} onChange={handleChange} required className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" placeholder="+234 ..." />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-slate-300">Paying From</span>
                        <PremiumPicker
                          name="country"
                          value={formData.country}
                          onChange={handleChange}
                          placeholder="Select country"
                          options={coachingCountries}
                          tone="dark"
                          required
                        />
                      </label>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                    <h2 className="font-heading text-2xl font-black">Your Project</h2>
                    <p className="mt-2 text-sm text-slate-400">Be specific about the idea, website, tool, or challenge you need help with.</p>
                    <div className="mt-8 grid gap-6">
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-slate-300">What do you want help building?</span>
                        <textarea
                          name="goalText"
                          value={formData.goalText}
                          onChange={handleChange}
                          required
                          rows={5}
                          className="w-full resize-none rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="Briefly describe your idea, website, software tool, or current blocker..."
                        />
                      </label>
                      <div>
                        <span className="mb-3 block text-sm font-bold text-slate-300">Where are you right now?</span>
                        <div className="grid gap-3">
                          {[
                            { value: "idea", label: "I have an idea but have not started building" },
                            { value: "started", label: "I have started building and need guidance" },
                            { value: "stuck", label: "I am stuck and need help fixing or improving something" },
                            { value: "launch", label: "I need help getting a project ready to launch" }
                          ].map((option) => (
                            <label key={option.value} className="group relative cursor-pointer">
                              <input type="radio" name="currentStage" value={option.value} checked={formData.currentStage === option.value} onChange={handleChange} className="peer sr-only" />
                              <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-5 transition-all hover:bg-white/10 peer-checked:border-primary peer-checked:bg-primary/10">
                                <div className="h-4 w-4 rounded-full border-2 border-slate-500 peer-checked:group-[]:border-4 peer-checked:group-[]:border-brand-sky" />
                                <span className="text-sm font-bold text-white">{option.label}</span>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                    <h2 className="font-heading text-2xl font-black">Your Learning Context</h2>
                    <div className="mt-8 grid gap-6">
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-slate-300">Experience Level</span>
                        <PremiumPicker
                          name="experienceLevel"
                          value={formData.experienceLevel}
                          onChange={handleChange}
                          placeholder="Select experience level"
                          tone="dark"
                          options={[
                            { value: "Complete beginner", label: "Complete beginner" },
                            { value: "I have started building", label: "I have started building" },
                            { value: "I need help improving something", label: "I need help improving something" }
                          ]}
                          required
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-slate-300">Availability</span>
                        <input name="availability" value={formData.availability} onChange={handleChange} required className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" placeholder="e.g. Weekdays, evenings, weekends..." />
                      </label>
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                    <h2 className="font-heading text-2xl font-black">Final Check</h2>
                    <div className="mt-8 grid gap-8">
                      <div>
                        <span className="mb-3 block text-sm font-bold text-slate-300">How much time can you commit between coaching sessions?</span>
                        <div className="grid gap-3 sm:grid-cols-3">
                          {[
                            { value: "light", label: "1-2 hours weekly" },
                            { value: "steady", label: "3-5 hours weekly" },
                            { value: "intensive", label: "6+ hours weekly" }
                          ].map((option) => (
                            <label key={option.value} className="group relative cursor-pointer">
                              <input type="radio" name="commitment" value={option.value} checked={formData.commitment === option.value} onChange={handleChange} className="peer sr-only" />
                              <div className="flex min-h-24 items-center justify-center rounded-xl border border-white/10 bg-white/5 p-4 text-center transition-all hover:bg-white/10 peer-checked:border-primary peer-checked:bg-primary/10">
                                <span className="text-sm font-bold text-white">{option.label}</span>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                      <label className="flex cursor-pointer items-start gap-4 rounded-xl border border-primary/20 bg-primary/5 p-5 transition-colors hover:bg-primary/10">
                        <input name="acknowledged" type="checkbox" checked={formData.acknowledged} onChange={handleChange} required className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-600 bg-slate-800 text-primary focus:ring-primary" />
                        <span className="text-sm leading-relaxed text-slate-300">
                          I understand that the discovery call is paid, coaching slots are limited, and private coaching requires practice between sessions.
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {step > 0 && (
                  <div className="mt-10 flex items-center justify-between border-t border-white/10 pt-6">
                    <button type="button" onClick={handlePrev} className="btn-inverse-secondary px-6 py-3 text-sm">
                      <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </button>
                    {step < TOTAL_STEPS ? (
                      <button type="button" onClick={handleNext} disabled={!isStepValid()} className="btn-inverse px-8 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50">
                        Continue <ChevronRight className="ml-1 h-5 w-5" />
                      </button>
                    ) : (
                      <button type="submit" disabled={!isStepValid() || isSubmitting} className="btn-primary px-8 py-3 text-sm shadow-lg shadow-primary/20 disabled:cursor-not-allowed disabled:opacity-50">
                        {isSubmitting ? "Submitting..." : "Submit Application"}
                      </button>
                    )}
                  </div>
                )}
                {errorMessage ? (
                  <p className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm font-bold text-white">
                    {errorMessage}
                  </p>
                ) : null}
            </form>
          </div>
        </div>
      </div>
    </main>
  )
}
