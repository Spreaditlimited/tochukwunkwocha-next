"use client"

import { FormEvent, useState } from "react"
import { ExternalLink, Link2, Loader2, Trash2 } from "lucide-react"

import { PremiumPicker } from "@/components/PremiumPicker"
import { showStudentToast } from "@/components/student-dashboard/StudentActionToaster"
import { STUDENT_PROJECT_LINK_DECLARATION_TEXT } from "@/lib/student-project-link-policy"

type StudentProjectLink = {
  linkUuid: string
  title: string
  projectUrl: string
  host: string
  description: string
  courseSlug: string
  certificateNo: string
  isPublic: boolean
  status: string
  sourceType: "self_declared"
  declarationAcceptedAt: string | null
  createdAt: string | null
}

type CourseOption = {
  courseSlug: string
  courseName: string
}

type CertificateOption = {
  certificateNo: string
  courseSlug: string
  label: string
}

async function postJson<T>(url: string, body: Record<string, unknown>, method = "POST") {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body)
  })
  const json = await response.json().catch(() => null)
  if (!response.ok || !json?.ok) throw new Error(json?.error || "Request failed.")
  return json as T
}

export function StudentProjectLinksPanel({
  initialLinks,
  courses,
  certificates,
  canAddLinks
}: {
  initialLinks: StudentProjectLink[]
  courses: CourseOption[]
  certificates: CertificateOption[]
  canAddLinks: boolean
}) {
  const [links, setLinks] = useState(initialLinks)
  const [title, setTitle] = useState("")
  const [projectUrl, setProjectUrl] = useState("")
  const [description, setDescription] = useState("")
  const [courseSlug, setCourseSlug] = useState(courses[0]?.courseSlug || "")
  const [certificateNo, setCertificateNo] = useState(certificates[0]?.certificateNo || "")
  const [declarationAccepted, setDeclarationAccepted] = useState(false)
  const [busy, setBusy] = useState("")

  async function submitLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy("create")
    try {
      const result = await postJson<{ links: StudentProjectLink[] }>("/api/student/project-links", {
        title,
        projectUrl,
        description,
        courseSlug,
        certificateNo,
        declarationAccepted
      })
      setLinks(result.links)
      setTitle("")
      setProjectUrl("")
      setDescription("")
      setDeclarationAccepted(false)
      showStudentToast({ type: "success", title: "Project link added", message: "Your additional project link is now available on your public project profile." })
    } catch (error) {
      showStudentToast({ type: "error", title: "Project link not saved", message: error instanceof Error ? error.message : "Could not save project link." })
    } finally {
      setBusy("")
    }
  }

  async function updateVisibility(linkUuid: string, isPublic: boolean) {
    setBusy(linkUuid)
    try {
      const result = await postJson<{ links: StudentProjectLink[] }>("/api/student/project-links", { linkUuid, isPublic }, "PATCH")
      setLinks(result.links)
      showStudentToast({ type: "success", title: isPublic ? "Project link shown" : "Project link hidden" })
    } catch (error) {
      showStudentToast({ type: "error", title: "Could not update link", message: error instanceof Error ? error.message : "Could not update project link." })
    } finally {
      setBusy("")
    }
  }

  async function deleteLink(linkUuid: string) {
    setBusy(linkUuid)
    try {
      const result = await postJson<{ links: StudentProjectLink[] }>("/api/student/project-links", { linkUuid, action: "delete" }, "PATCH")
      setLinks(result.links)
      showStudentToast({ type: "success", title: "Project link removed" })
    } catch (error) {
      showStudentToast({ type: "error", title: "Could not remove link", message: error instanceof Error ? error.message : "Could not remove project link." })
    } finally {
      setBusy("")
    }
  }

  return (
    <section className="rounded-xl border border-border bg-background p-6 sm:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Public Project Profile</p>
          <h3 className="mt-1 font-heading text-xl font-black text-foreground">Additional Project Links</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Add other projects you have built or materially contributed to. These links are student-declared and are separate from academy-verified certificate projects.
          </p>
        </div>
      </div>

      {links.length ? (
        <div className="mt-6 grid gap-3">
          {links.map((link) => (
            <div key={link.linkUuid} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-heading text-base font-bold text-foreground">{link.title}</h4>
                    <span className={link.isPublic ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-300" : "rounded-full bg-muted px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground"}>
                      {link.isPublic ? "Public" : "Hidden"}
                    </span>
                  </div>
                  <a href={link.projectUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex max-w-full items-center break-all text-sm font-bold text-primary">
                    {link.host || link.projectUrl}
                    <ExternalLink className="ml-1.5 h-3.5 w-3.5 shrink-0" />
                  </a>
                  {link.description ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{link.description}</p> : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    className="btn-secondary px-3 py-2 text-xs"
                    disabled={Boolean(busy)}
                    onClick={() => updateVisibility(link.linkUuid, !link.isPublic)}
                  >
                    {busy === link.linkUuid ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                    {link.isPublic ? "Hide" : "Show"}
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs font-bold text-destructive transition-colors hover:bg-destructive/10"
                    disabled={Boolean(busy)}
                    onClick={() => deleteLink(link.linkUuid)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/20 p-5 text-sm text-muted-foreground">
          No additional project links have been added yet.
        </div>
      )}

      <form onSubmit={submitLink} className="mt-8 grid gap-5 rounded-lg border border-border bg-card p-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Project title</span>
            <input className="field" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Example: Inventory dashboard" required disabled={!canAddLinks || Boolean(busy)} />
          </label>
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <Link2 className="h-3 w-3" /> Project URL
            </span>
            <input className="field" value={projectUrl} onChange={(event) => setProjectUrl(event.target.value)} placeholder="https://your-project.example.com" type="url" required disabled={!canAddLinks || Boolean(busy)} />
          </label>
        </div>
        <label className="block">
          <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Short description</span>
          <textarea className="field min-h-24 resize-y" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Briefly describe what the project does." disabled={!canAddLinks || Boolean(busy)} />
        </label>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Related programme</span>
            <PremiumPicker
              value={courseSlug}
              onChange={(event) => setCourseSlug(event.target.value)}
              disabled={!canAddLinks || Boolean(busy)}
              options={[
                { value: "", label: "Not linked to a programme" },
                ...courses.map((course) => ({ value: course.courseSlug, label: course.courseName }))
              ]}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Related certificate</span>
            <PremiumPicker
              value={certificateNo}
              onChange={(event) => setCertificateNo(event.target.value)}
              disabled={!canAddLinks || Boolean(busy)}
              options={[
                { value: "", label: "Not linked to a certificate" },
                ...certificates.map((certificate) => ({ value: certificate.certificateNo, label: certificate.label }))
              ]}
            />
          </label>
        </div>
        <label className="flex gap-3 rounded-lg border border-border bg-background p-4 text-sm leading-relaxed text-muted-foreground">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 shrink-0 accent-primary"
            checked={declarationAccepted}
            onChange={(event) => setDeclarationAccepted(event.target.checked)}
            required
            disabled={!canAddLinks || Boolean(busy)}
          />
          <span>{STUDENT_PROJECT_LINK_DECLARATION_TEXT}</span>
        </label>
        {!canAddLinks ? (
          <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm font-semibold text-amber-700 dark:text-amber-300">
            You can add additional public project links after your first project has been verified.
          </p>
        ) : null}
        <button type="submit" className="btn-primary w-full sm:w-fit" disabled={!canAddLinks || !declarationAccepted || Boolean(busy)}>
          {busy === "create" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Add Project Link
        </button>
      </form>
    </section>
  )
}
