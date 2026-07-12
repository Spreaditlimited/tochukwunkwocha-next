"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useState, FormEvent } from "react"
import { 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  ChevronRight, 
  Cpu, 
  CreditCard, 
  ShieldCheck, 
  XCircle 
} from "lucide-react"

import { PremiumPicker } from "@/components/PremiumPicker"
import { brand } from "@/lib/brand"

// Key for session storage resilience
const DRAFT_KEY = "build_scorecard_draft_v1"
const TOTAL_STEPS = 5

type FormData = {
  fullName: string
  companyName: string
  email: string
  phone: string
  website: string
  country: string
  buildDesc: string
  problemDesc: string
  systemUsers: string
  currentProcess: string
  complexity: string
  budget: string
  decision: string
  timeline: string
  acknowledged: boolean
}

const initialData: FormData = {
  fullName: "", companyName: "", email: "", phone: "", website: "", country: "",
  buildDesc: "", problemDesc: "", systemUsers: "",
  currentProcess: "", complexity: "", budget: "", decision: "", timeline: "",
  acknowledged: false
}

const countryOptions = [
  { value: "NG", label: "Nigeria" },
  { value: "GB", label: "United Kingdom" },
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  { value: "OTHER", label: "Other" }
]

export default function BuildScorecardPage() {
  const [step, setStep] = useState(0)
  const [formData, setFormData] = useState<FormData>(initialData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resultStatus, setResultStatus] = useState<"idle" | "success" | "review" | "decline">("idle")
  const [checkoutUrl, setCheckoutUrl] = useState("")
  const [errorMessage, setErrorMessage] = useState("")

  // Load draft from session storage on mount
  useEffect(() => {
    try {
      const draft = sessionStorage.getItem(DRAFT_KEY)
      if (draft) setFormData(JSON.parse(draft))
    } catch (e) {}
  }, [])

  // Save to session storage on change
  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(formData))
    } catch (e) {}
  }, [formData])

  const handleNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS))
  const handlePrev = () => setStep((s) => Math.max(s - 1, 0))

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrorMessage("")

    try {
      if (formData.complexity === "dq_fintech" || formData.complexity === "dq_marketplace") {
        setResultStatus("decline")
        return
      } else if (formData.timeline === "dq_exploring") {
        setResultStatus("review")
        return
      }

      const response = await fetch("/api/build-scorecard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(formData)
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Could not submit scorecard.")
      setCheckoutUrl(String(json.checkoutUrl || ""))
      setResultStatus("success")
      sessionStorage.removeItem(DRAFT_KEY)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not submit scorecard.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Helper to check if current step is valid to enable the "Next" button
  const isStepValid = () => {
    if (step === 1) return formData.fullName && formData.companyName && formData.email && formData.phone && formData.country
    if (step === 2) return formData.buildDesc && formData.problemDesc && formData.systemUsers
    if (step === 3) return formData.currentProcess
    if (step === 4) return formData.complexity
    if (step === 5) return formData.budget && formData.decision && formData.timeline && formData.acknowledged
    return true
  }

  return (
    <main className="relative flex min-h-screen flex-col bg-brand-ink text-white selection:bg-sky-500 selection:text-white">
      {/* Deep Space Backgrounds */}
      <div className="fixed inset-0 z-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none"></div>
      <div className="fixed -left-[10%] -top-[10%] z-0 h-[50%] w-[60%] rounded-full bg-emerald-500/10 blur-[150px] pointer-events-none"></div>
      <div className="fixed -right-[10%] -bottom-[10%] z-0 h-[60%] w-[50%] rounded-full bg-sky-500/10 blur-[150px] pointer-events-none"></div>

      {/* Progress Bar */}
      <div className="fixed left-0 top-0 z-50 h-1.5 w-full bg-white/5">
        <div 
          className="h-full bg-gradient-to-r from-emerald-500 to-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.5)] transition-all duration-500 ease-out" 
          style={{ width: `${step === 0 ? 10 : (step / TOTAL_STEPS) * 100}%` }}
        />
      </div>

      {/* Minimal Header */}
      <header className="relative z-20 flex w-full items-center justify-between px-6 py-6 lg:px-8">
        <Link
          href="/"
          className="inline-flex h-10 w-[170px] items-center justify-start transition-opacity hover:opacity-80 sm:h-11 sm:w-[188px]"
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
        <Link href="/build" className="text-xs font-bold uppercase tracking-widest text-slate-500 transition-colors hover:text-white">
          Cancel & Exit
        </Link>
      </header>

      {/* Main Focus Container */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-3xl">
          
          {/* Card Wrapper */}
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0a1120]/80 p-6 shadow-2xl backdrop-blur-2xl sm:p-10 lg:p-12">
            
            {resultStatus === "idle" ? (
              <form onSubmit={handleSubmit} className="relative">
                
                {/* STEP 0: Intro */}
                {step === 0 && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 text-center duration-500">
                    <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-sky-400">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75"></span>
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500"></span>
                      </span>
                      Application Form
                    </span>
                    <h1 className="font-heading text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                      Let’s understand what you are building.
                    </h1>
                    <p className="mx-auto mt-6 max-w-lg text-lg text-slate-400">
                      This short scorecard helps determine whether your project architecture fits the strict 30-day Build implementation model.
                    </p>
                    
                    <div className="mt-8 flex flex-col items-center justify-center gap-3 text-xs font-bold uppercase tracking-widest text-slate-500 sm:flex-row sm:gap-6">
                      <span className="flex items-center gap-2"><Cpu className="h-4 w-4 text-sky-400" /> 3–5 minutes</span>
                      <span className="hidden h-1.5 w-1.5 rounded-full bg-white/20 sm:block"></span>
                      <span>Automatically Scored</span>
                    </div>
                    
                    <button type="button" onClick={handleNext} className="btn-inverse mt-10 px-8 py-4 text-base">
                      Start Application <ArrowRight className="ml-2 h-5 w-5" />
                    </button>
                  </div>
                )}

                {/* STEP 1: Basics */}
                {step === 1 && (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                    <h2 className="font-heading text-2xl font-black">The Basics</h2>
                    <div className="mt-8 grid gap-6 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-slate-300">Full Name</span>
                        <input name="fullName" value={formData.fullName} onChange={handleChange} required className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500" placeholder="John Doe" />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-slate-300">Company Name</span>
                        <input name="companyName" value={formData.companyName} onChange={handleChange} required className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500" placeholder="Acme Corp" />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-slate-300">Email Address</span>
                        <input name="email" type="email" value={formData.email} onChange={handleChange} required className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500" placeholder="john@company.com" />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-slate-300">Phone Number</span>
                        <input name="phone" type="tel" value={formData.phone} onChange={handleChange} required className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500" placeholder="+234 ..." />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-slate-300">Website <span className="text-slate-500 font-normal">(Optional)</span></span>
                        <input name="website" type="url" value={formData.website} onChange={handleChange} className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500" placeholder="https://" />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-slate-300">Location</span>
                        <PremiumPicker
                          name="country"
                          value={formData.country}
                          onChange={handleChange}
                          required
                          placeholder="Select country"
                          options={countryOptions}
                          tone="dark"
                        />
                      </label>
                    </div>
                  </div>
                )}

                {/* STEP 2: The Project */}
                {step === 2 && (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                    <h2 className="font-heading text-2xl font-black">The Project</h2>
                    <p className="mt-2 text-sm text-slate-400">Be specific. Vague requests are harder to qualify.</p>
                    <div className="mt-8 grid gap-6">
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-slate-300">What exactly do you want to build?</span>
                        <textarea name="buildDesc" value={formData.buildDesc} onChange={handleChange} required rows={3} className="w-full resize-none rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500" placeholder="e.g., A customer portal for our logistics clients..." />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-sm font-bold text-slate-300">Describe the problem you are solving.</span>
                        <p className="mb-3 text-xs text-slate-500">The more detail on your current pain points, the better.</p>
                        <textarea name="problemDesc" value={formData.problemDesc} onChange={handleChange} required rows={4} className="w-full resize-none rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500" placeholder="e.g., We currently onboard drivers through WhatsApp and manually track documents across spreadsheets..." />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-slate-300">Who will use this system?</span>
                        <input name="systemUsers" value={formData.systemUsers} onChange={handleChange} required className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500" placeholder="Internal staff, external clients, etc." />
                      </label>
                    </div>
                  </div>
                )}

                {/* STEP 3: Current Operations */}
                {step === 3 && (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                    <h2 className="font-heading text-2xl font-black">Current Operations</h2>
                    <p className="mt-2 text-sm text-slate-400">How do you currently handle this process?</p>
                    <div className="mt-8 grid gap-4">
                      {[
                        { val: "chaos", label: "Spreadsheets & WhatsApp (Chaos)" },
                        { val: "combo", label: "A combination of unlinked tools" },
                        { val: "paper", label: "Mostly Paper / Manual entry" },
                        { val: "existing", label: "We use existing software, but it's limiting" },
                        { val: "none", label: "No process currently (Exploring new idea)" }
                      ].map((opt) => (
                        <label key={opt.val} className="group relative cursor-pointer">
                          <input type="radio" name="currentProcess" value={opt.val} checked={formData.currentProcess === opt.val} onChange={handleChange} className="peer sr-only" />
                          <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-5 transition-all hover:bg-white/10 peer-checked:border-sky-500 peer-checked:bg-sky-500/10">
                            <div className="h-4 w-4 rounded-full border-2 border-slate-500 peer-checked:group-[]:border-4 peer-checked:group-[]:border-sky-400"></div>
                            <span className="text-sm font-bold text-white">{opt.label}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* STEP 4: Technical Scope */}
                {step === 4 && (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                    <h2 className="font-heading text-2xl font-black">Technical Scope</h2>
                    <p className="mt-2 text-sm text-slate-400">Which category best describes your project?</p>
                    <div className="mt-8 grid gap-4">
                      {[
                        { val: "simple", label: "Focused Systems", desc: "Dashboards, internal tools, customer portals, booking systems, e-commerce websites." },
                        { val: "medium", label: "Medium Complexity Workflow", desc: "Custom logic integrating multiple business rules." },
                        { val: "dq_marketplace", label: "Mass Consumer Apps", desc: "Uber clones, Social Networks, B2B/B2C Marketplaces." },
                        { val: "dq_fintech", label: "Heavy Infrastructure", desc: "Deep AI infrastructure or Core Fintech platforms." }
                      ].map((opt) => (
                        <label key={opt.val} className="group relative cursor-pointer">
                          <input type="radio" name="complexity" value={opt.val} checked={formData.complexity === opt.val} onChange={handleChange} className="peer sr-only" />
                          <div className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/5 p-5 transition-all hover:bg-white/10 peer-checked:border-sky-500 peer-checked:bg-sky-500/10">
                            <div className="mt-1 h-4 w-4 shrink-0 rounded-full border-2 border-slate-500 peer-checked:group-[]:border-4 peer-checked:group-[]:border-sky-400"></div>
                            <div>
                              <span className="block text-sm font-bold text-white">{opt.label}</span>
                              <span className="mt-1 block text-sm text-slate-400">{opt.desc}</span>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* STEP 5: Logistics & Budget */}
                {step === 5 && (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                    <h2 className="font-heading text-2xl font-black">Logistics & Budget</h2>
                    <div className="mt-8 grid gap-10">
                      
                      <div>
                        <span className="mb-3 block text-sm font-bold text-slate-300">Allocated Budget Range</span>
                        <div className="grid gap-3 sm:grid-cols-3">
                          {[
                            { val: "ngn_1m_3m", label: "₦1m – ₦3m", sub: "Approx. $714 – $2,143" },
                            { val: "ngn_3m_5m", label: "₦3m – ₦5m", sub: "Approx. $2,143 – $3,571" },
                            { val: "ngn_5m_plus", label: "₦5m+", sub: "Approx. $3,571+" }
                          ].map((opt) => (
                            <label key={opt.val} className="group relative cursor-pointer">
                              <input type="radio" name="budget" value={opt.val} checked={formData.budget === opt.val} onChange={handleChange} className="peer sr-only" />
                              <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5 p-4 text-center transition-all hover:bg-white/10 peer-checked:border-sky-500 peer-checked:bg-sky-500/10">
                                <span className="text-base font-bold text-white">{opt.label}</span>
                                <span className="mt-1 text-xs text-slate-400">{opt.sub}</span>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="mb-3 block text-sm font-bold text-slate-300">Expected Delivery Timeline</span>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {[
                            { val: "dq_immediate", label: "Need in 7 days" },
                            { val: "10", label: "Start immediately (30 Days)" },
                            { val: "5", label: "1 – 3 months" },
                            { val: "dq_exploring", label: "Still exploring ideas" }
                          ].map((opt) => (
                            <label key={opt.val} className="group relative cursor-pointer">
                              <input type="radio" name="timeline" value={opt.val} checked={formData.timeline === opt.val} onChange={handleChange} className="peer sr-only" />
                              <div className="flex items-center justify-center rounded-xl border border-white/10 bg-white/5 p-4 text-center transition-all hover:bg-white/10 peer-checked:border-sky-500 peer-checked:bg-sky-500/10">
                                <span className="text-sm font-bold text-white">{opt.label}</span>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>

                      <label className="flex cursor-pointer items-start gap-4 rounded-xl border border-sky-500/20 bg-sky-500/5 p-5 transition-colors hover:bg-sky-500/10">
                        <input name="acknowledged" type="checkbox" checked={formData.acknowledged} onChange={handleChange} required className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-sky-500" />
                        <span className="text-sm leading-relaxed text-slate-300">
                          I understand that discovery sessions are paid, implementation slots are strictly limited to one per month, and submission does not guarantee selection.
                        </span>
                      </label>

                    </div>
                  </div>
                )}

                {/* Navigation Controls (Visible for steps 1-5) */}
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
                        {isSubmitting ? "Submitting..." : "Submit Scorecard"}
                      </button>
                    )}
                  </div>
                )}

                {errorMessage ? (
                  <p className="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-sm font-bold text-rose-200">
                    {errorMessage}
                  </p>
                ) : null}

              </form>
            ) : (
              /* RESULTS VIEWS */
              <div className="animate-in zoom-in-95 text-center duration-500">
                
                {resultStatus === "success" && (
                  <>
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                      <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                    </div>
                    <h2 className="font-heading text-3xl font-black">Great fit.</h2>
                    <p className="mx-auto mt-4 max-w-md text-lg text-slate-400">
                      Based on your responses, your project aligns perfectly with the Build methodology. You can now book your paid discovery session.
                    </p>
                    
                    <Link href={checkoutUrl} className="btn-primary mt-8 w-full px-8 py-4 text-base shadow-lg shadow-primary/20 sm:w-auto">
                      Book Paid Discovery Call <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </>
                )}

                {resultStatus === "review" && (
                  <>
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
                      <ShieldCheck className="h-10 w-10 text-amber-400" />
                    </div>
                    <h2 className="font-heading text-3xl font-black">Application Received.</h2>
                    <p className="mx-auto mt-4 max-w-md text-lg text-slate-400">
                      Thanks for applying. Your project structure requires manual review before proceeding to discovery.
                    </p>
                    <p className="mt-8 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 font-mono text-sm font-bold uppercase tracking-widest text-slate-300">
                      We will reach out via email.
                    </p>
                  </>
                )}

                {resultStatus === "decline" && (
                  <>
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-500/30 bg-slate-500/10">
                      <XCircle className="h-10 w-10 text-slate-400" />
                    </div>
                    <h2 className="font-heading text-3xl font-black">Thank you for your interest.</h2>
                    <p className="mx-auto mt-4 max-w-md text-lg text-slate-400">
                      Based on your responses, this project falls outside the specialized implementation scope and timeline used for the 30-Day Build process.
                    </p>
                    <Link href="/build" className="btn-inverse-secondary mt-8 px-8 py-3 text-sm">
                      <ArrowLeft className="mr-2 h-4 w-4" /> Return to Build Page
                    </Link>
                  </>
                )}

              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
