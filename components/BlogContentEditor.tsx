"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import { createPortal } from "react-dom"
import Link from "@tiptap/extension-link"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import {
  Bold,
  ExternalLink,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  Pilcrow,
  Quote,
  Redo2,
  Undo2,
  Unlink,
  X
} from "lucide-react"

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
  return html || "<p></p>"
}

function toolbarButtonClass(active = false, disabled = false) {
  return [
    "inline-flex h-10 w-10 items-center justify-center rounded-lg border shadow-sm transition-colors",
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary",
    disabled ? "cursor-not-allowed opacity-40" : ""
  ].join(" ")
}

function normalizeLinkUrl(value: string) {
  const url = value.trim()
  if (!url) return ""
  if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(url)) return url
  return `https://${url}`
}

export function BlogContentEditor({ defaultHtml }: { defaultHtml?: string | null }) {
  const initialHtml = useMemo(() => normalizeInitialHtml(defaultHtml || ""), [defaultHtml])
  const [html, setHtml] = useState(initialHtml)
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")
  const [linkText, setLinkText] = useState("")
  const [linkError, setLinkError] = useState("")

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          class: "font-bold text-primary underline underline-offset-2"
        }
      })
    ],
    content: initialHtml,
    onUpdate: ({ editor: currentEditor }) => {
      setHtml(cleanHtml(currentEditor.getHTML()))
    },
    editorProps: {
      attributes: {
        class: "blog-content min-h-[620px] max-w-none bg-background p-6 outline-none sm:p-8"
      }
    }
  })

  useEffect(() => {
    if (editor && editor.getHTML() !== initialHtml) {
      editor.commands.setContent(initialHtml, false)
      setHtml(initialHtml)
    }
  }, [editor, initialHtml])

  function openLinkDialog() {
    if (!editor) return
    setLinkUrl(String(editor.getAttributes("link").href || ""))
    setLinkText("")
    setLinkError("")
    setShowLinkDialog(true)
  }

  function closeLinkDialog() {
    setShowLinkDialog(false)
    setLinkError("")
  }

  function applyLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (!editor) return

    const url = normalizeLinkUrl(linkUrl)
    if (!url) {
      setLinkError("URL is required.")
      return
    }

    const text = linkText.trim()
    const { empty } = editor.state.selection
    if (!text && empty) {
      setLinkError("Select text in the editor or enter link text.")
      return
    }

    if (text) {
      editor
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text,
          marks: [{ type: "link", attrs: { href: url } }]
        })
        .run()
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
    }

    setHtml(cleanHtml(editor.getHTML()))
    setLinkUrl("")
    setLinkText("")
    closeLinkDialog()
  }

  const words = editor?.getText().trim().split(/\s+/).filter(Boolean).length || 0
  const characters = editor?.getText().length || 0

  const linkDialog = showLinkDialog && typeof document !== "undefined"
    ? createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeLinkDialog()
          }}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="blog-link-dialog-title"
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-primary" />
                <h3 id="blog-link-dialog-title" className="font-heading text-lg font-black text-foreground">
                  Insert Link
                </h3>
              </div>
              <button
                type="button"
                onClick={closeLinkDialog}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close link dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={applyLink} className="space-y-4 p-6">
              <label className="block">
                <span className="label">URL</span>
                <span className="relative mt-1 block">
                  <input
                    className="field h-11 pr-11"
                    value={linkUrl}
                    onChange={(event) => {
                      setLinkUrl(event.target.value)
                      if (linkError) setLinkError("")
                    }}
                    placeholder="https://example.com"
                    autoFocus
                    aria-invalid={Boolean(linkError)}
                    aria-describedby={linkError ? "blog-link-error" : undefined}
                  />
                  <ExternalLink className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </span>
              </label>

              <label className="block">
                <span className="label">
                  Link Text <span className="normal-case tracking-normal text-muted-foreground">(optional)</span>
                </span>
                <input
                  className="field mt-1 h-11"
                  value={linkText}
                  onChange={(event) => {
                    setLinkText(event.target.value)
                    if (linkError) setLinkError("")
                  }}
                  placeholder="Click here"
                />
                <span className="mt-1 block text-xs font-medium text-muted-foreground">
                  Leave empty to apply the link to the selected text.
                </span>
              </label>

              <div>
                <p className="mb-2 text-xs font-bold text-muted-foreground">Quick actions</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    ["Email", "mailto:"],
                    ["Phone", "tel:"],
                    ["Anchor", "#"]
                  ].map(([label, value]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setLinkUrl(value)}
                      className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground hover:text-foreground"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {linkError ? (
                <p id="blog-link-error" className="text-sm font-bold text-destructive" role="alert">
                  {linkError}
                </p>
              ) : null}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary" onClick={closeLinkDialog}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Insert Link
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )
    : null

  return (
    <section className="grid gap-3">
      <div>
        <span className="label">Content</span>
        <p className="mt-1 text-xs font-medium text-muted-foreground">
          Write normally. Select existing text before inserting a link, or provide link text in the dialog.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="sticky top-[8.5rem] z-30 flex flex-wrap items-center gap-2 rounded-t-2xl border-b border-border bg-card/95 p-3 shadow-sm backdrop-blur-xl lg:top-[4.5rem]">
          <button type="button" className={toolbarButtonClass(editor?.isActive("paragraph"))} title="Paragraph" onClick={() => editor?.chain().focus().setParagraph().run()}>
            <Pilcrow className="h-4 w-4" />
          </button>
          <button type="button" className={toolbarButtonClass(editor?.isActive("heading", { level: 2 }))} title="Heading 2" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 className="h-4 w-4" />
          </button>
          <button type="button" className={toolbarButtonClass(editor?.isActive("heading", { level: 3 }))} title="Heading 3" onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>
            <Heading3 className="h-4 w-4" />
          </button>
          <span className="mx-1 h-8 w-px bg-border" />
          <button type="button" className={toolbarButtonClass(editor?.isActive("bold"))} title="Bold" onClick={() => editor?.chain().focus().toggleBold().run()}>
            <Bold className="h-4 w-4" />
          </button>
          <button type="button" className={toolbarButtonClass(editor?.isActive("italic"))} title="Italic" onClick={() => editor?.chain().focus().toggleItalic().run()}>
            <Italic className="h-4 w-4" />
          </button>
          <button type="button" className={toolbarButtonClass(editor?.isActive("bulletList"))} title="Bullet list" onClick={() => editor?.chain().focus().toggleBulletList().run()}>
            <List className="h-4 w-4" />
          </button>
          <button type="button" className={toolbarButtonClass(editor?.isActive("blockquote"))} title="Quote" onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
            <Quote className="h-4 w-4" />
          </button>
          <span className="mx-1 h-8 w-px bg-border" />
          <button type="button" className={toolbarButtonClass(editor?.isActive("link"))} title="Insert link" onClick={openLinkDialog}>
            <Link2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={toolbarButtonClass(false, !editor?.isActive("link"))}
            title="Remove link"
            disabled={!editor?.isActive("link")}
            onClick={() => editor?.chain().focus().extendMarkRange("link").unsetLink().run()}
          >
            <Unlink className="h-4 w-4" />
          </button>
          <span className="mx-1 h-8 w-px bg-border" />
          <button type="button" className={toolbarButtonClass(false, !editor?.can().undo())} title="Undo" disabled={!editor?.can().undo()} onClick={() => editor?.chain().focus().undo().run()}>
            <Undo2 className="h-4 w-4" />
          </button>
          <button type="button" className={toolbarButtonClass(false, !editor?.can().redo())} title="Redo" disabled={!editor?.can().redo()} onClick={() => editor?.chain().focus().redo().run()}>
            <Redo2 className="h-4 w-4" />
          </button>
        </div>

        {editor ? (
          <EditorContent editor={editor} />
        ) : (
          <div className="min-h-[620px] animate-pulse bg-muted/20" />
        )}

        <div className="flex items-center gap-4 border-t border-border bg-muted/20 px-4 py-2 text-xs font-medium text-muted-foreground">
          <span>{words} words</span>
          <span>{characters} characters</span>
          <span className="ml-auto">Powered by TipTap</span>
        </div>
      </div>

      <input type="hidden" name="blogContent" value={html} />
      {linkDialog}
    </section>
  )
}
