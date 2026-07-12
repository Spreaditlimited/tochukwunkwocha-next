"use client"

import { type ClipboardEvent, type KeyboardEvent, useEffect, useRef } from "react"
import { Bold, Italic, LinkIcon, List, ListOrdered, Quote, Type, Underline } from "lucide-react"

import { plainTextToRichNotes, sanitizeRichNotes } from "@/lib/rich-notes"

type RichNotesEditorProps = {
  value: string
  onChange: (value: string) => void
}

export function RichNotesEditor({ value, onChange }: RichNotesEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!editorRef.current) return
    if (editorRef.current.innerHTML !== value) editorRef.current.innerHTML = value
  }, [value])

  function runCommand(command: string, commandValue?: string) {
    editorRef.current?.focus()
    document.execCommand(command, false, commandValue)
    if (editorRef.current) onChange(editorRef.current.innerHTML)
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault()
    const html = event.clipboardData.getData("text/html")
    const text = event.clipboardData.getData("text/plain")
    const nextHtml = html ? sanitizeRichNotes(html) : plainTextToRichNotes(text)
    document.execCommand("insertHTML", false, nextHtml)
    if (editorRef.current) onChange(editorRef.current.innerHTML)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const isModifier = event.metaKey || event.ctrlKey
    if (!isModifier || event.altKey) return
    const key = event.key.toLowerCase()
    if (key === "b") {
      event.preventDefault()
      runCommand("bold")
    } else if (key === "i") {
      event.preventDefault()
      runCommand("italic")
    } else if (key === "u") {
      event.preventDefault()
      runCommand("underline")
    } else if (key === "k") {
      event.preventDefault()
      const href = window.prompt("Paste link URL")
      if (href) runCommand("createLink", href)
    }
  }

  return (
    <div className="rounded-lg border border-input bg-background">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/20 p-2">
        <button type="button" title="Bold" onClick={() => runCommand("bold")} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"><Bold className="h-4 w-4" /></button>
        <button type="button" title="Italic" onClick={() => runCommand("italic")} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"><Italic className="h-4 w-4" /></button>
        <button type="button" title="Underline" onClick={() => runCommand("underline")} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"><Underline className="h-4 w-4" /></button>
        <span className="mx-1 h-6 w-px bg-border" />
        <button type="button" title="Heading" onClick={() => runCommand("formatBlock", "h3")} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"><Type className="h-4 w-4" /></button>
        <button type="button" title="Bulleted list" onClick={() => runCommand("insertUnorderedList")} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"><List className="h-4 w-4" /></button>
        <button type="button" title="Numbered list" onClick={() => runCommand("insertOrderedList")} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"><ListOrdered className="h-4 w-4" /></button>
        <button type="button" title="Quote" onClick={() => runCommand("formatBlock", "blockquote")} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"><Quote className="h-4 w-4" /></button>
        <button
          type="button"
          title="Link"
          onClick={() => {
            const href = window.prompt("Paste link URL")
            if (href) runCommand("createLink", href)
          }}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
        >
          <LinkIcon className="h-4 w-4" />
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
        onBlur={(event) => onChange(event.currentTarget.innerHTML)}
        className="min-h-[28rem] overflow-auto px-5 py-4 text-sm leading-7 text-foreground outline-none [&_*]:!text-inherit"
      />
    </div>
  )
}

export function notesPreview(value: string) {
  const text = value
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
  return text || "No notes"
}
