"use client"

import { useEffect, useRef, useState } from "react"
import { FileText, Save, X } from "lucide-react"

import { RichNotesEditor, notesPreview } from "./RichNotesEditor"

type ModuleDescriptionFieldProps = {
  defaultValue: string
}

export function ModuleDescriptionField({ defaultValue }: ModuleDescriptionFieldProps) {
  const hiddenRef = useRef<HTMLInputElement | null>(null)
  const [value, setValue] = useState(defaultValue || "")
  const [draft, setDraft] = useState(defaultValue || "")
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const nextValue = defaultValue || ""
    setValue(nextValue)
    setDraft(nextValue)
    if (hiddenRef.current) hiddenRef.current.value = nextValue
  }, [defaultValue])

  function openEditor() {
    setDraft(value)
    setOpen(true)
  }

  function closeEditor() {
    setDraft(value)
    setOpen(false)
  }

  function saveDraft() {
    if (hiddenRef.current) hiddenRef.current.value = draft
    setValue(draft)
    setOpen(false)
    window.setTimeout(() => hiddenRef.current?.form?.requestSubmit(), 0)
  }

  return (
    <div className="md:col-span-2">
      <input ref={hiddenRef} type="hidden" name="moduleDescription" value={value} readOnly />
      <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Module Super Note</span>
      <button
        type="button"
        onClick={openEditor}
        className="flex min-h-14 w-full min-w-0 items-center gap-3 rounded-lg border border-input bg-background px-4 py-3 text-left outline-none hover:border-primary/50 focus:border-primary focus:ring-1 focus:ring-primary"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileText className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black text-foreground">{value ? "Edit module note" : "Add module note"}</span>
          <span className="mt-1 block truncate text-xs font-semibold text-muted-foreground">{notesPreview(value)}</span>
        </span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 bg-background/90 p-4 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-5xl flex-col rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border p-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Module Super Note</p>
                <h3 className="mt-1 font-heading text-lg font-black text-foreground">Edit module-level note</h3>
              </div>
              <button type="button" onClick={closeEditor} className="btn-secondary h-9 px-3 text-xs">
                <X className="h-4 w-4" />
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              <RichNotesEditor value={draft} onChange={setDraft} />
            </div>
            <div className="flex justify-end gap-3 border-t border-border p-4">
              <button type="button" onClick={closeEditor} className="btn-secondary">
                Close without saving
              </button>
              <button type="button" onClick={saveDraft} className="btn-primary">
                <Save className="h-4 w-4" />
                Save note
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
