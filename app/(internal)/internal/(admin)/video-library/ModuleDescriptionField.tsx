"use client"

import { useEffect, useRef, useState } from "react"
import { FileText, Save } from "lucide-react"

import { DashboardModal } from "@/components/dashboard/DashboardModal"
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
        <DashboardModal
          title="Edit module-level note"
          eyebrow="Module Super Note"
          onClose={closeEditor}
          size="xl"
          fullHeight
          bodyClassName="p-4 sm:p-4"
          footer={
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeEditor} className="btn-secondary">
                Close without saving
              </button>
              <button type="button" onClick={saveDraft} className="btn-primary">
                <Save className="h-4 w-4" />
                Save note
              </button>
            </div>
          }
        >
          <RichNotesEditor value={draft} onChange={setDraft} />
        </DashboardModal>
      ) : null}
    </div>
  )
}
