import Link from "next/link"
import { 
  Building2,
  Calendar,
  CalendarPlus, 
  CheckCircle2, 
  ChevronRight, 
  ClipboardList, 
  Eye, 
  Filter, 
  PhoneCall, 
  Save, 
  Search, 
  Target 
} from "lucide-react"

import { listAvailableCallSlots, listSchoolScorecardLeads, type SchoolScorecardLead } from "@/lib/admin-school-scorecards"
import { PremiumPicker } from "@/components/PremiumPicker"
import { DashboardStatCard, DashboardStatsVisibility } from "@/components/dashboard/DashboardStatsVisibility"
import { formatDate } from "@/lib/utils"
import { bookSchoolScorecardCallAction, updateSchoolScorecardOutcomeAction } from "./actions"

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

function scoreBadge(score: number) {
  let colorClass = "border-border bg-muted text-muted-foreground"
  if (score >= 72) colorClass = "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
  else if (score >= 54) colorClass = "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400"
  else if (score >= 36) colorClass = "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
  else colorClass = "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400"

  return (
    <div className={`inline-flex flex-col items-center justify-center rounded-lg border px-3 py-1.5 shadow-sm ${colorClass}`}>
      <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Score</span>
      <span className="font-heading text-lg font-black">{score}<span className="text-xs opacity-60">/90</span></span>
    </div>
  )
}

function isFollowUpDue(row: SchoolScorecardLead) {
  if (!row.call.nextFollowUpAt) return false
  const date = new Date(row.call.nextFollowUpAt)
  return Number.isFinite(date.getTime()) && date.getTime() <= Date.now()
}

function matchesFilter(row: SchoolScorecardLead, filter: string, q: string) {
  if (filter === "no_call" && row.call.bookingUuid) return false
  if (filter === "booked" && !row.call.bookingUuid) return false
  if (filter === "followup_due" && !isFollowUpDue(row)) return false
  if (filter === "high_score" && row.score < 72) return false
  if (q) {
    const haystack = [row.fullName, row.schoolName, row.workEmail, row.phone, row.role].join(" ").toLowerCase()
    if (!haystack.includes(q.toLowerCase())) return false
  }
  return true
}

function answerList(answers: SchoolScorecardLead["answers"]) {
  if (!answers.length) return <p className="text-sm font-semibold text-muted-foreground">No captured answers.</p>
  return (
    <div className="grid gap-3">
      {answers.map((answer, index) => (
        <div key={`${answer.question || "q"}-${index}`} className="rounded-xl border border-border bg-background p-4 shadow-sm">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary">
            Question {index + 1}
          </p>
          <p className="mt-1 font-heading text-sm font-bold text-foreground">{answer.question || "Submitted field"}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{answer.answer || "No response provided"}</p>
          {typeof answer.score !== "undefined" && (
            <p className="mt-3 inline-flex items-center rounded bg-muted/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Score Value: {Number(answer.score || 0)}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

export default async function InternalSchoolScorecardsPage({ searchParams }: PageProps) {
  const params = await searchParams || {}
  const filter = param(params, "filter", "all")
  const q = param(params, "q", "")
  
  const [leads, slots] = await Promise.all([listSchoolScorecardLeads(200), listAvailableCallSlots()])
  const segmentOptions = [
    { value: "all", label: "View All Leads" },
    { value: "no_call", label: "No Call Booked Yet" },
    { value: "booked", label: "Call Booked / Rescheduled" },
    { value: "followup_due", label: "Follow-Up Action Due" },
    { value: "high_score", label: "High Score Qualified (72+)" }
  ]
  const outcomeOptions = ["pending", "completed", "no_show", "won", "lost", "follow_up"].map((item) => ({
    value: item,
    label: item.replace(/_/g, " ").toUpperCase()
  }))
  const slotOptions = slots.map((slot) => ({ value: slot.startIso, label: slot.label }))
  
  const visible = leads.filter((lead) => matchesFilter(lead, filter, q))
  const booked = leads.filter((lead) => lead.call.bookingUuid).length
  const synced = leads.filter((lead) => lead.brevoSynced).length

  return (
    <main className="space-y-8 pb-12">
      
      {/* Header & Controls */}
      <div className="flex flex-col gap-6 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow text-primary">B2B Operations</p>
          <h1 className="mt-1 font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            School Scorecards
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Evaluate B2B readiness scorecards, track closer follow-ups, and manage discovery call bookings for institutional programmes.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <Link href="/internal/schools" className="btn-secondary shadow-sm">
            <Building2 className="mr-2 h-4 w-4" /> School Accounts
          </Link>
          <Link href="/internal/school-calls" className="btn-secondary shadow-sm">
            <PhoneCall className="mr-2 h-4 w-4" /> Sales Calls
          </Link>
        </div>
      </div>

      {/* Primary Pulse Metrics */}
      <DashboardStatsVisibility storageKey="tochukwu-internal-school-scorecards-stats">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Leads", value: leads.length, icon: ClipboardList, color: "text-primary", bg: "bg-primary/10", border: "hover:border-primary/40" },
          { label: "Filtered Visibility", value: visible.length, icon: Filter, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", border: "hover:border-amber-500/40" },
          { label: "Calls Booked", value: booked, icon: Calendar, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", border: "hover:border-emerald-500/40" },
          { label: "CRM Synced", value: synced, icon: CheckCircle2, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10", border: "hover:border-sky-500/40" }
        ].map((stat) => (
          <DashboardStatCard key={stat.label} statKey={stat.label} label={stat.label} value={stat.value}
            icon={<stat.icon className="h-5 w-5" />} iconClassName={`${stat.bg} ${stat.color}`} className={stat.border} />
        ))}
      </section>
      </DashboardStatsVisibility>

      {/* Main Ledger & Filtering */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        
        {/* Filter Console */}
        <div className="border-b border-border bg-muted/20 p-6 sm:p-8">
          <form className="grid gap-4 lg:grid-cols-[260px_1fr_auto] lg:items-end">
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <Target className="h-3.5 w-3.5 text-primary" /> Segment Queue
              </span>
              <PremiumPicker name="filter" defaultValue={filter} options={segmentOptions} />
            </label>
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <Search className="h-3.5 w-3.5 text-primary" /> Global Search
              </span>
              <input name="q" defaultValue={q} placeholder="Search name, institution, email, phone..." className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary shadow-sm" />
            </label>
            <button className="btn-primary h-[42px] w-full justify-center shadow-sm lg:w-auto" type="submit">
              Apply Filters
            </button>
          </form>
        </div>

        {/* Lead Table */}
        <div className="max-h-[800px] overflow-auto bg-background scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20">
          <table className="w-full min-w-[124rem] text-left text-sm whitespace-nowrap">
            <thead className="sticky top-0 z-10 border-b border-border bg-card/90 text-[10px] font-bold uppercase tracking-widest text-muted-foreground backdrop-blur-md">
              <tr>
                <th className="px-6 py-4">Lead Profile</th>
                <th className="px-6 py-4">Contact Detail</th>
                <th className="px-6 py-4">Qualification</th>
                <th className="px-6 py-4">Discovery Call Status</th>
                <th className="px-6 py-4">Delivery & Source</th>
                <th className="px-6 py-4 text-right">Submission Dates</th>
                <th className="px-6 py-4 text-right">Closer Actions</th>
                <th className="px-6 py-4 text-right">Submissions & Booking</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.length ? visible.map((lead) => (
                <tr key={lead.leadUuid} className="align-top transition-colors hover:bg-muted/5">
                  
                  {/* Lead Profile */}
                  <td className="px-6 py-5">
                    <p className="font-heading text-lg font-bold text-foreground">{lead.fullName || "Unknown Name"}</p>
                    <p className="mt-1 font-semibold text-primary">{lead.schoolName || "No Institution"}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="inline-flex rounded bg-muted/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Role</span>
                      {lead.role || "Not specified"}
                    </p>
                  </td>
                  
                  {/* Contact Detail */}
                  <td className="px-6 py-5">
                    <p className="font-medium text-foreground">{lead.workEmail || "-"}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">{lead.phone || "No phone"}</p>
                    <p className="mt-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Pop: {lead.studentPopulation || "Unknown"}
                    </p>
                  </td>
                  
                  {/* Qualification Score */}
                  <td className="px-6 py-5">
                    {scoreBadge(lead.score)}
                    <div className="mt-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Calculated Band</p>
                      <p className="mt-0.5 font-semibold text-foreground">{lead.bandKey || "Unassigned"}</p>
                    </div>
                    <p className="mt-2 max-w-[200px] truncate text-xs italic text-muted-foreground" title={lead.headline || ""}>
                      "{lead.headline || "No summary headline"}"
                    </p>
                  </td>
                  
                  {/* Discovery Call Status */}
                  <td className="px-6 py-5">
                    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest shadow-sm ${
                      lead.call.bookingUuid ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "border-border bg-muted text-muted-foreground"
                    }`}>
                      {lead.call.status || "Not Booked"}
                    </span>
                    <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                      <p><span className="font-semibold text-foreground">Outcome:</span> {lead.call.outcomeStatus || "Pending"}</p>
                      <p><span className="font-semibold text-foreground">Owner:</span> {lead.call.assignedOwner || "Unassigned"}</p>
                      {lead.call.slotStartIso && (
                        <p className="flex items-center gap-1.5 text-primary">
                          <Calendar className="h-3 w-3" /> {formatDate(lead.call.slotStartIso)}
                        </p>
                      )}
                    </div>
                  </td>
                  
                  {/* Delivery & Source */}
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-2 text-xs">
                      <p className="flex items-center justify-between gap-4">
                        <span className="font-medium text-muted-foreground">Meta Pixel</span>
                        <span className={`font-bold ${lead.metaLeadSent ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                          {lead.metaLeadSent ? "Synced" : "Pending"}
                        </span>
                      </p>
                      <p className="flex items-center justify-between gap-4">
                        <span className="font-medium text-muted-foreground">Brevo CRM</span>
                        <span className={`font-bold ${lead.brevoSynced ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                          {lead.brevoSynced ? "Synced" : "Pending"}
                        </span>
                      </p>
                    </div>
                    {lead.brevoError && (
                      <p className="mt-2 max-w-[200px] truncate rounded bg-destructive/10 px-2 py-1 text-[10px] font-medium text-destructive" title={lead.brevoError}>
                        Error: {lead.brevoError}
                      </p>
                    )}
                    <p className="mt-3 max-w-[200px] truncate text-[10px] font-mono text-muted-foreground" title={lead.sourcePath || ""}>
                      {lead.sourcePath || "/courses/prompt-to-profit-schools"}
                    </p>
                  </td>
                  
                  {/* Dates */}
                  <td className="px-6 py-5 text-right text-xs font-medium text-muted-foreground">
                    <p>Submitted: {formatDate(lead.createdAt)}</p>
                    <p className="mt-1">Last Update: {formatDate(lead.updatedAt)}</p>
                  </td>
                  
                  {/* Closer Actions */}
                  <td className="px-6 py-5 text-right">
                    {lead.call.bookingUuid ? (
                      <form action={updateSchoolScorecardOutcomeAction} className="ml-auto flex w-[280px] flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4 text-left shadow-inner">
                        <input type="hidden" name="bookingUuid" value={lead.call.bookingUuid} />
                        
                        <label className="block">
                          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Call Outcome</span>
                          <PremiumPicker name="outcomeStatus" defaultValue={lead.call.outcomeStatus || "pending"} options={outcomeOptions} className="[&>select]:h-10 [&>select]:text-xs" />
                        </label>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <label className="block">
                            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Closer Owner</span>
                            <input name="assignedOwner" defaultValue={lead.call.assignedOwner} placeholder="Admin Name" className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary shadow-sm" />
                          </label>
                          <label className="block">
                            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Follow-Up Date</span>
                            <input name="nextFollowUpAtIso" type="datetime-local" defaultValue={localInputValue(lead.call.nextFollowUpAt)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-[11px] font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary shadow-sm" />
                          </label>
                        </div>
                        
                        <label className="block">
                          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Internal Feedback</span>
                          <textarea name="outcomeFeedback" defaultValue={lead.nextStep || lead.call.outcomeFeedback} rows={2} placeholder="Next steps or call notes..." className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-xs font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary shadow-sm" />
                        </label>
                        
                        <button className="btn-secondary w-full justify-center text-xs shadow-sm" type="submit">
                          <Save className="mr-1.5 h-3.5 w-3.5" /> Save Closer Data
                        </button>
                      </form>
                    ) : (
                      <div className="ml-auto w-[280px] rounded-xl border border-dashed border-border bg-muted/10 p-4 text-center">
                        <PhoneCall className="mx-auto mb-2 h-5 w-5 text-muted-foreground/50" />
                        <p className="text-xs font-semibold text-muted-foreground">A discovery call must be booked before closer outcomes can be tracked.</p>
                      </div>
                    )}
                  </td>
                  
                  {/* Form Submission & Booking Actions */}
                  <td className="px-6 py-5 text-right">
                    <div className="ml-auto flex w-[300px] flex-col gap-4 text-left">
                      
                      {/* Submissions Accordion */}
                      <details className="group rounded-xl border border-border bg-background shadow-sm open:pb-4">
                        <summary className="flex cursor-pointer items-center justify-between p-4 text-sm font-bold transition-colors hover:text-primary">
                          <span className="flex items-center gap-2">
                            <Eye className="h-4 w-4 text-primary" /> View Form Submission
                          </span>
                          <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                        </summary>
                        <div className="mt-2 px-4 space-y-4">
                          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-primary-foreground dark:text-primary">
                            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest opacity-80">Reference Identifiers</p>
                            <p><span className="font-semibold">Institution:</span> {lead.schoolName || "-"}</p>
                            <p className="mt-0.5"><span className="font-semibold">Meta Event ID:</span> {lead.metaEventId || "-"}</p>
                          </div>
                          <div className="max-h-[300px] overflow-auto pr-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20">
                            {answerList(lead.answers)}
                          </div>
                        </div>
                      </details>
                      
                      {/* Booking Form or Link */}
                      {!lead.call.bookingUuid ? (
                        <form action={bookSchoolScorecardCallAction} className="rounded-xl border border-border bg-muted/20 p-4 shadow-inner">
                          <input type="hidden" name="leadUuid" value={lead.leadUuid} />
                          <p className="mb-3 flex items-center gap-2 font-heading text-sm font-bold text-foreground">
                            <CalendarPlus className="h-4 w-4 text-primary" /> Manual Booking
                          </p>
                          <PremiumPicker name="slotStartIso" options={slotOptions} className="[&>select]:h-10 [&>select]:text-xs" />
                          <button className="btn-primary mt-3 w-full justify-center text-xs shadow-sm" type="submit">
                            Book Discovery Call
                          </button>
                        </form>
                      ) : (
                        <Link href="/internal/school-calls" className="btn-secondary w-full justify-center shadow-sm">
                          <PhoneCall className="mr-2 h-4 w-4" /> Go to Calls Dashboard
                        </Link>
                      )}
                    </div>
                  </td>
                  
                </tr>
              )) : (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center">
                    <div className="mx-auto flex flex-col items-center justify-center">
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <ClipboardList className="h-6 w-6" />
                      </div>
                      <h3 className="font-heading text-lg font-bold text-foreground">No Leads Found</h3>
                      <p className="mt-1 text-sm text-muted-foreground">There are no B2B school scorecards matching your current filter criteria.</p>
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
