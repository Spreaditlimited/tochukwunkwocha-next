import Link from "next/link"
import { 
  Building2,
  Calendar,
  CalendarClock, 
  CheckCircle2, 
  ClipboardList, 
  Clock, 
  ExternalLink, 
  Mail,
  RotateCcw, 
  Save, 
  ShieldCheck, 
  User, 
  Video, 
  XCircle 
} from "lucide-react"

import { listAvailableCallSlots, listSchoolCalls } from "@/lib/admin-school-calls"
import { PremiumPicker } from "@/components/PremiumPicker"
import { formatDate } from "@/lib/utils"
import {
  cancelSchoolCallAction,
  resendSchoolCallNotificationsAction,
  rescheduleSchoolCallAction,
  updateSchoolCallOutcomeAction
} from "./actions"

export const dynamic = "force-dynamic"

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function param(params: Record<string, string | string[] | undefined>, key: string, fallback = "") {
  const value = params[key]
  return Array.isArray(value) ? value[0] || fallback : value || fallback
}

function localInputValue(iso: string) {
  if (!iso) return ""
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return ""
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function StatusPill({ status }: { status: string }) {
  const raw = String(status || "unknown").toLowerCase()
  let colorClass = "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
  
  if (raw === "booked" || raw === "rescheduled") {
    colorClass = "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
  } else if (raw === "cancelled") {
    colorClass = "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400"
  }

  return (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest shadow-sm ${colorClass}`}>
      {raw}
    </span>
  )
}

function OutcomePill({ outcome }: { outcome: string | null }) {
  const raw = String(outcome || "pending").toLowerCase()
  let colorClass = "bg-muted text-muted-foreground"
  if (raw === "won" || raw === "completed") colorClass = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
  if (raw === "lost" || raw === "no_show") colorClass = "bg-rose-500/10 text-rose-600 dark:text-rose-400"
  if (raw === "follow_up") colorClass = "bg-sky-500/10 text-sky-600 dark:text-sky-400"

  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${colorClass}`}>
      {raw.replace(/_/g, " ")}
    </span>
  )
}

export default async function InternalSchoolCallsPage({ searchParams }: PageProps) {
  const params = await searchParams || {}
  const tab = param(params, "tab", "upcoming") === "past" ? "past" : "upcoming"
  
  const [calls, slots] = await Promise.all([listSchoolCalls(), listAvailableCallSlots()])
  const now = Date.now()
  const lookbackOptions = [
    { value: "24", label: "Last 24 hours" },
    { value: "72", label: "Last 72 hours" },
    { value: "168", label: "Last 7 days" }
  ]
  const outcomeOptions = ["pending", "completed", "no_show", "won", "lost", "follow_up"].map((item) => ({
    value: item,
    label: item.replace(/_/g, " ").toUpperCase()
  }))
  const slotOptions = slots.map((slot) => ({ value: slot.startIso, label: slot.label }))
  
  const visible = calls
    .filter((call) => {
      const ms = call.slotStartIso ? new Date(call.slotStartIso).getTime() : 0
      return tab === "past" ? ms > 0 && ms < now : !ms || ms >= now
    })
    .sort((a, b) => {
      const aMs = a.slotStartIso ? new Date(a.slotStartIso).getTime() : 0
      const bMs = b.slotStartIso ? new Date(b.slotStartIso).getTime() : 0
      return tab === "past" ? bMs - aMs : aMs - bMs
    })

  return (
    <main className="space-y-8 pb-12">
      
      {/* Header & Controls */}
      <div className="flex flex-col gap-6 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow text-primary">B2B Operations</p>
          <h1 className="mt-1 font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Discovery Calls
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Manage school onboarding meetings, track closer outcomes, handle reschedules, and orchestrate follow-up sequences.
          </p>
        </div>
        
        {/* Quick Links & Utilities */}
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <form action={resendSchoolCallNotificationsAction} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-2 sm:flex-row sm:items-center shadow-sm">
            <PremiumPicker name="lookbackHours" defaultValue="72" options={lookbackOptions} className="sm:w-44 [&>select]:h-9 [&>select]:text-xs" />
            <button className="btn-secondary h-9 justify-center px-4 py-0 text-xs shadow-sm" type="submit">
              <Mail className="mr-2 h-3.5 w-3.5" /> Force Resend Emails
            </button>
          </form>
          
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link href="/internal/schools" className="btn-secondary h-10 shadow-sm">
              <Building2 className="mr-2 h-4 w-4" /> Schools
            </Link>
            <Link href="/internal/school-scorecards" className="btn-secondary h-10 shadow-sm">
              <ClipboardList className="mr-2 h-4 w-4" /> Scorecards
            </Link>
          </div>
        </div>
      </div>

      {/* Main Ledger Section */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        
        {/* Ledger Header & Segmented Tabs */}
        <div className="flex flex-col justify-between gap-4 border-b border-border bg-muted/20 p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-heading text-xl font-black text-foreground">Call Schedule</h2>
              <p className="mt-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">{visible.length} appointments</p>
            </div>
          </div>
          
          {/* Segmented Controls */}
          <div className="flex shrink-0 overflow-hidden rounded-lg border border-border bg-background p-1 shadow-sm">
            <Link 
              href="/internal/school-calls?tab=upcoming" 
              className={`inline-flex items-center justify-center rounded-md px-5 py-2 text-xs font-bold transition-all ${
                tab === "upcoming" 
                  ? "bg-primary text-primary-foreground shadow" 
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              Upcoming Calls
            </Link>
            <Link 
              href="/internal/school-calls?tab=past" 
              className={`inline-flex items-center justify-center rounded-md px-5 py-2 text-xs font-bold transition-all ${
                tab === "past" 
                  ? "bg-primary text-primary-foreground shadow" 
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              Past Calls
            </Link>
          </div>
        </div>

        {/* Data Table */}
        <div className="max-h-[800px] overflow-auto bg-background scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20">
          <table className="w-full min-w-[112rem] text-left text-sm whitespace-nowrap">
            <thead className="sticky top-0 z-10 border-b border-border bg-card/90 text-[10px] font-bold uppercase tracking-widest text-muted-foreground backdrop-blur-md">
              <tr>
                <th className="px-6 py-4">Institution Context</th>
                <th className="px-6 py-4">Contact Profile</th>
                <th className="px-6 py-4">Schedule Slot</th>
                <th className="px-6 py-4">Closer Intel</th>
                <th className="px-6 py-4">Booking Status</th>
                <th className="px-6 py-4 text-right">Administrative Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.length ? visible.map((call) => (
                <tr key={call.bookingUuid} className="align-top transition-colors hover:bg-muted/5">
                  
                  {/* Institution Context */}
                  <td className="px-6 py-6">
                    <p className="font-heading text-lg font-black text-foreground">{call.schoolName || "Unnamed School"}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <span className="inline-flex rounded bg-muted/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Est. Pop</span>
                      {call.studentPopulation || "-"} Students
                    </p>
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Lead Captured: {formatDate(call.createdAt)}
                    </p>
                  </td>
                  
                  {/* Contact Profile */}
                  <td className="px-6 py-6">
                    <p className="flex items-center gap-1.5 font-bold text-foreground">
                      <User className="h-4 w-4 text-muted-foreground" /> {call.fullName || "Unknown Contact"}
                    </p>
                    <p className="mt-1 text-xs font-medium text-muted-foreground pl-5">{call.workEmail || "-"}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground pl-5">{call.phone || "-"}</p>
                    <p className="mt-2 inline-flex items-center rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                      {call.role || "Role unspecified"}
                    </p>
                  </td>
                  
                  {/* Schedule Slot */}
                  <td className="px-6 py-6">
                    <p className="flex items-center gap-1.5 font-bold text-foreground">
                      <Calendar className="h-4 w-4 text-primary" /> {formatDate(call.slotStartIso)}
                    </p>
                    <p className="mt-1 pl-5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      WAT Time Window
                    </p>
                    <p className="mt-0.5 pl-5 text-xs text-muted-foreground">
                      {formatDate(call.slotStartIso)} — {formatDate(call.slotEndIso)}
                    </p>
                    {call.zoomJoinUrl ? (
                      <div className="mt-3 pl-5">
                        <a className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-1.5 text-xs font-bold text-sky-600 transition-colors hover:bg-sky-500/20 dark:text-sky-400" href={call.zoomJoinUrl} target="_blank" rel="noreferrer">
                          <Video className="h-3.5 w-3.5" /> Join Zoom Meeting <ExternalLink className="h-3 w-3 opacity-70" />
                        </a>
                      </div>
                    ) : (
                      <p className="mt-3 pl-5 text-xs italic text-muted-foreground">No Zoom link generated.</p>
                    )}
                  </td>
                  
                  {/* Closer Intel */}
                  <td className="px-6 py-6">
                    <div className="flex items-center gap-2 mb-2">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                      <span className="font-bold text-foreground">{call.assignedOwner || "Unassigned"}</span>
                    </div>
                    <div className="pl-6 space-y-2 text-xs">
                      <div>
                        <OutcomePill outcome={call.callOutcomeStatus} />
                      </div>
                      {call.nextFollowUpAt && (
                        <p className="flex items-center gap-1.5 text-primary font-medium">
                          <Clock className="h-3 w-3" /> Follow-Up: {formatDate(call.nextFollowUpAt)}
                        </p>
                      )}
                      {call.outcomeFeedback && (
                        <div className="mt-2 max-w-[200px] whitespace-pre-wrap rounded-lg border border-border bg-muted/20 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
                          {call.outcomeFeedback}
                        </div>
                      )}
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground pt-1">
                        Updated By: {call.outcomeUpdatedBy || "System"}
                      </p>
                    </div>
                  </td>
                  
                  {/* Booking Status */}
                  <td className="px-6 py-6">
                    <StatusPill status={call.status} />
                  </td>
                  
                  {/* Administrative Actions */}
                  <td className="px-6 py-6 text-right">
                    <div className="ml-auto flex w-[300px] flex-col gap-4 text-left">
                      
                      {/* Save Closer Outcome Form */}
                      <form action={updateSchoolCallOutcomeAction} className="rounded-xl border border-border bg-card p-4 shadow-inner">
                        <input type="hidden" name="bookingUuid" value={call.bookingUuid} />
                        <p className="mb-3 flex items-center gap-2 font-heading text-sm font-bold text-foreground">
                          <CheckCircle2 className="h-4 w-4 text-primary" /> Log Discovery Outcome
                        </p>
                        
                        <div className="grid gap-3">
                          <PremiumPicker name="outcomeStatus" defaultValue={call.callOutcomeStatus || "pending"} options={outcomeOptions} className="[&>select]:h-10 [&>select]:text-xs" />
                          
                          <div className="grid grid-cols-2 gap-2">
                            <input name="assignedOwner" defaultValue={call.assignedOwner} placeholder="Admin Owner" className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary shadow-sm" />
                            <input name="nextFollowUpAtIso" type="datetime-local" defaultValue={localInputValue(call.nextFollowUpAt)} className="w-full rounded-md border border-input bg-background px-2 py-2 text-[10px] font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary shadow-sm" />
                          </div>
                          
                          <textarea name="outcomeFeedback" defaultValue={call.outcomeFeedback} rows={2} placeholder="Feedback / Next steps..." className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-xs font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary shadow-sm" />
                          
                          <button className="btn-primary w-full justify-center py-2 text-xs shadow-sm" type="submit">
                            <Save className="mr-1.5 h-3.5 w-3.5" /> Save Closer Intel
                          </button>
                        </div>
                      </form>
                      
                      <div className="grid grid-cols-2 gap-3">
                        {/* Reschedule Block */}
                        <details className="group rounded-xl border border-amber-500/20 bg-amber-500/5">
                          <summary className="flex cursor-pointer items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-bold text-amber-700 transition-colors hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200">
                            <RotateCcw className="h-3.5 w-3.5" /> Reschedule
                          </summary>
                          <div className="border-t border-amber-500/20 p-3">
                            <form action={rescheduleSchoolCallAction} className="grid gap-2">
                              <input type="hidden" name="bookingUuid" value={call.bookingUuid} />
                              <PremiumPicker name="slotStartIso" options={slotOptions} className="[&>select]:h-10 [&>select]:text-xs" />
                              <input name="note" defaultValue="Rescheduled by admin" className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-[10px] font-medium outline-none shadow-sm" />
                              <button className="inline-flex w-full items-center justify-center rounded bg-amber-500 px-3 py-1.5 text-[10px] font-bold text-white shadow-sm transition-colors hover:bg-amber-600" type="submit">
                                Confirm
                              </button>
                            </form>
                          </div>
                        </details>
                        
                        {/* Cancel Block */}
                        <details className="group rounded-xl border border-rose-500/20 bg-rose-500/5">
                          <summary className="flex cursor-pointer items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-bold text-rose-700 transition-colors hover:text-rose-800 dark:text-rose-300 dark:hover:text-rose-200">
                            <XCircle className="h-3.5 w-3.5" /> Cancel
                          </summary>
                          <div className="border-t border-rose-500/20 p-3">
                            <form action={cancelSchoolCallAction} className="grid gap-2">
                              <input type="hidden" name="bookingUuid" value={call.bookingUuid} />
                              <input name="note" defaultValue="Cancelled by admin" className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-[10px] font-medium outline-none shadow-sm" />
                              <button className="inline-flex w-full items-center justify-center rounded bg-rose-500 px-3 py-1.5 text-[10px] font-bold text-white shadow-sm transition-colors hover:bg-rose-600" type="submit">
                                Confirm Cancel
                              </button>
                            </form>
                          </div>
                        </details>
                      </div>
                      
                    </div>
                  </td>
                  
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="mx-auto flex flex-col items-center justify-center">
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <CalendarClock className="h-6 w-6" />
                      </div>
                      <h3 className="font-heading text-lg font-bold text-foreground">No Calls Scheduled</h3>
                      <p className="mt-1 text-sm text-muted-foreground">There are no {tab} discovery calls matching your criteria.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      
    </main>
  )
}
