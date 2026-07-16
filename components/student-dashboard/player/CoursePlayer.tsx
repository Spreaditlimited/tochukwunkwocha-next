"use client"

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { BookOpen, Captions, CheckCircle2, ChevronLeft, ChevronRight, FileText, Loader2, Pencil, Play, RefreshCw, Search, ScrollText, Trash2, Upload, X } from "lucide-react"

import { showStudentToast } from "@/components/student-dashboard/StudentActionToaster"
import type { LearningCoursePayload, LearningLesson } from "@/lib/learning-player"
import { cn } from "@/lib/utils"

type CoursePlayerProps = {
  course: LearningCoursePayload
  initialLessonId?: number
  learner: {
    fullName: string
    email: string
  }
}

type SupportData = {
  features: {
    assignmentsEnabled: boolean
    courseCommunityEnabled: boolean
    tutorQuestionsEnabled: boolean
  }
  assignments: {
    id: number
    lessonId: number | null
    submissionKind: string
    submissionText: string
    submissionLink: string
    status: string
    adminFeedback: string
    attachments: { kind: string; url: string; sortOrder: number }[]
    createdAt: string | null
  }[]
  threads: {
    id: number
    lessonId: number | null
    questionType: string
    title: string
    body: string
    status: string
    repliesCount: number
    authorName: string
    isOwner?: boolean
    createdAt: string | null
    lastActivityAt: string | null
    replies?: {
      id: number
      replyUuid: string
      parentReplyId: number | null
      authorName: string
      authorEmail: string
      body: string
      createdAt: string | null
      updatedAt: string | null
      isOwner: boolean
    }[]
  }[]
}

type DiscussionEditTarget =
  | { kind: "thread"; id: number; title: string; body: string }
  | { kind: "reply"; id: number; title: string; body: string }

type DiscussionDeleteTarget =
  | { kind: "thread"; id: number; title: string }
  | { kind: "reply"; id: number; title: string }

function fmtSeconds(value: number | null | undefined) {
  const seconds = Number(value || 0)
  if (!Number.isFinite(seconds) || seconds <= 0) return ""
  const minutes = Math.round(seconds / 60)
  return minutes <= 1 ? "1 min" : `${minutes} min`
}

function lessonMeta(lesson: LearningLesson) {
  return [
    lesson.progress.isCompleted ? "Completed" : "Not completed",
    lesson.progress.lastWatchedAt ? "Last watched" : "",
    fmtSeconds(lesson.video.durationSeconds)
  ].filter(Boolean).join(" · ")
}

function playbackMessage(error: string) {
  const raw = String(error || "")
  const lower = raw.toLowerCase()
  if (
    lower.includes("cloudflare_stream_signing") ||
    lower.includes("signing_private_key") ||
    lower.includes("signing_key_id")
  ) {
    return {
      title: "Video playback is not configured",
      body: "This lesson is available, but secure video playback has not been configured for this environment.",
      detail: "Missing Cloudflare Stream signing credentials."
    }
  }
  if (raw) {
    return {
      title: "Video is temporarily unavailable",
      body: "We could not start secure playback for this lesson. Please try again.",
      detail: ""
    }
  }
  return {
    title: "Video is not ready",
    body: "This lesson does not have a playable video yet.",
    detail: ""
  }
}

function notePreview(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
}

const richNoteClass = "space-y-3 text-sm leading-6 text-foreground/85 [&_a]:font-bold [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-primary/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-background [&_code]:px-1.5 [&_code]:py-0.5 [&_h3]:text-lg [&_h3]:font-black [&_h4]:font-black [&_li]:ml-5 [&_ol]:list-decimal [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-background [&_pre]:p-3 [&_ul]:list-disc"
const editorNoteClass = "space-y-3 text-sm leading-7 text-foreground [&_a]:font-bold [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-primary/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-muted/40 [&_code]:px-1.5 [&_code]:py-0.5 [&_h3]:text-lg [&_h3]:font-black [&_h4]:font-black [&_li]:ml-5 [&_ol]:list-decimal [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-muted/40 [&_pre]:p-3 [&_ul]:list-disc"

function RichNoteButton({
  label,
  title,
  html,
  tone,
  onOpen
}: {
  label: string
  title: string
  html: string
  tone: "lesson" | "module"
  onOpen: () => void
}) {
  const preview = notePreview(html)
  if (tone === "module") {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="mt-6 flex min-h-14 w-full min-w-0 items-center gap-3 rounded-lg border border-input bg-background px-4 py-3 text-left outline-none hover:border-primary/50 focus:border-primary focus:ring-1 focus:ring-primary"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileText className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black text-foreground">Open module note</span>
          <span className="mt-1 block truncate text-xs font-semibold text-muted-foreground">{preview || title}</span>
        </span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-6 flex w-full items-start gap-3 rounded-lg border border-[var(--sd-border)] bg-[var(--sd-soft)] p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
    >
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-card text-primary">
        <FileText className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-black uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="mt-1 block text-base font-black text-foreground">{title}</span>
        <span className="mt-2 block line-clamp-3 text-sm leading-6 text-foreground/75">
          {preview || "Open note"}
        </span>
      </span>
      <span className="shrink-0 rounded-md border border-[var(--sd-border)] bg-card px-3 py-1.5 text-xs font-black text-primary">
        Open
      </span>
    </button>
  )
}

function RichNoteModal({
  title,
  label,
  html,
  onClose
}: {
  title: string
  label: string
  html: string
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 bg-background/90 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-border p-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
            <h2 className="mt-1 font-heading text-lg font-black text-foreground">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="btn-secondary h-9 px-3 text-xs">
            <X className="h-4 w-4" />
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div className="rounded-lg border border-input bg-background">
            <div
              className={`min-h-[28rem] overflow-auto px-5 py-4 ${editorNoteClass}`}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function DiscussionEditModal({
  target,
  busy,
  onClose,
  onSave
}: {
  target: DiscussionEditTarget
  busy: boolean
  onClose: () => void
  onSave: (value: { title: string; body: string }) => void
}) {
  const [title, setTitle] = useState(target.title)
  const [body, setBody] = useState(target.body)
  const isThread = target.kind === "thread"

  return (
    <div className="fixed inset-0 z-50 bg-background/90 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={isThread ? "Edit discussion thread" : "Edit discussion reply"} onClick={busy ? undefined : onClose}>
      <div className="mx-auto mt-10 max-w-2xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-border p-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Course Discussion</p>
            <h2 className="mt-1 font-heading text-lg font-black text-foreground">{isThread ? "Edit Thread" : "Edit Reply"}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary h-9 px-3 text-xs disabled:opacity-50">
            <X className="h-4 w-4" />
            Close
          </button>
        </div>
        <div className="grid gap-4 p-4">
          {isThread ? (
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">Title</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} className="field" />
            </label>
          ) : null}
          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">{isThread ? "Body" : "Reply"}</span>
            <textarea value={body} onChange={(event) => setBody(event.target.value)} className="field min-h-40" />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={busy} className="btn-secondary justify-center disabled:opacity-50">
              Cancel
            </button>
            <button type="button" onClick={() => onSave({ title, body })} disabled={busy || (isThread && !title.trim()) || !body.trim()} className="btn-primary justify-center disabled:opacity-50">
              {busy ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DiscussionDeleteModal({
  target,
  busy,
  onClose,
  onConfirm
}: {
  target: DiscussionDeleteTarget
  busy: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 bg-background/90 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Delete discussion item" onClick={busy ? undefined : onClose}>
      <div className="mx-auto mt-16 max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-border p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Course Discussion</p>
          <h2 className="mt-1 font-heading text-lg font-black text-foreground">Delete {target.kind === "thread" ? "Thread" : "Reply"}</h2>
        </div>
        <div className="grid gap-4 p-4">
          <p className="text-sm leading-6 text-muted-foreground">
            This will permanently remove <span className="font-bold text-foreground">{target.title}</span>{target.kind === "thread" ? " and its replies" : ""}.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={busy} className="btn-secondary justify-center disabled:opacity-50">
              Cancel
            </button>
            <button type="button" onClick={onConfirm} disabled={busy} className="btn-primary justify-center bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50">
              {busy ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function CoursePlayer({ course, initialLessonId, learner }: CoursePlayerProps) {
  const lessons = useMemo(() => course.modules.flatMap((moduleRow) => moduleRow.lessons), [course.modules])
  const firstIncomplete = lessons.find((lesson) => !lesson.progress.isCompleted) || lessons[0] || null
  const initialLesson = lessons.find((lesson) => lesson.id === initialLessonId) || firstIncomplete
  const [activeLessonId, setActiveLessonId] = useState(initialLesson?.id || 0)
  const [completedIds, setCompletedIds] = useState(() => new Set(lessons.filter((lesson) => lesson.progress.isCompleted).map((lesson) => lesson.id)))
  const [playbackUrl, setPlaybackUrl] = useState("")
  const [playbackError, setPlaybackError] = useState("")
  const [loadingPlayback, setLoadingPlayback] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [transcriptError, setTranscriptError] = useState("")
  const [showTranscript, setShowTranscript] = useState(false)
  const [saving, setSaving] = useState(false)
  const [support, setSupport] = useState<SupportData | null>(null)
  const [supportError, setSupportError] = useState("")
  const [assignmentText, setAssignmentText] = useState("")
  const [assignmentLink, setAssignmentLink] = useState("")
  const [assignmentFiles, setAssignmentFiles] = useState<File[]>([])
  const [threadTitle, setThreadTitle] = useState("")
  const [threadBody, setThreadBody] = useState("")
  const [replyBodies, setReplyBodies] = useState<Record<number, string>>({})
  const [communitySearch, setCommunitySearch] = useState("")
  const [submittingSupport, setSubmittingSupport] = useState(false)
  const [openNote, setOpenNote] = useState<null | { label: string; title: string; html: string }>(null)
  const [discussionEdit, setDiscussionEdit] = useState<DiscussionEditTarget | null>(null)
  const [discussionDelete, setDiscussionDelete] = useState<DiscussionDeleteTarget | null>(null)
  const [discussionBusy, setDiscussionBusy] = useState(false)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const playerRef = useRef<HTMLDivElement | null>(null)

  const activeLesson = lessons.find((lesson) => lesson.id === activeLessonId) || null
  const activeModule = activeLesson
    ? course.modules.find((moduleRow) => moduleRow.lessons.some((lesson) => lesson.id === activeLesson.id)) || null
    : null
  const activeIndex = lessons.findIndex((lesson) => lesson.id === activeLessonId)
  const completedCount = completedIds.size
  const completionPercent = lessons.length ? Math.round((completedCount / lessons.length) * 100) : 0
  const playbackState = playbackMessage(playbackError)
  const captionLanguages = activeLesson?.accessibility.captionsLanguages
    .map((item) => item.label || item.srclang)
    .filter(Boolean) || []
  const captionsLabel = activeLesson?.accessibility.captionsVttUrl
    ? `Captions available${captionLanguages.length ? ` (${captionLanguages.join(", ")})` : ""}`
    : ""
  const visibleThreads = useMemo(() => {
    const query = communitySearch.trim().toLowerCase()
    const threads = support?.threads || []
    if (!query) return threads
    return threads.filter((thread) => {
      const haystack = [
        thread.title,
        thread.body,
        thread.authorName,
        ...(thread.replies || []).flatMap((reply) => [reply.authorName, reply.authorEmail, reply.body])
      ].join(" ").toLowerCase()
      return haystack.includes(query)
    })
  }, [communitySearch, support?.threads])

  useEffect(() => {
    if (!activeLesson) return
    setPlaybackUrl("")
    setPlaybackError("")
    setTranscript("")
    setTranscriptError("")
    setShowTranscript(false)

    if (!activeLesson.video.hasVideo) {
      setPlaybackError("This lesson has no playable video yet.")
      return
    }

    let cancelled = false
    setLoadingPlayback(true)
    fetch("/api/student/learning/playback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId: activeLesson.id })
    })
      .then((response) => response.json().then((json) => ({ response, json })))
      .then(({ response, json }) => {
        if (cancelled) return
        if (!response.ok || !json?.ok) throw new Error(json?.error || "Could not load lesson video.")
        setPlaybackUrl(json.playback.embedUrl)
      })
      .catch((error) => {
        if (!cancelled) setPlaybackError(error instanceof Error ? error.message : "Could not load lesson video.")
      })
      .finally(() => {
        if (!cancelled) setLoadingPlayback(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeLessonId])

  useEffect(() => {
    if (!activeLessonId) return
    if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    heartbeatRef.current = setInterval(() => {
      fetch("/api/student/learning/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: activeLessonId, watchSeconds: 15 })
      }).catch(() => null)
    }, 15000)

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    }
  }, [activeLessonId])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/student/learning/support?course=${encodeURIComponent(course.courseSlug)}`)
      .then((response) => response.json().then((json) => ({ response, json })))
      .then(({ response, json }) => {
        if (cancelled) return
        if (!response.ok || !json?.ok) throw new Error(json?.error || "Could not load learning support.")
        setSupport(json.support)
      })
      .catch((error) => {
        if (!cancelled) setSupportError(error instanceof Error ? error.message : "Could not load learning support.")
      })
    return () => {
      cancelled = true
    }
  }, [course.courseSlug])

  async function markComplete() {
    if (!activeLesson) return
    setSaving(true)
    try {
      const response = await fetch("/api/student/learning/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: activeLesson.id, markComplete: true })
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Could not update progress.")
      setCompletedIds((current) => new Set(current).add(activeLesson.id))
      showStudentToast({ type: "success", title: "Lesson completed", message: "Your course progress has been updated." })
    } catch (error) {
      showStudentToast({ type: "error", title: "Progress update failed", message: error instanceof Error ? error.message : "Could not update progress." })
    } finally {
      setSaving(false)
    }
  }

  async function loadTranscript() {
    if (!activeLesson) return
    if (showTranscript) {
      setShowTranscript(false)
      return
    }
    setShowTranscript(true)
    setTranscriptError("")
    if (transcript) return
    const response = await fetch("/api/student/learning/transcript", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId: activeLesson.id })
    })
    const json = await response.json().catch(() => null)
    if (!response.ok || !json?.ok) {
      setTranscriptError(json?.error || "Could not load transcript.")
      showStudentToast({ type: "error", title: "Transcript unavailable", message: json?.error || "Could not load transcript." })
      return
    }
    setTranscript(json.transcriptText || "")
    showStudentToast({ type: "success", title: "Transcript loaded", message: "Transcript access has been opened for this lesson." })
  }

  function retryPlayback() {
    if (!activeLesson) return
    setActiveLessonId(0)
    window.setTimeout(() => setActiveLessonId(activeLesson.id), 0)
  }

  function focusPlayerOnSmallScreen() {
    if (typeof window === "undefined") return
    if (!window.matchMedia("(max-width: 1279px)").matches) return
    window.requestAnimationFrame(() => {
      playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      playerRef.current?.focus({ preventScroll: true })
    })
  }

  function selectLesson(lessonId: number) {
    setActiveLessonId(lessonId)
    focusPlayerOnSmallScreen()
  }

  async function refreshSupport() {
    setSupportError("")
    const response = await fetch(`/api/student/learning/support?course=${encodeURIComponent(course.courseSlug)}`)
    const json = await response.json().catch(() => null)
    if (response.ok && json?.ok) setSupport(json.support)
    else setSupportError(json?.error || "Could not load learning support.")
  }

  async function uploadAssignmentFiles(files: File[]) {
    if (!files.length) return []
    const signatureResponse = await fetch("/api/student/learning/assignment-upload-signature", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseSlug: course.courseSlug })
    })
    const signature = await signatureResponse.json().catch(() => null)
    if (!signatureResponse.ok || !signature?.ok) throw new Error(signature?.error || "Could not prepare upload.")
    const urls: string[] = []
    for (const file of files.slice(0, 8)) {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("api_key", signature.apiKey)
      formData.append("timestamp", String(signature.timestamp))
      formData.append("folder", signature.folder)
      formData.append("signature", signature.signature)
      const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(signature.cloudName)}/auto/upload`, {
        method: "POST",
        body: formData
      })
      const upload = await uploadResponse.json().catch(() => null)
      if (!uploadResponse.ok || !upload?.secure_url) throw new Error(upload?.error?.message || "Could not upload assignment file.")
      urls.push(String(upload.secure_url))
    }
    return urls
  }

  async function submitAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeLesson) return
    setSubmittingSupport(true)
    try {
      const screenshotUrls = await uploadAssignmentFiles(assignmentFiles)
      const response = await fetch("/api/student/learning/assignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug: course.courseSlug,
          lessonId: activeLesson.id,
          moduleId: course.modules.find((moduleRow) => moduleRow.lessons.some((lesson) => lesson.id === activeLesson.id))?.id || null,
          submissionKind: screenshotUrls.length ? "screenshots" : assignmentLink ? "link" : "text",
          submissionText: assignmentText,
          submissionLink: assignmentLink,
          screenshotUrls
        })
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Could not submit assignment.")
      setAssignmentText("")
      setAssignmentLink("")
      setAssignmentFiles([])
      event.currentTarget.reset()
      showStudentToast({ type: "success", title: "Assignment submitted", message: "Your assignment has been sent for review." })
      await refreshSupport()
    } catch (error) {
      showStudentToast({ type: "error", title: "Assignment submission failed", message: error instanceof Error ? error.message : "Could not submit assignment." })
    } finally {
      setSubmittingSupport(false)
    }
  }

  async function submitReply(threadId: number) {
    const body = replyBodies[threadId] || ""
    if (!body.trim()) return
    setSubmittingSupport(true)
    try {
      const response = await fetch("/api/student/learning/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseSlug: course.courseSlug, threadId, body })
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Could not create reply.")
      setReplyBodies((current) => ({ ...current, [threadId]: "" }))
      showStudentToast({ type: "success", title: "Reply posted", message: "Your reply has been added to the discussion." })
      await refreshSupport()
    } catch (error) {
      showStudentToast({ type: "error", title: "Reply failed", message: error instanceof Error ? error.message : "Could not create reply." })
    } finally {
      setSubmittingSupport(false)
    }
  }

  async function updateThread(thread: SupportData["threads"][number]) {
    setDiscussionEdit({ kind: "thread", id: thread.id, title: thread.title, body: thread.body })
  }

  async function saveDiscussionEdit(value: { title: string; body: string }) {
    if (!discussionEdit) return
    setDiscussionBusy(true)
    const endpoint = discussionEdit.kind === "thread" ? "/api/student/learning/thread/update" : "/api/student/learning/reply/update"
    const payload = discussionEdit.kind === "thread"
      ? { courseSlug: course.courseSlug, threadId: discussionEdit.id, title: value.title, body: value.body }
      : { courseSlug: course.courseSlug, replyId: discussionEdit.id, body: value.body }
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(() => null)
    const json = response ? await response.json().catch(() => null) : null
    setDiscussionBusy(false)
    if (!response?.ok || !json?.ok) {
      showStudentToast({
        type: "error",
        title: discussionEdit.kind === "thread" ? "Thread update failed" : "Reply update failed",
        message: json?.error || "Could not update discussion."
      })
      return
    }
    showStudentToast({
      type: "success",
      title: discussionEdit.kind === "thread" ? "Thread updated" : "Reply updated",
      message: discussionEdit.kind === "thread" ? "Your discussion thread has been updated." : "Your discussion reply has been updated."
    })
    setDiscussionEdit(null)
    await refreshSupport()
  }

  async function deleteThread(threadId: number) {
    const thread = support?.threads.find((item) => item.id === threadId)
    setDiscussionDelete({ kind: "thread", id: threadId, title: thread?.title || "this thread" })
  }

  async function confirmDiscussionDelete() {
    if (!discussionDelete) return
    setDiscussionBusy(true)
    const endpoint = discussionDelete.kind === "thread" ? "/api/student/learning/thread/delete" : "/api/student/learning/reply/delete"
    const payload = discussionDelete.kind === "thread"
      ? { courseSlug: course.courseSlug, threadId: discussionDelete.id }
      : { courseSlug: course.courseSlug, replyId: discussionDelete.id }
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(() => null)
    const json = response ? await response.json().catch(() => null) : null
    setDiscussionBusy(false)
    if (!response?.ok || !json?.ok) {
      showStudentToast({
        type: "error",
        title: discussionDelete.kind === "thread" ? "Thread delete failed" : "Reply delete failed",
        message: json?.error || "Could not delete discussion item."
      })
      return
    }
    showStudentToast({
      type: "success",
      title: discussionDelete.kind === "thread" ? "Thread deleted" : "Reply deleted",
      message: discussionDelete.kind === "thread" ? "Your discussion thread has been removed." : "Your discussion reply has been removed."
    })
    setDiscussionDelete(null)
    await refreshSupport()
  }

  async function updateReply(reply: NonNullable<SupportData["threads"][number]["replies"]>[number]) {
    setDiscussionEdit({ kind: "reply", id: reply.id, title: "Reply", body: reply.body })
  }

  async function deleteReply(replyId: number) {
    setDiscussionDelete({ kind: "reply", id: replyId, title: "this reply" })
  }

  async function submitThread(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeLesson) return
    setSubmittingSupport(true)
    try {
      const response = await fetch("/api/student/learning/thread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug: course.courseSlug,
          lessonId: activeLesson.id,
          moduleId: course.modules.find((moduleRow) => moduleRow.lessons.some((lesson) => lesson.id === activeLesson.id))?.id || null,
          questionType: "peer",
          title: threadTitle,
          body: threadBody
        })
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Could not create thread.")
      setThreadTitle("")
      setThreadBody("")
      showStudentToast({ type: "success", title: "Discussion posted", message: "Your question has been added to the course discussion." })
      await refreshSupport()
    } catch (error) {
      showStudentToast({ type: "error", title: "Discussion post failed", message: error instanceof Error ? error.message : "Could not create thread." })
    } finally {
      setSubmittingSupport(false)
    }
  }

  function openAdjacent(direction: -1 | 1) {
    const next = lessons[activeIndex + direction]
    if (next) selectLesson(next.id)
  }

  if (!lessons.length) {
    return (
      <div className="rounded-lg border border-[var(--sd-border)] bg-[var(--sd-panel)] p-8 text-center">
        <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="mt-4 text-xl font-black">No lessons available</h2>
        <p className="mt-2 text-sm text-muted-foreground">This course does not have published lessons yet.</p>
        <Link href="/dashboard/courses" className="btn-inverse-secondary mt-5">Back to courses</Link>
      </div>
    )
  }

  return (
    <>
    <div className="grid min-w-0 gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="order-2 min-w-0 overflow-hidden rounded-lg border border-[var(--sd-border)] bg-[var(--sd-panel)] p-3 shadow-sm xl:order-1 xl:sticky xl:top-24 xl:max-h-[calc(100vh-8rem)]">
        <div className="min-w-0">
          <p className="truncate text-xs font-black uppercase tracking-wider text-primary">{course.courseTitle}</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--sd-soft)]">
            <div className="h-full rounded-full bg-primary" style={{ width: `${completionPercent}%` }} />
          </div>
          <p className="mt-2 text-xs font-semibold text-muted-foreground">
            {completedCount} of {lessons.length} lessons completed
          </p>
        </div>

        <div className="mt-5 grid max-h-none min-w-0 gap-4 overflow-y-auto overflow-x-hidden pr-1 xl:max-h-[calc(100vh-15rem)]">
          {course.modules.map((moduleRow) => (
            <section key={moduleRow.id} className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-black text-foreground">{moduleRow.title}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {moduleRow.progress.completedLessons}/{moduleRow.progress.totalLessons} complete
                  </p>
                </div>
              </div>
              <div className="mt-3 grid min-w-0 gap-2">
                {moduleRow.lessons.map((lesson) => {
                  const isActive = lesson.id === activeLessonId
                  const isDone = completedIds.has(lesson.id)
                  return (
                    <button
                      key={lesson.id}
                      type="button"
                      onClick={() => selectLesson(lesson.id)}
                      className={cn(
                        "block w-full min-w-0 overflow-hidden rounded-md border px-2.5 py-2.5 text-left transition",
                        isActive
                          ? "border-primary/30 bg-primary/10"
                          : "border-[var(--sd-border)] bg-[var(--sd-soft)] hover:border-primary/25"
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black",
                          isDone ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
                        )}>
                          {isDone ? <CheckCircle2 className="h-4 w-4" /> : lesson.order || ""}
                        </span>
                        <span className="min-w-0 flex-1 overflow-hidden">
                          <span className="block truncate text-[13px] font-bold text-foreground">{lesson.title}</span>
                          <span className="mt-1 block truncate text-xs text-muted-foreground">{fmtSeconds(lesson.video.durationSeconds) || "Lesson"}</span>
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </aside>

      <section ref={playerRef} tabIndex={-1} className="order-1 min-w-0 scroll-mt-4 outline-none xl:order-2">
        {activeLesson ? (
          <div className="overflow-hidden rounded-lg border border-[var(--sd-border)] bg-[var(--sd-panel)] shadow-sm">
            <div className="relative aspect-video bg-[#060b14]">
              {loadingPlayback ? (
                <div className="absolute inset-0 flex items-center justify-center text-white">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Authorizing lesson...
                </div>
              ) : playbackUrl ? (
                <>
                  <iframe
                    title={activeLesson.title}
                    src={playbackUrl}
                    className="h-full w-full"
                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                    allowFullScreen
                  />
                  <div className="pointer-events-none absolute right-4 top-4 rounded bg-black/35 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white/75">
                    {learner.email}
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-white">
                  <div className="max-w-md">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/5">
                      <Play className="ml-0.5 h-7 w-7" />
                    </div>
                    <h2 className="mt-5 text-xl font-black tracking-tight">{playbackState.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-white/65">{playbackState.body}</p>
                    {playbackState.detail ? (
                      <p className="mx-auto mt-4 w-fit rounded-md border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs text-white/50">
                        {playbackState.detail}
                      </p>
                    ) : null}
                    {activeLesson.video.hasVideo ? (
                      <button type="button" onClick={retryPlayback} className="btn-inverse mt-5">
                        Retry playback
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 sm:p-6 lg:p-8">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-primary">Lesson {activeLesson.order || activeIndex + 1}</p>
                  <h1 className="mt-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl">{activeLesson.title}</h1>
                  <p className="mt-2 text-sm text-muted-foreground">{lessonMeta(activeLesson)}</p>
                </div>
                <button
                  type="button"
                  onClick={markComplete}
                  disabled={saving || completedIds.has(activeLesson.id)}
                  className="btn-primary shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {completedIds.has(activeLesson.id) ? "Lesson completed" : saving ? "Saving..." : "Mark complete"}
                </button>
              </div>

              {activeLesson.notes ? (
                <RichNoteButton
                  label="Lesson Notes"
                  title={activeLesson.title}
                  html={activeLesson.notes}
                  tone="lesson"
                  onOpen={() => setOpenNote({ label: "Lesson Notes", title: activeLesson.title, html: activeLesson.notes })}
                />
              ) : null}

              {activeModule?.description ? (
                <RichNoteButton
                  label="Module Note"
                  title={activeModule.title}
                  html={activeModule.description}
                  tone="module"
                  onOpen={() => setOpenNote({ label: "Module Super Note", title: activeModule.title, html: activeModule.description })}
                />
              ) : null}

              <div className="mt-6 flex flex-wrap gap-3">
                {captionsLabel ? (
                  <span className="btn-secondary cursor-default gap-2" aria-label={captionsLabel}>
                    <Captions className="h-4 w-4" />
                    {captionsLabel}
                  </span>
                ) : null}
                {activeLesson.accessibility.transcriptAvailable ? (
                  <button type="button" onClick={loadTranscript} className="btn-secondary gap-2">
                    <ScrollText className="h-4 w-4" />
                    {showTranscript ? "Close transcript" : "Transcript"}
                  </button>
                ) : null}
                {activeLesson.accessibility.signLanguageVideoUrl ? (
                  <a href={activeLesson.accessibility.signLanguageVideoUrl} className="btn-secondary gap-2" target="_blank" rel="noreferrer">
                    <FileText className="h-4 w-4" />
                    Sign language
                  </a>
                ) : null}
              </div>

              {showTranscript ? (
                <div className="mt-5 rounded-lg border border-[var(--sd-border)] bg-[var(--sd-soft)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Transcript</p>
                    <button type="button" onClick={() => setShowTranscript(false)} className="btn-secondary h-8 px-3 text-xs">
                      <X className="h-3.5 w-3.5" />
                      Close
                    </button>
                  </div>
                  {transcriptError ? (
                    <div className="mt-2 grid gap-3">
                      <p className="text-sm font-semibold text-destructive">{transcriptError}</p>
                    </div>
                  ) : (
                    <pre
                      className="mt-3 max-h-96 select-none overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--sd-border)] bg-background p-4 font-sans text-sm leading-6 text-foreground/85"
                      draggable={false}
                      onCopy={(event) => event.preventDefault()}
                      onCut={(event) => event.preventDefault()}
                      onContextMenu={(event) => event.preventDefault()}
                    >
                      {transcript || "Loading transcript..."}
                    </pre>
                  )}
                </div>
              ) : null}

              {activeLesson.accessibility.audioDescriptionText ? (
                <div className="mt-5 rounded-lg border border-[var(--sd-border)] bg-[var(--sd-soft)] p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Audio description</p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-foreground/85">
                    {activeLesson.accessibility.audioDescriptionText}
                  </p>
                </div>
              ) : null}

              {supportError ? (
                <div className="mt-5 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm font-semibold text-destructive">
                  {supportError}
                </div>
              ) : null}

              {support?.features.assignmentsEnabled ? (
                <div className="mt-6 rounded-lg border border-[var(--sd-border)] bg-[var(--sd-soft)] p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Assignments</p>
                  <form onSubmit={submitAssignment} className="mt-3 grid gap-3">
                    <textarea
                      value={assignmentText}
                      onChange={(event) => setAssignmentText(event.target.value)}
                      className="field min-h-28"
                      placeholder="Describe what you completed for this lesson."
                    />
                    <input
                      value={assignmentLink}
                      onChange={(event) => setAssignmentLink(event.target.value)}
                      className="field"
                      placeholder="Optional project link"
                    />
                    <label className="rounded-md border border-[var(--sd-border)] bg-card p-3 text-sm text-muted-foreground">
                      <span className="mb-2 flex items-center gap-2 font-bold text-foreground">
                        <Upload className="h-4 w-4 text-primary" />
                        Screenshots or files
                      </span>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        multiple
                        onChange={(event) => setAssignmentFiles(Array.from(event.target.files || []).slice(0, 8))}
                      />
                      {assignmentFiles.length ? (
                        <span className="mt-2 block text-xs">{assignmentFiles.length} file{assignmentFiles.length === 1 ? "" : "s"} selected</span>
                      ) : null}
                    </label>
                    <button type="submit" disabled={submittingSupport || (!assignmentText.trim() && !assignmentLink.trim() && !assignmentFiles.length)} className="btn-primary w-fit disabled:opacity-50">
                      {submittingSupport ? "Submitting..." : "Submit assignment"}
                    </button>
                  </form>
                  {support.assignments.length ? (
                    <div className="mt-4 grid gap-2">
                      {support.assignments.slice(0, 4).map((item) => (
                        <div key={item.id} className="rounded-md border border-[var(--sd-border)] bg-card p-3 text-sm">
                          <p className="font-bold capitalize text-foreground">{item.status.replace(/_/g, " ")}</p>
                          <p className="mt-1 line-clamp-2 text-muted-foreground">{item.submissionText || item.submissionLink}</p>
                          {item.attachments?.length ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {item.attachments.map((attachment) => (
                                <a key={attachment.url} href={attachment.url} target="_blank" rel="noreferrer" className="rounded-md border border-[var(--sd-border)] px-2 py-1 text-xs font-semibold text-primary">
                                  Attachment
                                </a>
                              ))}
                            </div>
                          ) : null}
                          {item.adminFeedback ? <p className="mt-2 text-primary">{item.adminFeedback}</p> : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {support?.features.courseCommunityEnabled ? (
                <div className="mt-6 rounded-lg border border-[var(--sd-border)] bg-[var(--sd-soft)] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Community</p>
                      <p className="mt-1 text-sm font-semibold text-muted-foreground">Ask questions, reply to classmates, and search previous discussions.</p>
                    </div>
                    <button type="button" onClick={() => refreshSupport()} className="btn-secondary h-10 gap-2 text-sm">
                      <RefreshCw className="h-4 w-4" />
                      Refresh
                    </button>
                  </div>
                  <form onSubmit={submitThread} className="mt-3 grid gap-3">
                    <input
                      value={threadTitle}
                      onChange={(event) => setThreadTitle(event.target.value)}
                      className="field"
                      placeholder="Question title"
                    />
                    <textarea
                      value={threadBody}
                      onChange={(event) => setThreadBody(event.target.value)}
                      className="field min-h-24"
                      placeholder="Ask a question or share a lesson note."
                    />
                    <button type="submit" disabled={submittingSupport || !threadTitle.trim() || !threadBody.trim()} className="btn-primary w-fit disabled:opacity-50">
                      Post question
                    </button>
                  </form>
                  <label className="mt-4 flex min-h-11 items-center gap-2 rounded-lg border border-[var(--sd-border)] bg-card px-3">
                    <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <input
                      value={communitySearch}
                      onChange={(event) => setCommunitySearch(event.target.value)}
                      className="min-w-0 flex-1 bg-transparent py-2.5 text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/70"
                      placeholder="Search threads and replies"
                      type="search"
                    />
                  </label>
                  {visibleThreads.length ? (
                    <div className="mt-4 grid gap-2">
                      {visibleThreads.map((thread) => (
                        <div key={thread.id} className="rounded-md border border-[var(--sd-border)] bg-card p-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-bold text-foreground">{thread.title}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{thread.repliesCount} replies</span>
                              {thread.isOwner ? (
                                <>
                                  <button type="button" onClick={() => updateThread(thread)} className="inline-flex h-7 w-7 items-center justify-center rounded border border-[var(--sd-border)] text-muted-foreground hover:text-primary" aria-label="Edit thread">
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button type="button" onClick={() => deleteThread(thread.id)} className="inline-flex h-7 w-7 items-center justify-center rounded border border-[var(--sd-border)] text-muted-foreground hover:text-destructive" aria-label="Delete thread">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </div>
                          <p className="mt-1 line-clamp-2 text-muted-foreground">{thread.body}</p>
                          {thread.replies?.length ? (
                            <div className="mt-3 grid gap-2 border-t border-[var(--sd-border)] pt-3">
                              {thread.replies.map((reply) => (
                                <div key={reply.id} className="rounded-md bg-[var(--sd-soft)] p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <p className="text-xs font-bold text-foreground">{reply.authorName || reply.authorEmail}</p>
                                    {reply.isOwner ? (
                                      <div className="flex items-center gap-1">
                                        <button type="button" onClick={() => updateReply(reply)} className="inline-flex h-7 w-7 items-center justify-center rounded border border-[var(--sd-border)] text-muted-foreground hover:text-primary" aria-label="Edit reply">
                                          <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                        <button type="button" onClick={() => deleteReply(reply.id)} className="inline-flex h-7 w-7 items-center justify-center rounded border border-[var(--sd-border)] text-muted-foreground hover:text-destructive" aria-label="Delete reply">
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    ) : null}
                                  </div>
                                  <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{reply.body}</p>
                                </div>
                              ))}
                            </div>
                          ) : null}
                          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                            <input
                              value={replyBodies[thread.id] || ""}
                              onChange={(event) => setReplyBodies((current) => ({ ...current, [thread.id]: event.target.value }))}
                              className="field min-w-0 flex-1"
                              placeholder="Write a reply"
                            />
                            <button type="button" onClick={() => submitReply(thread.id)} disabled={submittingSupport || !(replyBodies[thread.id] || "").trim()} className="btn-secondary px-4 py-2 text-sm disabled:opacity-50">
                              Reply
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-md border border-dashed border-[var(--sd-border)] bg-card p-6 text-center text-sm font-semibold text-muted-foreground">
                      {communitySearch.trim() ? "No discussion matched your search." : "No discussion has been posted yet."}
                    </div>
                  )}
                </div>
              ) : null}

              <div className="mt-8 flex items-center justify-between gap-3">
                <button type="button" onClick={() => openAdjacent(-1)} disabled={activeIndex <= 0} className="btn-secondary gap-2 disabled:opacity-50">
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <button type="button" onClick={() => openAdjacent(1)} disabled={activeIndex >= lessons.length - 1} className="btn-primary gap-2 disabled:opacity-50">
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
    {openNote ? (
      <RichNoteModal
        label={openNote.label}
        title={openNote.title}
        html={openNote.html}
        onClose={() => setOpenNote(null)}
      />
    ) : null}
    {discussionEdit ? (
      <DiscussionEditModal
        target={discussionEdit}
        busy={discussionBusy}
        onClose={() => setDiscussionEdit(null)}
        onSave={saveDiscussionEdit}
      />
    ) : null}
    {discussionDelete ? (
      <DiscussionDeleteModal
        target={discussionDelete}
        busy={discussionBusy}
        onClose={() => setDiscussionDelete(null)}
        onConfirm={confirmDiscussionDelete}
      />
    ) : null}
    </>
  )
}
