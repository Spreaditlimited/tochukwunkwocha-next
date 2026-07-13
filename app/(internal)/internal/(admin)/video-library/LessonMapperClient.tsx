"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { FileText, GripVertical, PlusCircle, Save, Trash2, X } from "lucide-react"

import { PremiumPicker } from "@/components/PremiumPicker"
import { saveVideoLibraryLessonsAction } from "./actions"
import { RichNotesEditor, notesPreview } from "./RichNotesEditor"

type LessonRow = {
  rowKey: string
  id: string
  lessonSlug: string
  lessonTitle: string
  lessonOrder: string
  videoAssetId: string
  lessonNotes: string
  captionsVttUrl: string
  captionsLanguagesJson: string
  transcriptText: string
  audioDescriptionText: string
  signLanguageVideoUrl: string
  accessibilityStatus: string
  isActive: boolean
}

type VideoOption = {
  id: string
  label: string
}

type LessonMapperClientProps = {
  moduleId: string
  lessons: LessonRow[]
  videos: VideoOption[]
}

function newLesson(rowKey: string, order: number): LessonRow {
  return {
    rowKey,
    id: "",
    lessonSlug: "",
    lessonTitle: "",
    lessonOrder: String(order),
    videoAssetId: "",
    lessonNotes: "",
    captionsVttUrl: "",
    captionsLanguagesJson: "",
    transcriptText: "",
    audioDescriptionText: "",
    signLanguageVideoUrl: "",
    accessibilityStatus: "draft",
    isActive: true
  }
}

function normalizeRows(rows: LessonRow[]) {
  return rows.map((row, index) => ({
    ...row,
    rowKey: row.rowKey || `lesson-${row.id || "new"}-${index}`,
    lessonOrder: String(row.lessonOrder || index + 1)
  }))
}

export function LessonMapperClient({ moduleId, lessons, videos }: LessonMapperClientProps) {
  const router = useRouter()
  const [rows, setRows] = useState(() => normalizeRows(lessons))
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [editingNotesKey, setEditingNotesKey] = useState("")
  const [editingNotesDraft, setEditingNotesDraft] = useState("")
  const [message, setMessage] = useState("")
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setRows(normalizeRows(lessons))
    setMessage("")
  }, [lessons, moduleId])

  const editingNotesRow = rows.find((row) => row.rowKey === editingNotesKey) || null
  const videoOptions = useMemo(() => [
    { value: "", label: "No video attached" },
    ...videos.map((video) => ({ value: video.id, label: video.label }))
  ], [videos])
  const accessibilityStatusOptions = [
    { value: "draft", label: "Draft" },
    { value: "in_progress", label: "In Progress" },
    { value: "ready", label: "Ready" },
    { value: "blocked", label: "Blocked" }
  ]

  const accessibilitySummary = useMemo(() => {
    const activeRows = rows.filter((row) => row.isActive)
    const missingCaptions = activeRows.filter((row) => !row.captionsVttUrl.trim()).length
    const missingTranscript = activeRows.filter((row) => !row.transcriptText.trim()).length
    if (!rows.length) return ""
    if (!missingCaptions && !missingTranscript) return "Accessibility check: all current lesson rows include captions URL and transcript."
    return `Accessibility warning (non-blocking): ${missingCaptions} lesson(s) missing captions URL, ${missingTranscript} lesson(s) missing transcript.`
  }, [rows])

  function updateRow(rowKey: string, patch: Partial<LessonRow>) {
    setRows((current) => current.map((row) => row.rowKey === rowKey ? { ...row, ...patch } : row))
  }

  function openNotes(row: LessonRow) {
    setEditingNotesKey(row.rowKey)
    setEditingNotesDraft(row.lessonNotes)
  }

  function closeNotes() {
    setEditingNotesKey("")
    setEditingNotesDraft("")
  }

  function saveNotes() {
    if (!editingNotesRow) return
    updateRow(editingNotesRow.rowKey, { lessonNotes: editingNotesDraft })
    closeNotes()
  }

  function addRow() {
    setRows((current) => [
      ...current,
      newLesson(`new-${Date.now()}-${current.length + 1}`, current.length + 1)
    ])
    setMessage("")
  }

  function removeRow(rowKey: string) {
    setRows((current) => current
      .filter((row) => row.rowKey !== rowKey)
      .map((row, index) => ({ ...row, lessonOrder: String(index + 1) })))
    setMessage("")
  }

  function dropRow(dropIndex: number) {
    if (dragIndex === null || dragIndex === dropIndex) return
    setRows((current) => {
      const next = [...current]
      const [moved] = next.splice(dragIndex, 1)
      if (!moved) return current
      next.splice(dropIndex, 0, moved)
      return next.map((row, index) => ({ ...row, lessonOrder: String(index + 1) }))
    })
    setDragIndex(null)
  }

  function saveRows() {
    const formData = new FormData()
    formData.set("moduleId", moduleId)
    formData.set("replaceAll", "true")
    formData.set("lessonsJson", JSON.stringify(rows.map((row) => ({
      id: row.id || null,
      lessonSlug: row.lessonSlug,
      lessonTitle: row.lessonTitle,
      lessonOrder: row.lessonOrder,
      videoAssetId: row.videoAssetId || null,
      lessonNotes: row.lessonNotes,
      captionsVttUrl: row.captionsVttUrl,
      captionsLanguagesJson: row.captionsLanguagesJson,
      transcriptText: row.transcriptText,
      audioDescriptionText: row.audioDescriptionText,
      signLanguageVideoUrl: row.signLanguageVideoUrl,
      accessibilityStatus: row.accessibilityStatus,
      isActive: row.isActive
    }))))
    setMessage("Saving your lesson rows...")
    startTransition(() => {
      saveVideoLibraryLessonsAction(formData)
        .then(() => {
          setMessage("Mapping saved. Your lesson order, videos, and notes are up to date.")
          router.refresh()
        })
        .catch((error) => {
          setMessage(error?.message || "Could not save the lesson mapping.")
        })
    })
  }

  return (
    <>
      <div className="border-b border-border bg-muted/20 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="eyebrow text-primary">Lesson Mapper</p>
            <h2 className="mt-1 font-heading text-xl font-black text-foreground">
              {rows.length} lessons in selected module
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Select module, map lesson title/order to a video asset, then save.</p>
          </div>
          <button type="button" onClick={addRow} className="btn-secondary h-10 px-4 text-xs">
            <PlusCircle className="h-4 w-4" />
            Add lesson row
          </button>
        </div>
      </div>

      <div className="max-h-[52rem] overflow-auto">
        <div className="min-w-[82rem] divide-y divide-border">
          <div className="grid grid-cols-[3rem_2.1fr_5rem_2.1fr_2.1fr_1.7fr_1.6fr_2.2fr_2fr_1.8fr_1.2fr_5.5rem_6rem] gap-3 bg-card/95 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <span>Move</span>
            <span>Lesson</span>
            <span>Order</span>
            <span>Video Asset</span>
            <span>Notes</span>
            <span>Captions URL</span>
            <span>Caption Languages</span>
            <span>Transcript</span>
            <span>Audio Description</span>
            <span>Sign Language URL</span>
            <span>A11y Status</span>
            <span>Active</span>
            <span className="text-right">Action</span>
          </div>

          {rows.length ? rows.map((row, index) => (
            <div
              key={row.rowKey}
              onDragEnd={() => setDragIndex(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => dropRow(index)}
              className="grid grid-cols-[3rem_2.1fr_5rem_2.1fr_2.1fr_1.7fr_1.6fr_2.2fr_2fr_1.8fr_1.2fr_5.5rem_6rem] gap-3 px-5 py-4"
            >
              <div draggable onDragStart={() => setDragIndex(index)} className="cursor-move pt-2 text-muted-foreground">
                <GripVertical className="h-4 w-4" />
              </div>
              <input value={row.lessonTitle} onChange={(event) => updateRow(row.rowKey, { lessonTitle: event.target.value })} className="h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
              <input type="number" value={row.lessonOrder} onChange={(event) => updateRow(row.rowKey, { lessonOrder: event.target.value })} className="h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
              <PremiumPicker value={row.videoAssetId} onChange={(event) => updateRow(row.rowKey, { videoAssetId: event.target.value })} options={videoOptions} className="[&>select]:h-10 [&>select]:text-xs" />
              <button
                type="button"
                onClick={() => openNotes(row)}
                className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-input bg-background px-3 text-left text-xs font-bold text-foreground outline-none hover:border-primary/50 focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{notesPreview(row.lessonNotes)}</span>
              </button>
              <input value={row.captionsVttUrl} onChange={(event) => updateRow(row.rowKey, { captionsVttUrl: event.target.value })} placeholder="Captions VTT URL" className="h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
              <input value={row.captionsLanguagesJson} onChange={(event) => updateRow(row.rowKey, { captionsLanguagesJson: event.target.value })} placeholder='["en"]' className="h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
              <textarea value={row.transcriptText} onChange={(event) => updateRow(row.rowKey, { transcriptText: event.target.value })} rows={2} placeholder="Transcript" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
              <textarea value={row.audioDescriptionText} onChange={(event) => updateRow(row.rowKey, { audioDescriptionText: event.target.value })} rows={2} placeholder="Audio description" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
              <input value={row.signLanguageVideoUrl} onChange={(event) => updateRow(row.rowKey, { signLanguageVideoUrl: event.target.value })} placeholder="Sign language URL" className="h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
              <PremiumPicker value={row.accessibilityStatus} onChange={(event) => updateRow(row.rowKey, { accessibilityStatus: event.target.value })} options={accessibilityStatusOptions} className="[&>select]:h-10 [&>select]:text-xs" />
              <label className="flex h-10 items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs font-bold">
                <input type="checkbox" checked={row.isActive} onChange={(event) => updateRow(row.rowKey, { isActive: event.target.checked })} className="h-4 w-4 rounded border-input text-primary focus:ring-primary" />
                Active
              </label>
              <button type="button" onClick={() => removeRow(row.rowKey)} className="inline-flex h-10 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10 px-3 text-xs font-black text-destructive hover:bg-destructive hover:text-destructive-foreground">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )) : (
            <div className="px-5 py-12 text-center text-sm font-semibold text-muted-foreground">No lessons yet. Add rows and save.</div>
          )}
        </div>
      </div>

      {editingNotesRow ? (
        <div className="fixed inset-0 z-50 bg-background/90 p-4 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-5xl flex-col rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border p-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Lesson Notes</p>
                <h3 className="mt-1 truncate font-heading text-lg font-black text-foreground">
                  {editingNotesRow.lessonTitle || "Untitled lesson"}
                </h3>
              </div>
              <button type="button" onClick={closeNotes} className="btn-secondary h-9 px-3 text-xs">
                <X className="h-4 w-4" />
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              <RichNotesEditor
                value={editingNotesDraft}
                onChange={setEditingNotesDraft}
              />
            </div>
            <div className="flex justify-end gap-3 border-t border-border p-4">
              <button type="button" onClick={closeNotes} className="btn-secondary">
                Close without saving
              </button>
              <button type="button" onClick={saveNotes} className="btn-primary">
                <Save className="h-4 w-4" />
                Save note
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="border-t border-border bg-muted/10 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className={accessibilitySummary.includes("warning") ? "min-w-0 text-xs font-bold text-amber-700 dark:text-amber-300" : "min-w-0 text-xs font-bold text-emerald-700 dark:text-emerald-300"}>
            {message || accessibilitySummary}
          </p>
          <button type="button" onClick={saveRows} disabled={isPending} className="btn-primary h-11 w-full justify-center px-4 text-sm md:w-auto md:min-w-36">
            <Save className="h-4 w-4" />
            {isPending ? "Saving..." : "Save Mapping"}
          </button>
        </div>
      </div>
    </>
  )
}
