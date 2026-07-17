import Link from "next/link"
import { 
  Briefcase,
  Calendar,
  CalendarPlus,
  ChevronRight, 
  ClipboardList, 
  CreditCard,
  Eye, 
  Filter, 
  PhoneCall, 
  Save, 
  Search, 
  Target 
} from "lucide-react"

import { listAvailableCallSlots, listBuildScorecardLeads, type BuildScorecardLead } from "@/lib/admin-build-service"
import { PremiumPicker } from "@/components/PremiumPicker"
import { formatDate } from "@/lib/utils"
import {
  bookBuildScorecardCallAction,
  sendBuildDiscoveryPaymentLinkAction,
  updateBuildScorecardOutcomeAction
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

function money(minor: number, currency: string) {
  const ccy = String(currency || "NGN").toUpperCase()
  if (!minor) return "-"
  try {
    return new Intl.NumberFormat(ccy === "NGN" ? "en-NG" : "en-GB", { style: "currency", currency: ccy }).format(minor / 100)
  } catch {
    return `${ccy} ${(minor / 100).toLocaleString()}`
  }
}

function ScoreBadge({ score }: { score: number }) {
  let colorClass = "border-border bg-muted text-muted-foreground"
  if (score >= 72) colorClass = "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
  else if (score >= 54) colorClass = "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400"
  else if (score >= 36) colorClass = "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
  else colorClass = "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400"

  return (
    <div className={`inline-flex flex-col items-center justify-center rounded-lg border px-3 py-1.5 shadow-sm ${colorClass}`}>
      <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Score</span>
      <span className="font-heading text-lg font-black">{score}<span className="text-xs opacity-60">/100</span></span>
    </div>
  )
}

function PaymentBadge({ status }: { status: string }) {
  const raw = String(status || "").toLowerCase()
  let label = "Not Sent"
  let colorClass = "border-border bg-muted text-muted-foreground"

  if (raw === "paid") {
    label = "Paid"
    colorClass = "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
  } else if (raw === "initiated") {
    label = "Payment Pending"
    colorClass = "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
  }

  return (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest shadow-sm ${colorClass}`}>
      {label}
    </span>
  )
}

function CallBadge({ call }: { call: BuildScorecardLead["call"] }) {
  const status = String(call.status || "not_booked").toLowerCase()
  const isBooked = Boolean(call.bookingUuid)
  const colorClass = isBooked
    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    : "border-border bg-muted text-muted-foreground"
    
  return (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest shadow-sm ${colorClass}`}>
      {status.replace(/_/g, " ")}
    </span>
  )
}

function canSendPaymentLink(row: BuildScorecardLead) {
  const manual = row.bandKey.toLowerCase() === "manual_review" || row.followUpRequired
  return manual && !row.call.bookingUuid && row.discoveryPayment.status !== "paid"
}

function isFollowUpDue(row: BuildScorecardLead) {
  if (!row.call.nextFollowUpAt) return false
  const date = new Date(row.call.nextFollowUpAt)
  return Number.isFinite(date.getTime()) && date.getTime() <= Date.now()
}

function matchesFilter(row: BuildScorecardLead, filter: string, q: string) {
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

function answerList(answers: BuildScorecardLead["answers"]) {
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

export default async function InternalBuildScorecardsPage({ searchParams }: PageProps) {
  const params = await searchParams || {}
  const filter = param(params, "filter", "all")
  const q = param(params, "q", "")
  
  const [leads, slots] = await Promise.all([listBuildScorecardLeads(200), listAvailableCallSlots()])
  const segmentOptions = [
    { value: "all", label: "View All Submissions" },
    { value: "no_call", label: "No Call Booked Yet" },
    { value: "booked", label: "Call Booked" },
    { value: "followup_due", label: "Follow-Up Action Due" },
    { value: "high_score", label: "High Score Qualified" }
  ]
  const outcomeOptions = ["pending", "follow_up", "completed", "won", "lost", "no_show"].map((item) => ({
    value: item,
    label: item.replace(/_/g, " ").toUpperCase()
  }))
  const slotOptions = slots.map((slot) => ({ value: slot.startIso, label: slot.label }))
  const paymentProviderOptions = [
    { value: "paystack", label: "Paystack" },
    { value: "stripe", label: "Stripe" }
  ]
  
  const visible = leads.filter((lead) => matchesFilter(lead, filter, q))
  const paid = leads.filter((lead) => lead.discoveryPayment.status === "paid").length
  const booked = leads.filter((lead) => lead.call.bookingUuid).length

  return (
    <main className="space-y-8 pb-12">
      
      {/* Header & Controls */}
      <div className="flex flex-col gap-6 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow text-primary">Enterprise Pipeline</p>
          <h1 className="mt-1 font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Build Service Scorecards
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Evaluate enterprise readiness, manage manual review logic, issue discovery payment links, and orchestrate technical strategy calls.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <Link href="/internal/build-calls" className="btn-secondary shadow-sm">
            <PhoneCall className="mr-2 h-4 w-4" /> Open Build Calls
          </Link>
        </div>
      </div>

      {/* Primary Pulse Metrics */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Submissions", value: leads.length, icon: ClipboardList, color: "text-primary", bg: "bg-primary/10", border: "hover:border-primary/40" },
          { label: "Filtered Visibility", value: visible.length, icon: Filter, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", border: "hover:border-amber-500/40" },
          { label: "Paid Discovery", value: paid, icon: CreditCard, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", border: "hover:border-emerald-500/40" },
          { label: "Calls Booked", value: booked, icon: Calendar, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10", border: "hover:border-sky-500/40" }
        ].map((stat) => (
          <div key={stat.label} className={`group flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5 ${stat.border}`}>
            <div className="flex items-center justify-between gap-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</p>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${stat.bg} ${stat.color} transition-transform group-hover:scale-110`}>
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-6 font-heading text-3xl font-black text-foreground">{stat.value}</p>
          </div>
        ))}
      </section>

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
              <input name="q" defaultValue={q} placeholder="Search name, enterprise, email, role..." className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary shadow-sm" />
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
                <th className="px-6 py-4">Lead Identity</th>
                <th className="px-6 py-4">Contact Detail</th>
                <th className="px-6 py-4">Qualification Engine</th>
                <th className="px-6 py-4">Discovery Funnel</th>
                <th className="px-6 py-4">Financial Log & Delivery</th>
                <th className="px-6 py-4 text-right">Closer Actions</th>
                <th className="px-6 py-4 text-right">Administrative Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.length ? visible.map((lead) => (
                <tr key={lead.leadUuid} className="align-top transition-colors hover:bg-muted/5">
                  
                  {/* Lead Identity */}
                  <td className="px-6 py-5">
                    <p className="font-heading text-lg font-bold text-foreground">{lead.fullName || "Unknown Name"}</p>
                    <p className="mt-1 font-semibold text-primary">{lead.schoolName || "No Enterprise Provided"}</p>
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
                      Size/URL: {lead.studentPopulation || "Unknown"}
                    </p>
                  </td>
                  
                  {/* Qualification Engine */}
                  <td className="px-6 py-5">
                    <ScoreBadge score={lead.score} />
                    <div className="mt-3 flex flex-col gap-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Assigned Band</p>
                      <p className="font-semibold text-foreground">{lead.bandKey || "Unassigned"}</p>
                    </div>
                    {lead.followUpRequired ? (
                      <p className="mt-2 inline-flex items-center rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">
                        Manual Review
                      </p>
                    ) : (
                      <p className="mt-2 inline-flex items-center rounded border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Automated Path
                      </p>
                    )}
                    <p className="mt-2 max-w-[200px] truncate text-xs italic text-muted-foreground" title={lead.headline || ""}>
                      "{lead.headline || "No summary headline"}"
                    </p>
                  </td>
                  
                  {/* Discovery Funnel (Call Data) */}
                  <td className="px-6 py-5">
                    <CallBadge call={lead.call} />
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
                  
                  {/* Financial Log & Delivery */}
                  <td className="px-6 py-5">
                    <PaymentBadge status={lead.discoveryPayment.status} />
                    <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                      <p>
                        <span className="font-semibold text-foreground">Settle:</span> {money(lead.discoveryPayment.amountMinor, lead.discoveryPayment.provider === "stripe" ? "GBP" : "NGN")}
                      </p>
                      {lead.discoveryPaymentLinkSentAt && (
                        <p>Sent: {formatDate(lead.discoveryPaymentLinkSentAt)}</p>
                      )}
                    </div>
                    <div className="mt-3 border-t border-border pt-2 text-[10px] font-medium text-muted-foreground">
                      <p>Sub: {formatDate(lead.createdAt)}</p>
                      <p className="mt-1">Upd: {formatDate(lead.updatedAt)}</p>
                      <p className="mt-1 max-w-[150px] truncate" title={lead.sourcePath || "/build"}>Src: {lead.sourcePath || "/build"}</p>
                    </div>
                  </td>
                  
                  {/* Closer Actions (Update) */}
                  <td className="px-6 py-5 text-right">
                    {lead.call.bookingUuid ? (
                      <form action={updateBuildScorecardOutcomeAction} className="ml-auto flex w-[280px] flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4 text-left shadow-inner">
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
                  
                  {/* Administrative Actions & Booking */}
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
                            <p><span className="font-semibold">Business:</span> {lead.schoolName || "-"}</p>
                            <p className="mt-0.5"><span className="font-semibold">Payment Auth:</span> {lead.discoveryPayment.status || "Not Processed"}</p>
                          </div>
                          <div className="max-h-[300px] overflow-auto pr-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20">
                            {answerList(lead.answers)}
                          </div>
                        </div>
                      </details>
                      
                      {/* Call Booking Mechanism */}
                      {!lead.call.bookingUuid && lead.discoveryPayment.status === "paid" && (
                        <form action={bookBuildScorecardCallAction} className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-inner">
                          <input type="hidden" name="leadUuid" value={lead.leadUuid} />
                          <p className="mb-3 flex items-center gap-2 font-heading text-sm font-bold text-emerald-700 dark:text-emerald-300">
                            <CalendarPlus className="h-4 w-4" /> Schedule Call (Paid)
                          </p>
                          <PremiumPicker name="slotStartIso" options={slotOptions} className="[&>select]:h-10 [&>select]:text-xs" />
                          <button className="mt-3 w-full rounded-md bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-700" type="submit">
                            Book Discovery Call
                          </button>
                        </form>
                      )}

                      {/* Manual Payment Dispatch */}
                      {canSendPaymentLink(lead) ? (
                        <form action={sendBuildDiscoveryPaymentLinkAction} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-inner">
                          <input type="hidden" name="leadUuid" value={lead.leadUuid} />
                          <p className="mb-3 flex items-center gap-2 font-heading text-sm font-bold text-amber-700 dark:text-amber-300">
                            <CreditCard className="h-4 w-4" /> Request Payment
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input name="country" defaultValue="Nigeria" className="w-full rounded-md border border-amber-500/30 bg-background px-3 py-2 text-xs font-medium outline-none transition-colors focus:border-amber-500 focus:ring-1 focus:ring-amber-500 shadow-sm" />
                            <PremiumPicker name="provider" defaultValue="paystack" options={paymentProviderOptions} className="[&>select]:h-10 [&>select]:text-xs" />
                          </div>
                          <button className="mt-3 w-full rounded-md bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-amber-600" type="submit">
                            {lead.discoveryPayment.status === "initiated" ? "Resend Payment Link" : "Dispatch Payment Link"}
                          </button>
                        </form>
                      ) : lead.call.bookingUuid ? (
                        <Link href="/internal/build-calls" className="btn-secondary w-full justify-center shadow-sm">
                          <PhoneCall className="mr-2 h-4 w-4" /> Go to Calls Dashboard
                        </Link>
                      ) : lead.discoveryPayment.status !== "paid" ? (
                        <div className="rounded-xl border border-border bg-muted/20 p-4 text-center">
                          <p className="text-xs font-semibold text-muted-foreground">Awaiting automated payment capture.</p>
                        </div>
                      ) : null}

                    </div>
                  </td>
                  
                </tr>
              )) : (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center">
                    <div className="mx-auto flex flex-col items-center justify-center">
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <Briefcase className="h-6 w-6" />
                      </div>
                      <h3 className="font-heading text-lg font-bold text-foreground">No Leads Found</h3>
                      <p className="mt-1 text-sm text-muted-foreground">There are no B2B Build Service scorecards matching your current filter criteria.</p>
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
