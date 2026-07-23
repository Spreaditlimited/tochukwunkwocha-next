import Link from "next/link"
import { 
  CheckCircle2, 
  CreditCard, 
  ExternalLink, 
  Filter, 
  Mail, 
  MessageCircle, 
  MonitorPlay, 
  RefreshCw, 
  Send, 
  ShieldAlert, 
  Trash2, 
  UserPlus, 
  Users, 
  XCircle 
} from "lucide-react"

import { PremiumPicker } from "@/components/PremiumPicker"
import { TrademarkText } from "@/components/TrademarkText"
import { ScrollPreservingGetForm } from "@/components/internal/ScrollPreservingGetForm"
import {
  enrollmentDashboardSummary,
  enrollmentSummary,
  listLatestOnboardingEmailFailures,
  listEnrollmentBatches,
  listEnrollmentCourses,
  listEnrollmentPayments,
  listHolidayWaitlistContacts,
  listWhatsAppCampaigns,
  listWhatsAppMarketingContacts
} from "@/lib/admin-enrollments"
import { formatMinorCurrency } from "@/lib/student-dashboard"
import { formatDate } from "@/lib/utils"
import {
  addExternalStudentPaymentAction,
  completeManualPaymentRecoveryAction,
  deleteHolidayWaitlistContactAction,
  reconcilePaystackPaymentsAction,
  resendBatchActivationEmailsAction,
  resendManualPaymentActivationEmailAction,
  reviewManualPaymentAction,
  sendManualPaymentMetaPurchaseAction,
  sendWhatsAppCampaignAction,
  updateManualPaymentEmailAction
} from "./actions"

export const dynamic = "force-dynamic"

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function param(params: Record<string, string | string[] | undefined>, key: string, fallback = "") {
  const value = params[key]
  return Array.isArray(value) ? value[0] || fallback : value || fallback
}

function statusTone(status: string | null) {
  const raw = String(status || "").toLowerCase()
  if (raw === "approved" || raw === "paid") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
  if (raw === "rejected") return "border-destructive/20 bg-destructive/10 text-destructive"
  return "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
}

function statusLabel(status: string | null) {
  const raw = String(status || "pending_verification")
  if (raw === "pending_verification") return "Pending"
  return raw.replace(/_/g, " ")
}

function metaDispatchTone(status: string, sent: boolean) {
  if (sent || status === "sent") return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
  if (status === "failed") return "bg-red-500/10 text-red-600 dark:text-red-400"
  if (status === "sending") return "bg-sky-500/10 text-sky-600 dark:text-sky-400"
  return "bg-amber-500/10 text-amber-600 dark:text-amber-400"
}

function metaDispatchLabel(status: string, sent: boolean) {
  if (sent || status === "sent") return "Dispatched"
  if (status === "failed") return "Failed"
  if (status === "sending") return "Sending"
  return "Pending"
}

function formatTotalsByCurrency(totals: Record<string, number>) {
  const entries = Object.entries(totals)
    .filter(([, amount]) => amount > 0)
    .sort(([left], [right]) => left.localeCompare(right))
  if (!entries.length) return "--"
  return entries.map(([currency, amount]) => formatMinorCurrency(currency, amount)).join(" + ")
}

export default async function ManualPaymentsPage({ searchParams }: PageProps) {
  const params = await searchParams || {}
  const courseSlug = param(params, "course", "all")
  const status = param(params, "status", "all")
  const batchKey = param(params, "batch", "all")
  const search = param(params, "q", "")
  const waCourse = param(params, "waCourse", courseSlug === "all" ? "all" : courseSlug)
  const waSearch = param(params, "waSearch", "")
  const summaryCourseSlug = param(params, "summaryCourse", courseSlug || "all")
  const summaryBatchKey = summaryCourseSlug === "all" ? "all" : param(params, "summaryBatch", batchKey || "all")

  const [courses, allBatches, summaryBatches, payments, globalSummary, dashboardSummary, waitlist, whatsAppContacts, whatsAppCampaigns, onboardingFailures] = await Promise.all([
    listEnrollmentCourses(),
    listEnrollmentBatches(courseSlug === "all" ? undefined : courseSlug),
    summaryCourseSlug === "all" ? Promise.resolve([]) : listEnrollmentBatches(summaryCourseSlug),
    listEnrollmentPayments({ courseSlug, status, batchKey, search, limit: 150 }),
    enrollmentSummary("all", "all"),
    enrollmentDashboardSummary(summaryCourseSlug, summaryBatchKey),
    listHolidayWaitlistContacts(160),
    listWhatsAppMarketingContacts({ courseSlug: waCourse, opted: "in", search: waSearch, limit: 160 }),
    listWhatsAppCampaigns(12),
    listLatestOnboardingEmailFailures({ courseSlug, batchKey, limit: 20 }).catch(() => [])
  ])
  
  const selectedCourse = courses.find((course) => course.slug === courseSlug)
  const selectedCourseMode = selectedCourse?.enrollmentMode || "batch"
  const batchesForSelected = allBatches.filter((batch) => courseSlug === "all" || batch.courseSlug === courseSlug)
  
  const pendingCount = (globalSummary.find((item) => item.status === "pending_verification")?.students || 0)
    + (globalSummary.find((item) => item.status === "recovery_required")?.students || 0)
  const approvedCount = globalSummary.find((item) => item.status === "approved")?.students || 0
  const rejectedCount = globalSummary.find((item) => item.status === "rejected")?.students || 0
  const approvedTotal = globalSummary.find((item) => item.status === "approved")?.totalMinor || 0
  const dashboardProviders = dashboardSummary.providerCounts
  const dashboardTotal = formatTotalsByCurrency(dashboardSummary.totalsByCurrency)
  const courseOptions = courses.map((course) => ({ value: course.slug, label: course.label }))
  const courseOptionsWithAll = [{ value: "all", label: "All Programmes" }, ...courseOptions]
  const summaryCourseOptions = [{ value: "all", label: "All courses" }, ...courseOptions]
  const summaryBatchOptions = [
    { value: "all", label: "All batches" },
    ...summaryBatches.map((batch) => ({
      key: `summary-${batch.courseSlug}-${batch.batchKey}`,
      value: batch.batchKey,
      label: batch.batchLabel
    }))
  ]
  const externalBatchOptions = [
    { value: "", label: "Default batch / Immediate access" },
    ...allBatches.map((batch) => ({
      key: `external-${batch.courseSlug}-${batch.batchKey}`,
      value: batch.batchKey,
      label: `${batch.courseSlug} / ${batch.batchLabel}`
    }))
  ]
  const ledgerBatchOptions = [
    { value: "all", label: selectedCourseMode === "immediate" ? "Immediate Access (N/A)" : "All Batches" },
    ...batchesForSelected.map((batch) => ({
      key: `ledger-${batch.courseSlug}-${batch.batchKey}`,
      value: batch.batchKey,
      label: batch.batchLabel
    }))
  ]
  const activationBatchOptions = batchesForSelected
    .filter((batch) => batch.batchKey)
    .map((batch) => ({
      key: `activation-${batch.courseSlug}-${batch.batchKey}`,
      value: batch.batchKey,
      label: batch.batchLabel
    }))
  const activationDefaultBatch = batchKey !== "all" ? batchKey : activationBatchOptions[0]?.value || ""
  const activationDefaultSubject = activationDefaultBatch
    ? `Important: New Password Reset Link for ${activationBatchOptions.find((batch) => batch.value === activationDefaultBatch)?.label || activationDefaultBatch}`
    : "Important: New Password Reset Link"
  const activationDefaultMessage = [
    "Hello {{first_name}},",
    "",
    "Here is your secure dashboard access link:",
    "{{reset_link}}",
    "",
    "Use this link to set or reset your password and access your learning dashboard.",
    "",
    "Tochukwu Tech and AI Academy"
  ].join("\n")

  return (
    <main className="flex flex-col gap-8 pb-12">
      
      {/* Header & Actions */}
      <div className="flex flex-col gap-6 border-b border-border pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="eyebrow text-primary">Enrollments</p>
          <h1 className="mt-1 font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Manual Payments & Operations
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Review bank-transfer proofs, manage enrollment status, add external students, correct attribution details, and orchestrate WhatsApp campaigns.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <form action={reconcilePaystackPaymentsAction}>
            <input type="hidden" name="courseSlug" value={courseSlug} />
            <input type="hidden" name="batchKey" value={batchKey} />
            <button type="submit" className="btn-primary shadow-sm">
              <RefreshCw className="mr-2 h-4 w-4" /> Reconcile Paystack
            </button>
          </form>
          <Link href="/internal/video-library" className="btn-secondary shadow-sm">
            <MonitorPlay className="mr-2 h-4 w-4" /> Course Manager
          </Link>
        </div>
      </div>

      {/* Enrollment Summary */}
      <section className="order-[-1] overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-t-4 border-primary p-6 sm:p-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="eyebrow text-primary">Filtered Summary</p>
              <h2 className="mt-1 font-heading text-xl font-black text-foreground">
                {dashboardSummary.courseName} - {dashboardSummary.batchLabel}
              </h2>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                Registration: {dashboardSummary.registrationStatus}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                The figures below reflect only the course and batch selected here.
              </p>
            </div>
            <ScrollPreservingGetForm className="grid gap-3 sm:grid-cols-[minmax(12rem,auto)_minmax(12rem,auto)_auto] sm:items-end">
              <input type="hidden" name="course" value={courseSlug} />
              <input type="hidden" name="status" value={status} />
              <input type="hidden" name="batch" value={batchKey} />
              <input type="hidden" name="q" value={search} />
              <input type="hidden" name="waCourse" value={waCourse} />
              <input type="hidden" name="waSearch" value={waSearch} />
              {summaryCourseSlug === "all" ? <input type="hidden" name="summaryBatch" value="all" /> : null}
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Course</span>
                <PremiumPicker name="summaryCourse" defaultValue={summaryCourseSlug} options={summaryCourseOptions} className="sm:w-64" />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Batch</span>
                <PremiumPicker name="summaryBatch" defaultValue={summaryBatchKey} disabled={summaryCourseSlug === "all"} options={summaryBatchOptions} className="sm:w-64" />
              </label>
              <button type="submit" className="btn-secondary justify-center shadow-sm">Update Summary</button>
            </ScrollPreservingGetForm>
          </div>

          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="inline-flex w-fit items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-sm font-bold text-amber-700 dark:text-amber-300">
              Pending manual approvals: {dashboardSummary.manualPendingCount}
            </p>
            <p className="text-sm font-semibold text-muted-foreground">
              Registered payment records: {dashboardSummary.totalRegistrations}
            </p>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-xl border border-border bg-muted/20 px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Course Name</p>
              <p className="mt-2 truncate text-lg font-black text-foreground">{dashboardSummary.courseName} ({dashboardSummary.batchLabel})</p>
            </article>
            <article className="rounded-xl border border-border bg-muted/20 px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Number of Payments</p>
              <p className="mt-2 text-lg font-black text-foreground">{dashboardSummary.totalPayments}</p>
            </article>
            <article className="rounded-xl border border-border bg-muted/20 px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Actual Enrollments</p>
              <p className="mt-2 text-lg font-black text-foreground">{dashboardSummary.actualEnrollments}</p>
            </article>
            <article className="rounded-xl border border-border bg-muted/20 px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Amount</p>
              <p className="mt-2 text-lg font-black text-emerald-600 dark:text-emerald-400">{dashboardTotal}</p>
            </article>
          </div>

          <div className="mt-4 rounded-xl border border-border bg-background px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Payment Sources</p>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-foreground">
              Manual: {dashboardProviders.manual}, Paystack: {dashboardProviders.paystack}, Stripe: {dashboardProviders.stripe}, PayPal: {dashboardProviders.paypal}, Other: {dashboardProviders.other} | Payments: {dashboardSummary.totalPayments} | Actual enrollments: {dashboardSummary.actualEnrollments}
            </p>
          </div>
        </div>
      </section>

      {/* Global statistics are intentionally independent of every page filter. */}
      <section className="order-first">
        <div className="mb-4">
          <p className="eyebrow text-primary">Global Statistics</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">All courses and all batches. These figures never change with the filters below.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pending Review</p>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400"><RefreshCw className="h-5 w-5" /></div>
          </div>
          <p className="mt-6 font-heading text-3xl font-black text-foreground">{pendingCount}</p>
        </div>
        <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Paid / Approved Seats</p>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-5 w-5" /></div>
          </div>
          <p className="mt-6 font-heading text-3xl font-black text-foreground">{approvedCount}</p>
        </div>
        <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-destructive/40 hover:shadow-lg hover:shadow-destructive/5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Rejected</p>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive"><XCircle className="h-5 w-5" /></div>
          </div>
          <p className="mt-6 font-heading text-3xl font-black text-foreground">{rejectedCount}</p>
        </div>
        <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Approved Revenue</p>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><CreditCard className="h-5 w-5" /></div>
          </div>
          <p className="mt-6 min-w-0 break-words font-heading text-2xl font-black leading-tight text-foreground sm:text-3xl lg:text-[clamp(1.25rem,1.7vw,1.875rem)]">
            {formatMinorCurrency("NGN", approvedTotal)}
          </p>
        </div>
        </div>
      </section>

      {/* Add External Student Module */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-muted/20 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-heading text-xl font-black text-foreground">Add External Student</h2>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                Provision access for verified offline payments. The system generates an approved payment and automatically grants dashboard access.
              </p>
            </div>
          </div>
        </div>
        
        <form action={addExternalStudentPaymentAction} className="p-6 sm:p-8">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Programme</span>
              <PremiumPicker name="courseSlug" defaultValue={courseSlug === "all" ? "prompt-to-profit" : courseSlug} options={courseOptions} />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Batch Allocation</span>
              <PremiumPicker name="batchKey" options={externalBatchOptions} />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Full Name</span>
              <input name="firstName" placeholder="Learner's full name" className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Email Address</span>
              <input name="email" type="email" placeholder="student@example.com" className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Phone Number</span>
              <input name="phone" placeholder="+234..." className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Country</span>
              <input name="country" defaultValue="Nigeria" placeholder="Nigeria" className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Buyer Type</span>
              <PremiumPicker
                name="buyerType"
                defaultValue="student"
                options={[
                  { value: "student", label: "Single Learner" },
                  { value: "family", label: "Family / Group" }
                ]}
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Seats</span>
              <input name="seatCount" type="number" min="1" step="1" defaultValue="1" placeholder="1" className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Coupon Code</span>
              <input name="couponCode" placeholder="Optional" className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm font-medium uppercase outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Bank Reference</span>
              <input name="transferReference" placeholder="e.g. TXN-123456" className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Proof URL</span>
              <input name="proofUrl" placeholder="Optional" className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Proof Public ID</span>
              <input name="proofPublicId" placeholder="Optional Cloudinary ID" className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
            </label>
            <label className="block xl:col-span-3">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Admin Note</span>
              <textarea name="adminNote" rows={2} placeholder="Optional internal notes" className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
            </label>
            <div className="flex items-end justify-end">
              <button className="btn-primary w-full shadow-sm xl:w-auto" type="submit" data-toast="Provisioning access">
                <UserPlus className="mr-2 h-4 w-4" /> Provision Access
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* Activation Email Resend */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-muted/20 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-heading text-xl font-black text-foreground">Activation Email Resend</h2>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                Resend dashboard access and password reset links to an approved batch. Tags match the legacy static workflow.
              </p>
            </div>
          </div>
        </div>
        <form action={resendBatchActivationEmailsAction} className="p-6 sm:p-8">
          <div className="grid gap-5 lg:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Course</span>
              <PremiumPicker name="courseSlug" defaultValue={courseSlug === "all" ? courseOptions[0]?.value || "" : courseSlug} options={courseOptions} />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Batch</span>
              <PremiumPicker name="batchKey" defaultValue={activationDefaultBatch} options={activationBatchOptions.length ? activationBatchOptions : [{ value: "", label: "Select a batch" }]} />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Email Subject</span>
              <input name="subject" defaultValue={activationDefaultSubject} className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Send Limit</span>
              <input name="limit" type="number" min="1" max="1000" defaultValue="500" className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
            </label>
            <label className="block lg:col-span-2">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Message</span>
              <textarea name="messageTemplate" rows={8} defaultValue={activationDefaultMessage} className="w-full rounded-xl border border-input bg-background/50 px-4 py-3 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
              <span className="mt-2 block text-xs font-medium text-muted-foreground">
                Tags: {"{{first_name}}"}, {"{{full_name}}"}, {"{{email}}"}, {"{{reset_link}}"}, {"{{batch_label}}"}, {"{{course_slug}}"}, {"{{temp_password}}"}
              </span>
            </label>
            <div className="flex justify-end lg:col-span-2">
              <button className="btn-primary w-full justify-center shadow-sm sm:w-auto" type="submit">
                <Mail className="mr-2 h-4 w-4" /> Send To Batch
              </button>
            </div>
          </div>
        </form>
        {onboardingFailures.length ? (
          <div className="border-t border-border bg-background p-6 sm:p-8">
            <p className="text-[10px] font-bold uppercase tracking-widest text-destructive">Latest Failed Recipients</p>
            <div className="mt-3 max-h-48 overflow-auto rounded-xl border border-border">
              <table className="w-full min-w-[36rem] text-left text-xs">
                <thead className="sticky top-0 bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Batch</th>
                    <th className="px-4 py-3">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {onboardingFailures.map((failure) => (
                    <tr key={`${failure.runId}-${failure.email}`}>
                      <td className="px-4 py-3 font-semibold text-foreground">{failure.email}</td>
                      <td className="px-4 py-3 text-muted-foreground">{failure.batchLabel || failure.batchKey || "-"}</td>
                      <td className="px-4 py-3 text-destructive">{failure.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      {/* Communications Grid */}
      <div className="contents">
        
        {/* WhatsApp Campaign */}
        <section className="order-2 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-border bg-muted/20 p-6 sm:flex-row sm:items-start sm:p-8">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <MessageCircle className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-heading text-xl font-black text-foreground">WhatsApp Campaign</h2>
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  Trigger an opted-in broadcast via the n8n WhatsApp workflow.
                </p>
              </div>
            </div>
            <div className="shrink-0 rounded-lg border border-primary/20 bg-primary/10 px-3 py-1.5 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Audience Size</p>
              <p className="font-heading text-lg font-black text-primary">{whatsAppContacts.length}</p>
            </div>
          </div>
          
          <div className="p-6 sm:p-8">
            <form action={sendWhatsAppCampaignAction} className="grid gap-5 lg:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Campaign Name</span>
                <input name="campaignName" defaultValue="Prompt to Profit WhatsApp Campaign" className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Target Audience</span>
                <PremiumPicker
                  name="courseSlug"
                  defaultValue={waCourse}
                  options={[{ value: "all", label: "All opted-in contacts" }, ...courseOptions.map((option) => ({ ...option, key: `wa-${option.value}` }))]}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Template Name</span>
                <input name="templateName" defaultValue="holiday_waitlist_welcome" placeholder="e.g. hello_world" className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Language Code</span>
                <input name="templateLanguage" defaultValue="en" placeholder="en" className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
              </label>
              <label className="block lg:col-span-2">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Test Phone Number</span>
                <input name="testPhone" placeholder="+234..." className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
              </label>
              <label className="block lg:col-span-2">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Template Preview (Variables)</span>
                <textarea
                  name="templatePreview"
                  rows={4}
                  defaultValue="Hi {{1}}, thanks for joining the Prompt to Profit Holiday VIP waitlist. As requested, we will keep you updated as the holiday approaches so you can secure your child’s spot. Meanwhile, how old is your child?"
                  className="w-full rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm font-medium text-emerald-900 outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:text-emerald-100"
                />
              </label>
              <div className="grid gap-3 pt-2 sm:grid-cols-2 lg:col-span-2">
                <button name="sendMode" value="test" className="btn-secondary justify-center shadow-sm" type="submit">
                  Send Test Broadcast
                </button>
                <button name="sendMode" value="campaign" className="btn-primary justify-center shadow-sm" type="submit">
                  <Send className="mr-2 h-4 w-4" /> Dispatch Campaign
                </button>
              </div>
            </form>
            
            <div className="mt-8">
              <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recent Campaigns</h3>
              <div className="max-h-64 overflow-auto rounded-xl border border-border bg-background">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="sticky top-0 border-b border-border bg-muted/80 uppercase tracking-widest text-muted-foreground backdrop-blur-md">
                    <tr>
                      <th className="px-4 py-3">Campaign Profile</th>
                      <th className="px-4 py-3">Audience</th>
                      <th className="px-4 py-3">N8N Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {whatsAppCampaigns.length ? whatsAppCampaigns.map((campaign) => (
                      <tr key={campaign.campaignUuid} className="transition-colors hover:bg-muted/5">
                        <td className="px-4 py-3">
                          <p className="font-bold text-foreground">{campaign.campaignName}</p>
                          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{campaign.campaignUuid}</p>
                          <p className="mt-0.5 text-muted-foreground">{formatDate(campaign.createdAt)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-foreground">{campaign.audienceCourseSlug || "Global List"}</p>
                          <p className="mt-0.5 text-muted-foreground">{campaign.recipientCount} Recipients</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${campaign.n8nError ? 'text-destructive' : 'text-foreground'}`}>
                            {campaign.n8nStatus || "Pending"}
                          </span>
                          {campaign.n8nError && (
                            <p className="mt-1.5 max-w-[200px] whitespace-normal text-[10px] font-medium text-destructive">
                              {campaign.n8nError}
                            </p>
                          )}
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={3} className="px-4 py-8 text-center font-semibold text-muted-foreground">No campaigns launched yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* WhatsApp Audience List */}
        <section className="order-4 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border bg-muted/20 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-heading text-xl font-black text-foreground">Audience Ledger</h2>
                <p className="mt-1 text-xs font-medium text-muted-foreground">Opted-in contacts dynamically aggregated across workflows.</p>
              </div>
            </div>
            
            <ScrollPreservingGetForm className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <input type="hidden" name="course" value={courseSlug} />
              <input type="hidden" name="status" value={status} />
              <input type="hidden" name="batch" value={batchKey} />
              <PremiumPicker
                name="waCourse"
                defaultValue={waCourse}
                options={courseOptionsWithAll.map((option) => ({ ...option, key: `wa-filter-${option.value}` }))}
              />
              <input name="waSearch" defaultValue={waSearch} placeholder="Search by name, phone..." className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-xs font-bold outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
              <button className="btn-secondary w-full justify-center px-6 py-2.5 text-xs shadow-sm sm:w-auto" type="submit">
                <Filter className="mr-2 h-3.5 w-3.5" /> Filter
              </button>
            </ScrollPreservingGetForm>
          </div>
          
          <div className="max-h-[36rem] flex-1 overflow-auto bg-background">
            <div>
              <table className="w-full min-w-[36rem] text-left text-xs whitespace-nowrap">
                <thead className="sticky top-0 z-10 border-b border-border bg-muted/90 uppercase tracking-widest text-muted-foreground backdrop-blur-md">
                  <tr>
                    <th className="px-5 py-3">Contact Identity</th>
                    <th className="px-5 py-3">Linked Programme</th>
                    <th className="px-5 py-3">Entry Source</th>
                    <th className="px-5 py-3">Last Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {whatsAppContacts.length ? whatsAppContacts.map((contact) => (
                    <tr key={contact.id} className="transition-colors hover:bg-muted/5">
                      <td className="px-5 py-3.5">
                        <p className="font-bold text-foreground">{contact.fullName || "Unknown Contact"}</p>
                        {contact.email && <p className="mt-0.5 text-muted-foreground">{contact.email}</p>}
                        <p className="mt-0.5 font-mono text-muted-foreground">{contact.phone}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-foreground">{contact.courseSlug || "-"}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex rounded bg-muted/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          {contact.source || "-"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">{formatDate(contact.updatedAt)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} className="px-5 py-12 text-center font-semibold text-muted-foreground">No opted-in contacts match this filter.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {/* Holiday Waitlist Section */}
      <section className="order-3 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-border bg-muted/20 p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-heading text-xl font-black text-foreground">Holiday Waitlist</h2>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                Legacy waitlist records. Deleting a contact automatically purges queued messages for that phone number.
              </p>
            </div>
          </div>
          <div className="shrink-0 rounded-lg border border-primary/20 bg-primary/10 px-4 py-2 text-center shadow-inner">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Total Waitlist</p>
            <p className="font-heading text-xl font-black text-primary">{waitlist.total}</p>
          </div>
        </div>
        
        <div className="max-h-[28rem] overflow-auto bg-background">
          <table className="w-full min-w-[54rem] text-left text-sm whitespace-nowrap">
            <thead className="sticky top-0 z-10 border-b border-border bg-muted/90 text-xs uppercase tracking-widest text-muted-foreground backdrop-blur-md">
              <tr>
                <th className="px-6 py-4">Contact Details</th>
                <th className="px-6 py-4">Phone Number</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">System Dates</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {waitlist.contacts.length ? waitlist.contacts.map((contact) => (
                <tr key={contact.id} className="transition-colors hover:bg-muted/5">
                  <td className="px-6 py-4">
                    <p className="font-bold text-foreground">{contact.fullName || "Waitlist Contact"}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{contact.email}</p>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs font-semibold text-foreground">{contact.phone}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${contact.optedIn ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "border border-border bg-muted text-muted-foreground"}`}>
                      {contact.optedIn ? "Opted In" : "Opted Out"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-muted-foreground">
                    <p>C: {formatDate(contact.createdAt)}</p>
                    <p className="mt-0.5">U: {formatDate(contact.updatedAt)}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <form action={deleteHolidayWaitlistContactAction}>
                      <input type="hidden" name="id" value={contact.id} />
                      <button className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold text-muted-foreground shadow-sm transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive" type="submit">
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Purge
                      </button>
                    </form>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-sm font-semibold text-muted-foreground">No holiday waitlist contacts found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Master Ledger: manual submissions and paid online orders */}
      <section className="order-1 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-muted/20 p-6 sm:p-8">
          <p className="eyebrow text-primary">Master Ledger</p>
          <h2 className="mt-1 font-heading text-xl font-bold text-foreground">Enrollment & Payment Registry</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Paid online orders and manual payment submissions, consolidated into one operational ledger.
          </p>
          
          <ScrollPreservingGetForm className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Programme Filter</span>
              <PremiumPicker name="course" defaultValue={courseSlug} options={courseOptionsWithAll} />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status Filter</span>
              <PremiumPicker
                name="status"
                defaultValue={status}
                options={[
                  { value: "all", label: "All States" },
                  { value: "pending_verification", label: "Pending Review" },
                  { value: "recovery_required", label: "Recovery Required" },
                  { value: "approved", label: "Approved" },
                  { value: "rejected", label: "Rejected" }
                ]}
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Batch Filter</span>
              <PremiumPicker name="batch" defaultValue={selectedCourseMode === "immediate" ? "all" : batchKey} disabled={selectedCourseMode === "immediate"} options={ledgerBatchOptions} />
            </label>
            <label className="block sm:col-span-2 lg:col-span-1">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Global Search</span>
              <input name="q" defaultValue={search} placeholder="Name, email, phone, TXN..." className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-bold outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary shadow-sm" />
            </label>
            <button className="btn-primary h-[42px] w-full justify-center shadow-sm sm:col-span-2 lg:col-span-1" type="submit">
              Apply Filters
            </button>
          </ScrollPreservingGetForm>
        </div>

        <div className="max-h-[74vh] overflow-auto bg-background scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20">
          <table className="w-full min-w-[124rem] text-left text-sm whitespace-nowrap">
            <thead className="sticky top-0 z-10 border-b border-border bg-card/90 text-xs uppercase tracking-widest text-muted-foreground backdrop-blur-md">
              <tr>
                <th className="px-6 py-4">Transaction Identity</th>
                <th className="px-6 py-4">Learner Profile</th>
                <th className="px-6 py-4">Allocation</th>
                <th className="px-6 py-4">Financials</th>
                <th className="px-6 py-4">Verification Proof</th>
                <th className="px-6 py-4">Approval Review</th>
                <th className="px-6 py-4">Email Correction</th>
                <th className="px-6 py-4">Meta Pixel Push</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payments.length ? payments.map((payment) => (
                <tr key={payment.paymentUuid} className="align-top transition-colors hover:bg-muted/5">
                  <td className="px-6 py-5">
                    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest shadow-sm ${statusTone(payment.status)}`}>
                      {statusLabel(payment.status)}
                    </span>
                    <p className="mt-3 font-mono text-[11px] font-semibold text-foreground">{payment.paymentUuid}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(payment.createdAt)}</p>
                    <p className="mt-2 inline-flex rounded bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {payment.providerLabel}
                    </p>
                  </td>
                  <td className="px-6 py-5">
                    <p className="font-heading font-bold text-foreground">{payment.firstName || "Unknown Learner"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{payment.email || "No email"}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">{payment.phone || "-"}</p>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">{payment.country || "-"}</p>
                  </td>
                  <td className="px-6 py-5">
                    <p className="font-heading text-[13px] font-black text-foreground">
                      <TrademarkText text={payment.courseSlug} />
                    </p>
                    <p className="mt-1.5 inline-flex rounded bg-muted/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {payment.batchLabel || "Immediate Access"}
                    </p>
                    <p className="mt-1.5 text-xs font-semibold text-muted-foreground">
                      {payment.buyerType || "student"} allocation ({payment.seatCount} seat{payment.seatCount !== 1 ? 's' : ''})
                    </p>
                  </td>
                  <td className="px-6 py-5">
                    <p className="font-heading text-lg font-black text-foreground">
                      {formatMinorCurrency(payment.currency || "NGN", payment.amountMinor)}
                    </p>
                    {payment.discountMinor > 0 && (
                      <p className="mt-1.5 text-[11px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                        Discount: {formatMinorCurrency(payment.currency || "NGN", payment.discountMinor)} 
                        {payment.couponCode && ` [${payment.couponCode}]`}
                      </p>
                    )}
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">Ref:</span> {payment.transferReference || "-"}
                    </p>
                  </td>
                  <td className="px-6 py-5">
                    {payment.source === "online" ? (
                      <span className="inline-flex items-center rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        Provider Verified
                      </span>
                    ) : payment.proofUrl ? (
                      <a 
                        className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/10 shadow-sm" 
                        href={payment.proofUrl} 
                        target="_blank" 
                        rel="noreferrer"
                      >
                        Inspect Proof <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="inline-flex items-center rounded-md border border-border bg-muted/50 px-3 py-1.5 text-xs font-bold text-muted-foreground">
                        No Proof Attached
                      </span>
                    )}
                    {payment.proofPublicId && (
                      <p className="mt-2 w-48 truncate font-mono text-[10px] text-muted-foreground" title={payment.proofPublicId}>
                        ID: {payment.proofPublicId}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    {payment.status === "recovery_required" ? (
                      <div className="w-[280px] rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-700 shadow-sm dark:text-amber-300">
                        <p className="font-bold">Customer details required</p>
                        <p className="mt-2 leading-relaxed">Complete the recovery form before approving or rejecting this payment.</p>
                      </div>
                    ) : payment.source === "manual" && (payment.status === "pending_verification" || payment.status === "pending" || payment.status === "submitted") ? (
                      <form action={reviewManualPaymentAction} className="grid w-[280px] gap-3 rounded-xl border border-border bg-muted/20 p-4 shadow-inner">
                        <input type="hidden" name="paymentUuid" value={payment.paymentUuid} />
                        <textarea 
                          name="reviewNote" 
                          rows={2} 
                          placeholder="Optional review notes..." 
                          className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" 
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <button name="action" value="approve" className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-white transition-all hover:bg-emerald-600 shadow-sm" type="submit">
                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Approve
                          </button>
                          <button name="action" value="reject" className="inline-flex items-center justify-center rounded-lg bg-destructive px-3 py-2 text-xs font-bold text-white transition-all hover:bg-destructive/90 shadow-sm" type="submit">
                            <XCircle className="mr-1.5 h-3.5 w-3.5" /> Reject
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="w-[280px] rounded-xl border border-border bg-background p-4 shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Audit Log</p>
                        <div className="mt-2 space-y-1 text-xs">
                          <p><span className="font-semibold text-foreground">Reviewer:</span> {payment.reviewedBy || "System"}</p>
                          <p><span className="font-semibold text-foreground">Timestamp:</span> {formatDate(payment.reviewedAt)}</p>
                        </div>
                        {payment.reviewNote && (
                          <div className="mt-3 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground whitespace-pre-wrap">
                            {payment.reviewNote}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    {payment.status === "recovery_required" ? (
                      <form action={completeManualPaymentRecoveryAction} className="grid w-[280px] gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 shadow-inner">
                        <input type="hidden" name="paymentUuid" value={payment.paymentUuid} />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">Complete recovery</p>
                        <input name="firstName" defaultValue={payment.firstName || ""} required placeholder="Customer full name" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary" />
                        <input name="email" type="email" required placeholder="Customer email" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary" />
                        <input name="phone" required placeholder="Customer phone" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary" />
                        <input name="transferReference" defaultValue={payment.transferReference || ""} placeholder="Bank reference (optional)" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary" />
                        <button className="btn-secondary w-full justify-center py-2 text-xs shadow-sm" type="submit">Save Details &amp; Approve</button>
                      </form>
                    ) : payment.source === "manual" ? (
                      <div className="grid w-[240px] gap-2.5 rounded-xl border border-border bg-muted/20 p-4 shadow-inner">
                      <form action={updateManualPaymentEmailAction} className="grid gap-2.5">
                        <input type="hidden" name="paymentUuid" value={payment.paymentUuid} />
                        <input 
                          name="newEmail" 
                          type="email" 
                          defaultValue={payment.email || ""} 
                          placeholder="Correct email address"
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" 
                        />
                        <button className="btn-secondary w-full justify-center py-2 text-xs shadow-sm" type="submit">
                          Apply Correction
                        </button>
                      </form>
                      {payment.status === "approved" && (
                        <form action={resendManualPaymentActivationEmailAction}>
                          <input type="hidden" name="paymentUuid" value={payment.paymentUuid} />
                          <button className="btn-secondary w-full justify-center py-2 text-xs shadow-sm" type="submit">
                            <Mail className="mr-1.5 h-3.5 w-3.5" /> Resend Activation
                          </button>
                        </form>
                      )}
                      </div>
                    ) : (
                      <div className="w-[240px] whitespace-normal break-words rounded-xl border border-border bg-background p-4 text-xs leading-relaxed text-muted-foreground shadow-sm">
                        Online order details are provider-verified. Email changes should be made on the linked student account.
                      </div>
                    )}
                  </td>
                  <td className="min-w-0 px-6 py-5">
                    {payment.source === "manual" ? (
                      <form action={sendManualPaymentMetaPurchaseAction} className="grid w-[260px] min-w-0 max-w-[260px] gap-2.5 overflow-hidden whitespace-normal rounded-xl border border-border bg-muted/20 p-4 shadow-inner">
                      <input type="hidden" name="paymentUuid" value={payment.paymentUuid} />
                      
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Meta Status</span>
                        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${metaDispatchTone(payment.metaPurchaseDispatchStatus, payment.metaPurchaseSent)}`}>
                          {metaDispatchLabel(payment.metaPurchaseDispatchStatus, payment.metaPurchaseSent)}
                        </span>
                      </div>
                      
                      <input name="fbp" placeholder="fbp (optional)" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
                      <input name="fbc" placeholder="fbc (optional)" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
                      <input name="fbclid" placeholder="fbclid (optional)" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
                      <input name="eventSourceUrl" placeholder="Event Source URL (optional)" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
                      
                      <button className="btn-secondary mt-1 w-full justify-center py-2 text-xs shadow-sm" type="submit" disabled={payment.metaPurchaseSent || payment.metaPurchaseDispatchStatus === "sending"}>
                        <Send className="mr-1.5 h-3.5 w-3.5" /> {payment.metaPurchaseSent ? "Already Dispatched" : payment.metaPurchaseDispatchStatus === "failed" ? "Retry Event" : payment.metaPurchaseDispatchStatus === "sending" ? "Dispatching…" : "Dispatch Event"}
                      </button>

                      {payment.metaPurchaseLastError ? (
                        <div className="min-w-0 max-w-full overflow-hidden rounded-md border border-red-500/15 bg-red-500/5 p-2 text-[10px] leading-relaxed text-red-600 dark:text-red-400">
                          <p className="max-w-full whitespace-normal [overflow-wrap:anywhere]">{payment.metaPurchaseLastError}</p>
                          {payment.metaPurchaseTraceId ? <p className="mt-1 max-w-full break-all font-mono text-[9px] opacity-80">Trace: {payment.metaPurchaseTraceId}</p> : null}
                        </div>
                      ) : null}

                      {payment.metaPurchaseAttemptCount > 0 ? <p className="text-center text-[10px] text-muted-foreground">Attempts: {payment.metaPurchaseAttemptCount}</p> : null}
                      
                      {payment.metaPurchaseSentAt && (
                        <p className="mt-1 text-center text-[10px] text-muted-foreground">
                          Last sent: {formatDate(payment.metaPurchaseSentAt)}
                        </p>
                      )}
                      </form>
                    ) : (
                      <div className="w-[260px] whitespace-normal break-words rounded-xl border border-border bg-background p-4 text-xs leading-relaxed text-muted-foreground shadow-sm">
                        Purchase tracking is handled automatically during the {payment.providerLabel} checkout.
                      </div>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center justify-center">
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <Filter className="h-6 w-6" />
                      </div>
                      <h3 className="font-heading text-lg font-bold text-foreground">No Registries Found</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        There are no enrollment payments matching your current filter criteria.
                      </p>
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
