import Link from "next/link"
import { 
  ArrowLeft,
  BellRing,
  BookOpen, 
  CheckCircle2,
  Clock, 
  Eye, 
  Filter, 
  GraduationCap, 
  PlaySquare, 
  Search, 
  Send,
  ShieldCheck,
  User, 
  UsersRound 
} from "lucide-react"

import { PremiumPicker } from "@/components/PremiumPicker"
import { DashboardStatCard, DashboardStatsVisibility } from "@/components/dashboard/DashboardStatsVisibility"
import {
  getStudentCourseProgressDetail,
  listLearningProgressCourseOptions,
  listStudentsProgressByCourse
} from "@/lib/admin-learning-progress"
import { listLearningFollowupAdminData } from "@/lib/learning-inactivity-followups"
import { courseLifecycleConfig, listCourseLifecycleBatchOptions, listCourseLifecycleDeliveries, listCourseLifecycleDeliveryStats, previewCourseLifecycleEmails, type LifecycleStage } from "@/lib/course-lifecycle-emails"
import { listAutomationRunHealth } from "@/lib/automation-runs"
import { formatDate } from "@/lib/utils"
import {
  configureLearningFollowupWebhookAction,
  previewCourseLifecycleEmailsAction,
  previewLearningFollowupsAction,
  retryLearningFollowupCampaignAction,
  saveLearningFollowupSettingsAction,
  saveCourseLifecycleSettingsAction,
  sendCourseLifecycleEmailsAction,
  sendLearningFollowupsNowAction,
  setLearningFollowupCampaignPausedAction
} from "./actions"

export const dynamic = "force-dynamic"
export const maxDuration = 300

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function param(params: Record<string, string | string[] | undefined>, key: string, fallback = "") {
  const value = params[key]
  return Array.isArray(value) ? value[0] || fallback : value || fallback
}

function percentTone(value: number) {
  if (value >= 100) return "bg-emerald-500"
  if (value >= 50) return "bg-primary"
  if (value > 0) return "bg-amber-500"
  return "bg-muted-foreground/30"
}

function durationLabel(seconds: number) {
  if (!seconds) return ""
  const minutes = Math.floor(seconds / 60)
  const remaining = Math.round(seconds % 60)
  return `${minutes}m ${String(remaining).padStart(2, "0")}s`
}

function automationRunOutcome(run: { status: string; resultJson: string | null }) {
  if (run.status === "failed") return { label: "Run failed", tone: "text-destructive", detail: "The automation stopped with an error." }
  if (run.status === "running") return { label: "Checking now", tone: "text-amber-600", detail: "The automation is still processing." }
  if (!run.resultJson) return { label: "Check finished", tone: "text-muted-foreground", detail: "No delivery result was recorded for this run." }

  let result: Record<string, unknown> = {}
  try {
    result = run.resultJson ? JSON.parse(run.resultJson) as Record<string, unknown> : {}
  } catch {
    result = {}
  }
  const sent = Math.max(0, Number(result.sent || 0))
  const failed = Math.max(0, Number(result.failed || 0))
  const deferred = Math.max(0, Number(result.deferred || 0))
  const due = Math.max(0, Number(result.due ?? result.dueRecipients ?? 0))

  if (result.dryRun === true) {
    return {
      label: "Dry run only",
      tone: "text-amber-600",
      detail: `${due} email${due === 1 ? "" : "s"} due · no email sent`
    }
  }
  if (sent > 0) {
    return {
      label: `${sent} email${sent === 1 ? "" : "s"} sent`,
      tone: "text-emerald-600",
      detail: `${failed} failed${deferred ? ` · ${deferred} deferred` : ""}`
    }
  }
  if (deferred > 0) {
    return {
      label: "Emails deferred",
      tone: "text-amber-600",
      detail: `${deferred} recipient${deferred === 1 ? "" : "s"} deferred · no email sent`
    }
  }
  if (due === 0) return { label: "No email due", tone: "text-muted-foreground", detail: "The check ran successfully; no email was sent." }
  return { label: "No email sent", tone: "text-muted-foreground", detail: `${due} due · ${failed} failed` }
}

export default async function InternalLearningProgressPage({ searchParams }: PageProps) {
  const params = await searchParams || {}
  const courseSlug = param(params, "course", "prompt-to-profit")
  const enrollmentType = param(params, "enrollment", "all")
  const batchKey = param(params, "batch", "all")
  const search = param(params, "search", "")
  const detailAccount = param(params, "account", "")
  const detailEmail = param(params, "email", "")
  const followupStatus = param(params, "followupStatus", "all")
  const followupCourse = param(params, "followupCourse", "all")
  const followupSearch = param(params, "followupSearch", "")
  const previewState = param(params, "previewState", "")
  const previewDue = Math.max(0, Number(param(params, "previewDue", "0")) || 0)
  const previewAt = param(params, "previewAt", "")
  const brevoState = param(params, "brevoState", "")
  const lifecyclePreviewState = param(params, "lifecyclePreviewState", "")
  const lifecyclePreviewDue = Math.max(0, Number(param(params, "lifecyclePreviewDue", "0")) || 0)
  const lifecycleCourse = param(params, "lifecycleCourse", "")
  const lifecycleBatch = param(params, "lifecycleBatch", "")
  const lifecycleStage = param(params, "lifecycleStage", "all") as LifecycleStage | "all"
  const lifecycleRecipient = param(params, "lifecycleRecipient", "")

  const [courses, progress, followups, lifecycleConfig, lifecycleStats, automationHealth, lifecycleBatches, lifecycleDeliveries] = await Promise.all([
    listLearningProgressCourseOptions(),
    listStudentsProgressByCourse({ courseSlug, enrollmentType, batchKey, search }),
    listLearningFollowupAdminData({ status: followupStatus, courseSlug: followupCourse, search: followupSearch }),
    courseLifecycleConfig(),
    listCourseLifecycleDeliveryStats(),
    listAutomationRunHealth(["course-lifecycle-emails", "learning-inactivity-delivery", "learning-inactivity-reconcile"]),
    listCourseLifecycleBatchOptions(),
    listCourseLifecycleDeliveries()
  ])
  const lifecyclePreview = lifecyclePreviewState === "success"
    ? await previewCourseLifecycleEmails({ courseSlug: lifecycleCourse, batchKey: lifecycleBatch, stage: lifecycleStage, recipientEmail: lifecycleRecipient, limit: 10 })
    : null
  const selectedLifecycleEmail = lifecyclePreview?.preview[0] as {
    recipientEmail: string
    recipientRole: string
    subject: string
    html?: string
    text?: string
  } | undefined
  
  const detail = detailAccount || detailEmail
    ? await getStudentCourseProgressDetail({
        courseSlug: progress.courseSlug,
        accountId: detailAccount,
        email: detailEmail
      })
    : null

  // URL builder for returning to the main list (closes detail view)
  const listUrl = `/internal/learning-progress?course=${encodeURIComponent(progress.courseSlug)}&enrollment=${encodeURIComponent(progress.filters.enrollmentType)}&batch=${encodeURIComponent(progress.filters.batchKey)}&search=${encodeURIComponent(search)}`
  const courseOptions = courses.length
    ? courses.map((course, index) => ({
        key: `${course.courseSlug}-${index}`,
        value: course.courseSlug,
        label: course.courseTitle || course.courseSlug
      }))
    : [{ value: progress.courseSlug, label: progress.courseSlug }]
  const enrollmentOptions = progress.filters.availableEnrollmentTypes.map((type) => ({ value: type.key, label: type.label }))
  const batchOptions = progress.filters.availableBatches.map((batch) => ({ value: batch.key, label: batch.label }))
  const lifecycleCourseOptions = Array.from(new Map(lifecycleBatches.map((batch) => [batch.courseSlug, { value: batch.courseSlug, label: batch.courseName || batch.courseSlug }])).values())
  const lifecycleStageOptions = [
    { value: "all", label: "All due stages" },
    { value: "welcome_48h", label: "48-hour preparation" },
    { value: "batch_switch_24h", label: "24-hour batch switch" },
    { value: "lesson_release", label: "Lesson release" }
  ]

  return (
    <main className="space-y-8 pb-12">
      
      {/* Header */}
      <div className="flex flex-col gap-6 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow text-primary">Learning Progress</p>
          <h1 className="mt-1 font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Student Progress Console
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Monitor student lesson completion, recent activity, cohort enrollment, and deep module-level learning trajectories.
          </p>
        </div>
      </div>

      {previewState === "success" ? (
        <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-emerald-950 dark:text-emerald-100" role="status">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h2 className="font-heading text-base font-black">Safe preview completed</h2>
              <p className="mt-1 text-sm font-semibold">{previewDue} recipient{previewDue === 1 ? " is" : "s are"} currently due. No email was sent.</p>
              <p className="mt-1 text-xs opacity-75">The selected recipient, subject, and complete email are open below.</p>
              {previewAt ? <p className="mt-1 text-xs opacity-75">Completed {formatDate(previewAt)}</p> : null}
            </div>
          </div>
        </section>
      ) : previewState === "error" ? (
        <section className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-destructive" role="alert">
          <h2 className="font-heading text-base font-black">Safe preview could not finish</h2>
          <p className="mt-1 text-sm font-semibold">No email was sent. Check the server log for the internal error and try again.</p>
        </section>
      ) : null}

      {brevoState === "local-ready" ? (
        <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-emerald-950 dark:text-emerald-100" role="status">
          <h2 className="font-heading text-base font-black">Local Brevo self-test passed</h2>
          <p className="mt-1 text-sm font-semibold">The Brevo credentials, secure webhook authentication, Brevo event payload handling, and local route all responded correctly. No email was sent and no production registration was changed.</p>
        </section>
      ) : brevoState === "connected" ? (
        <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-emerald-950 dark:text-emerald-100" role="status">
          <h2 className="font-heading text-base font-black">Brevo events connected</h2>
          <p className="mt-1 text-sm font-semibold">The deployed webhook is registered for delivery, engagement, bounce, complaint, and unsubscribe events.</p>
        </section>
      ) : brevoState === "error" ? (
        <section className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-destructive" role="alert">
          <h2 className="font-heading text-base font-black">Brevo validation did not finish</h2>
          <p className="mt-1 text-sm font-semibold">Nothing was sent or activated. Check the server log for the internal error and try again.</p>
        </section>
      ) : null}

      {/* Primary Metrics Grid */}
      <DashboardStatsVisibility storageKey="tochukwu-internal-learning-progress-stats">
        <section className="grid gap-4 sm:grid-cols-3">
          <DashboardStatCard statKey="Active Cohort Students" label="Active Cohort Students" value={progress.students.length}
            icon={<UsersRound className="h-5 w-5" />} valueClassName="text-4xl" />
          <DashboardStatCard statKey="Total Course Lessons" label="Total Course Lessons" value={progress.totalLessons}
            icon={<PlaySquare className="h-5 w-5" />} iconClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400" valueClassName="text-4xl" />
          <DashboardStatCard statKey="Target Course" label="Target Course" value={progress.courseSlug}
            icon={<BookOpen className="h-5 w-5" />} iconClassName="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" valueClassName="truncate text-2xl" />
        </section>
      </DashboardStatsVisibility>

      <section id="course-lifecycle-emails" className="scroll-mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border bg-muted/20 p-6 sm:p-8 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><BellRing className="h-5 w-5" /></div>
              <div><h2 className="font-heading text-xl font-black text-foreground">Course Lifecycle Emails</h2><p className="mt-1 text-sm text-muted-foreground">Role-aware preparation, batch-switch and lesson-release emails generated from live batch data.</p></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
              <span className={`rounded-md border px-2.5 py-1 ${lifecycleConfig.enabled ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600" : "border-border bg-muted text-muted-foreground"}`}>{lifecycleConfig.enabled ? "Automation enabled" : "Automation disabled"}</span>
              <span className={`rounded-md border px-2.5 py-1 ${lifecycleConfig.dryRun ? "border-amber-500/20 bg-amber-500/10 text-amber-600" : "border-primary/20 bg-primary/10 text-primary"}`}>{lifecycleConfig.dryRun ? "Dry run only" : "Live delivery"}</span>
            </div>
          </div>
          <form action={previewCourseLifecycleEmailsAction}><button type="submit" className="btn-secondary w-full justify-center lg:w-auto"><ShieldCheck className="mr-2 h-4 w-4" />Run Safe Preview</button></form>
        </div>
        {lifecyclePreviewState ? (
          <div className={`border-b p-5 text-sm font-semibold ${lifecyclePreviewState === "success" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700" : "border-destructive/20 bg-destructive/10 text-destructive"}`}>
            {lifecyclePreviewState === "success" ? `${lifecyclePreviewDue} lifecycle email${lifecyclePreviewDue === 1 ? " is" : "s are"} currently due. Nothing was sent.` : "The safe preview failed. Nothing was sent."}
          </div>
        ) : null}
        <div className="border-b border-border bg-background p-6 sm:p-8">
          <div className="mb-5"><p className="eyebrow text-primary">Email Operations</p><h3 className="mt-1 font-heading text-lg font-black">Preview or manually send due lifecycle emails</h3><p className="mt-1 text-sm text-muted-foreground">Filters never make an ineligible email eligible. Sent stages remain protected by the delivery ledger.</p></div>
          <div className="grid gap-5 xl:grid-cols-2">
            <form action={previewCourseLifecycleEmailsAction} className="grid gap-4 rounded-xl border border-border bg-muted/10 p-5 sm:grid-cols-2">
              <div className="sm:col-span-2"><p className="text-sm font-black">Exact safe preview</p><p className="mt-1 text-xs text-muted-foreground">Shows the rendered email and sends nothing.</p></div>
              <label><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Course</span><PremiumPicker name="courseSlug" defaultValue={lifecycleCourse} options={[{ value: "", label: "All courses" }, ...lifecycleCourseOptions]} /></label>
              <label><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Batch</span><PremiumPicker name="batchKey" defaultValue={lifecycleBatch} options={[{ value: "", label: "All batches" }, ...lifecycleBatches.map((batch) => ({ value: batch.batchKey, label: `${batch.batchLabel} · ${batch.courseName}` }))]} /></label>
              <label><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Stage</span><PremiumPicker name="stage" defaultValue={lifecycleStage} options={lifecycleStageOptions} /></label>
              <label className="sm:col-span-2"><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recipient emails (optional)</span><textarea name="recipientEmail" defaultValue={lifecycleRecipient.replace(/,/g, "\n")} rows={3} placeholder={"Leave blank for everyone matching the filters, or enter selected emails separated by commas or new lines."} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm" /><span className="mt-1.5 block text-xs text-muted-foreground">Use this to preview everyone, one person, or a selected group.</span></label>
              <button type="submit" className="btn-secondary justify-center sm:col-span-2"><Eye className="mr-2 h-4 w-4" />Preview Exact Email</button>
            </form>

            <form action={sendCourseLifecycleEmailsAction} className="grid gap-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 sm:grid-cols-2">
              <div className="sm:col-span-2"><p className="text-sm font-black">Manual lifecycle send</p><p className="mt-1 text-xs text-muted-foreground">Select one batch. Leave the recipient list blank for everyone eligible in that batch, or enter only the email addresses you want.</p></div>
              <label><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Course</span><PremiumPicker name="courseSlug" required defaultValue={lifecycleCourse} options={[{ value: "", label: "Select a course", disabled: true }, ...lifecycleCourseOptions]} /></label>
              <label><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Batch</span><PremiumPicker name="batchKey" required defaultValue={lifecycleBatch} options={[{ value: "", label: "Select a batch", disabled: true }, ...lifecycleBatches.map((batch) => ({ value: batch.batchKey, label: `${batch.batchLabel} · ${batch.courseName}` }))]} /></label>
              <label><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Stage</span><PremiumPicker name="stage" defaultValue={lifecycleStage} options={lifecycleStageOptions} /></label>
              <label><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Maximum email sends this run</span><input name="limit" type="number" min="1" max="300" defaultValue="300" className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-bold" /></label>
              <label className="sm:col-span-2"><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recipient emails (optional)</span><textarea name="recipientEmail" defaultValue={lifecycleRecipient.replace(/,/g, "\n")} rows={4} placeholder={"Leave blank to send to everyone eligible in this batch.\n\nTo send to some people, enter their emails separated by commas or new lines."} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm" /><span className="mt-1.5 block text-xs font-semibold text-muted-foreground">Blank = all eligible batch recipients. One or more emails = only those matching recipients.</span></label>
              <label><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-amber-700">Type SEND to confirm</span><input name="confirmation" required pattern="[Ss][Ee][Nn][Dd]" autoComplete="off" className="w-full rounded-lg border border-amber-500/40 bg-background px-3 py-2.5 text-sm font-black uppercase" /></label>
              <button type="submit" className="btn-primary justify-center sm:col-span-2"><Send className="mr-2 h-4 w-4" />Send to Selected Batch Audience</button>
            </form>
          </div>
        </div>
        {selectedLifecycleEmail?.html ? (
          <details open className="border-b border-border bg-muted/10 p-6 sm:p-8">
            <summary className="cursor-pointer text-sm font-black">Exact lifecycle email preview</summary>
            <div className="mt-4 rounded-xl border border-border bg-background p-5">
              <p className="text-xs text-muted-foreground">Recipient: {selectedLifecycleEmail.recipientEmail} · {selectedLifecycleEmail.recipientRole.replace(/_/g, " ")}</p>
              <p className="mt-2 font-bold">Subject: {selectedLifecycleEmail.subject}</p>
              <iframe title="Course lifecycle email preview" srcDoc={selectedLifecycleEmail.html} sandbox="" className="mt-4 h-[720px] w-full rounded-xl border border-border bg-white" />
              <details className="mt-4 rounded-lg border border-border p-4"><summary className="cursor-pointer text-xs font-black uppercase tracking-wider text-muted-foreground">Plain-text fallback</summary><pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-6 text-muted-foreground">{selectedLifecycleEmail.text}</pre></details>
            </div>
          </details>
        ) : lifecyclePreviewState === "success" ? <p className="border-b border-border p-6 text-sm text-muted-foreground">No currently due email matches those filters.</p> : null}
        <div className="grid gap-3 border-b border-border p-6 sm:grid-cols-3 sm:p-8">
          {automationHealth.length ? automationHealth.map((run) => {
            const outcome = automationRunOutcome(run)
            return (
              <div key={run.automationKey} className="rounded-xl border border-border bg-background p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{run.automationKey.replace(/-/g, " ")}</p>
                <p className={`mt-2 text-sm font-black uppercase ${outcome.tone}`}>{outcome.label}</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">{outcome.detail}</p>
                <p className="mt-2 text-xs text-muted-foreground">Last checked {formatDate(run.startedAt)}</p>
                {run.lastError ? <p className="mt-2 text-xs text-destructive">{run.lastError}</p> : null}
              </div>
            )
          }) : <p className="text-sm text-muted-foreground sm:col-span-3">No scheduled automation run has been recorded yet. The first deployed cron invocation will appear here.</p>}
        </div>
        <div className="grid gap-3 border-b border-border p-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-4">
          {lifecycleStats.length ? lifecycleStats.map((item) => (
            <div key={item.status} className="rounded-xl border border-border bg-background p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{item.status.replace(/_/g, " ")}</p><p className="mt-2 font-heading text-3xl font-black">{item.total}</p><p className="mt-1 text-[10px] text-muted-foreground">{item.latestSentAt ? `Latest ${formatDate(item.latestSentAt)}` : "No completed send"}</p></div>
          )) : <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-4">No lifecycle deliveries have been attempted yet.</p>}
        </div>
        <div className="border-b border-border bg-background p-6 sm:p-8">
          <h3 className="font-heading text-lg font-black">Lifecycle Delivery Audit</h3>
          <p className="mt-1 text-sm text-muted-foreground">Recipient-level automated and manual delivery attempts.</p>
          <div className="mt-4 max-h-[380px] overflow-auto rounded-xl border border-border">
            <table className="w-full min-w-[76rem] text-left text-sm">
              <thead className="sticky top-0 border-b border-border bg-card text-[10px] font-bold uppercase tracking-widest text-muted-foreground"><tr><th className="px-4 py-3">Recipient</th><th className="px-4 py-3">Course / Batch</th><th className="px-4 py-3">Stage</th><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Timing</th><th className="px-4 py-3">Provider</th></tr></thead>
              <tbody className="divide-y divide-border">
                {lifecycleDeliveries.length ? lifecycleDeliveries.map((delivery) => (
                  <tr key={delivery.deliveryUuid}>
                    <td className="px-4 py-3"><p className="font-semibold">{delivery.recipientName || "Recipient"}</p><p className="mt-1 text-xs text-muted-foreground">{delivery.recipientEmail} · {delivery.recipientRole.replace(/_/g, " ")}</p></td>
                    <td className="px-4 py-3"><p className="font-semibold">{delivery.courseSlug}</p><p className="mt-1 text-xs text-muted-foreground">{delivery.batchKey}</p></td>
                    <td className="px-4 py-3 text-xs font-bold uppercase">{delivery.stage.replace(/_/g, " ")}</td>
                    <td className="max-w-[280px] truncate px-4 py-3" title={delivery.subject}>{delivery.subject || "Pending render"}</td>
                    <td className="px-4 py-3"><span className="rounded border border-border bg-muted/40 px-2 py-1 text-[10px] font-black uppercase">{delivery.status.replace(/_/g, " ")}</span><p className="mt-1 text-[10px] text-muted-foreground">{delivery.attempts} attempt{delivery.attempts === 1 ? "" : "s"}</p>{delivery.lastError ? <p className="mt-1 max-w-[260px] truncate text-[10px] text-destructive" title={delivery.lastError}>{delivery.lastError}</p> : null}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground"><p>Due {formatDate(delivery.dueAt)}</p><p className="mt-1">{delivery.sentAt ? `Sent ${formatDate(delivery.sentAt)}` : "Not sent"}</p></td>
                    <td className="max-w-[180px] truncate px-4 py-3 font-mono text-[10px] text-muted-foreground" title={delivery.providerMessageId}>{delivery.providerMessageId || "—"}</td>
                  </tr>
                )) : <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No lifecycle delivery attempts recorded.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <form action={saveCourseLifecycleSettingsAction} className="grid gap-4 bg-background p-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-[auto_auto_160px_1fr_auto] lg:items-end">
          <label className="flex items-center gap-3 rounded-lg border border-border px-4 py-3"><input name="enabled" type="checkbox" defaultChecked={lifecycleConfig.enabled} className="h-4 w-4 rounded" /><span className="text-xs font-bold">Enable automation</span></label>
          <label className="flex items-center gap-3 rounded-lg border border-border px-4 py-3"><input name="dryRun" type="checkbox" defaultChecked={lifecycleConfig.dryRun} className="h-4 w-4 rounded" /><span className="text-xs font-bold">Dry-run mode</span></label>
          <label><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recipients/run</span><input name="runLimit" type="number" min="1" max="300" defaultValue={lifecycleConfig.runLimit} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-bold" /></label>
          <label><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Community URLs JSON</span><input name="communityUrls" defaultValue={JSON.stringify(Object.fromEntries(lifecycleConfig.communityUrls))} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm" /></label>
          <button type="submit" className="btn-primary h-[42px] justify-center"><Send className="mr-2 h-4 w-4" />Save</button>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border bg-muted/20 p-6 sm:p-8 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><BellRing className="h-5 w-5" /></div>
              <div>
                <h2 className="font-heading text-xl font-black text-foreground">Weekly Learning Follow-ups</h2>
                <p className="mt-1 text-sm text-muted-foreground">Behaviour-based Brevo reminders for learners inactive for a full week.</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
              <span className={`rounded-md border px-2.5 py-1 ${followups.config.enabled ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600" : "border-border bg-muted text-muted-foreground"}`}>{followups.config.enabled ? "Automation enabled" : "Automation disabled"}</span>
              <span className={`rounded-md border px-2.5 py-1 ${followups.config.dryRun ? "border-amber-500/20 bg-amber-500/10 text-amber-600" : "border-primary/20 bg-primary/10 text-primary"}`}>{followups.config.dryRun ? "Dry run only" : "Live delivery"}</span>
              <span className={`rounded-md border px-2.5 py-1 ${followups.config.webhookConfigured ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600" : "border-amber-500/20 bg-amber-500/10 text-amber-600"}`}>{followups.config.webhookConfigured ? "Brevo events secured" : "Production webhook not registered"}</span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Brevo event URL: <code>/api/webhooks/brevo/learning-followups</code> · authenticate with the <code>x-learning-followup-secret</code> header.</p>
          </div>
          <form action={previewLearningFollowupsAction}>
            <div className="flex flex-wrap gap-2">
              <button type="submit" data-toast-long="true" data-toast="Running safe preview" className="btn-secondary w-full justify-center lg:w-auto"><ShieldCheck className="mr-2 h-4 w-4" />Run Safe Preview</button>
              <button formAction={configureLearningFollowupWebhookAction} type="submit" className="btn-secondary w-full justify-center lg:w-auto"><BellRing className="mr-2 h-4 w-4" />Configure Brevo Events</button>
            </div>
          </form>
        </div>

        <div className="grid gap-4 border-b border-border p-6 sm:grid-cols-3 sm:p-8 xl:grid-cols-6">
          {[
            ["Due now", followups.stats.due], ["Active", followups.stats.active], ["Paused", followups.stats.paused],
            ["Sent", followups.stats.sent], ["Delivered", followups.stats.delivered], ["Resumed", followups.stats.resumed],
            ["Clicked", followups.stats.clicked], ["Finished after reminder", followups.stats.completedAfterReminder],
            ["Projects after reminder", followups.stats.projectsAfterReminder], ["Certificates after reminder", followups.stats.certificatesAfterReminder]
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-border bg-background p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
              <p className="mt-2 font-heading text-3xl font-black text-foreground">{value}</p>
            </div>
          ))}
        </div>

        <div className="border-b border-border bg-background p-6 sm:p-8">
          <div className="mb-5"><p className="eyebrow text-primary">Email Operations</p><h3 className="mt-1 font-heading text-lg font-black">Preview or manually send due follow-ups</h3><p className="mt-1 text-sm text-muted-foreground">A manual run still requires an active, due campaign and uses the existing campaign-cycle idempotency key.</p></div>
          <div className="grid gap-5 xl:grid-cols-2">
            <form action={previewLearningFollowupsAction} className="grid gap-4 rounded-xl border border-border bg-muted/10 p-5 sm:grid-cols-2">
              <div className="sm:col-span-2"><p className="text-sm font-black">Exact safe preview</p><p className="mt-1 text-xs text-muted-foreground">Selects a currently due recipient and sends nothing.</p></div>
              <label><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Course</span><PremiumPicker name="courseSlug" defaultValue={followupCourse === "all" ? "" : followupCourse} options={[{ value: "", label: "All courses" }, ...courses.map((course, index) => ({ key: `manual-preview-${course.courseSlug}-${index}`, value: course.courseSlug, label: course.courseTitle || course.courseSlug }))]} /></label>
              <label><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recipient email</span><input name="recipientEmail" type="email" defaultValue={followupSearch.includes("@") ? followupSearch : ""} placeholder="Optional: one recipient" className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm" /></label>
              <button type="submit" data-toast-long="true" className="btn-secondary justify-center sm:col-span-2"><Eye className="mr-2 h-4 w-4" />Preview Exact Follow-up</button>
            </form>
            <form action={sendLearningFollowupsNowAction} className="grid gap-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 sm:grid-cols-2">
              <div className="sm:col-span-2"><p className="text-sm font-black">Manual follow-up send</p><p className="mt-1 text-xs text-muted-foreground">Triggers due follow-ups now, even when scheduled automation is paused or in dry-run mode.</p></div>
              <label><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Course</span><PremiumPicker name="courseSlug" defaultValue={followupCourse === "all" ? "" : followupCourse} options={[{ value: "", label: "All courses" }, ...courses.map((course, index) => ({ key: `manual-send-${course.courseSlug}-${index}`, value: course.courseSlug, label: course.courseTitle || course.courseSlug }))]} /></label>
              <label><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recipient email</span><input name="recipientEmail" type="email" defaultValue={followupSearch.includes("@") ? followupSearch : ""} placeholder="Optional: one recipient" className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm" /></label>
              <label><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Maximum recipients</span><input name="limit" type="number" min="1" max="300" defaultValue="80" className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-bold" /></label>
              <label><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-amber-700">Type SEND to confirm</span><input name="confirmation" required pattern="[Ss][Ee][Nn][Dd]" autoComplete="off" className="w-full rounded-lg border border-amber-500/40 bg-background px-3 py-2.5 text-sm font-black uppercase" /></label>
              <button type="submit" className="btn-primary justify-center sm:col-span-2"><Send className="mr-2 h-4 w-4" />Send Due Follow-ups Now</button>
            </form>
          </div>
        </div>

        <form action={saveLearningFollowupSettingsAction} className="grid gap-4 border-b border-border bg-background p-6 sm:grid-cols-2 sm:p-8 xl:grid-cols-7">
          <label className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
            <input name="enabled" type="checkbox" defaultChecked={followups.config.enabled} className="h-4 w-4 rounded" />
            <span className="text-xs font-bold">Enable automation</span>
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
            <input name="dryRun" type="checkbox" defaultChecked={followups.config.dryRun} className="h-4 w-4 rounded" />
            <span className="text-xs font-bold">Dry-run mode</span>
          </label>
          {[
            ["inactivityDays", "Inactive days", followups.config.inactivityDays],
            ["campaignMonths", "Campaign months", followups.config.campaignMonths],
            ["maxReminders", "Maximum emails", followups.config.maxReminders],
            ["runLimit", "Recipients/run", followups.config.runLimit]
          ].map(([name, label, value]) => (
            <label key={String(name)} className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
              <input name={String(name)} type="number" min="1" defaultValue={String(value)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-bold" />
            </label>
          ))}
          <button type="submit" className="btn-primary min-h-[42px] w-full justify-center whitespace-nowrap sm:col-span-2 xl:col-span-1 xl:self-end"><Send className="mr-2 h-4 w-4" />Save Controls</button>
          <label className="block sm:col-span-2 xl:col-span-7">
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Course allowlist (comma-separated; blank means all batch courses)</span>
            <input name="courseAllowlist" defaultValue={followups.config.courseAllowlist.join(", ")} placeholder="prompt-to-profit, prompt-to-profit-holiday" className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm" />
          </label>
        </form>

        {followups.emailPreview ? (
          <details id="learning-followup-email-preview" open={previewState === "success"} className="scroll-mt-6 border-b border-border bg-muted/10 p-6 sm:p-8">
            <summary className="cursor-pointer text-sm font-black text-foreground">Exact email selected by the safe preview</summary>
            <div className="mt-4 rounded-xl border border-border bg-background p-5">
              <p className="text-xs text-muted-foreground">Recipient: {followups.emailPreview.recipientEmail}</p>
              <p className="mt-2 font-bold text-foreground">Subject: {followups.emailPreview.subject}</p>
              <p className="mt-2 text-xs text-muted-foreground">Links are visually accurate but disabled in this preview.</p>
              <a
                href={`/api/learning-follow-up/pause?preview=1&course=${encodeURIComponent(followups.emailPreview.courseSlug)}`}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary mt-4 w-full justify-center sm:w-auto"
              >
                Preview pause confirmation page
              </a>
              <iframe
                title="Learning follow-up email preview"
                srcDoc={followups.emailPreview.html}
                sandbox=""
                className="mt-4 h-[760px] w-full rounded-xl border border-border bg-white"
              />
              <details className="mt-4 rounded-lg border border-border p-4">
                <summary className="cursor-pointer text-xs font-black uppercase tracking-wider text-muted-foreground">Plain-text fallback</summary>
                <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-6 text-muted-foreground">{followups.emailPreview.text}</pre>
              </details>
            </div>
          </details>
        ) : null}

        <form className="grid gap-4 border-b border-border bg-background p-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-[1fr_1fr_2fr_auto] lg:items-end">
          <input type="hidden" name="course" value={progress.courseSlug} />
          <label className="block">
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Follow-up status</span>
            <PremiumPicker name="followupStatus" defaultValue={followupStatus} options={[
              { value: "all", label: "All statuses" }, { value: "active", label: "Active" },
              { value: "paused", label: "Paused" }, { value: "waiting", label: "Waiting for release" },
              { value: "completed", label: "Completed" }, { value: "expired", label: "Expired" },
              { value: "stopped", label: "Stopped" }
            ]} />
          </label>
          <label className="block">
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Programme</span>
            <PremiumPicker name="followupCourse" defaultValue={followupCourse} options={[
              { value: "all", label: "All programmes" },
              ...courses.map((course, index) => ({ key: `followup-${course.courseSlug}-${index}`, value: course.courseSlug, label: course.courseTitle || course.courseSlug }))
            ]} />
          </label>
          <label className="block">
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Learner or recipient</span>
            <input name="followupSearch" defaultValue={followupSearch} placeholder="Search name or email" className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm" />
          </label>
          <button className="btn-secondary h-[42px] justify-center" type="submit"><Search className="mr-2 h-4 w-4" />Filter</button>
        </form>

        <div className="max-h-[520px] overflow-auto bg-background">
          <table className="w-full min-w-[72rem] text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-border bg-card/95 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <tr><th className="px-6 py-4">Learner</th><th className="px-6 py-4">Programme</th><th className="px-6 py-4">Progress</th><th className="px-6 py-4">Last activity</th><th className="px-6 py-4">Next check</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-right">Control</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {followups.campaigns.length ? followups.campaigns.map((campaign) => (
                <tr key={campaign.campaignUuid} className="hover:bg-muted/10">
                  <td className="px-6 py-4"><p className="font-bold text-foreground">{campaign.learnerName}</p><p className="mt-1 text-xs text-muted-foreground">{campaign.recipientEmail}</p></td>
                  <td className="px-6 py-4"><p className="font-semibold">{campaign.courseSlug}</p><p className="mt-1 text-xs text-muted-foreground">{campaign.batchLabel}</p></td>
                  <td className="px-6 py-4"><p className="font-black">{campaign.completedLessons}/{campaign.totalLessons}</p><p className="mt-1 text-xs text-muted-foreground">{campaign.remainingLessons} remaining · {campaign.reminderCount} sent</p></td>
                  <td className="px-6 py-4"><p className="max-w-[220px] truncate font-semibold">{campaign.lastLessonTitle || "Not started"}</p><p className="mt-1 text-xs text-muted-foreground">{campaign.lastActivityAt ? formatDate(campaign.lastActivityAt) : "Never"}</p></td>
                  <td className="px-6 py-4 text-xs text-muted-foreground">{campaign.nextReminderAt ? formatDate(campaign.nextReminderAt) : "—"}</td>
                  <td className="px-6 py-4"><span className="rounded-md border border-border bg-muted/40 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest">{campaign.status.replace(/_/g, " ")}</span>{campaign.stoppedReason ? <p className="mt-2 text-[10px] text-muted-foreground">{campaign.stoppedReason.replace(/_/g, " ")}</p> : null}</td>
                  <td className="px-6 py-4 text-right">
                    {campaign.status === "stopped" && campaign.stoppedReason === "delivery_failed" ? (
                      <form action={retryLearningFollowupCampaignAction}>
                        <input type="hidden" name="campaignUuid" value={campaign.campaignUuid} />
                        <button type="submit" className="btn-secondary px-3 py-2 text-xs">Retry</button>
                      </form>
                    ) : !["completed", "expired", "stopped"].includes(campaign.status) ? (
                      <form action={setLearningFollowupCampaignPausedAction}>
                        <input type="hidden" name="campaignUuid" value={campaign.campaignUuid} />
                        <input type="hidden" name="paused" value={campaign.status === "paused" ? "false" : "true"} />
                        <button type="submit" className="btn-secondary px-3 py-2 text-xs">{campaign.status === "paused" ? "Resume" : "Pause"}</button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              )) : <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-muted-foreground">Run a safe preview to create and inspect eligible campaign records. No email will be sent.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border bg-muted/10 p-6 sm:p-8">
          <h3 className="font-heading text-lg font-black text-foreground">Delivery Audit</h3>
          <p className="mt-1 text-sm text-muted-foreground">Brevo submission, click, resumption, retry, and failure records.</p>
          <div className="mt-4 max-h-[360px] overflow-auto rounded-xl border border-border bg-background">
            <table className="w-full min-w-[64rem] text-left text-sm">
              <thead className="sticky top-0 border-b border-border bg-card text-[10px] font-bold uppercase tracking-widest text-muted-foreground"><tr><th className="px-4 py-3">Learner</th><th className="px-4 py-3">Recipient</th><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Outcome</th><th className="px-4 py-3">Provider</th></tr></thead>
              <tbody className="divide-y divide-border">
                {followups.deliveries.length ? followups.deliveries.map((delivery) => (
                  <tr key={delivery.deliveryUuid}>
                    <td className="px-4 py-3 font-semibold">{delivery.learnerName || "Learner"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{delivery.recipientEmail}</td>
                    <td className="max-w-[260px] truncate px-4 py-3" title={delivery.subject}>{delivery.subject || "Pending render"}</td>
                    <td className="px-4 py-3"><span className="rounded border border-border bg-muted/40 px-2 py-1 text-[10px] font-black uppercase">{delivery.status.replace(/_/g, " ")}</span><p className="mt-1 text-[10px] text-muted-foreground">{delivery.attempts} attempt{delivery.attempts === 1 ? "" : "s"}</p>{delivery.lastError ? <p className="mt-1 max-w-[260px] truncate text-[10px] text-destructive" title={delivery.lastError}>{delivery.lastError}</p> : null}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{delivery.bouncedAt ? `Bounced ${formatDate(delivery.bouncedAt)}` : delivery.resumedAt ? `Resumed ${formatDate(delivery.resumedAt)}` : delivery.clickedAt ? `Clicked ${formatDate(delivery.clickedAt)}` : delivery.deliveredAt ? `Delivered ${formatDate(delivery.deliveredAt)}` : delivery.sentAt ? `Sent ${formatDate(delivery.sentAt)}` : "Not sent"}{delivery.providerEvent ? <p className="mt-1 text-[10px] uppercase">Brevo: {delivery.providerEvent.replace(/_/g, " ")}</p> : null}</td>
                    <td className="max-w-[180px] truncate px-4 py-3 font-mono text-[10px] text-muted-foreground" title={delivery.providerMessageId}>{delivery.providerMessageId || "—"}</td>
                  </tr>
                )) : <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No delivery attempts recorded.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Main Ledger / Directory */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        
        {/* Filter Console */}
        <div className="border-b border-border bg-muted/20 p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Filter className="h-4 w-4" />
            </div>
            <h2 className="font-heading text-xl font-black text-foreground">Cohort Filters</h2>
          </div>
          
          <form className="grid gap-4 lg:grid-cols-[1.5fr_1fr_1fr_1.5fr_auto] lg:items-end">
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Course</span>
              <PremiumPicker name="course" defaultValue={progress.courseSlug} options={courseOptions} />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Enrollment Target</span>
              <PremiumPicker name="enrollment" defaultValue={progress.filters.enrollmentType} options={enrollmentOptions} />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Batch Allocation</span>
              <PremiumPicker name="batch" defaultValue={progress.filters.batchKey} options={batchOptions} />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Student Identity</span>
              <input name="search" defaultValue={search} placeholder="Name, email, school..." className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary shadow-sm" />
            </label>
            <button className="btn-primary h-[42px] w-full justify-center shadow-sm lg:w-auto" type="submit">
              <Search className="mr-2 h-4 w-4" /> Apply Search
            </button>
          </form>
        </div>

        {/* Data Table */}
        <div className="max-h-[600px] overflow-auto bg-background scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20">
          <table className="w-full min-w-[74rem] text-left text-sm whitespace-nowrap">
            <thead className="sticky top-0 z-10 border-b border-border bg-card/90 text-[10px] font-bold uppercase tracking-widest text-muted-foreground backdrop-blur-md">
              <tr>
                <th className="px-6 py-4">Learner Profile</th>
                <th className="px-6 py-4">Velocity</th>
                <th className="px-6 py-4">Overall Completion</th>
                <th className="px-6 py-4">Current Trajectory</th>
                <th className="px-6 py-4">Modular Breakdown</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {progress.students.length ? progress.students.map((student) => (
                <tr key={`${student.email}-${student.batchKey}-${student.enrollmentType}`} className="transition-colors hover:bg-muted/5">
                  <td className="px-6 py-4">
                    <p className="font-heading font-bold text-foreground">{student.fullName || "Unknown Student"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{student.email}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="inline-flex items-center rounded bg-muted/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {student.enrollmentType === "school" ? "School Org" : "Direct"}
                      </span>
                      <span className="inline-flex items-center rounded border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                        {student.batchLabel || "No Batch"}
                      </span>
                      {student.schoolName && (
                        <span className="inline-flex items-center rounded border border-sky-500/20 bg-sky-500/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-sky-600 dark:text-sky-400">
                          {student.schoolName}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-heading text-lg font-black text-foreground">
                      {student.completedLessons} <span className="text-sm font-medium text-muted-foreground">/ {student.totalLessons}</span>
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex w-[140px] items-center gap-3">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted shadow-inner">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${percentTone(student.completionPercent)}`} 
                          style={{ width: `${student.completionPercent}%` }} 
                        />
                      </div>
                      <span className="w-10 text-right font-mono text-xs font-bold text-foreground">
                        {student.completionPercent}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="max-w-[200px]">
                      <p className="truncate font-semibold text-foreground" title={student.lastWatchedLessonTitle || "No activity"}>
                        {student.lastWatchedLessonTitle || "Not started yet"}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {student.lastWatchedAt ? formatDate(student.lastWatchedAt) : "Never"}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex max-w-[280px] flex-wrap gap-1.5">
                      {student.moduleBreakdown.length ? student.moduleBreakdown.map((moduleRow, index) => (
                        <span 
                          key={`${student.email}-${moduleRow.moduleId}`} 
                          className="inline-flex cursor-help items-center rounded border border-border bg-muted/30 px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground" 
                          title={moduleRow.moduleTitle}
                        >
                          M{index + 1}: {moduleRow.completionPercent}%
                        </span>
                      )) : <span className="text-xs italic text-muted-foreground">No modules accessed.</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-xs font-bold text-foreground shadow-sm transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                      href={`/internal/learning-progress?course=${encodeURIComponent(progress.courseSlug)}&enrollment=${encodeURIComponent(progress.filters.enrollmentType)}&batch=${encodeURIComponent(progress.filters.batchKey)}&search=${encodeURIComponent(search)}&account=${encodeURIComponent(String(student.accountId || ""))}&email=${encodeURIComponent(student.email)}`}
                    >
                      <Eye className="mr-2 h-3.5 w-3.5" />
                      Deep Dive
                    </Link>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="mx-auto flex flex-col items-center justify-center">
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <UsersRound className="h-6 w-6" />
                      </div>
                      <h3 className="font-heading text-lg font-bold text-foreground">No Records Found</h3>
                      <p className="mt-1 text-sm text-muted-foreground">No student trajectories match the current filter criteria.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Deep Dive Detail View */}
      {(detailAccount || detailEmail) && (
        <section className="animate-in fade-in slide-in-from-bottom-4 overflow-hidden rounded-2xl border-2 border-primary/20 bg-card shadow-xl">
          {detail ? (
            <>
              {/* Detail Header */}
              <div className="flex flex-col gap-4 border-b border-border bg-muted/10 p-6 sm:flex-row sm:items-start sm:justify-between sm:p-8">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Deep Dive Profile</p>
                      <h2 className="font-heading text-2xl font-black text-foreground">{detail.student.fullName || "Unknown Student"}</h2>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium text-muted-foreground">
                    <span>{detail.student.email}</span>
                    {detail.student.schoolName && (
                      <>
                        <span className="h-1 w-1 rounded-full bg-border"></span>
                        <span className="flex items-center gap-1.5"><GraduationCap className="h-4 w-4" /> {detail.student.schoolName}</span>
                      </>
                    )}
                  </div>
                </div>
                <Link className="btn-secondary shrink-0 shadow-sm" href={listUrl}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Return to Ledger
                </Link>
              </div>

              {/* Progress Summary Ribbon */}
              <div className="border-b border-border bg-card p-6 sm:p-8">
                <div className="flex flex-col gap-6 md:flex-row md:items-center">
                  <div className="flex-1">
                    <div className="flex items-end justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Course Completion</span>
                      <span className="font-heading text-xl font-black text-foreground">{detail.progress.completionPercent}%</span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-muted shadow-inner">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${percentTone(detail.progress.completionPercent)}`} 
                        style={{ width: `${detail.progress.completionPercent}%` }} 
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6 md:shrink-0 md:pl-8">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Lessons Completed</p>
                      <p className="mt-1 font-heading text-2xl font-black text-foreground">
                        {detail.progress.completedLessons} <span className="text-sm font-medium text-muted-foreground">/ {detail.progress.totalLessons}</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Last Check-In</p>
                      <p className="mt-1 font-heading text-lg font-black text-foreground">
                        {detail.progress.lastWatchedAt ? formatDate(detail.progress.lastWatchedAt) : "Never"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Module Breakdown List */}
              <div className="bg-muted/5 p-6 sm:p-8">
                <h3 className="mb-6 flex items-center gap-2 font-heading text-lg font-black text-foreground">
                  <BookOpen className="h-5 w-5 text-primary" /> Curricular Trajectory
                </h3>
                
                <div className="grid gap-6">
                  {detail.modules.length ? detail.modules.map((moduleRow, moduleIndex) => (
                    <article key={moduleRow.moduleId} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-colors hover:border-primary/20">
                      
                      {/* Module Header */}
                      <div className="flex items-center justify-between border-b border-border bg-muted/20 p-5">
                        <div className="min-w-0 pr-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Module {moduleIndex + 1}</p>
                          <h4 className="mt-1 truncate font-heading text-lg font-black text-foreground">{moduleRow.moduleTitle || "Unnamed Module"}</h4>
                        </div>
                        <div className="flex h-10 w-16 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 font-mono text-sm font-bold text-primary shadow-inner">
                          {moduleRow.progress.completionPercent}%
                        </div>
                      </div>
                      
                      {/* Lesson Ledger */}
                      <div className="p-2">
                        {moduleRow.lessons.map((lesson) => {
                          const isComplete = lesson.isCompleted
                          return (
                            <div 
                              key={lesson.lessonId || `${moduleRow.moduleId}-${lesson.lessonOrder}`} 
                              className="group flex flex-col justify-between gap-4 rounded-lg p-3 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center"
                            >
                              <div className="flex items-start gap-3 min-w-0">
                                <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${isComplete ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground/50'}`}>
                                  {isComplete ? <CheckCircle2 className="h-3.5 w-3.5" /> : <div className="h-1.5 w-1.5 rounded-full bg-current"></div>}
                                </div>
                                <div className="min-w-0">
                                  <p className={`truncate font-semibold ${isComplete ? 'text-foreground' : 'text-muted-foreground'}`}>
                                    {lesson.lessonTitle || "Unnamed Lesson"}
                                  </p>
                                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground/80">
                                    {lesson.lastWatchedAt ? (
                                      <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {formatDate(lesson.lastWatchedAt)}</span>
                                    ) : (
                                      <span>Unopened</span>
                                    )}
                                    {lesson.watchSeconds > 0 && (
                                      <>
                                        <span className="h-1 w-1 rounded-full bg-border"></span>
                                        <span>{durationLabel(lesson.watchSeconds)} elapsed</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="shrink-0 pl-8 sm:pl-0">
                                <span className={`inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-widest shadow-sm ${
                                  isComplete ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-border bg-muted text-muted-foreground'
                                }`}>
                                  {isComplete ? "Completed" : "Pending"}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </article>
                  )) : (
                    <div className="flex items-center justify-center rounded-xl border border-dashed border-border py-12 text-sm font-semibold text-muted-foreground">
                      No modular data generated for this enrollment yet.
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <Search className="h-6 w-6" />
              </div>
              <h3 className="font-heading text-lg font-bold text-foreground">Profile Unavailable</h3>
              <p className="mt-1 text-sm text-muted-foreground">The requested student detail record could not be retrieved from the database.</p>
              <Link className="btn-secondary mt-6 shadow-sm" href={listUrl}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Return to Ledger
              </Link>
            </div>
          )}
        </section>
      )}
    </main>
  )
}
