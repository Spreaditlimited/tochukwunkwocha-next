import { 
  Briefcase, 
  CalendarClock, 
  ChevronRight, 
  CreditCard, 
  Eye, 
  Filter, 
  Globe, 
  MessageSquareText, 
  PhoneCall, 
  Search, 
  Target, 
  UserRound, 
  Video 
} from "lucide-react"

import { prisma } from "@/lib/prisma"
import { formatMinorCurrency } from "@/lib/student-dashboard"
import { formatDate } from "@/lib/utils"

export const dynamic = "force-dynamic"

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type CoachingLeadRow = {
  leadUuid: string
  fullName: string | null
  workEmail: string | null
  phone: string | null
  country: string | null
  goalText: string | null
  experienceLevel: string | null
  availability: string | null
  sourcePath: string | null
  createdAt: Date | null
  updatedAt: Date | null
  paymentUuid: string | null
  paymentStatus: string | null
  paymentType: string | null
  planKey: string | null
  amountMinor: number | bigint | null
  currency: string | null
  paymentProvider: string | null
  paymentReference: string | null
  paidAt: Date | null
  bookingUuid: string | null
  bookingStatus: string | null
  slotStartUtc: Date | null
  zoomJoinUrl: string | null
  outcomeStatus: string | null
  outcomeFeedback: string | null
  nextFollowUpAt: Date | null
}

async function ensurePrivateCoachingTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_private_ai_coaching_leads (
      id BIGINT NOT NULL AUTO_INCREMENT,
      lead_uuid VARCHAR(80) NOT NULL,
      full_name VARCHAR(180) NOT NULL,
      work_email VARCHAR(220) NOT NULL,
      phone VARCHAR(80) NULL,
      country VARCHAR(80) NULL,
      goal_text LONGTEXT NULL,
      experience_level VARCHAR(80) NULL,
      availability VARCHAR(120) NULL,
      source_path VARCHAR(255) NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_private_ai_coaching_lead_uuid (lead_uuid),
      KEY idx_private_ai_coaching_email (work_email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_private_ai_coaching_payments (
      id BIGINT NOT NULL AUTO_INCREMENT,
      payment_uuid VARCHAR(80) NOT NULL,
      lead_uuid VARCHAR(80) NULL,
      work_email VARCHAR(220) NOT NULL,
      full_name VARCHAR(180) NOT NULL,
      payment_type VARCHAR(40) NOT NULL DEFAULT 'discovery',
      plan_key VARCHAR(80) NULL,
      amount_minor INT NOT NULL DEFAULT 0,
      currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
      payment_provider VARCHAR(40) NOT NULL DEFAULT 'paystack',
      payment_reference VARCHAR(180) NOT NULL,
      checkout_url VARCHAR(1200) NULL,
      payment_order_id VARCHAR(180) NULL,
      payment_status VARCHAR(40) NOT NULL DEFAULT 'initiated',
      paid_at DATETIME NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_private_ai_coaching_payment_uuid (payment_uuid),
      UNIQUE KEY uniq_private_ai_coaching_reference (payment_reference)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

async function listCoachingLeads() {
  await ensurePrivateCoachingTables()
  return prisma.$queryRaw<CoachingLeadRow[]>`
    SELECT
      l.lead_uuid AS leadUuid,
      l.full_name AS fullName,
      l.work_email AS workEmail,
      l.phone,
      l.country,
      l.goal_text AS goalText,
      l.experience_level AS experienceLevel,
      l.availability,
      l.source_path AS sourcePath,
      l.created_at AS createdAt,
      l.updated_at AS updatedAt,
      p.payment_uuid AS paymentUuid,
      p.payment_status AS paymentStatus,
      p.payment_type AS paymentType,
      p.plan_key AS planKey,
      p.amount_minor AS amountMinor,
      p.currency,
      p.payment_provider AS paymentProvider,
      p.payment_reference AS paymentReference,
      p.paid_at AS paidAt,
      c.booking_uuid AS bookingUuid,
      c.status AS bookingStatus,
      c.slot_start_utc AS slotStartUtc,
      c.zoom_join_url AS zoomJoinUrl,
      c.call_outcome_status AS outcomeStatus,
      c.outcome_feedback AS outcomeFeedback,
      c.next_follow_up_at AS nextFollowUpAt
    FROM tochukwu_private_ai_coaching_leads l
    LEFT JOIN (
      SELECT p1.*
      FROM tochukwu_private_ai_coaching_payments p1
      INNER JOIN (
        SELECT lead_uuid, MAX(id) AS id
        FROM tochukwu_private_ai_coaching_payments
        WHERE lead_uuid IS NOT NULL AND lead_uuid <> ''
        GROUP BY lead_uuid
      ) latest_payment ON latest_payment.id = p1.id
    ) p ON p.lead_uuid = l.lead_uuid
    LEFT JOIN (
      SELECT c1.*
      FROM school_call_bookings_tochukwu c1
      INNER JOIN (
        SELECT source_lead_uuid, MAX(id) AS id
        FROM school_call_bookings_tochukwu
        WHERE lead_source_type = 'private_ai_coaching'
          AND source_lead_uuid IS NOT NULL
          AND source_lead_uuid <> ''
        GROUP BY source_lead_uuid
      ) latest_booking ON latest_booking.id = c1.id
    ) c ON c.source_lead_uuid = l.lead_uuid
    ORDER BY l.created_at DESC, l.id DESC
    LIMIT 300
  `.catch(() => [])
}

function param(params: Record<string, string | string[] | undefined>, key: string, fallback = "") {
  const value = params[key]
  return Array.isArray(value) ? value[0] || fallback : value || fallback
}

function StatusBadge({ label, state }: { label: string, state: "success" | "pending" | "error" | "neutral" | "info" }) {
  const styles = {
    success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    pending: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    error: "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400",
    info: "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400",
    neutral: "border-border bg-muted text-muted-foreground"
  }
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest shadow-sm ${styles[state]}`}>{label}</span>
}

function PaymentStatusPill(status: string | null) {
  const raw = String(status || "").toLowerCase()
  if (raw === "paid" || raw === "success") return <StatusBadge label="Paid" state="success" />
  if (raw === "initiated" || raw === "pending") return <StatusBadge label="Payment Pending" state="pending" />
  return <StatusBadge label="No Payment" state="neutral" />
}

function BookingStatusPill(status: string | null) {
  const raw = String(status || "").toLowerCase()
  if (raw === "booked" || raw === "rescheduled") return <StatusBadge label={raw} state="success" />
  if (raw === "cancelled" || raw === "failed") return <StatusBadge label={raw} state="error" />
  if (raw === "zoom_failed") return <StatusBadge label="Zoom Sync Failed" state="error" />
  if (raw === "pending") return <StatusBadge label="Pending" state="pending" />
  return <StatusBadge label="No Booking" state="neutral" />
}

function matches(lead: CoachingLeadRow, filter: string, q: string) {
  const paymentStatus = String(lead.paymentStatus || "").toLowerCase()
  const hasBooking = Boolean(lead.bookingUuid)
  if (filter === "paid" && paymentStatus !== "paid") return false
  if (filter === "pending_payment" && paymentStatus !== "initiated") return false
  if (filter === "booked" && !hasBooking) return false
  if (filter === "no_booking" && hasBooking) return false
  
  if (!q) return true
  const haystack = [
    lead.fullName,
    lead.workEmail,
    lead.phone,
    lead.country,
    lead.goalText,
    lead.experienceLevel,
    lead.availability,
    lead.paymentReference
  ].join(" ").toLowerCase()
  
  return haystack.includes(q.toLowerCase())
}

export default async function InternalPrivateCoachingPage({ searchParams }: PageProps) {
  const params = await searchParams || {}
  const filter = param(params, "filter", "all")
  const q = param(params, "q", "")
  
  const leads = await listCoachingLeads()
  const visible = leads.filter((lead) => matches(lead, filter, q))
  const paid = leads.filter((lead) => String(lead.paymentStatus || "").toLowerCase() === "paid").length
  const booked = leads.filter((lead) => lead.bookingUuid).length

  return (
    <main className="space-y-8 pb-12">
      
      {/* Header */}
      <div className="flex flex-col gap-6 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow text-primary">Premium Pipeline</p>
          <h1 className="mt-1 font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Private Coaching Leads
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Monitor incoming coaching applications, review applicant goals, track discovery payments, and manage Zoom strategy sessions.
          </p>
        </div>
      </div>

      {/* Primary Pulse Metrics */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Applications", value: leads.length, icon: Briefcase, color: "text-primary", bg: "bg-primary/10", border: "hover:border-primary/40" },
          { label: "Filtered Visibility", value: visible.length, icon: Filter, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", border: "hover:border-amber-500/40" },
          { label: "Paid Discovery", value: paid, icon: CreditCard, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", border: "hover:border-emerald-500/40" },
          { label: "Calls Booked", value: booked, icon: CalendarClock, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10", border: "hover:border-sky-500/40" }
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
                <Target className="h-3.5 w-3.5 text-primary" /> Funnel Status
              </span>
              <select name="filter" defaultValue={filter} className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-bold outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary shadow-sm">
                <option value="all">View All Applications</option>
                <option value="paid">Payment Successful</option>
                <option value="pending_payment">Payment Pending</option>
                <option value="booked">Discovery Call Booked</option>
                <option value="no_booking">No Call Booked</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <Search className="h-3.5 w-3.5 text-primary" /> Deep Search
              </span>
              <input name="q" defaultValue={q} placeholder="Search name, email, goals, reference..." className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary shadow-sm" />
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
                <th className="px-6 py-4">Applicant Profile</th>
                <th className="px-6 py-4">Contact Info</th>
                <th className="px-6 py-4">Build Context & Goal</th>
                <th className="px-6 py-4">Financial Status</th>
                <th className="px-6 py-4">Strategy Session</th>
                <th className="px-6 py-4">Availability Window</th>
                <th className="px-6 py-4 text-right">Deep Dive Analysis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.length ? visible.map((lead) => (
                <tr key={lead.leadUuid} className="align-top transition-colors hover:bg-muted/5">
                  
                  {/* Applicant Profile */}
                  <td className="px-6 py-5">
                    <p className="flex items-center gap-2 font-heading text-lg font-bold text-foreground">
                      <UserRound className="h-4 w-4 text-muted-foreground" /> {lead.fullName || "Unknown Applicant"}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 font-medium text-muted-foreground">
                      <Globe className="h-3.5 w-3.5" /> {lead.country || "Location not provided"}
                    </p>
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Applied: {formatDate(lead.createdAt)}
                    </p>
                  </td>
                  
                  {/* Contact Info */}
                  <td className="px-6 py-5">
                    <p className="font-medium text-foreground">{lead.workEmail || "No email"}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground pl-1">{lead.phone || "No phone"}</p>
                  </td>
                  
                  {/* Build Context & Goal */}
                  <td className="px-6 py-5">
                    <span className="inline-flex rounded bg-muted/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground shadow-sm">
                      Lvl: {lead.experienceLevel || "Unknown"}
                    </span>
                    <p className="mt-2 max-w-sm truncate text-xs font-medium italic text-muted-foreground" title={lead.goalText || ""}>
                      "{lead.goalText || "No specific goal provided in application"}"
                    </p>
                  </td>
                  
                  {/* Financial Status */}
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-2">
                      <div>{PaymentStatusPill(lead.paymentStatus)}</div>
                      {lead.amountMinor && (
                        <p className="font-heading text-sm font-black text-foreground">
                          {formatMinorCurrency(lead.currency || "NGN", Number(lead.amountMinor))}
                        </p>
                      )}
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {lead.paymentProvider || "Provider N/A"}
                      </p>
                      {lead.paymentReference && (
                        <p className="max-w-[200px] truncate font-mono text-[10px] text-muted-foreground" title={lead.paymentReference}>
                          Ref: {lead.paymentReference}
                        </p>
                      )}
                    </div>
                  </td>
                  
                  {/* Strategy Session */}
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-2.5">
                      <div>{BookingStatusPill(lead.bookingStatus)}</div>
                      {lead.slotStartUtc && (
                        <p className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                          <CalendarClock className="h-3.5 w-3.5 text-primary" /> {formatDate(lead.slotStartUtc)}
                        </p>
                      )}
                      {lead.zoomJoinUrl ? (
                        <a href={lead.zoomJoinUrl} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-1.5 text-xs font-bold text-sky-600 transition-colors hover:bg-sky-500/20 dark:text-sky-400 shadow-sm">
                          <Video className="h-3.5 w-3.5" /> Join Zoom Meeting
                        </a>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">No link provisioned</span>
                      )}
                    </div>
                  </td>
                  
                  {/* Availability Window */}
                  <td className="px-6 py-5">
                    <p className="max-w-[200px] whitespace-pre-wrap text-xs font-medium leading-relaxed text-muted-foreground">
                      {lead.availability || "Not specified by applicant"}
                    </p>
                  </td>
                  
                  {/* Deep Dive Details */}
                  <td className="px-6 py-5 text-right">
                    <details className="group ml-auto w-[360px] rounded-xl border border-border bg-background shadow-sm open:pb-4 text-left">
                      <summary className="flex cursor-pointer items-center justify-between p-4 text-sm font-bold transition-colors hover:text-primary">
                        <span className="flex items-center gap-2">
                          <Eye className="h-4 w-4 text-primary" /> View Analysis Profile
                        </span>
                        <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                      </summary>
                      
                      <div className="mt-1 px-4 space-y-4 max-h-[400px] overflow-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20">
                        
                        <section className="rounded-lg border border-border bg-muted/10 p-4">
                          <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary">
                            <UserRound className="h-3.5 w-3.5" /> Applicant Identity
                          </p>
                          <div className="grid gap-2 text-xs">
                            <p><span className="font-bold text-muted-foreground">Name:</span> <span className="font-medium">{lead.fullName || "-"}</span></p>
                            <p><span className="font-bold text-muted-foreground">Email:</span> <span className="font-medium">{lead.workEmail || "-"}</span></p>
                            <p><span className="font-bold text-muted-foreground">Phone:</span> <span className="font-medium">{lead.phone || "-"}</span></p>
                            <p><span className="font-bold text-muted-foreground">Country:</span> <span className="font-medium">{lead.country || "-"}</span></p>
                            <p><span className="font-bold text-muted-foreground">Level:</span> <span className="font-medium">{lead.experienceLevel || "-"}</span></p>
                          </div>
                        </section>

                        <section className="rounded-lg border border-border bg-muted/10 p-4">
                          <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary">
                            <Target className="h-3.5 w-3.5" /> Strategic Goal & Context
                          </p>
                          <p className="whitespace-pre-wrap text-xs leading-relaxed font-medium text-foreground">
                            {lead.goalText || "No context provided."}
                          </p>
                        </section>

                        <section className="rounded-lg border border-border bg-muted/10 p-4">
                          <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary">
                            <CreditCard className="h-3.5 w-3.5" /> Financial Log
                          </p>
                          <div className="grid gap-2 text-xs">
                            <p className="flex items-center gap-2"><span className="font-bold text-muted-foreground">Status:</span> {PaymentStatusPill(lead.paymentStatus)}</p>
                            <p><span className="font-bold text-muted-foreground">Intent Type:</span> <span className="font-medium capitalize">{lead.paymentType || "-"}</span></p>
                            <p><span className="font-bold text-muted-foreground">SaaS Plan:</span> <span className="font-medium">{lead.planKey || "Standard"}</span></p>
                            <p><span className="font-bold text-muted-foreground">Settled At:</span> <span className="font-medium">{formatDate(lead.paidAt)}</span></p>
                          </div>
                        </section>

                        <section className="rounded-lg border border-border bg-muted/10 p-4">
                          <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary">
                            <PhoneCall className="h-3.5 w-3.5" /> Session Telemetry
                          </p>
                          <div className="grid gap-2 text-xs">
                            <p className="flex items-center gap-2"><span className="font-bold text-muted-foreground">Booking:</span> {BookingStatusPill(lead.bookingStatus)}</p>
                            <p><span className="font-bold text-muted-foreground">Final Outcome:</span> <span className="font-medium capitalize">{lead.outcomeStatus || "Pending"}</span></p>
                            {lead.outcomeFeedback && (
                              <div className="mt-2 rounded border border-border bg-background p-2">
                                <span className="mb-1 block font-bold text-muted-foreground">Closer Feedback:</span>
                                <span className="font-medium text-foreground whitespace-pre-wrap">{lead.outcomeFeedback}</span>
                              </div>
                            )}
                            <p className="mt-1"><span className="font-bold text-muted-foreground">Next Action Date:</span> <span className="font-medium">{formatDate(lead.nextFollowUpAt)}</span></p>
                          </div>
                        </section>
                        
                      </div>
                    </details>
                  </td>
                  
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="mx-auto flex flex-col items-center justify-center">
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <MessageSquareText className="h-6 w-6" />
                      </div>
                      <h3 className="font-heading text-lg font-bold text-foreground">No Leads Found</h3>
                      <p className="mt-1 text-sm text-muted-foreground">There are no private coaching applications matching your current filter criteria.</p>
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