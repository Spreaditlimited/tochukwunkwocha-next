"use client"

import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { deleteQuestionAction, moderateAnswerAction, publishQuestionAction, saveQuestionAction, setQuestionVisibilityAction, unpublishQuestionAction, type AskAdminState } from "@/app/(internal)/internal/(admin)/questions/actions"
import { ASK_MAX_LENGTH, ASK_STATUSES } from "@/lib/ask-validation"
import { SubmitButton } from "@/components/SubmitButton"
import { showInternalToast } from "@/components/internal/InternalActionToaster"
import { DashboardModal } from "@/components/dashboard/DashboardModal"
import { PremiumPicker } from "@/components/PremiumPicker"

function Feedback({ state }: { state: AskAdminState }) {
  return <>{state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}{state.message ? <p role="status" className="text-sm text-primary">{state.message}</p> : null}</>
}

type PublicationConfirmation = { title: string; description: string; label: string }

function PublicationForm({ action, className, confirmationFor, children }: {
  action: (form: FormData) => void
  className: string
  confirmationFor: (form: FormData) => PublicationConfirmation | null
  children: ReactNode
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const confirmed = useRef(false)
  const [confirmation, setConfirmation] = useState<PublicationConfirmation | null>(null)
  function confirmPublication() {
    setConfirmation(null)
    confirmed.current = true
    try {
      // Re-run native validation and the normal React form action exactly once.
      formRef.current?.requestSubmit()
    } finally {
      confirmed.current = false
    }
  }
  return <>
    <form ref={formRef} action={action} data-toast-managed="true" className={className} onSubmit={(event) => {
      if (confirmed.current) return
      const next = confirmationFor(new FormData(event.currentTarget))
      if (next) {
        event.preventDefault()
        setConfirmation(next)
      }
    }}>{children}</form>
    {confirmation ? <DashboardModal
      title={confirmation.title}
      eyebrow="Publication"
      description={confirmation.description}
      onClose={() => setConfirmation(null)}
      closeLabel="Close publication confirmation"
      footer={<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" data-modal-autofocus onClick={() => setConfirmation(null)} className="btn-secondary justify-center">Cancel</button>
        <button type="button" onClick={confirmPublication} className="btn-primary justify-center">{confirmation.label}</button>
      </div>}
    >
      <p className="text-sm font-normal text-muted-foreground">You can change visibility again from the dashboard.</p>
    </DashboardModal> : null}
  </>
}

export function QuestionEditor({ question }: { question?: {
  id: string; kind: string; body: string; status: string; facebookUrl: string | null; acceptingAnswers: boolean; version: string
} }) {
  const [state, action] = useActionState(saveQuestionAction, {})
  const [body, setBody] = useState(question?.body || "")
  const [facebookUrl, setFacebookUrl] = useState(question?.facebookUrl || "")
  const [acceptingAnswers, setAcceptingAnswers] = useState(question?.acceptingAnswers ?? true)
  const savedAcceptingAnswers = question?.acceptingAnswers
  useEffect(() => {
    if (savedAcceptingAnswers !== undefined) setAcceptingAnswers(savedAcceptingAnswers)
  }, [savedAcceptingAnswers])
  const router = useRouter()
  const lastCreated = useRef("")
  useEffect(() => {
    if (state.createdId && state.createdId !== lastCreated.current) {
      lastCreated.current = state.createdId
      router.push(`/internal/questions?tab=prompts&edit=${state.createdId}`)
    }
  }, [state.createdId, router])
  const prompt = !question || question.kind === "prompt"
  return (
    <PublicationForm action={action} className="space-y-4" confirmationFor={() => question ? null : {
      title: "Publish question?",
      description: "Your answer link will be ready to copy and accept anonymous answers. Public visibility will start off, and no Facebook link is required.",
      label: "Yes, publish question"
    }}>
      <input type="hidden" name="status" value={question?.status || "unlisted"} />
      {question ? <><input type="hidden" name="id" value={question.id} /><input type="hidden" name="version" value={question.version} /></> : null}
      <label className="block text-sm font-bold">{prompt ? "Your question for the audience" : "Original anonymous question"}
        <textarea name="body" required minLength={5} maxLength={ASK_MAX_LENGTH} readOnly={!prompt} value={body} onChange={(event) => setBody(event.target.value)} className="field mt-2 min-h-32" />
      </label>
      <label className="block text-sm font-bold">Facebook post link (optional)
        <input type="url" name="facebookUrl" maxLength={1000} value={facebookUrl} onChange={(event) => setFacebookUrl(event.target.value)} placeholder="https://www.facebook.com/…" className="field mt-2" />
      </label>
      <p className="text-xs leading-5 text-muted-foreground">You can publish without a Facebook link and add it later. Adding a link does not change visibility. Make the Facebook post public so visitors can follow it.</p>
      {!question ? <p className="text-xs leading-5 text-muted-foreground">New questions are published automatically with public visibility off. After creating, use the Public visibility toggle to show the question on /ask. The answer link works while visibility is off.</p> : null}
      {prompt && question ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="acceptingAnswers" checked={acceptingAnswers} onChange={(event) => setAcceptingAnswers(event.target.checked)} /> Accept anonymous answers (independent of public visibility)</label> : null}
      <SubmitButton className="btn-primary" pendingText="Saving…" disabled={Boolean(state.createdId)}>{question ? "Save question" : "Publish question"}</SubmitButton>
      <Feedback state={state} />
    </PublicationForm>
  )
}

export function QuestionVisibilityToggle({ id, version, visible }: { id: string; version: string; visible: boolean }) {
  const [state, action, pending] = useActionState(setQuestionVisibilityAction, {})
  return <PublicationForm action={action} className="space-y-2" confirmationFor={() => visible ? null : {
    title: "Make question public?",
    description: "This question and its approved answers will appear on /ask. A Facebook link is optional.",
    label: "Yes, make visible"
  }}>
    <input type="hidden" name="id" value={id} />
    <input type="hidden" name="version" value={version} />
    <input type="hidden" name="visible" value={String(!visible)} />
    <button type="submit" role="switch" aria-checked={visible} aria-label="Public visibility" disabled={pending} className="brand-focus inline-flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-bold text-foreground disabled:opacity-50">
      <span aria-hidden="true" className={`flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${visible ? "bg-primary" : "bg-muted border border-border"}`}><span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${visible ? "translate-x-5" : "translate-x-0"}`} /></span>
      Public visibility: {pending ? "Saving…" : visible ? "On" : "Off"}
    </button>
    <Feedback state={state} />
  </PublicationForm>
}

export function AnswerModeration({ id, status, version }: { id: string; status: string; version: string }) {
  const [state, action] = useActionState(moderateAnswerAction, {})
  const [visibility, setVisibility] = useState(status)
  return <PublicationForm action={action} className="mt-4 space-y-3" confirmationFor={(form) => {
    return form.get("status") === "published" && status !== "published" ? {
      title: "Publish anonymous answer?",
      description: "This answer will be visible when its question is public. If the question is published but hidden, the answer will remain hidden too.",
      label: "Yes, publish answer"
    } : null
  }}>
    <input type="hidden" name="id" value={id} /><input type="hidden" name="version" value={version} />
    <label className="block text-sm font-bold">Answer visibility<PremiumPicker name="status" value={visibility} onChange={(event) => setVisibility(event.target.value)} className="mt-2" options={ASK_STATUSES.map((value) => ({ value, label: value === "published" ? "Published — public" : `${value} — private` }))} /></label>
    <SubmitButton className="btn-primary" pendingText="Saving…">Save answer visibility</SubmitButton>
    <Feedback state={state} />
  </PublicationForm>
}

export function UnpublishQuestionButton({ id, version }: { id: string; version: string }) {
  const [state, action] = useActionState(async (previous: AskAdminState, form: FormData) => {
    const result = await unpublishQuestionAction(previous, form)
    if (result.message) showInternalToast({ type: "success", title: "Question unpublished", message: result.message })
    return result
  }, {})
  return <form action={action} data-toast-managed="true" className="space-y-2">
    <input type="hidden" name="id" value={id} />
    <input type="hidden" name="version" value={version} />
    <SubmitButton className="btn-secondary" pendingText="Unpublishing…">Unpublish question</SubmitButton>
    {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
  </form>
}

export function PublishQuestionButton({ id, version }: { id: string; version: string }) {
  const [state, action] = useActionState(publishQuestionAction, {})
  return <PublicationForm action={action} className="space-y-2" confirmationFor={() => ({
    title: "Publish question?",
    description: "Public visibility will stay off. For an audience question, its answer link will become active and accept anonymous answers. No Facebook link is required.",
    label: "Yes, publish question"
  })}>
    <input type="hidden" name="id" value={id} />
    <input type="hidden" name="version" value={version} />
    <SubmitButton className="btn-primary" pendingText="Publishing…">Publish question</SubmitButton>
    <Feedback state={state} />
  </PublicationForm>
}

export function DeleteQuestionButton({ id, version }: { id: string; version: string }) {
  const router = useRouter()
  const search = useSearchParams()
  const [modalOpen, setModalOpen] = useState(false)
  const formId = useId()
  const [state, action, pending] = useActionState(async (previous: AskAdminState, form: FormData) => {
    const result = await deleteQuestionAction(previous, form)
    if (result.message) {
      setModalOpen(false)
      showInternalToast({ type: "success", title: "Question deleted", message: result.message })
      if (search.get("edit") === id) {
        const params = new URLSearchParams(search.toString())
        params.delete("edit")
        router.replace(`/internal/questions?${params}`)
      }
    }
    return result
  }, {})
  return <>
    <button type="button" className="btn-secondary text-destructive" onClick={() => setModalOpen(true)} disabled={pending}>Delete question</button>
    {modalOpen ? <DashboardModal
      title="Delete question?"
      eyebrow="Permanent action"
      description="This will permanently delete the question and all its anonymous answers. This cannot be undone."
      onClose={() => setModalOpen(false)}
      closeDisabled={pending}
      closeLabel="Close delete-question confirmation"
      footer={<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" data-modal-autofocus onClick={() => setModalOpen(false)} disabled={pending} className="btn-secondary justify-center disabled:opacity-50">Cancel</button>
        <button type="submit" form={formId} disabled={pending} className="btn-primary justify-center bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50">{pending ? "Deleting…" : "Yes, delete question"}</button>
      </div>}
    >
      <form id={formId} action={action} data-toast-managed="true" className="space-y-4">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="version" value={version} />
        <p className="text-sm font-normal text-muted-foreground">Any shared website links to this question will stop working. Your linked Facebook post will not be deleted.</p>
        {state.error ? <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm font-semibold text-destructive">{state.error}</p> : null}
      </form>
    </DashboardModal> : null}
  </>
}
