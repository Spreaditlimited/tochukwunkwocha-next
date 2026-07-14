"use client"

import { useMemo, useRef, useState } from "react"
import { Bold, Heading2, Heading3, Italic, Link2, List, Pilcrow, Quote, Redo2, Undo2, Unlink } from "lucide-react"

function cleanHtml(value: string) {
  if (typeof window === "undefined") return value
  const template = document.createElement("template")
  template.innerHTML = value
  template.content.querySelectorAll("script, style, iframe, object, embed").forEach((node) => node.remove())
  template.content.querySelectorAll("*").forEach((node) => {
    Array.from(node.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase()
      const val = attribute.value
      if (name.startsWith("on")) node.removeAttribute(attribute.name)
      if ((name === "href" || name === "src") && /^\s*javascript:/i.test(val)) node.removeAttribute(attribute.name)
      if (name === "style") node.removeAttribute(attribute.name)
    })
  })
  return template.innerHTML.trim()
}

function normalizeInitialHtml(value: string) {
  const html = String(value || "").trim()
  if (!html) return "<p></p>"
  return html
}

function toolbarButtonClass(active = false) {
  return active
    ? "inline-flex h-10 w-10 items-center justify-center rounded-lg border border-primary bg-primary text-primary-foreground shadow-sm"
    : "inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
}

type EditorCommand = "bold" | "italic" | "insertUnorderedList" | "formatBlock" | "undo" | "redo" | "unlink"

export function BlogContentEditor({ defaultHtml }: { defaultHtml?: string | null }) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const savedRangeRef = useRef<Range | null>(null)
  const initialHtml = useMemo(() => normalizeInitialHtml(defaultHtml || ""), [defaultHtml])
  const [html, setHtml] = useState(initialHtml)
  const [linkUrl, setLinkUrl] = useState("")
  const [showLinkField, setShowLinkField] = useState(false)

  function syncHtml() {
    const next = cleanHtml(editorRef.current?.innerHTML || "")
    setHtml(next)
  }

  function saveSelection() {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)
    if (editorRef.current?.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange()
    }
  }

  function restoreSelection() {
    const range = savedRangeRef.current
    if (!range) return
    const selection = window.getSelection()
    if (!selection) return
    selection.removeAllRanges()
    selection.addRange(range)
  }

  function runCommand(command: EditorCommand, value?: string) {
    editorRef.current?.focus()
    restoreSelection()
    document.execCommand(command, false, value)
    syncHtml()
    saveSelection()
  }

  function applyLink() {
    const url = linkUrl.trim()
    if (!url) return
    const safeUrl = /^(https?:\/\/|\/|mailto:)/i.test(url) ? url : `https://${url}`
    editorRef.current?.focus()
    restoreSelection()
    document.execCommand("createLink", false, safeUrl)
    setLinkUrl("")
    setShowLinkField(false)
    syncHtml()
    saveSelection()
  }

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    event.preventDefault()
    const text = event.clipboardData.getData("text/plain")
    document.execCommand("insertText", false, text)
    syncHtml()
  }

  return (
    <section className="grid gap-3">
      <div>
        <span className="label">Content</span>
        <p className="mt-1 text-xs font-medium text-muted-foreground">
          Write normally. Use the toolbar for headings, emphasis, lists, quotes, and links. The post is saved as clean HTML for the public blog.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/20 p-3">
          <button type="button" className={toolbarButtonClass()} title="Paragraph" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("formatBlock", "p")}>
            <Pilcrow className="h-4 w-4" />
          </button>
          <button type="button" className={toolbarButtonClass()} title="Heading 2" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("formatBlock", "h2")}>
            <Heading2 className="h-4 w-4" />
          </button>
          <button type="button" className={toolbarButtonClass()} title="Heading 3" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("formatBlock", "h3")}>
            <Heading3 className="h-4 w-4" />
          </button>
          <span className="mx-1 h-8 w-px bg-border" />
          <button type="button" className={toolbarButtonClass()} title="Bold" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("bold")}>
            <Bold className="h-4 w-4" />
          </button>
          <button type="button" className={toolbarButtonClass()} title="Italic" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("italic")}>
            <Italic className="h-4 w-4" />
          </button>
          <button type="button" className={toolbarButtonClass()} title="Bullet list" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("insertUnorderedList")}>
            <List className="h-4 w-4" />
          </button>
          <button type="button" className={toolbarButtonClass()} title="Quote" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("formatBlock", "blockquote")}>
            <Quote className="h-4 w-4" />
          </button>
          <span className="mx-1 h-8 w-px bg-border" />
          <button type="button" className={toolbarButtonClass()} title="Add link" onMouseDown={(event) => event.preventDefault()} onClick={() => { saveSelection(); setShowLinkField((value) => !value) }}>
            <Link2 className="h-4 w-4" />
          </button>
          <button type="button" className={toolbarButtonClass()} title="Remove link" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("unlink")}>
            <Unlink className="h-4 w-4" />
          </button>
          <span className="mx-1 h-8 w-px bg-border" />
          <button type="button" className={toolbarButtonClass()} title="Undo" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("undo")}>
            <Undo2 className="h-4 w-4" />
          </button>
          <button type="button" className={toolbarButtonClass()} title="Redo" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("redo")}>
            <Redo2 className="h-4 w-4" />
          </button>
        </div>

        {showLinkField ? (
          <div className="flex flex-col gap-2 border-b border-border bg-background p-3 sm:flex-row">
            <input
              className="field h-11 flex-1"
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              placeholder="Paste link URL"
            />
            <button type="button" className="btn-primary justify-center px-5" onClick={applyLink}>
              Apply Link
            </button>
          </div>
        ) : null}

        <div
          ref={editorRef}
          className="blog-content min-h-[620px] max-w-none bg-background p-6 outline-none focus:ring-2 focus:ring-primary/30 sm:p-8"
          contentEditable
          suppressContentEditableWarning
          dangerouslySetInnerHTML={{ __html: initialHtml }}
          onInput={syncHtml}
          onBlur={syncHtml}
          onKeyUp={saveSelection}
          onMouseUp={saveSelection}
          onFocus={saveSelection}
          onPaste={handlePaste}
        />
      </div>

      <input type="hidden" name="blogContent" value={html} />
    </section>
  )
}
