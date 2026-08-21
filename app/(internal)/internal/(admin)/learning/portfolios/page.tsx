import Link from "next/link"
import { BriefcaseBusiness, CheckCircle2, Clock, ExternalLink, ShieldCheck, UserRoundSearch } from "lucide-react"

import { DashboardStatCard, DashboardStatsVisibility } from "@/components/dashboard/DashboardStatsVisibility"
import { PremiumPicker } from "@/components/PremiumPicker"
import { listAdminStudentHireEnquiries, listAdminStudentPortfolios } from "@/lib/student-public-profile"
import { formatDate } from "@/lib/utils"
import { reviewStudentPortfolioAction, updateStudentHireEnquiryAction } from "./actions"

export const dynamic = "force-dynamic"

function value(row: Record<string, unknown>, key: string, max = 5000) {
  return String(row[key] || "").trim().slice(0, max)
}

function statusClass(status: string) {
  if (status === "approved" || status === "closed") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
  if (status === "rejected" || status === "spam" || status === "failed") return "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300"
  return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
}

export default async function StudentPortfoliosAdminPage() {
  const [portfolios, enquiries] = await Promise.all([listAdminStudentPortfolios(), listAdminStudentHireEnquiries()])
  const pending = portfolios.filter((profile) => value(profile, "reviewStatus", 24) === "pending").length
  const published = portfolios.filter((profile) => profile.hasPublishedVersion && profile.isPublic).length
  const newEnquiries = enquiries.filter((item) => value(item, "status") === "new").length
  const reviewOptions = [
    { value: "pending", label: "Pending review" },
    { value: "approved", label: "Approve and publish" },
    { value: "rejected", label: "Request changes" }
  ]
  const enquiryOptions = [
    { value: "new", label: "New" },
    { value: "in_progress", label: "In progress" },
    { value: "closed", label: "Closed" },
    { value: "spam", label: "Spam" }
  ]

  return (
    <main className="space-y-8 pb-12">
      <header className="border-b border-border pb-6">
        <p className="eyebrow">Public talent directory</p>
        <h1 className="mt-1 font-heading text-3xl font-black tracking-tight">Student Portfolios &amp; Hiring</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">Review consented portfolio copy and portraits, publish factual snapshots, and manage protected professional enquiries without exposing student contact information.</p>
      </header>

      <DashboardStatsVisibility storageKey="tochukwu-student-portfolio-stats">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardStatCard statKey="Profiles" label="Submitted profiles" value={portfolios.length} icon={<UserRoundSearch className="h-5 w-5" />} valueClassName="text-4xl" />
          <DashboardStatCard statKey="Pending" label="Awaiting review" value={pending} icon={<Clock className="h-5 w-5" />} iconClassName="bg-amber-500/10 text-amber-600" valueClassName="text-4xl" />
          <DashboardStatCard statKey="Published" label="Published profiles" value={published} icon={<CheckCircle2 className="h-5 w-5" />} iconClassName="bg-emerald-500/10 text-emerald-600" valueClassName="text-4xl" />
          <DashboardStatCard statKey="Enquiries" label="New hiring enquiries" value={newEnquiries} icon={<BriefcaseBusiness className="h-5 w-5" />} iconClassName="bg-sky-500/10 text-sky-600" valueClassName="text-4xl" />
        </section>
      </DashboardStatsVisibility>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-muted/20 p-6 sm:p-8"><h2 className="font-heading text-xl font-black">Portfolio review queue</h2><p className="mt-1 text-sm text-muted-foreground">Approval creates an immutable public snapshot. Later edits return to review without overwriting the live version.</p></div>
        <div className="grid gap-5 p-6 sm:p-8">
          {portfolios.length ? portfolios.map((profile) => {
            const reviewStatus = value(profile, "reviewStatus", 24)
            const profileUuid = value(profile, "profileUuid", 64)
            const publicSlug = value(profile, "publicSlug", 190)
            return <article key={profileUuid} className="overflow-hidden rounded-2xl border border-border bg-background">
              <div className="flex flex-col gap-4 border-b border-border bg-muted/10 p-5 lg:flex-row lg:items-start lg:justify-between">
                <div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${statusClass(reviewStatus)}`}>{reviewStatus.replace(/_/g, " ")}</span>{profile.managedOrYoung ? <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-violet-700 dark:text-violet-300">Young / managed learner</span> : null}{profile.openToWork ? <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">Requests hiring</span> : null}</div><h3 className="mt-3 font-heading text-xl font-black">{value(profile, "displayName")}</h3><p className="mt-1 text-sm text-muted-foreground">{value(profile, "email")}</p></div>
                <div className="text-left text-xs text-muted-foreground lg:text-right"><p>Updated {formatDate((profile as Record<string, unknown>).updatedAt as Date)}</p>{profile.hasPublishedVersion ? <Link href={`/projects/${publicSlug}`} target="_blank" className="mt-2 inline-flex items-center gap-1 font-bold text-primary">View live version <ExternalLink className="h-3.5 w-3.5" /></Link> : null}</div>
              </div>
              <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
                <div className="grid gap-5 border-b border-border p-5 lg:border-b-0 lg:border-r">
                  <div><p className="label">Headline</p><p className="mt-2 font-bold">{value(profile, "professionalHeadline") || "Not provided"}</p></div>
                  <div><p className="label">Biography</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{value(profile, "biography", 1800) || "Not provided"}</p></div>
                  <div><p className="label">Featured project</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{value(profile, "featuredProjectSummary", 1800) || "Not provided"}</p></div>
                  <dl className="grid gap-3 rounded-xl border border-border bg-muted/10 p-4 text-xs sm:grid-cols-2"><div><dt className="label">Country</dt><dd className="mt-1 font-semibold">{value(profile, "country") || "Not public"}</dd></div><div><dt className="label">Skills</dt><dd className="mt-1 font-semibold">{profile.skills.join(", ") || "None"}</dd></div><div><dt className="label">Portrait consent</dt><dd className="mt-1 font-semibold">{profile.profilePictureConsent ? "Yes" : "No"}</dd></div><div><dt className="label">Published version</dt><dd className="mt-1 font-semibold">{profile.hasPublishedVersion ? "Exists" : "Not yet"}</dd></div></dl>
                </div>
                <form action={reviewStudentPortfolioAction} className="grid content-start gap-4 p-5">
                  <input type="hidden" name="profileUuid" value={profileUuid} />
                  <label><span className="label mb-2 block">Publication decision</span><PremiumPicker name="reviewStatus" defaultValue={reviewStatus} options={reviewOptions} /></label>
                  {profile.managedOrYoung ? <label className="flex items-start gap-3 rounded-xl border border-violet-500/20 bg-violet-500/10 p-4 text-sm leading-relaxed"><input type="checkbox" name="guardianConsentConfirmed" defaultChecked={profile.guardianConsentConfirmed} className="mt-1 h-4 w-4 accent-primary" /><span><strong>Responsible-adult consent confirmed.</strong> Check only after verifying permission for the enhanced biography and any portrait selected for publication.</span></label> : null}
                  <label><span className="label mb-2 block">Student-facing review note</span><textarea name="reviewNote" rows={6} defaultValue={value(profile, "reviewNote", 2000)} className="field resize-y" placeholder="Explain any changes required. The student will see this note." /></label>
                  <button className="btn-primary w-full justify-center" type="submit"><ShieldCheck className="mr-2 h-4 w-4" /> Save portfolio review</button>
                </form>
              </div>
            </article>
          }) : <p className="rounded-xl border border-dashed border-border py-16 text-center text-sm font-semibold text-muted-foreground">No students have submitted enhanced portfolio information yet.</p>}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-muted/20 p-6 sm:p-8"><h2 className="font-heading text-xl font-black">Hiring enquiries</h2><p className="mt-1 text-sm text-muted-foreground">Every enquiry is retained for moderation and delivery auditing. Student contact details are not exposed to senders.</p></div>
        <div className="grid gap-5 p-6 sm:p-8">
          {enquiries.length ? enquiries.map((enquiry) => {
            const enquiryUuid = value(enquiry, "enquiryUuid", 64)
            const status = value(enquiry, "status", 32)
            return <article key={enquiryUuid} className="grid overflow-hidden rounded-2xl border border-border bg-background lg:grid-cols-[1.1fr_0.9fr]">
              <div className="border-b border-border p-5 lg:border-b-0 lg:border-r"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${statusClass(status)}`}>{status.replace(/_/g, " ")}</span><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${statusClass(value(enquiry, "deliveryStatus", 32))}`}>Email {value(enquiry, "deliveryStatus", 32)}</span></div><h3 className="mt-3 font-heading text-xl font-black">{value(enquiry, "studentName")}</h3><p className="mt-2 text-sm font-semibold">From {value(enquiry, "enquirerName")} · {value(enquiry, "organisation") || "No organisation"}</p><p className="mt-1 text-xs text-muted-foreground">{value(enquiry, "enquirerEmail")} · {value(enquiry, "opportunityType").replace(/_/g, " ")} · {formatDate(enquiry.createdAt as Date)}</p><p className="mt-5 whitespace-pre-wrap rounded-xl border border-border bg-muted/10 p-4 text-sm leading-7">{value(enquiry, "message", 4000)}</p><div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2"><p><strong>Timeline:</strong> {value(enquiry, "timeline") || "Not provided"}</p><p><strong>Budget:</strong> {value(enquiry, "budgetRange") || "Not provided"}</p></div>{value(enquiry, "deliveryError", 2000) ? <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">{value(enquiry, "deliveryError", 2000)}</p> : null}</div>
              <form action={updateStudentHireEnquiryAction} className="grid content-start gap-4 p-5"><input type="hidden" name="enquiryUuid" value={enquiryUuid} /><label><span className="label mb-2 block">Enquiry status</span><PremiumPicker name="status" defaultValue={status} options={enquiryOptions} /></label><label><span className="label mb-2 block">Internal note</span><textarea name="adminNote" rows={6} defaultValue={value(enquiry, "adminNote", 2000)} className="field resize-y" placeholder="Due diligence, follow-up or closure notes" /></label><button type="submit" className="btn-primary w-full justify-center">Save enquiry status</button></form>
            </article>
          }) : <p className="rounded-xl border border-dashed border-border py-16 text-center text-sm font-semibold text-muted-foreground">No hiring enquiries have been received.</p>}
        </div>
      </section>
    </main>
  )
}
