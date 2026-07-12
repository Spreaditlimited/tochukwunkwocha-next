import type { Metadata } from "next"
import Link from "next/link"
import { Award, BookOpen, FileUp, Plus, RotateCcw, Trash2, Users } from "lucide-react"

import { AdvancedSeatPurchaseForm } from "@/components/schools/AdvancedSeatPurchaseForm"
import { SchoolDashboardShell } from "@/components/schools/SchoolDashboardShell"
import { SchoolCodeCopyButton } from "@/components/schools/SchoolCodeCopyButton"
import { SchoolWelcomeNotice } from "@/components/schools/SchoolWelcomeNotice"
import { requireSchoolAdmin } from "@/lib/school-auth"
import { getSchoolDashboardData } from "@/lib/school-dashboard"
import { buildMetadata } from "@/lib/site-seo"
import {
  addSchoolStudentAction,
  deleteSchoolCertificateAction,
  importSchoolStudentsAction,
  issueSchoolCertificateAction,
  resetSchoolStudentCodeAction,
  toggleSchoolStudentAction,
  upgradeSchoolAdvancedStudentsAction
} from "./actions"

export const metadata: Metadata = buildMetadata({
  title: "School Dashboard | Tochukwu Tech and AI Academy",
  description: "Manage Prompt to Profit for Schools students, seats, access codes, progress, and certificates.",
  path: "/schools/dashboard",
  noIndex: true
})

function formatDate(value: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "-"
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

function isSyntheticEmail(value: string) {
  return value.includes("@student-code.local")
}

export default async function SchoolDashboardPage({
  searchParams
}: {
  searchParams?: Promise<{ advanced_payment?: string; welcome?: string }>
}) {
  const params = searchParams ? await searchParams : {}
  const session = await requireSchoolAdmin()
  const { metrics, students, advanced, advancedCandidates } = await getSchoolDashboardData({
    schoolId: session.schoolId,
    courseSlug: session.courseSlug || "prompt-to-profit"
  })

  return (
    <SchoolDashboardShell session={session} active="overview" title={session.schoolName} eyebrow="School Workspace">
      <div className="space-y-8">
        <SchoolWelcomeNotice />
        {params.advanced_payment === "success" ? (
          <div className="rounded-lg border border-primary/20 bg-primary/10 p-4 text-sm font-semibold text-primary">
            Advanced seat payment confirmed. Your new advanced seats are now available.
          </div>
        ) : null}
        {params.advanced_payment === "failed" || params.advanced_payment === "cancelled" ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm font-semibold text-destructive">
            Advanced seat payment was not completed. No advanced seats were added.
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">School Account</p>
            <h2 className="mt-2 font-heading text-3xl font-black tracking-tight text-foreground">Overview</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Course: {session.courseSlug} • Admin: {session.fullName}
            </p>
          </div>
          <a href="/schools/book-call" className="btn-primary w-fit">Book support call</a>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Seats", value: `${metrics.seatsUsed} / ${metrics.seatsPurchased}`, sub: `Available: ${metrics.seatsAvailable}`, icon: Users },
            { label: "Average completion", value: `${metrics.averageCompletionPercent}%`, sub: "Active students", icon: BookOpen },
            { label: "Active in 7 days", value: String(metrics.activeLast7Days), sub: "Recent learners", icon: Users },
            { label: "Access expires", value: formatDate(metrics.accessExpiresAt), sub: "School license", icon: Award }
          ].map((card) => {
            const Icon = card.icon
            return (
              <div key={card.label} className="surface-raised bg-card p-5">
                <Icon className="h-5 w-5 text-primary" />
                <p className="mt-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">{card.label}</p>
                <p className="mt-2 font-heading text-2xl font-black text-foreground">{card.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{card.sub}</p>
              </div>
            )
          })}
        </div>

        <section id="bulk-enroll" className="surface-raised bg-card p-5 sm:p-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <div>
              <h2 className="font-heading text-2xl font-black text-foreground">Add Student</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Add one learner at a time. Leave email blank to use access-code-only onboarding.
              </p>
              <form action={addSchoolStudentAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <input
                  name="fullName"
                  required
                  placeholder="Full name"
                  className="rounded-md border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <input
                  name="email"
                  type="email"
                  placeholder="Optional email"
                  className="rounded-md border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <button className="btn-primary justify-center" type="submit">
                  <Plus className="mr-2 h-4 w-4" /> Add
                </button>
              </form>
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-heading text-lg font-black text-foreground">Bulk Upload</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Upload or paste CSV rows with `full_name,email` columns.</p>
                </div>
                <a href="/api/schools/students/template" className="btn-secondary w-fit px-4 py-2 text-xs">
                  Download CSV Template
                </a>
              </div>
              <form action={importSchoolStudentsAction} className="mt-4 grid gap-3">
                <textarea
                  name="csvText"
                  rows={5}
                  placeholder={`full_name,email\nJane Doe,\nJohn Doe,john@example.com`}
                  className="w-full rounded-md border border-input bg-background px-4 py-3 font-mono text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <input
                  name="csvFile"
                  type="file"
                  accept=".csv,text/csv"
                  className="rounded-md border border-input bg-background px-4 py-3 text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-bold file:text-primary-foreground"
                />
                <button className="btn-secondary justify-center" type="submit">
                  <FileUp className="mr-2 h-4 w-4" /> Import CSV
                </button>
              </form>
            </div>
          </div>
        </section>

        <section id="advanced" className="surface-raised bg-card p-5 sm:p-6">
          <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow">Prompt to Profit Advanced</p>
              <h2 className="mt-2 font-heading text-2xl font-black text-foreground">Advanced Seats</h2>
              <p className="mt-1 text-sm text-muted-foreground">Buy advanced seats, then upgrade eligible students.</p>
            </div>
            <a href="/courses/prompt-to-production" className="btn-secondary w-fit">Learn More</a>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              { label: "Purchased", value: advanced.seatsPurchased },
              { label: "Used", value: advanced.seatsUsed },
              { label: "Available", value: advanced.seatsAvailable }
            ].map((item) => (
              <article key={item.label} className="rounded-lg border border-border bg-muted/20 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{item.label}</p>
                <p className="mt-2 font-heading text-2xl font-black text-foreground">{item.value}</p>
              </article>
            ))}
          </div>

          <AdvancedSeatPurchaseForm minSeats={5} />

          <form action={upgradeSchoolAdvancedStudentsAction} className="mt-6 grid gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-heading text-lg font-black text-foreground">Upgrade Students</h3>
              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary px-4 py-2 text-xs" name="mode" value="selected" type="submit">Upgrade Selected</button>
                <button className="btn-primary px-4 py-2 text-xs" name="mode" value="all" type="submit">Upgrade All Eligible</button>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto rounded-lg border border-border bg-muted/20 p-2">
              {advancedCandidates.length ? advancedCandidates.map((student) => (
                <label key={student.id} className="flex items-center justify-between gap-3 rounded-md px-3 py-2 hover:bg-background">
                  <span className="flex min-w-0 items-center gap-3">
                    <input name="studentId" value={student.id} type="checkbox" disabled={!student.eligible} className="h-4 w-4 rounded border-input text-primary focus:ring-primary" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-foreground">{student.fullName}</span>
                      <span className="block truncate text-xs text-muted-foreground">{student.studentCode}</span>
                    </span>
                  </span>
                  <span className={student.eligible ? "text-xs font-bold text-primary" : "text-xs font-bold text-muted-foreground"}>
                    {student.eligible ? "Eligible" : student.alreadyUpgraded ? "Already upgraded" : "Inactive"}
                  </span>
                </label>
              )) : (
                <p className="p-4 text-sm text-muted-foreground">No students found.</p>
              )}
            </div>
          </form>

          {advanced.seatsAvailable <= 0 ? (
            <p className="mt-4 rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-sm font-semibold text-amber-700 dark:text-amber-300">
              No advanced seats are currently available. Advanced seat purchase still needs to be completed before upgrades can be applied.
            </p>
          ) : null}
        </section>

        <section id="students" className="surface-raised overflow-hidden bg-card">
          <div className="border-b border-border p-5 sm:p-6">
            <h2 className="font-heading text-2xl font-black text-foreground">Students</h2>
            <p className="mt-1 text-sm text-muted-foreground">{students.length} learner records</p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[72rem] w-full text-left text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Progress</th>
                  <th className="px-4 py-3">Last Activity</th>
                  <th className="px-4 py-3">Website</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3">Certificate</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {students.length ? students.map((student) => {
                  const active = student.status.toLowerCase() === "active"
                  return (
                    <tr key={student.id}>
                      <td className="px-4 py-4">
                        <p className="font-bold text-foreground">{student.fullName}</p>
                        <p className="text-xs text-muted-foreground">{isSyntheticEmail(student.email) ? "" : student.email}</p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <code className="rounded border border-border bg-muted/30 px-2 py-1 text-xs font-bold text-foreground">
                            {student.studentCode || "-"}
                          </code>
                          {student.studentCode ? <SchoolCodeCopyButton code={student.studentCode} /> : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-foreground">{student.completionPercent}%</td>
                      <td className="px-4 py-4 text-muted-foreground">{formatDate(student.lastActivityAt)}</td>
                      <td className="px-4 py-4">
                        {student.websiteUrl ? (
                          <a className="font-bold text-primary underline" href={student.websiteUrl} target="_blank" rel="noreferrer">
                            View site
                          </a>
                        ) : (
                          <span className="text-muted-foreground">Not submitted</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">{formatDate(student.websiteSubmittedAt)}</td>
                      <td className="px-4 py-4 text-foreground">
                        {student.certificateNo ? (
                          <Link
                            href={`/schools/certificate/?certificate_no=${encodeURIComponent(student.certificateNo)}`}
                            className="font-bold text-primary underline"
                            target="_blank"
                          >
                            {student.certificateNo}
                          </Link>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className={active ? "rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-bold text-primary" : "rounded-full border border-border bg-muted/30 px-2 py-1 text-xs font-bold text-muted-foreground"}>
                          {student.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <form action={toggleSchoolStudentAction}>
                            <input type="hidden" name="studentId" value={student.id} />
                            <input type="hidden" name="active" value={active ? "0" : "1"} />
                            <button className="btn-secondary px-3 py-2 text-xs" type="submit">{active ? "Disable" : "Enable"}</button>
                          </form>
                          <form action={resetSchoolStudentCodeAction}>
                            <input type="hidden" name="studentId" value={student.id} />
                            <button className="btn-secondary px-3 py-2 text-xs" type="submit">
                              <RotateCcw className="mr-1 h-3 w-3" /> Code
                            </button>
                          </form>
                          {student.certificateNo ? (
                            <form action={deleteSchoolCertificateAction}>
                              <input type="hidden" name="studentId" value={student.id} />
                              <button className="btn-secondary px-3 py-2 text-xs" type="submit">
                                <Trash2 className="mr-1 h-3 w-3" /> Cert
                              </button>
                            </form>
                          ) : (
                            <form action={issueSchoolCertificateAction}>
                              <input type="hidden" name="studentId" value={student.id} />
                              <button
                                className="btn-secondary px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                                type="submit"
                                disabled={student.completionPercent < 100 || !student.websiteUrl || !active}
                              >
                                Issue cert
                              </button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                }) : (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No students yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </SchoolDashboardShell>
  )
}
