import Link from "next/link"
import { 
  ArrowLeft,
  BookOpen, 
  CheckCircle2, 
  ChevronRight, 
  Clock, 
  Eye, 
  Filter, 
  GraduationCap, 
  PlaySquare, 
  Search, 
  User, 
  UsersRound 
} from "lucide-react"

import { PremiumPicker } from "@/components/PremiumPicker"
import {
  getStudentCourseProgressDetail,
  listLearningProgressCourseOptions,
  listStudentsProgressByCourse
} from "@/lib/admin-learning-progress"
import { formatDate } from "@/lib/utils"

export const dynamic = "force-dynamic"

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

export default async function InternalLearningProgressPage({ searchParams }: PageProps) {
  const params = await searchParams || {}
  const courseSlug = param(params, "course", "prompt-to-profit")
  const enrollmentType = param(params, "enrollment", "all")
  const batchKey = param(params, "batch", "all")
  const search = param(params, "search", "")
  const detailAccount = param(params, "account", "")
  const detailEmail = param(params, "email", "")

  const [courses, progress] = await Promise.all([
    listLearningProgressCourseOptions(),
    listStudentsProgressByCourse({ courseSlug, enrollmentType, batchKey, search })
  ])
  
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

      {/* Primary Metrics Grid */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="group flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Active Cohort Students</p>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-110">
              <UsersRound className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-6 font-heading text-4xl font-black text-foreground">{progress.students.length}</p>
        </div>
        
        <div className="group flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Course Lessons</p>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 transition-transform group-hover:scale-110 dark:text-amber-400">
              <PlaySquare className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-6 font-heading text-4xl font-black text-foreground">{progress.totalLessons}</p>
        </div>

        <div className="group flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Target Course</p>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 transition-transform group-hover:scale-110 dark:text-emerald-400">
              <BookOpen className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-6 truncate font-heading text-2xl font-black text-foreground" title={progress.courseSlug}>
            {progress.courseSlug}
          </p>
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
