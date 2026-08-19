import Link from "next/link"
import Image from "next/image"
import {
  CheckCircle2,
  Clock3, 
  ExternalLink,
  PlayCircle,
  Video
} from "lucide-react"

import {
  EmptyStudentState,
  StudentDashboardCard,
  StudentDashboardShell
} from "@/components/student-dashboard/StudentDashboardShell"
import { BatchSwitchPanel, type BatchSwitchEnrollment } from "@/components/student-dashboard/BatchSwitchPanel"
import { CourseWorkbookDownloadLink } from "@/components/student-dashboard/CourseWorkbookDownloadLink"
import { TrademarkText } from "@/components/TrademarkText"
import { listIncludedPromptToProfitWorkbooks } from "@/lib/course-workbooks"
import { mapWithConcurrency } from "@/lib/async-pool"
import { getBatchSwitchOptions } from "@/lib/student-batch-switch"
import { getLearningCourseForStudent } from "@/lib/learning-player"
import {
  formatMinorCurrency,
  hasPendingManualPayment,
  listStudentCourses,
  statusLabel,
  statusTone
} from "@/lib/student-dashboard"
import { requireStudent } from "@/lib/student-auth"
import { formatDate, formatDateTimeWAT, watWallDateTimeMs } from "@/lib/utils"

export const dynamic = "force-dynamic"

type StudentCoursesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function liveSessionButtonLabel(title: string) {
  const cleanTitle = String(title || "").trim()
  const dayMatch = cleanTitle.match(/\bday\s*(\d+)\b/i)
  if (dayMatch && /\blive\b/i.test(cleanTitle)) return `Day ${dayMatch[1]} Live`
  return cleanTitle || "Live Class"
}

export default async function StudentCoursesPage({ searchParams }: StudentCoursesPageProps) {
  const session = await requireStudent()
  const params = searchParams ? await searchParams : {}
  const courses = await listStudentCourses(session.account.email, session.account.id)
  const includedWorkbooks = await listIncludedPromptToProfitWorkbooks({
    accountId: session.account.id,
    email: session.account.email
  })
  const workbooksUnlocked = includedWorkbooks.some((workbook) => workbook.batchStarted)
  const workbookBatchStartAt = includedWorkbooks.find((workbook) => workbook.batchStartAt)?.batchStartAt || null
  const progressEntries = await mapWithConcurrency(courses, 2, async (course) => {
    if (!course.isActive) return [course.courseSlug, { completedLessons: 0, totalLessons: 0, completionPercent: 0 }] as const
    const result = await getLearningCourseForStudent({
      accountId: session.account.id,
      email: session.account.email,
      courseSlug: course.courseSlug
    }).catch(() => null)
    return [
      course.courseSlug,
      result?.ok
        ? result.course.progress
        : { completedLessons: 0, totalLessons: 0, completionPercent: 0 }
    ] as const
  })
  const progressByCourse = new Map(progressEntries)
  const manualPaymentPending =
    String(params.manual_payment || "") === "pending" &&
    (await hasPendingManualPayment(session.account.email))
  const batchSwitchOptions = await getBatchSwitchOptions(session.account)
  const batchSwitchEnrollments: BatchSwitchEnrollment[] = batchSwitchOptions.map((item) => ({
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    courseSlug: item.courseSlug,
    batchKey: item.batchKey,
    batchLabel: item.batchLabel,
    batchStartText: item.batchStartText,
    currentBatchIsFuture: item.currentBatchIsFuture,
    seatCount: item.seatCount,
    canSwitch: item.canSwitch,
    lockedReason: item.lockedReason,
    options: item.options.map((option) => ({
      batchKey: option.batchKey,
      batchLabel: option.batchLabel,
      batchStartText: option.batchStartText,
      remainingSeats: option.remainingSeats
    }))
  }))

  return (
    <StudentDashboardShell 
      account={session.account} 
      active="courses" 
      title="Courses"
      eyebrow="Learning Workspace"
    >
      {/* Header Section */}
      <StudentDashboardCard className="bg-gradient-to-br from-card to-muted/30">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="max-w-2xl">
            <p className="eyebrow text-primary">Learning Access</p>
            <h2 className="mt-2 font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">
              Your Courses
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Manage your paid enrollments, approved manual payments, and pending manual verifications connected to your student account.
            </p>
          </div>
          <Link href="/courses" className="btn-secondary shrink-0 shadow-sm">
            Explore More Courses
          </Link>
        </div>
      </StudentDashboardCard>

      {manualPaymentPending ? (
        <StudentDashboardCard className="mt-6 border-amber-400/40 bg-amber-50 text-amber-950 dark:bg-amber-500/10 dark:text-amber-100">
          <div className="flex items-start gap-3">
            <Clock3 className="mt-1 h-5 w-5 shrink-0" />
            <div>
              <h2 className="font-heading text-lg font-black">Manual payment submitted</h2>
              <p className="mt-2 text-sm leading-relaxed">
                Your student account is active, but this enrollment is awaiting payment verification. Course access will open here after approval.
              </p>
            </div>
          </div>
        </StudentDashboardCard>
      ) : null}

      {/* Courses Grid */}
      <div className="mt-8">
        {courses.length ? (
          <div className="grid gap-6 xl:grid-cols-2">
            {courses.map((course) => {
              const isActive = course.isActive
              const isGroupSeat = course.source === "family_child"
              const courseStartMs = watWallDateTimeMs(course.courseStartAt)
              const courseStartsInFuture = Boolean(
                isActive &&
                Number.isFinite(courseStartMs) &&
                courseStartMs > Date.now()
              )
              const courseStartLabel = course.courseStartAt ? formatDateTimeWAT(course.courseStartAt) : ""
              const firstLessonLabel = course.firstRecordedLessonAvailableAt
                ? formatDateTimeWAT(course.firstRecordedLessonAvailableAt)
                : ""
              const progress = progressByCourse.get(course.courseSlug) || {
                completedLessons: 0,
                totalLessons: 0,
                completionPercent: 0
              }

              return (
                <StudentDashboardCard 
                  key={`${course.source}-${course.uuid}`} 
                  className="flex h-full flex-col overflow-hidden p-0 transition-all hover:border-primary/30 hover:shadow-md"
                >
                  {/* Course Header */}
                  <div className="border-b border-border bg-muted/20 p-6 sm:p-8">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          {course.source.replace(/_/g, " ")}
                        </p>
                        <h2 className="font-heading text-xl font-black text-foreground sm:text-2xl">
                          <TrademarkText text={course.courseName} />
                        </h2>
                        <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm">
                          <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                          {course.batchLabel || course.batchKey || "General access"}
                        </div>
                        <BatchSwitchPanel
                          enrollments={batchSwitchEnrollments}
                          sourceType={course.source}
                          courseSlug={course.courseSlug}
                          batchKey={course.batchKey}
                          showUnavailable
                        />
                      </div>
                      
                      {/* Status Icon */}
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border shadow-sm ${
                        isActive 
                          ? "student-status-icon-paid" 
                          : "student-status-icon-pending"
                      }`}>
                        {isActive ? (
                          <CheckCircle2 className="h-6 w-6" />
                        ) : (
                          <Clock3 className="h-6 w-6" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Course Metadata Grid */}
                  <div className="p-6 sm:p-8">
                    <div className="grid gap-4 rounded-xl border border-border bg-background/50 p-5 sm:grid-cols-2">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Status</p>
                        <span className={`mt-2 inline-flex rounded-md border px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${statusTone(course.status)}`}>
                          {statusLabel(course.status)}
                        </span>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Amount</p>
                        <p className="mt-2 font-heading text-lg font-black text-foreground">
                          {isGroupSeat ? "Group seat" : formatMinorCurrency(course.currency, course.amountMinor)}
                        </p>
                      </div>
                      <div className="pt-2 sm:border-t sm:border-border">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                          {isActive ? "Paid On" : "Submitted On"}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-foreground">
                          {formatDate(course.paidAt || course.submittedAt)}
                        </p>
                      </div>
                      <div className="pt-2 sm:border-t sm:border-border">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                          {courseStartsInFuture ? "Starts On" : "Access Expires"}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-foreground">
                          {courseStartsInFuture
                            ? courseStartLabel
                            : course.accessExpiresAt
                              ? formatDate(course.accessExpiresAt)
                              : "Pending approval"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-border bg-background/50 p-5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Course Progress</p>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {progress.completedLessons}/{progress.totalLessons} lessons completed ({progress.completionPercent}%).
                      </p>
                    </div>
                  </div>

                  {/* Course Actions */}
                  <div className="mt-auto border-t border-border bg-muted/10 p-6 sm:p-8">
                    {isActive && course.liveSessions.length ? (
                      <div className="mb-5 rounded-xl border border-sky-400/30 bg-sky-50 p-4 text-sky-950 dark:bg-sky-500/10 dark:text-sky-100">
                        <p className="text-[11px] font-black uppercase tracking-widest text-sky-700 dark:text-sky-300">Live classes</p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {course.liveSessions.map((session) => {
                            const sessionStartMs = watWallDateTimeMs(session.startsAt)
                            const accessOpensMs = sessionStartMs - 30 * 60 * 1000
                            const sessionLocked = !Number.isFinite(accessOpensMs) || accessOpensMs > Date.now()
                            const content = (
                              <>
                                <Video className="mr-2 h-4 w-4 shrink-0" />
                                <span>{liveSessionButtonLabel(session.title)}</span>
                              </>
                            )

                            return (
                              <div key={session.sessionUuid} className="space-y-2">
                                {sessionLocked ? (
                                  <button
                                    type="button"
                                    disabled
                                    className="btn-primary min-h-12 w-full cursor-not-allowed opacity-60 shadow-sm"
                                  >
                                    {content}
                                  </button>
                                ) : (
                                  <a
                                    href={session.zoomJoinUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn-primary min-h-12 w-full shadow-sm"
                                  >
                                    {content}
                                  </a>
                                )}
                                {session.startsAtLabel ? (
                                  <p className="text-xs font-semibold leading-relaxed text-sky-800 dark:text-sky-200">
                                    {sessionLocked ? `Unlocks 30 minutes before the session. Session: ${session.startsAtLabel}.` : `Live class scheduled for ${session.startsAtLabel}.`}
                                  </p>
                                ) : null}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ) : null}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-3">
                        {isActive && courseStartsInFuture ? (
                          <>
                            <button
                              type="button"
                              className="btn-primary w-full cursor-not-allowed opacity-60 shadow-sm"
                              disabled
                              title={`Unlocks on ${courseStartLabel}`}
                            >
                              <PlayCircle className="mr-2 h-4 w-4" />
                              Open Course Player
                            </button>
                            <p className="rounded-xl border border-amber-400/30 bg-amber-50 px-4 py-3 text-sm font-semibold leading-relaxed text-amber-950 dark:bg-amber-500/10 dark:text-amber-100">
                              This button unlocks on {courseStartLabel}.
                              {firstLessonLabel ? ` Your first recorded lesson will become available in the course player on ${firstLessonLabel}.` : null}
                            </p>
                          </>
                        ) : isActive ? (
                          <Link
                            href={`/dashboard/courses/player?course=${encodeURIComponent(course.courseSlug)}`}
                            className="btn-primary w-full shadow-sm"
                          >
                            <PlayCircle className="mr-2 h-4 w-4" />
                            Open Course Player
                          </Link>
                        ) : null}
                      </div>
                      <div>
                        <Link
                          href={`/courses/${encodeURIComponent(course.courseSlug)}`}
                          className="btn-secondary w-full"
                        >
                          View Course Details
                          <ExternalLink className="ml-2 h-4 w-4 text-muted-foreground" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </StudentDashboardCard>
              )
            })}
          </div>
        ) : (
          <EmptyStudentState
            icon="book"
            title="No courses found"
            description="You do not have any paid or pending course records connected to this student account. Explore our curriculum to begin your learning journey."
            action={
              <Link href="/courses" className="btn-primary shadow-sm">
                Explore Curriculum
              </Link>
            }
          />
        )}
      </div>

      {includedWorkbooks.length ? (
        <StudentDashboardCard className="mt-8 overflow-hidden p-0">
          <div className="border-b border-border bg-gradient-to-br from-primary/10 via-card to-sky-500/10 p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div className="max-w-2xl">
                <p className="eyebrow text-primary">Included with your enrollment</p>
                <h2 className="mt-2 font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                  Your 5 Software Workbooks
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {workbooksUnlocked
                    ? "These PDF workbooks are free with your completed Prompt to Profit enrollment. Download them and keep building after Day 5."
                    : `These five PDF workbooks are included with your completed enrollment and will unlock when your assigned batch starts${workbookBatchStartAt ? ` on ${formatDateTimeWAT(workbookBatchStartAt)}` : ""}.`}
                </p>
              </div>
              <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-widest ${workbooksUnlocked ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"}`}>
                {workbooksUnlocked ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                {workbooksUnlocked ? "Included" : "Included · Unlocks at batch start"}
              </span>
            </div>
          </div>

          <div className="grid gap-5 p-6 sm:grid-cols-2 sm:p-8 xl:grid-cols-5">
            {includedWorkbooks.map((workbook) => (
              <article key={workbook.sku} className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <div className="relative overflow-hidden border-b border-border bg-muted/30">
                  <Image
                    src={workbook.coverImageUrl}
                    alt={`${workbook.title} workbook cover`}
                    width={1130}
                    height={1600}
                    sizes="(min-width: 1280px) 220px, (min-width: 640px) 45vw, 90vw"
                    className="aspect-[113/160] w-full object-cover"
                  />
                  <span className="absolute left-3 top-3 rounded-full border border-white/20 bg-brand-ink/90 px-3 py-1 font-mono text-[0.65rem] font-black uppercase tracking-widest text-sky-300 shadow-lg">
                    Workbook {workbook.number}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="font-heading text-base font-black leading-tight text-foreground">{workbook.title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{workbook.description}</p>
                  {workbook.available ? (
                    <CourseWorkbookDownloadLink href={workbook.downloadHref} title={workbook.title} />
                  ) : (
                    <button type="button" disabled className="btn-secondary mt-5 w-full cursor-not-allowed opacity-60">
                      {workbook.batchStarted ? "PDF coming soon" : "Available when batch starts"}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </StudentDashboardCard>
      ) : null}
    </StudentDashboardShell>
  )
}
