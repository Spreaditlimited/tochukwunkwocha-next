import Link from "next/link"
import {
  ExternalLink,
  GraduationCap,
  Layers3,
  MonitorPlay,
  PlaySquare,
  Save,
  Trash2,
  Video
} from "lucide-react"

import { PremiumPicker } from "@/components/PremiumPicker"
import { DashboardStatCard, DashboardStatsVisibility } from "@/components/dashboard/DashboardStatsVisibility"
import { listVideoLibrary } from "@/lib/admin-video-library"
import { formatDate, formatDateTimeWAT } from "@/lib/utils"
import {
  activateCourseBatchAction,
  cloneVideoLibraryModuleAction,
  deleteCourseBatchAction,
  deleteCourseLiveSessionAction,
  detachVideoLibraryModuleAction,
  importVideoLibraryCsvAction,
  saveCourseBatchAction,
  saveCourseLiveSessionAction,
  savePublicVideoSlotAction,
  saveVideoLibraryCourseAction,
  saveVideoLibraryModuleAction
} from "./actions"
import { AccessibilityGenerateButton } from "./AccessibilityGenerateButton"
import { CloudflareProgressPanel } from "./CloudflareProgressPanel"
import { LessonMapperClient } from "./LessonMapperClient"
import { ModuleBatchRulesClient } from "./ModuleBatchRulesClient"
import { ModuleDescriptionField } from "./ModuleDescriptionField"
import { VideoLibraryScrollRestorer } from "./VideoLibraryScrollRestorer"

export const dynamic = "force-dynamic"

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function param(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key]
  return Array.isArray(value) ? value[0] || "" : value || ""
}

function moneyInput(value: number | bigint | null | undefined) {
  if (!value) return ""
  return String(Number(value) / 100)
}

function dateInput(value: Date | null | undefined) {
  if (!value) return ""
  return [
    value.getUTCFullYear(),
    String(value.getUTCMonth() + 1).padStart(2, "0"),
    String(value.getUTCDate()).padStart(2, "0")
  ].join("-") + `T${String(value.getUTCHours()).padStart(2, "0")}:${String(value.getUTCMinutes()).padStart(2, "0")}`
}

function moduleBatchRuleProps(
  batches: Array<{ batchKey: string; batchLabel: string | null; batchStartAt: Date | null; status: string | null }>,
  schedules: Array<{ batchKey: string; accessMode: string; dripAt: Date | null }>
) {
  return {
    batches: batches.map((batch) => ({
      batchKey: batch.batchKey,
      batchLabel: batch.batchLabel || "",
      batchStartAt: dateInput(batch.batchStartAt),
      status: batch.status || ""
    })),
    schedules: schedules.map((schedule) => ({
      batchKey: schedule.batchKey,
      accessMode: schedule.accessMode === "drip" ? "drip" : "immediate",
      dripAt: dateInput(schedule.dripAt)
    }))
  }
}

function paymentEnabled(methods: string | null | undefined, method: string) {
  const list = String(methods || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
  if (!list.length) return true
  return list.includes(method)
}

function activePill(active: unknown, activeLabel = "Published", inactiveLabel = "Draft") {
  const isActive = Number(active || 0) === 1
  return (
    <span className={isActive
      ? "inline-flex rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400"
      : "inline-flex rounded-md border border-border bg-muted/40 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground"
    }>
      {isActive ? activeLabel : inactiveLabel}
    </span>
  )
}

function videoLabel(video: { id: bigint; videoUid: string; filename: string | null; readyToStream: number | bigint | boolean; sourceDeletedAt: Date | null }) {
  const status = video.sourceDeletedAt ? "deleted" : Number(video.readyToStream || 0) === 1 ? "ready" : "processing"
  return `${video.filename || video.videoUid} · ${status}`
}

function preserveModuleScheduleInputs(
  schedules: Array<{ batchKey: string; accessMode: string; dripAt: Date | null }>
) {
  return schedules.map((schedule, index) => (
    <span key={`${schedule.batchKey}-${index}`}>
      <input type="hidden" name="dripBatchKey" value={schedule.batchKey} />
      <input type="hidden" name="dripAccessMode" value={schedule.accessMode || "drip"} />
      <input type="hidden" name="dripAt" value={dateInput(schedule.dripAt)} />
    </span>
  ))
}

function videoLibraryHref(params: Record<string, string | number | bigint | null | undefined>) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    const stringValue = value === null || value === undefined ? "" : String(value)
    if (stringValue) query.set(key, stringValue)
  })
  const qs = query.toString()
  return qs ? `/internal/video-library?${qs}` : "/internal/video-library"
}

export default async function InternalVideoLibraryPage({ searchParams }: PageProps) {
  const params = await searchParams || {}
  const selectedModuleId = BigInt(Number(param(params, "moduleId") || 0))
  const selectedCourseSlug = param(params, "course") || ""
  const selectedModuleCourseSlug = param(params, "moduleCourse") || ""
  const selectedModuleTableCourseSlug = param(params, "moduleTableCourse") || ""
  const selectedModuleTableBatchKey = param(params, "moduleTableBatch") || ""
  const { courses, modules, lessons, videos, batches, moduleDripSchedules, publicVideoSlots, liveSessions } = await listVideoLibrary()

  const selectedModule = selectedModuleId > BigInt(0)
    ? modules.find((module) => module.id === selectedModuleId && (!selectedModuleCourseSlug || module.courseSlug === selectedModuleCourseSlug)) || modules.find((module) => module.id === selectedModuleId) || null
    : modules.find((module) => selectedCourseSlug && module.courseSlug === selectedCourseSlug) || modules[0] || null
  const activeModuleId = selectedModule?.id || BigInt(0)
  const activeCourse = courses.find((course) => course.courseSlug === selectedModule?.courseSlug) || courses.find((course) => course.courseSlug === selectedCourseSlug) || courses[0] || null
  const moduleHasAnyBatchRule = (moduleId: bigint) => moduleDripSchedules.some((schedule) => schedule.moduleId === moduleId)
  const moduleHasBatchRule = (moduleId: bigint, batchKey: string) => moduleDripSchedules.some((schedule) => schedule.moduleId === moduleId && schedule.batchKey === batchKey)
  const filterBatches = selectedModuleTableCourseSlug
    ? batches.filter((batch) => batch.courseSlug === selectedModuleTableCourseSlug)
    : []
  const effectiveModuleTableBatchKey = selectedModuleTableCourseSlug && filterBatches.some((batch) => batch.batchKey === selectedModuleTableBatchKey)
    ? selectedModuleTableBatchKey
    : ""
  const visibleModules = modules.filter((module) => {
    if (selectedModuleTableCourseSlug && module.courseSlug !== selectedModuleTableCourseSlug) return false
    if (!effectiveModuleTableBatchKey) return true
    return moduleHasBatchRule(module.id, effectiveModuleTableBatchKey) || !moduleHasAnyBatchRule(module.id)
  })
  const selectedLessons = activeModuleId > BigInt(0)
    ? lessons.filter((lesson) => lesson.moduleId === activeModuleId)
    : []
  const lessonMapperLessons = selectedLessons.map((lesson, index) => ({
    rowKey: `lesson-${String(lesson.id)}-${index}`,
    id: String(lesson.id),
    lessonSlug: lesson.lessonSlug || "",
    lessonTitle: lesson.lessonTitle || "",
    lessonOrder: String(lesson.lessonOrder || index + 1),
    videoAssetId: lesson.videoAssetId ? String(lesson.videoAssetId) : "",
    lessonNotes: lesson.lessonNotes || "",
    captionsVttUrl: lesson.captionsVttUrl || "",
    captionsLanguagesJson: lesson.captionsLanguagesJson || "",
    transcriptText: lesson.transcriptText || "",
    audioDescriptionText: lesson.audioDescriptionText || "",
    signLanguageVideoUrl: lesson.signLanguageVideoUrl || "",
    accessibilityStatus: lesson.accessibilityStatus || "draft",
    isActive: Number(lesson.isActive || 0) !== 0
  }))
  const lessonMapperVideos = videos.map((video) => ({
    id: String(video.id),
    label: videoLabel(video)
  }))
  const selectedBatches = activeCourse
    ? batches.filter((batch) => batch.courseSlug === activeCourse.courseSlug)
    : []
  const selectedSchedules = activeModuleId > BigInt(0)
    ? moduleDripSchedules.filter((schedule) => schedule.moduleId === activeModuleId)
    : []
  const immediateCourse = activeCourse?.enrollmentMode === "immediate"
  const courseOptions = courses.map((course) => ({ value: course.courseSlug, label: course.courseTitle }))
  const courseOptionsWithAll = [{ value: "", label: "All courses" }, ...courseOptions]
  const batchStatusOptions = [
    { value: "open", label: "Open" },
    { value: "closed", label: "Closed" }
  ]
  const enrollmentModeOptions = [
    { value: "batch", label: "Batch based" },
    { value: "immediate", label: "Immediate access" }
  ]
  const publicVideoOptions = [
    { value: "", label: "No video selected" },
    ...videos.map((video) => ({ value: String(video.id), label: videoLabel(video) }))
  ]
  const sourceModuleOptions = [
    { value: "", label: "Select source module" },
    ...modules.map((module) => ({
      key: `${module.courseSlug}-${String(module.id)}`,
      value: String(module.id),
      label: `[${module.courseSlug}] ${module.moduleTitle}`
    }))
  ]
  const moduleTableBatchOptions = [
    { value: "", label: "All batches" },
    ...filterBatches.map((batch) => ({
      key: `${batch.courseSlug}-${batch.batchKey}`,
      value: batch.batchKey,
      label: batch.batchLabel || batch.batchKey
    }))
  ]
  const courseBatchManager = (
    <div className="border-t border-border p-6">
      <div className="rounded-xl border border-border bg-background p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Course Batches</h3>
            <p className="mt-1 text-xs text-muted-foreground">Manage batches for the selected course.</p>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">
            {activeCourse ? "Batches for selected course" : "Select a course first"}
          </span>
        </div>
        <div className="mt-4 max-h-[34rem] overflow-auto">
          {activeCourse ? (
            <div className="space-y-4">
              {selectedBatches.length ? selectedBatches.map((batch) => {
                const batchLiveSessions = liveSessions.filter((session) => session.courseSlug === activeCourse.courseSlug && session.batchKey === batch.batchKey)
                return (
                <div key={batch.batchKey} className="rounded-xl border border-border bg-card p-4">
                  <form action={saveCourseBatchAction} className="grid gap-3 md:grid-cols-2">
                    <input type="hidden" name="courseSlug" value={activeCourse.courseSlug} />
                    <input type="hidden" name="originalBatchKey" value={batch.batchKey} />
                    <input name="batchLabel" defaultValue={batch.batchLabel || ""} className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
                    <input name="batchKey" defaultValue={batch.batchKey} className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
                    <PremiumPicker name="status" defaultValue={batch.status || "closed"} options={batchStatusOptions} />
                    <input name="batchStartAt" type="datetime-local" defaultValue={dateInput(batch.batchStartAt)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
                    <input name="paystackReferencePrefix" defaultValue={batch.paystackReferencePrefix || ""} placeholder="Paystack prefix" className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
                    <input name="brevoListId" defaultValue={batch.brevoListId || ""} placeholder="Brevo list" className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
                    <div className="flex items-center gap-2">
                      {activePill(batch.isActive, "Active batch", "Inactive batch")}
                    </div>
                    <div className="flex gap-2">
                      <button className="btn-secondary h-10 flex-1 justify-center text-xs" type="submit" data-toast="Saving batch">Save</button>
                    </div>
                  </form>
                  <div className="mt-3 flex gap-2">
                    {Number(batch.isActive || 0) === 1 ? null : (
                      <form action={activateCourseBatchAction}>
                        <input type="hidden" name="courseSlug" value={activeCourse.courseSlug} />
                        <input type="hidden" name="batchKey" value={batch.batchKey} />
                        <button className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-black text-muted-foreground hover:border-primary/40 hover:text-primary" type="submit" data-toast="Setting active batch">Set Active</button>
                      </form>
                    )}
                    <form action={deleteCourseBatchAction}>
                      <input type="hidden" name="courseSlug" value={activeCourse.courseSlug} />
                      <input type="hidden" name="batchKey" value={batch.batchKey} />
                      <button className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-black text-destructive hover:bg-destructive hover:text-destructive-foreground" type="submit" data-toast="Deleting batch">Delete</button>
                    </form>
                  </div>
                  <div className="mt-5 rounded-xl border border-border bg-background p-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Live Classes & Zoom</h4>
                        <p className="mt-1 text-xs text-muted-foreground">Configure any number of live classes for this batch. Dates can be relative to the batch start.</p>
                      </div>
                      <span className="text-xs font-bold text-muted-foreground">{batchLiveSessions.length} configured</span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {batchLiveSessions.map((session) => (
                        <div key={session.sessionUuid} className="rounded-xl border border-border bg-card p-3">
                          <form action={saveCourseLiveSessionAction} className="grid gap-3 lg:grid-cols-[1.2fr_0.5fr_0.6fr_0.8fr_0.7fr]">
                            <input type="hidden" name="sessionUuid" value={session.sessionUuid} />
                            <input type="hidden" name="courseSlug" value={activeCourse.courseSlug} />
                            <input type="hidden" name="batchKey" value={batch.batchKey} />
                            <input name="sessionTitle" defaultValue={session.sessionTitle} placeholder="Day 1 Live Class" className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
                            <input name="dayOffset" type="number" min="0" defaultValue={Number(session.dayOffset || 0)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
                            <input name="timeOfDay" type="time" defaultValue={session.timeOfDay || "19:00"} className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
                            <input name="startsAt" type="datetime-local" defaultValue={dateInput(session.startsAt)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
                            <input name="reminderMinutesBefore" type="number" min="0" defaultValue={Number(session.reminderMinutesBefore || 720)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
                            <input name="zoomJoinUrl" defaultValue={session.zoomJoinUrl || ""} placeholder="Zoom join URL" className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary lg:col-span-3" />
                            <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                              <input name="isVisible" type="checkbox" defaultChecked={Number(session.isVisible || 0) === 1} className="h-4 w-4 rounded border-input text-primary focus:ring-primary" />
                              Show on student cards
                            </label>
                            <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                              <input name="reminderEnabled" type="checkbox" defaultChecked={Number(session.reminderEnabled || 0) === 1} className="h-4 w-4 rounded border-input text-primary focus:ring-primary" />
                              Brevo reminder
                            </label>
                            <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                              <input name="useSharedZoom" type="checkbox" defaultChecked className="h-4 w-4 rounded border-input text-primary focus:ring-primary" />
                              Reuse batch Zoom
                            </label>
                            <button className="btn-secondary justify-center text-xs lg:col-span-2" type="submit" data-toast="Saving live session">Save Live Session</button>
                          </form>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-muted-foreground">
                              {session.startsAt ? formatDateTimeWAT(session.startsAt) : "No date"} · {session.reminderSentAt ? `Reminder sent ${formatDate(session.reminderSentAt)}` : "Reminder pending"}
                            </p>
                            <form action={deleteCourseLiveSessionAction}>
                              <input type="hidden" name="sessionUuid" value={session.sessionUuid} />
                              <button className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-black text-destructive hover:bg-destructive hover:text-destructive-foreground" type="submit" data-toast="Deleting live session">Delete</button>
                            </form>
                          </div>
                        </div>
                      ))}
                      <form action={saveCourseLiveSessionAction} className="grid gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-3 lg:grid-cols-[1.2fr_0.5fr_0.6fr_0.8fr_0.7fr]">
                        <input type="hidden" name="courseSlug" value={activeCourse.courseSlug} />
                        <input type="hidden" name="batchKey" value={batch.batchKey} />
                        <input name="sessionTitle" placeholder="New live class title" className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
                        <input name="dayOffset" type="number" min="0" placeholder="Day offset" defaultValue="0" className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
                        <input name="timeOfDay" type="time" defaultValue="19:00" className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
                        <input name="startsAt" type="datetime-local" className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
                        <input name="reminderMinutesBefore" type="number" min="0" defaultValue="720" className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
                        <input name="zoomJoinUrl" placeholder="Optional Zoom URL; blank creates/reuses batch Zoom" className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary lg:col-span-3" />
                        <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                          <input name="isVisible" type="checkbox" defaultChecked className="h-4 w-4 rounded border-input text-primary focus:ring-primary" />
                          Show
                        </label>
                        <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                          <input name="reminderEnabled" type="checkbox" defaultChecked className="h-4 w-4 rounded border-input text-primary focus:ring-primary" />
                          Brevo
                        </label>
                        <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                          <input name="useSharedZoom" type="checkbox" defaultChecked className="h-4 w-4 rounded border-input text-primary focus:ring-primary" />
                          Shared Zoom
                        </label>
                        <button className="btn-primary justify-center text-xs lg:col-span-2" type="submit" data-toast="Creating live session">Add Live Session</button>
                      </form>
                    </div>
                  </div>
                </div>
              )}) : (
                <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm font-semibold text-muted-foreground">No batches created for this course.</p>
              )}
              <form action={saveCourseBatchAction} className="grid gap-3 rounded-xl border border-border bg-muted/20 p-4 md:grid-cols-2">
                <input type="hidden" name="courseSlug" value={activeCourse.courseSlug} />
                <input name="batchLabel" placeholder="New batch label" className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
                <input name="batchKey" placeholder="batch-key" className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
                <input name="paystackReferencePrefix" placeholder="Prefix" className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
                <button className="btn-primary justify-center md:col-span-2" type="submit" data-toast="Creating batch">Create Batch</button>
              </form>
            </div>
          ) : (
            <p className="text-sm font-semibold text-muted-foreground">Select a course first.</p>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <main data-video-library-page className="space-y-8 pb-12">
      <VideoLibraryScrollRestorer />
      <div className="flex flex-col gap-6 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow text-primary">Content Engine</p>
          <h1 className="mt-1 font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Video Library
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Sync Cloudflare videos, publish courses, select a module, then map lessons directly in the Lesson Mapper.
          </p>
        </div>
      </div>

      <DashboardStatsVisibility storageKey="tochukwu-internal-video-library-stats">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Courses", value: courses.length, icon: GraduationCap },
          { label: "Modules", value: modules.length, icon: Layers3 },
          { label: "Lessons", value: lessons.length, icon: PlaySquare },
          { label: "Synced Videos", value: videos.length, icon: Video }
        ].map((stat) => (
          <DashboardStatCard key={stat.label} statKey={stat.label} label={stat.label}
            value={stat.value} icon={<stat.icon className="h-5 w-5" />} />
        ))}
      </section>
      </DashboardStatsVisibility>

      <CloudflareProgressPanel />

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-muted/20 p-6">
          <div>
            <p className="eyebrow text-primary">Public Pages</p>
            <h2 className="mt-1 font-heading text-xl font-black text-foreground">Public Video Slots</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Assign synced Cloudflare videos to the public page video sections. Resource videos remain managed in Resources with YouTube Shorts URLs.
            </p>
          </div>
        </div>
        <div className="grid gap-4 p-6 lg:grid-cols-2">
          {publicVideoSlots.map((slot) => {
            const isReady = slot.videoUid && Number(slot.readyToStream || 0) === 1 && !slot.sourceDeletedAt
            return (
              <form key={slot.slotKey} action={savePublicVideoSlotAction} className="rounded-xl border border-border bg-background p-4">
                <input type="hidden" name="slotKey" value={slot.slotKey} />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{slot.pageLabel}</p>
                    <h3 className="mt-1 font-heading text-lg font-black text-foreground">{slot.slotLabel}</h3>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                      {slot.videoUid ? `${slot.filename || slot.videoUid} · ${isReady ? "ready" : slot.sourceDeletedAt ? "deleted" : "processing"}` : "No video assigned"}
                    </p>
                  </div>
                  {activePill(slot.isActive, "Active", "Hidden")}
                </div>
                <div className="mt-4 grid gap-3">
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cloudflare Video</span>
                    <PremiumPicker name="videoAssetId" defaultValue={slot.videoAssetId ? String(slot.videoAssetId) : ""} options={publicVideoOptions} />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Player Title</span>
                    <input name="headline" defaultValue={slot.headline || ""} placeholder={slot.slotLabel} className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Internal Note</span>
                    <textarea name="description" rows={2} defaultValue={slot.description || ""} className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
                  </label>
                  <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <label className="flex items-center gap-2 text-sm font-bold">
                      <input name="isActive" type="checkbox" defaultChecked={Number(slot.isActive || 0) === 1} className="h-4 w-4 rounded border-input text-primary focus:ring-primary" />
                      Show on public page
                    </label>
                    <button className="btn-primary justify-center" type="submit" data-toast="Saving public video slot">
                      <Save className="h-4 w-4" />
                      Save Slot
                    </button>
                  </div>
                </div>
              </form>
            )
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-muted/20 p-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_18rem] lg:items-end">
            <div>
              <p className="eyebrow text-primary">Courses</p>
              <h2 className="mt-1 font-heading text-xl font-black text-foreground">Course Settings</h2>
              <p className="mt-1 text-sm text-muted-foreground">Choose a course to narrow the module registry and manage enrollment/release settings.</p>
            </div>
            <form className="flex gap-3">
              <PremiumPicker name="course" defaultValue={activeCourse?.courseSlug || ""} options={courseOptionsWithAll} className="min-w-0 flex-1" />
              <button className="btn-secondary shrink-0" type="submit">Open</button>
            </form>
          </div>
        </div>

        {activeCourse ? (
          <>
            <form action={saveVideoLibraryCourseAction} className="grid gap-4 p-6 lg:grid-cols-4">
              <input type="hidden" name="courseSlug" value={activeCourse.courseSlug} />
              <input type="hidden" name="schoolAdvancedDiscountNgn" value={moneyInput(activeCourse.schoolAdvancedDiscountNgnMinor)} />
              <input type="hidden" name="schoolAdvancedDiscountGbp" value={moneyInput(activeCourse.schoolAdvancedDiscountGbpMinor)} />
              <input type="hidden" name="schoolAdvancedDiscountUsd" value={moneyInput(activeCourse.schoolAdvancedDiscountUsdMinor)} />
              <input type="hidden" name="schoolAdvancedDiscountEur" value={moneyInput(activeCourse.schoolAdvancedDiscountEurMinor)} />
              <label className="block lg:col-span-2">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Course Title</span>
                <input name="courseTitle" defaultValue={activeCourse.courseTitle} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Enrollment Mode</span>
                <PremiumPicker name="enrollmentMode" defaultValue={activeCourse.enrollmentMode || "batch"} options={enrollmentModeOptions} />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Release Date</span>
                <input name="releaseAt" type="datetime-local" defaultValue={dateInput(activeCourse.releaseAt)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">NGN Price</span>
                <input name="priceNgn" defaultValue={moneyInput(activeCourse.priceNgnMinor)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">GBP Price</span>
                <input name="priceGbp" defaultValue={moneyInput(activeCourse.priceGbpMinor)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">USD Price</span>
                <input name="priceUsd" defaultValue={moneyInput(activeCourse.priceUsdMinor)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">EUR Price</span>
                <input name="priceEur" defaultValue={moneyInput(activeCourse.priceEurMinor)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
              </label>
              <label className="block lg:col-span-4">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Description</span>
                <textarea name="courseDescription" rows={2} defaultValue={activeCourse.courseDescription || ""} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
              </label>
              <div className="flex flex-col gap-4 rounded-xl border border-border bg-muted/20 p-4 lg:col-span-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-x-6 gap-y-3">
                  <label className="flex items-center gap-2 text-sm font-bold"><input name="isPublished" type="checkbox" defaultChecked={Number(activeCourse.isPublished || 0) === 1} className="h-4 w-4 rounded border-input text-primary focus:ring-primary" />Published</label>
                  <label className="flex items-center gap-2 text-sm font-bold"><input name="isEnrollmentLocked" type="checkbox" defaultChecked={Number(activeCourse.isEnrollmentLocked || 0) === 1} className="h-4 w-4 rounded border-input text-primary focus:ring-primary" />Lock enrollment</label>
                  <label className="flex items-center gap-2 text-sm font-bold text-muted-foreground"><input name="paymentMethods" value="paystack" type="checkbox" defaultChecked={paymentEnabled(activeCourse.paymentMethods, "paystack")} className="h-4 w-4 rounded border-input text-primary focus:ring-primary" />Paystack</label>
                  <label className="flex items-center gap-2 text-sm font-bold text-muted-foreground"><input name="paymentMethods" value="stripe" type="checkbox" defaultChecked={paymentEnabled(activeCourse.paymentMethods, "stripe")} className="h-4 w-4 rounded border-input text-primary focus:ring-primary" />Stripe</label>
                  <label className="flex items-center gap-2 text-sm font-bold text-muted-foreground"><input name="paymentMethods" value="manual_transfer" type="checkbox" defaultChecked={paymentEnabled(activeCourse.paymentMethods, "manual_transfer")} className="h-4 w-4 rounded border-input text-primary focus:ring-primary" />Manual</label>
                </div>
                <button className="btn-secondary justify-center" type="submit" data-toast="Saving course">
                  <Save className="h-4 w-4" />
                  Save Course
                </button>
              </div>
            </form>
            {courseBatchManager}
          </>
        ) : courseBatchManager}
      </section>

      <section className="space-y-6">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="border-b border-border bg-muted/20 p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-heading text-xl font-black text-foreground">Modules</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Quickly publish/unpublish modules or open one to edit lessons.</p>
                </div>
                <span className="inline-flex w-fit rounded-md border border-border bg-background px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Showing {visibleModules.length} of {modules.length}
                </span>
              </div>
              <form className="mt-5 grid gap-4 lg:grid-cols-[minmax(14rem,20rem)_minmax(10rem,14rem)_auto] lg:items-end">
                {selectedCourseSlug ? <input type="hidden" name="course" value={selectedCourseSlug} /> : null}
                {selectedModuleCourseSlug ? <input type="hidden" name="moduleCourse" value={selectedModuleCourseSlug} /> : null}
                {selectedModuleId > BigInt(0) ? <input type="hidden" name="moduleId" value={String(selectedModuleId)} /> : null}
                <label className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Filter by Course</span>
                  <PremiumPicker name="moduleTableCourse" defaultValue={selectedModuleTableCourseSlug} options={courseOptionsWithAll} />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Filter by Batch</span>
                  <PremiumPicker name="moduleTableBatch" defaultValue={effectiveModuleTableBatchKey} options={moduleTableBatchOptions} />
                </label>
                <button className="btn-secondary h-12 justify-center" type="submit">Filter</button>
              </form>
            </div>
            <div className="max-h-[26rem] min-h-[18rem] overflow-auto overscroll-contain bg-background">
              <table className="w-full min-w-[76rem] text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-border bg-card text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="px-5 py-4">Module</th>
                    <th className="px-5 py-4">Lessons</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Course & Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visibleModules.length ? visibleModules.map((module) => {
                    const isSelected = module.id === activeModuleId && module.courseSlug === selectedModule?.courseSlug
                    const moduleSchedules = moduleDripSchedules.filter((schedule) => schedule.moduleId === module.id)
                    const activeLessonCount = Number(module.activeLessonCount || 0)
                    const missingCaptions = Number(module.missingCaptionsCount || 0)
                    const missingTranscript = Number(module.missingTranscriptCount || 0)
                    const a11yReady = activeLessonCount > 0 && missingCaptions === 0 && missingTranscript === 0
                    return (
                      <tr key={`${module.courseSlug}-${String(module.id)}`} className={isSelected ? "bg-primary/10" : "hover:bg-muted/20"}>
                        <td className="px-5 py-5 align-top">
                          <p className="font-heading text-base font-black text-foreground">{module.moduleTitle}</p>
                          <p className="mt-1 font-mono text-[11px] text-muted-foreground">{module.moduleSlug}</p>
                        </td>
                        <td className="px-5 py-5 align-top font-heading text-lg font-black text-foreground">
                          {Number(module.lessonCount || 0)}
                        </td>
                        <td className="px-5 py-5 align-top">
                          <div className="flex flex-wrap gap-2">
                            {activePill(module.isActive, "published", "unpublished")}
                            <span className={a11yReady
                              ? "inline-flex rounded-md border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-primary"
                              : "inline-flex rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300"
                            }>
                              {a11yReady ? "a11y ready" : "a11y pending"}
                            </span>
                          </div>
                          <p className="mt-2 max-w-md text-xs font-semibold text-muted-foreground">
                            {a11yReady
                              ? "All active lessons have captions and transcript."
                              : activeLessonCount > 0
                                ? `${missingCaptions} missing captions, ${missingTranscript} missing transcript.`
                                : "No active lessons in this module yet."}
                          </p>
                        </td>
                        <td className="px-5 py-5 align-top">
                          <div className="flex min-w-max flex-nowrap items-start gap-2">
                            <form action={saveVideoLibraryModuleAction} className="flex flex-nowrap gap-2">
                              <input type="hidden" name="moduleId" value={String(module.id)} />
                              <input type="hidden" name="moduleSlug" value={module.moduleSlug} />
                              <input type="hidden" name="moduleTitle" value={module.moduleTitle} />
                              <input type="hidden" name="moduleDescription" value={module.moduleDescription || ""} />
                              <input type="hidden" name="sortOrder" value={String(module.sortOrder || 0)} />
                              <input type="hidden" name="actionIntent" value="move" />
                              {Number(module.isActive || 0) === 1 ? <input type="hidden" name="isActive" value="on" /> : null}
                              {moduleSchedules.length ? <input type="hidden" name="dripEnabled" value="on" /> : null}
                              {preserveModuleScheduleInputs(moduleSchedules)}
                              <PremiumPicker name="courseSlug" defaultValue={module.courseSlug} options={courseOptions} className="w-[13rem] shrink-0" />
                              <button className="btn-secondary h-10 shrink-0 px-4 text-xs" type="submit" data-toast="Moving module">Move</button>
                            </form>
                            <AccessibilityGenerateButton moduleId={String(module.id)} moduleTitle={module.moduleTitle} />
                            <Link href={videoLibraryHref({
                              course: selectedCourseSlug,
                              moduleTableCourse: selectedModuleTableCourseSlug,
                              moduleTableBatch: effectiveModuleTableBatchKey,
                              moduleCourse: module.courseSlug,
                              moduleId: module.id
                            })} className={isSelected ? "btn-primary h-10 shrink-0 px-4 text-xs" : "btn-secondary h-10 shrink-0 px-4 text-xs"}>
                              Open
                            </Link>
                            <form action={saveVideoLibraryModuleAction}>
                              <input type="hidden" name="moduleId" value={String(module.id)} />
                              <input type="hidden" name="courseSlug" value={module.courseSlug} />
                              <input type="hidden" name="moduleSlug" value={module.moduleSlug} />
                              <input type="hidden" name="moduleTitle" value={module.moduleTitle} />
                              <input type="hidden" name="moduleDescription" value={module.moduleDescription || ""} />
                              <input type="hidden" name="sortOrder" value={String(module.sortOrder || 0)} />
                              <input type="hidden" name="actionIntent" value="status" />
                              {Number(module.isActive || 0) === 1 ? null : <input type="hidden" name="isActive" value="on" />}
                              {moduleSchedules.length ? <input type="hidden" name="dripEnabled" value="on" /> : null}
                              {preserveModuleScheduleInputs(moduleSchedules)}
                              <button className="btn-secondary h-10 shrink-0 px-4 text-xs" type="submit" data-toast={Number(module.isActive || 0) === 1 ? "Unpublishing module" : "Publishing module"}>
                                {Number(module.isActive || 0) === 1 ? "Unpublish" : "Publish"}
                              </button>
                            </form>
                            <form action={detachVideoLibraryModuleAction}>
                              <input type="hidden" name="moduleId" value={String(module.id)} />
                              <input type="hidden" name="courseSlug" value={module.courseSlug} />
                              <button className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-destructive/30 bg-destructive/10 px-4 text-xs font-black text-destructive hover:bg-destructive hover:text-destructive-foreground" type="submit" data-toast="Detaching module">
                                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                Detach
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    )
                  }) : (
                    <tr>
                      <td colSpan={4} className="px-5 py-12 text-center text-sm font-semibold text-muted-foreground">No modules found for this course and batch filter.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] xl:items-start">
          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="border-b border-border bg-muted/20 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="eyebrow text-primary">Module Builder</p>
                  <h2 className="mt-1 font-heading text-xl font-black text-foreground">
                    {selectedModule ? selectedModule.moduleTitle : "Create module"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    New lessons are accessible when this module is active and its batch access rule allows the learner’s batch.
                  </p>
                </div>
                {selectedModule ? (
                  <form action={detachVideoLibraryModuleAction}>
                    <input type="hidden" name="moduleId" value={String(selectedModule.id)} />
                    <input type="hidden" name="courseSlug" value={selectedModule.courseSlug} />
                    <button className="inline-flex items-center justify-center rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs font-black text-destructive hover:bg-destructive hover:text-destructive-foreground" type="submit" data-toast="Detaching module">
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Detach
                    </button>
                  </form>
                ) : null}
              </div>
            </div>

            <form action={saveVideoLibraryModuleAction} className="grid gap-4 p-5 md:grid-cols-2">
              <input type="hidden" name="moduleId" value={selectedModule ? String(selectedModule.id) : ""} />
              <div className="rounded-xl border border-border bg-background p-4 md:col-span-2">
                <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
                  <label className="block min-w-0 flex-1">
                    <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Reuse Existing Module</span>
                    <PremiumPicker name="sourceModuleId" form="clone-module-form" defaultValue="" options={sourceModuleOptions} />
                  </label>
                  <label className="block min-w-0 flex-1">
                    <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Target Course</span>
                    <PremiumPicker
                      name="targetCourseSlug"
                      form="clone-module-form"
                      defaultValue={selectedModule?.courseSlug || activeCourse?.courseSlug || ""}
                      options={[{ value: "", label: "Select course" }, ...courseOptions]}
                    />
                  </label>
                  <button form="clone-module-form" className="btn-secondary justify-center" type="submit" data-toast="Adding module to course">
                    Add To Course
                  </button>
                </div>
              </div>
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Course</span>
                <PremiumPicker name="courseSlug" defaultValue={selectedModule?.courseSlug || activeCourse?.courseSlug || ""} options={[{ value: "", label: "Select course" }, ...courseOptions]} />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sort Order</span>
                <input name="sortOrder" type="number" defaultValue={selectedModule ? String(selectedModule.sortOrder || 0) : "0"} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Module Title</span>
                <input name="moduleTitle" defaultValue={selectedModule?.moduleTitle || ""} placeholder="Day 1 Live Class" className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
              </label>
              <ModuleDescriptionField key={selectedModule ? String(selectedModule.id) : "new-module"} defaultValue={selectedModule?.moduleDescription || ""} />
              <div className="flex flex-wrap gap-3 rounded-xl border border-border bg-muted/20 p-4 md:col-span-2">
                <label className="flex items-center gap-2 text-sm font-bold">
                  <input name="isActive" type="checkbox" defaultChecked={selectedModule ? Number(selectedModule.isActive || 0) !== 0 : true} className="h-4 w-4 rounded border-input text-primary focus:ring-primary" />
                  Active module
                </label>
              </div>
              <ModuleBatchRulesClient
                {...moduleBatchRuleProps(selectedBatches, selectedSchedules)}
                initialEnabled={Boolean(selectedSchedules.length || Number(selectedModule?.dripEnabled || 0) === 1)}
                disabled={immediateCourse}
              />
              <div className="flex flex-col gap-3 md:col-span-2 sm:flex-row sm:justify-end">
                <button className="btn-primary justify-center" type="submit" data-toast="Saving module">
                  <Save className="h-4 w-4" />
                  Save Module
                </button>
              </div>
            </form>
            <form id="clone-module-form" action={cloneVideoLibraryModuleAction} />
          </section>

          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {selectedModule ? (
              <LessonMapperClient moduleId={String(selectedModule.id)} lessons={lessonMapperLessons} videos={lessonMapperVideos} />
            ) : (
              <div className="p-12 text-center text-sm font-semibold text-muted-foreground">Open a module to edit lessons.</div>
            )}
          </section>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border bg-muted/20 p-5">
            <h2 className="font-heading text-xl font-black text-foreground">Bulk CSV Import</h2>
            <p className="mt-1 text-sm text-muted-foreground">Headers: course_slug,module_title,module_description,lesson_title,lesson_order,video_uid,filename,hls_url,dash_url,captions_vtt_url,captions_languages_json,transcript_text,audio_description_text,sign_language_video_url,accessibility_status</p>
          </div>
          <form action={importVideoLibraryCsvAction} className="p-5">
            <textarea name="csvText" rows={10} placeholder="Paste CSV here..." className="w-full rounded-xl border border-input bg-background px-4 py-3 font-mono text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button name="apply" value="off" className="btn-secondary justify-center" type="submit" data-toast="Previewing CSV import">Preview</button>
              <button name="apply" value="on" className="btn-primary justify-center" type="submit" data-toast="Applying CSV import">Apply Import</button>
            </div>
          </form>
      </section>

      <Link href="/internal/learning" className="inline-flex items-center text-sm font-black text-primary hover:underline">
        <MonitorPlay className="mr-2 h-4 w-4" />
        Open Learning Support <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
      </Link>
    </main>
  )
}
