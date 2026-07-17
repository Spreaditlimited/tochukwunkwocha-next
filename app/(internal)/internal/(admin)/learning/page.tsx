import { 
  Award,
  BookOpen,
  CheckCircle2, 
  Clock, 
  FileCheck2, 
  FileText, 
  GraduationCap, 
  Laptop, 
  Link as LinkIcon, 
  Mail, 
  MessageSquareText, 
  RotateCcw,
  Settings2,
  ShieldAlert,
  Smartphone,
  Users
} from "lucide-react"

import { CERTIFICATE_PROOF_MARKER, listLearningSupportData } from "@/lib/admin-learning-support"
import { formatDate } from "@/lib/utils"
import {
  resendStudentResetLinkAction,
  resendCertificateApprovalEmailAction,
  resetStudentDevicesAction,
  reviewAssignmentAction,
  saveCourseFeaturesAction
} from "./actions"
import { PremiumPicker } from "@/components/PremiumPicker"

export const dynamic = "force-dynamic"

function isOn(value: number | bigint | boolean | null | undefined) {
  return Number(value || 0) === 1
}

function featureFor(features: Awaited<ReturnType<typeof listLearningSupportData>>["features"], courseSlug: string) {
  return features.find((item) => item.courseSlug === courseSlug)
}

function assignmentKindLabel(kind: string, text: string | null) {
  if (kind === "link" && text === CERTIFICATE_PROOF_MARKER) return "Certificate Proof Link"
  const cleanKind = kind || "assignment"
  return cleanKind.charAt(0).toUpperCase() + cleanKind.slice(1).replace(/_/g, " ")
}

function StatusPill({ status }: { status: string | null }) {
  const s = String(status || "pending").toLowerCase()
  let colorClass = "border-border bg-muted text-muted-foreground"
  
  if (s === "approved" || s === "ready") {
    colorClass = "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
  } else if (s === "pending" || s === "submitted" || s === "in_review" || s === "needs_revision") {
    colorClass = "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
  } else if (s === "denied" || s === "rejected" || s === "blocked") {
    colorClass = "border-destructive/20 bg-destructive/10 text-destructive"
  }

  return (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest shadow-sm ${colorClass}`}>
      {s.replace(/_/g, " ")}
    </span>
  )
}

export default async function InternalLearningSupportPage() {
  const { courses, features, assignments, attachments, students } = await listLearningSupportData()
  const alumniParticipationOptions = [
    { value: "none", label: "None (Hidden)" },
    { value: "read_only", label: "Read Only" },
    { value: "full", label: "Full Participation" }
  ]
  const enabledOptions = [
    { value: "0", label: "Disabled" },
    { value: "1", label: "Enabled" }
  ]
  const proofTypeOptions = [
    { value: "website_link", label: "Website Link" }
  ]
  const assignmentStatusOptions = [
    { value: "submitted", label: "Mark as Submitted (Unread)" },
    { value: "in_review", label: "In Review (WIP)" },
    { value: "needs_revision", label: "Needs Revision (Changes Required)" },
    { value: "approved", label: "Approved (Pass)" },
    { value: "rejected", label: "Rejected (Fail)" }
  ]
  
  const attachmentMap = new Map<string, typeof attachments>()
  for (const attachment of attachments) {
    const key = String(attachment.assignmentId)
    attachmentMap.set(key, [...(attachmentMap.get(key) || []), attachment])
  }
  
  const pendingCount = assignments.filter((item) => ["submitted", "in_review"].includes(item.status)).length
  const certificateProofCount = assignments.filter((item) => item.submissionKind === "link" && item.submissionText === CERTIFICATE_PROOF_MARKER).length

  return (
    <main className="space-y-8 pb-12">
      
      {/* Header */}
      <div className="flex flex-col gap-6 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow text-primary">Student Success</p>
          <h1 className="mt-1 font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Learning Support Ops
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Manage curriculum feature toggles, grade assignment submissions, verify certificate proofs, and provide direct administrative support to learners.
          </p>
        </div>
      </div>

      {/* Primary Pulse Metrics */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="group flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Courses</p>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-110">
              <BookOpen className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-6 font-heading text-4xl font-black text-foreground">{courses.length}</p>
        </div>
        
        <div className="group flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pending Reviews</p>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 transition-transform group-hover:scale-110 dark:text-amber-400">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-6 font-heading text-4xl font-black text-foreground">{pendingCount}</p>
        </div>

        <div className="group flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Certificate Proofs</p>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 transition-transform group-hover:scale-110 dark:text-emerald-400">
              <Award className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-6 font-heading text-4xl font-black text-foreground">{certificateProofCount}</p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr] xl:items-start">
        {/* Student Support Actions */}
        <section className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm xl:h-[600px]">
          <div className="flex items-center justify-between border-b border-border bg-muted/20 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-heading text-xl font-black text-foreground">Student Security</h2>
                <p className="mt-1 text-sm font-medium text-muted-foreground">Manage active sessions and device limits.</p>
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-auto bg-background p-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 sm:p-8">
            <div className="grid gap-4">
              {students.length ? students.map((student) => (
                <article key={String(student.id)} className="rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/20">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h3 className="font-heading text-lg font-black text-foreground">{student.fullName || "Unknown Student"}</h3>
                      <p className="mt-0.5 text-sm font-medium text-muted-foreground">{student.email}</p>
                      
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        <span className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1">
                          <Laptop className="h-3 w-3" /> {Number(student.activeSessions || 0)} Sessions
                        </span>
                        <span className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1">
                          <Smartphone className="h-3 w-3" /> {Number(student.trustedDevices || 0)} Devices
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3" /> Login: {formatDate(student.lastLoginAt)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col">
                      <form action={resendStudentResetLinkAction} className="w-full sm:w-auto lg:w-full">
                        <input type="hidden" name="accountId" value={String(student.id)} />
                        <button className="btn-secondary w-full justify-center shadow-sm" type="submit">
                          <Mail className="mr-2 h-3.5 w-3.5" /> Send Reset Link
                        </button>
                      </form>
                      <form action={resetStudentDevicesAction} className="w-full sm:w-auto lg:w-full">
                        <input type="hidden" name="accountId" value={String(student.id)} />
                        <button className="inline-flex w-full items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs font-bold text-destructive shadow-sm transition-colors hover:bg-destructive hover:text-destructive-foreground" type="submit">
                          <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reset Devices
                        </button>
                      </form>
                    </div>
                  </div>
                </article>
              )) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 py-12 text-center text-sm font-semibold text-muted-foreground">
                  <ShieldAlert className="mb-2 h-6 w-6" />
                  No student accounts found.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Course Feature Controls */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-3 border-b border-border bg-muted/20 p-6 sm:p-8">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Settings2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-heading text-xl font-black text-foreground">Course Feature Toggles</h2>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              Enable or disable specific learning capabilities per curriculum track.
            </p>
          </div>
        </div>
        
        <div className="max-h-[500px] overflow-auto bg-background p-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-2">
            {courses.length ? courses.map((course) => {
              const feature = featureFor(features, course.courseSlug)
              return (
                <form key={course.courseSlug} action={saveCourseFeaturesAction} className="flex flex-col rounded-xl border border-border bg-card shadow-sm transition-colors hover:border-primary/20">
                  <input type="hidden" name="courseSlug" value={course.courseSlug} />
                  
                  <div className="flex items-start justify-between border-b border-border bg-muted/10 p-5">
                    <div>
                      <h3 className="font-heading text-lg font-black text-foreground">{course.courseTitle || course.courseSlug}</h3>
                      <p className="mt-1 font-mono text-[10px] font-bold text-muted-foreground">/{course.courseSlug}</p>
                    </div>
                    <button className="btn-secondary justify-center shadow-sm" type="submit">
                      Save Settings
                    </button>
                  </div>
                  
                  <div className="grid flex-1 gap-4 p-5 sm:grid-cols-2">
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 transition-colors hover:bg-muted/40">
                      <input name="assignmentsEnabled" type="checkbox" defaultChecked={isOn(feature?.assignmentsEnabled)} className="h-4 w-4 rounded border-input text-primary focus:ring-primary" />
                      <span className="text-xs font-bold text-foreground">Assignments</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 transition-colors hover:bg-muted/40">
                      <input name="courseCommunityEnabled" type="checkbox" defaultChecked={isOn(feature?.courseCommunityEnabled)} className="h-4 w-4 rounded border-input text-primary focus:ring-primary" />
                      <span className="text-xs font-bold text-foreground">Community</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 transition-colors hover:bg-muted/40 sm:col-span-2">
                      <input name="certificateProofRequired" type="checkbox" defaultChecked={isOn(feature?.certificateProofRequired)} className="h-4 w-4 rounded border-input text-primary focus:ring-primary" />
                      <span className="text-xs font-bold text-foreground">Require Certificate Proof Link</span>
                    </label>
                    
                    <label className="block sm:col-span-2">
                      <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Alumni Participation Status</span>
                      <PremiumPicker name="alumniParticipationMode" defaultValue={feature?.alumniParticipationMode || "none"} options={alumniParticipationOptions} />
                    </label>
                    
                    <label className="block">
                      <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tutor Q&A</span>
                      <PremiumPicker name="tutorQuestionsEnabled" defaultValue={isOn(feature?.tutorQuestionsEnabled) ? "1" : "0"} options={enabledOptions} />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Proof Type</span>
                      <PremiumPicker name="certificateProofType" defaultValue={feature?.certificateProofType || "website_link"} disabled options={proofTypeOptions} />
                    </label>
                  </div>
                </form>
              )
            }) : (
              <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 py-12 text-center text-sm font-semibold text-muted-foreground">
                <GraduationCap className="mb-2 h-6 w-6" />
                No courses found to configure.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Grading / Assignment Queue */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-border bg-muted/20 p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-heading text-xl font-black text-foreground">Evaluation Queue</h2>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                Grade assignments and verify portfolio/certificate link submissions.
              </p>
            </div>
          </div>
          <div className="shrink-0 rounded-lg border border-border bg-background px-4 py-2 text-center shadow-inner">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total In Queue</p>
            <p className="font-heading text-xl font-black text-foreground">{assignments.length}</p>
          </div>
        </div>

        <div className="max-h-[800px] overflow-auto bg-background p-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 sm:p-8">
          <div className="grid gap-8">
            {assignments.length ? assignments.map((assignment) => {
              const itemAttachments = attachmentMap.get(String(assignment.id)) || []
              const certificateUrl = assignment.certificateNo
                ? `/dashboard/certificate?certificate_no=${encodeURIComponent(assignment.certificateNo)}`
                : ""
              const isApprovedCertificateProof = assignment.status === "approved"
                && assignment.submissionKind === "link"
                && assignment.submissionText === CERTIFICATE_PROOF_MARKER
                
              return (
                <article key={String(assignment.id)} className="rounded-2xl border border-border bg-card shadow-sm transition-colors hover:border-primary/20">
                  
                  {/* Identity Header */}
                  <div className="flex flex-col justify-between gap-4 border-b border-border bg-muted/10 p-6 lg:flex-row lg:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <StatusPill status={assignment.status} />
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-primary shadow-sm">
                          <FileText className="h-3 w-3" /> {assignmentKindLabel(assignment.submissionKind, assignment.submissionText)}
                        </span>
                      </div>
                      <h3 className="mt-4 font-heading text-xl font-black text-foreground">{assignment.studentName || "Unknown Learner"}</h3>
                      <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-muted-foreground">
                        <span className="flex items-center gap-1.5"><Mail className="h-3 w-3" /> {assignment.studentEmail}</span>
                        <span className="flex items-center gap-1.5 font-mono"><BookOpen className="h-3 w-3" /> {assignment.courseSlug}</span>
                        <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {formatDate(assignment.createdAt)}</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {certificateUrl && (
                        <a href={certificateUrl} className="btn-secondary shrink-0 shadow-sm" target="_blank" rel="noreferrer">
                          <Award className="mr-2 h-4 w-4" /> View Associated Certificate
                        </a>
                      )}
                      {isApprovedCertificateProof && (
                        <form action={resendCertificateApprovalEmailAction}>
                          <input type="hidden" name="assignmentId" value={String(assignment.id)} />
                          <button type="submit" className="btn-secondary shrink-0 shadow-sm">
                            <Mail className="mr-2 h-4 w-4" />
                            {certificateUrl ? "Resend Certificate Email" : "Issue Certificate & Send Email"}
                          </button>
                        </form>
                      )}
                    </div>
                  </div>

                  {/* Grading Workspace */}
                  <div className="grid lg:grid-cols-2">
                    
                    {/* Submission Material */}
                    <div className="border-b border-border p-6 lg:border-b-0 lg:border-r">
                      <h4 className="mb-4 flex items-center gap-2 font-heading text-sm font-bold uppercase tracking-widest text-muted-foreground">
                        <MessageSquareText className="h-4 w-4" /> Learner Submission
                      </h4>
                      
                      <div className="rounded-xl border border-border bg-background p-5 shadow-inner">
                        {assignment.submissionText && assignment.submissionText !== CERTIFICATE_PROOF_MARKER ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none text-foreground whitespace-pre-wrap">
                            {assignment.submissionText}
                          </div>
                        ) : null}
                        
                        {assignment.submissionLink ? (
                          <div className="mt-4 flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                            <LinkIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <a href={assignment.submissionLink} className="break-all text-sm font-bold text-primary underline transition-colors hover:text-primary/80" target="_blank" rel="noreferrer">
                              {assignment.submissionLink}
                            </a>
                          </div>
                        ) : null}
                        
                        {!assignment.submissionText && !assignment.submissionLink && (
                          <p className="text-sm italic text-muted-foreground">No text body or primary link provided.</p>
                        )}
                      </div>

                      {itemAttachments.length > 0 && (
                        <div className="mt-6">
                          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Attached Files</p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {itemAttachments.map((attachment, index) => (
                              <a 
                                key={`${attachment.url}-${index}`} 
                                href={attachment.url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="group flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3 transition-colors hover:border-primary/40 hover:bg-primary/5"
                              >
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground shadow-sm transition-colors group-hover:text-primary">
                                  <FileText className="h-4 w-4" />
                                </div>
                                <span className="min-w-0 truncate text-xs font-semibold text-foreground group-hover:text-primary">
                                  {attachment.url.split('/').pop() || attachment.url}
                                </span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Admin Review Form */}
                    <div className="p-6">
                      <h4 className="mb-4 flex items-center gap-2 font-heading text-sm font-bold uppercase tracking-widest text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4" /> Administrative Evaluation
                      </h4>
                      <form action={reviewAssignmentAction} className="flex h-[calc(100%-2rem)] flex-col">
                        <input type="hidden" name="assignmentId" value={String(assignment.id)} />
                        
                        <div className="grid gap-5">
                          <label className="block">
                            <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Evaluation Status</span>
                            <PremiumPicker name="status" defaultValue={assignment.status} options={assignmentStatusOptions} />
                          </label>
                          
                          <label className="block flex-1">
                            <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Constructive Feedback</span>
                            <textarea 
                              name="feedback" 
                              rows={6} 
                              defaultValue={assignment.adminFeedback || ""} 
                              placeholder="Provide actionable feedback to the learner..." 
                              className="w-full resize-none rounded-md border border-input bg-background/50 px-4 py-3 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20" 
                            />
                          </label>
                        </div>
                        
                        <div className="mt-6 flex flex-col justify-between gap-4 border-t border-border pt-6 sm:flex-row sm:items-center">
                          <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-muted/10 px-4 py-2 transition-colors hover:bg-muted/30">
                            <input name="sendApprovalEmail" type="checkbox" className="h-4 w-4 rounded border-input text-primary focus:ring-primary" />
                            <span className="text-sm font-bold text-foreground">Dispatch Notification Email</span>
                          </label>
                          <button className="btn-primary w-full justify-center shadow-sm sm:w-auto" type="submit">
                            Save Evaluation
                          </button>
                        </div>
                      </form>
                    </div>
                    
                  </div>
                </article>
              )
            }) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/10 py-16 text-center text-sm font-semibold text-muted-foreground">
                <FileCheck2 className="mb-4 h-8 w-8 text-muted-foreground/50" />
                No assignments currently require evaluation.
              </div>
            )}
          </div>
        </div>
      </section>
      
    </main>
  )
}
