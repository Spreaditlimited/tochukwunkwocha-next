"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, type FormEvent } from "react"
import { 
  AlertCircle,
  Briefcase,
  Building2,
  Calendar,
  CalendarCheck, 
  CheckCircle2, 
  ChevronDown, 
  Loader2, 
  Mail,
  Phone,
  User,
  Users,
  Video,
  XCircle
} from "lucide-react"

import { BrandMark } from "@/components/BrandMark"

type Slot = {
  startIso: string
  endIso: string
  label: string
}

type BookingMode = "school" | "build" | "private_ai_coaching"

function modeFromSource(source: string): BookingMode {
  if (source === "build") return "build"
  if (source === "private_ai_coaching") return "private_ai_coaching"
  return "school"
}

function dateKey(iso: string) {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return ""
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value || ""
  return `${get("year")}-${get("month")}-${get("day")}`
}

function timeLabel(iso: string) {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return ""
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "numeric", minute: "2-digit" }).format(date)
}

function copyForMode(mode: BookingMode) {
  if (mode === "build") {
    return {
      badge: "Build Discovery",
      title: "Schedule your build discovery call",
      intro: "Pick a slot for the build discovery session and receive your Zoom link immediately.",
      panelTitle: "Book your build discovery call",
      emailLabel: "Work Email",
      roleLabel: "Your role",
      organizationLabel: "Business / Project name",
      detailLabel: "Project type"
    }
  }
  if (mode === "private_ai_coaching") {
    return {
      badge: "Private Coaching",
      title: "Schedule your discovery call",
      intro: "Choose a time for your private coaching discovery call. Your application details are already saved.",
      panelTitle: "Book your coaching discovery call",
      emailLabel: "Email address",
      roleLabel: "Current role",
      organizationLabel: "Project / Coaching focus",
      detailLabel: "What are you building?"
    }
  }
  return {
    badge: "School Onboarding",
    title: "Schedule a discovery call",
    intro: "Pick a slot, book instantly, and receive a Zoom link immediately. You can reschedule or cancel from your management link.",
    panelTitle: "Book a new call",
    emailLabel: "Work Email",
    roleLabel: "Your Role",
    organizationLabel: "School Name",
    detailLabel: "Student Population"
  }
}

async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init)
  const json = await response.json().catch(() => null)
  if (!response.ok || !json?.ok) throw new Error(json?.error || "Request failed")
  return json as T
}

export function CallBookingClient({
  source,
  manageToken,
  buildAccessToken,
  coachingAccessToken
}: {
  source: string
  manageToken: string
  buildAccessToken: string
  coachingAccessToken: string
}) {
  const mode = modeFromSource(source)
  const copy = copyForMode(mode)
  const [slots, setSlots] = useState<Slot[]>([])
  const [selectedDate, setSelectedDate] = useState("")
  const [selectedSlot, setSelectedSlot] = useState("")
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [booking, setBooking] = useState<Record<string, string> | null>(null)

  const grouped = useMemo(() => {
    const map = new Map<string, Slot[]>()
    for (const slot of slots) {
      const key = dateKey(slot.startIso)
      if (!key) continue
      map.set(key, [...(map.get(key) || []), slot])
    }
    return map
  }, [slots])
  
  const dateKeys = Array.from(grouped.keys()).sort()
  const visibleSlots = grouped.get(selectedDate) || []

  async function loadSlots() {
    setError("")
    const params = new URLSearchParams()
    if (mode !== "school") params.set("source", mode)
    if (buildAccessToken) params.set("build_access", buildAccessToken)
    if (coachingAccessToken) params.set("coaching_access", coachingAccessToken)
    
    const data = await requestJson<{ slots: Slot[] }>(`/api/schools/call/slots?${params.toString()}`)
    setSlots(data.slots || [])
    
    const first = data.slots?.[0]
    if (first) {
      setSelectedDate(dateKey(first.startIso))
      setSelectedSlot(first.startIso)
    }
  }

  useEffect(() => {
    loadSlots().catch((err) => setError(err instanceof Error ? err.message : "Could not load slots."))
    if (manageToken) {
      requestJson<{ booking: Record<string, string> }>(`/api/schools/call/manage?manage=${encodeURIComponent(manageToken)}`)
        .then((data) => setBooking(data.booking))
        .catch((err) => setError(err instanceof Error ? err.message : "Could not load booking."))
    }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setLoading(true)
    setError("")
    setStatus("")
    try {
      const payload = {
        sourceType: mode,
        fullName: String(form.get("fullName") || ""),
        schoolName: String(form.get("schoolName") || ""),
        workEmail: String(form.get("workEmail") || ""),
        phone: String(form.get("phone") || ""),
        role: String(form.get("role") || ""),
        studentPopulation: String(form.get("studentPopulation") || ""),
        slotStartIso: selectedSlot,
        buildAccessToken,
        coachingAccessToken
      }
      const data = await requestJson<Record<string, string>>("/api/schools/call/book", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      })
      setBooking(data)
      setStatus("Call booked successfully. Check your email for details.")
      event.currentTarget.reset()
      await loadSlots()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not book call.")
    } finally {
      setLoading(false)
    }
  }

  async function reschedule() {
    if (!manageToken || !selectedSlot) return
    setLoading(true)
    setError("")
    try {
      const data = await requestJson<{ slotLabel: string }>("/api/schools/call/reschedule", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ manageToken, slotStartIso: selectedSlot, note: "Rescheduled by attendee" })
      })
      setStatus(`Booking rescheduled to ${data.slotLabel}.`)
      const managed = await requestJson<{ booking: Record<string, string> }>(`/api/schools/call/manage?manage=${encodeURIComponent(manageToken)}`)
      setBooking(managed.booking)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reschedule booking.")
    } finally {
      setLoading(false)
    }
  }

  async function cancel() {
    if (!manageToken || !window.confirm("Cancel this booking?")) return
    setLoading(true)
    setError("")
    try {
      await requestJson("/api/schools/call/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ manageToken, reason: "Cancelled by attendee" })
      })
      setStatus("Booking cancelled.")
      const managed = await requestJson<{ booking: Record<string, string> }>(`/api/schools/call/manage?manage=${encodeURIComponent(manageToken)}`)
      setBooking(managed.booking)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel booking.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-brand-ink text-white selection:bg-sky-500 selection:text-white">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px]" />
      <div className="pointer-events-none fixed -left-[10%] -top-[10%] z-0 h-[50%] w-[60%] rounded-full bg-emerald-500/10 blur-[150px]" />
      <div className="pointer-events-none fixed -bottom-[10%] -right-[10%] z-0 h-[60%] w-[50%] rounded-full bg-cyan-500/10 blur-[150px]" />

      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-8 lg:px-8">
        <BrandMark href="/" context="public" variant="full" tone="reverse" className="h-10 w-44" />
        <Link 
          href="/" 
          className="rounded-full bg-white/5 px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          Exit
        </Link>
      </header>
      
      <section className="relative z-10 mx-auto grid w-full max-w-7xl gap-12 px-6 py-8 sm:py-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16 lg:px-8">
        
        {/* Left Column: Copy & Current Booking Ticket */}
        <div className="flex flex-col">
          <p className="inline-flex w-fit items-center rounded-md border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-sky-400 shadow-sm">
            {copy.badge}
          </p>
          <h1 className="mt-6 font-heading text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            {copy.title}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
            {copy.intro}
          </p>

          {/* Active Booking Ticket */}
          {booking && (
            <div className="mt-10 animate-in fade-in slide-in-from-bottom-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                Your Current Itinerary
              </p>
              <div className="overflow-hidden rounded-2xl border border-emerald-500/20 bg-emerald-500/5 shadow-2xl backdrop-blur-sm">
                <div className="border-b border-emerald-500/20 bg-emerald-500/10 p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-emerald-50">Confirmed Appointment</p>
                      <p className="mt-0.5 text-xs text-emerald-200/70">{booking.slotLabel || status}</p>
                    </div>
                  </div>
                </div>
                
                {booking.zoomJoinUrl && (
                  <div className="p-5">
                    <a 
                      className="group flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 transition-colors hover:bg-emerald-500/20" 
                      href={booking.zoomJoinUrl} 
                      target="_blank" 
                      rel="noreferrer"
                    >
                      <div className="flex items-center gap-3">
                        <Video className="h-5 w-5 text-emerald-400" />
                        <div>
                          <p className="text-sm font-bold text-emerald-50">Join Video Room</p>
                          <p className="text-xs text-emerald-200/70">Secure Zoom Link</p>
                        </div>
                      </div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 transition-transform group-hover:scale-110">
                        <ChevronDown className="h-4 w-4 -rotate-90" />
                      </div>
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Interactive Booking Panel */}
        <div className="flex h-fit flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] shadow-2xl backdrop-blur-xl">
          <div className="border-b border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="font-heading text-2xl font-black text-white">
              {manageToken ? "Manage Booking" : copy.panelTitle}
            </h2>
          </div>
          
          <div className="p-6 sm:p-8">
            
            {/* Scheduling Block */}
            <div className="grid gap-6">
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <Calendar className="h-3.5 w-3.5" /> Select Date
                </span>
                <div className="relative">
                  <select 
                    value={selectedDate} 
                    onChange={(event) => {
                      setSelectedDate(event.target.value)
                      setSelectedSlot((grouped.get(event.target.value) || [])[0]?.startIso || "")
                    }} 
                    className="w-full appearance-none rounded-xl border border-white/10 bg-black/40 px-4 py-3.5 text-sm font-bold text-white outline-none transition-colors focus:border-sky-500/50 focus:bg-black/60 focus:ring-1 focus:ring-sky-500/50"
                  >
                    {dateKeys.map((key) => <option key={key} value={key}>{key}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </label>

              <div>
                <span className="mb-3 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Available Time Slots (WAT)
                </span>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {visibleSlots.map((slot) => (
                    <button 
                      key={slot.startIso} 
                      type="button" 
                      onClick={() => setSelectedSlot(slot.startIso)} 
                      className={`flex h-12 items-center justify-center rounded-lg border text-sm font-bold transition-all ${
                        selectedSlot === slot.startIso 
                          ? "border-sky-500 bg-sky-500 text-white shadow-[0_0_15px_rgba(14,165,233,0.3)]" 
                          : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {timeLabel(slot.startIso)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Form or Management Actions */}
            {manageToken ? (
              <div className="mt-8 flex flex-col gap-4 border-t border-white/10 pt-8 sm:flex-row">
                <button 
                  type="button" 
                  onClick={reschedule} 
                  disabled={loading || !selectedSlot} 
                  className="btn-inverse w-full justify-center shadow-lg sm:w-auto"
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarCheck className="mr-2 h-4 w-4" />} Reschedule Time
                </button>
                <button 
                  type="button" 
                  onClick={cancel} 
                  disabled={loading} 
                  className="inline-flex h-[42px] items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 px-5 text-sm font-bold text-rose-400 transition-colors hover:bg-rose-500/20 disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
                >
                  <XCircle className="mr-2 h-4 w-4" /> Cancel Booking
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-8 border-t border-white/10 pt-8">
                {mode !== "private_ai_coaching" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block sm:col-span-2">
                      <span className="sr-only">Full name</span>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input name="fullName" required placeholder="Full Name" className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3.5 pl-11 text-sm font-medium text-white outline-none transition-colors placeholder:text-slate-500 focus:border-sky-500/50 focus:bg-black/60 focus:ring-1 focus:ring-sky-500/50" />
                      </div>
                    </label>
                    <label className="block">
                      <span className="sr-only">{copy.emailLabel}</span>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input name="workEmail" required type="email" placeholder={copy.emailLabel} className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3.5 pl-11 text-sm font-medium text-white outline-none transition-colors placeholder:text-slate-500 focus:border-sky-500/50 focus:bg-black/60 focus:ring-1 focus:ring-sky-500/50" />
                      </div>
                    </label>
                    <label className="block">
                      <span className="sr-only">Phone</span>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input name="phone" required placeholder="Phone Number" className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3.5 pl-11 text-sm font-medium text-white outline-none transition-colors placeholder:text-slate-500 focus:border-sky-500/50 focus:bg-black/60 focus:ring-1 focus:ring-sky-500/50" />
                      </div>
                    </label>
                    <label className="block">
                      <span className="sr-only">{copy.roleLabel}</span>
                      <div className="relative">
                        <Briefcase className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input name="role" required placeholder={copy.roleLabel} className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3.5 pl-11 text-sm font-medium text-white outline-none transition-colors placeholder:text-slate-500 focus:border-sky-500/50 focus:bg-black/60 focus:ring-1 focus:ring-sky-500/50" />
                      </div>
                    </label>
                    <label className="block">
                      <span className="sr-only">{copy.organizationLabel}</span>
                      <div className="relative">
                        <Building2 className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input name="schoolName" required placeholder={copy.organizationLabel} className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3.5 pl-11 text-sm font-medium text-white outline-none transition-colors placeholder:text-slate-500 focus:border-sky-500/50 focus:bg-black/60 focus:ring-1 focus:ring-sky-500/50" />
                      </div>
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="sr-only">{copy.detailLabel}</span>
                      <div className="relative">
                        <Users className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input name="studentPopulation" required placeholder={copy.detailLabel} className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3.5 pl-11 text-sm font-medium text-white outline-none transition-colors placeholder:text-slate-500 focus:border-sky-500/50 focus:bg-black/60 focus:ring-1 focus:ring-sky-500/50" />
                      </div>
                    </label>
                  </div>
                )}
                <div className="mt-8">
                  <button 
                    disabled={loading || !selectedSlot} 
                    className="btn-inverse w-full justify-center shadow-lg shadow-white/5 disabled:pointer-events-none disabled:opacity-50" 
                    type="submit"
                  >
                    {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CalendarCheck className="mr-2 h-5 w-5" />} Confirm Booking
                  </button>
                </div>
              </form>
            )}

            {/* Notification Toasts */}
            {status && (
              <div className="mt-6 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 animate-in fade-in slide-in-from-bottom-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <p className="text-sm font-medium text-emerald-100">{status}</p>
              </div>
            )}
            {error && (
              <div className="mt-6 flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 animate-in fade-in slide-in-from-bottom-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                <p className="text-sm font-medium text-rose-100">{error}</p>
              </div>
            )}
            
          </div>
        </div>
      </section>
    </main>
  )
}
