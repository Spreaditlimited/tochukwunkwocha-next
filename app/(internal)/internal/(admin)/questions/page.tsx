import Link from "next/link"
import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ASK_STATUSES, ASK_QUESTION_STATUSES, isQuestionPublished, questionStatusLabel, askPage, askId } from "@/lib/ask-validation"
import { QuestionEditor, QuestionVisibilityToggle, AnswerModeration, PublishQuestionButton, UnpublishQuestionButton, DeleteQuestionButton } from "@/components/ask/AskAdminForms"
import { FacebookLink } from "@/components/ask/FacebookLink"
import { AnswerShareLink } from "@/components/ask/AnswerShareLink"
import { PremiumPicker } from "@/components/PremiumPicker"
import { QuestionShareLink } from "@/components/ask/QuestionShareLink"

export const dynamic = "force-dynamic"
const PAGE_SIZE = 20
type Search = { tab?: string; status?: string; page?: string; edit?: string; question?: string }

function StatusBadge({ status, answer = false }: { status: string; answer?: boolean }) {
  const tone = status === "published" ? "border-primary/20 bg-primary/10 text-primary" : status === "pending" ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "border-border bg-muted/30 text-muted-foreground"
  return <span className={`inline-flex rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${tone}`}>{answer ? (status === "published" ? "Approved" : status) : questionStatusLabel(status)}</span>
}

export default async function QuestionsAdminPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin("/internal/questions")
  const search = await searchParams
  const tab = search.tab === "prompts" || search.tab === "answers" ? search.tab : "inbox"
  const statuses = tab === "answers" ? ASK_STATUSES : ASK_QUESTION_STATUSES
  const status = statuses.some((value) => value === search.status) ? search.status : undefined
  const page = askPage(search.page)
  let editId: string | undefined
  let questionId: string | undefined
  try { if (search.edit) editId = askId(search.edit) } catch { /* invalid ids do not reach queries */ }
  try { if (search.question) questionId = askId(search.question) } catch { /* invalid filter */ }
  const counts = await prisma.askQuestion.groupBy({ by: ["kind", "status"], _count: true })
  const pendingAnswers = await prisma.askAnswer.count({ where: { status: "pending" } })
  const questions = tab !== "answers" ? await prisma.askQuestion.findMany({
    where: { kind: tab === "prompts" ? "prompt" : "visitor", ...(status ? { status } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: PAGE_SIZE + 1, skip: (page - 1) * PAGE_SIZE,
    include: { _count: { select: { answers: true } } }
  }) : []
  const answers = tab === "answers" ? await prisma.askAnswer.findMany({
    where: { ...(status ? { status } : {}), ...(questionId ? { questionId } : {}) },
    include: { question: { select: { id: true, body: true, status: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: PAGE_SIZE + 1, skip: (page - 1) * PAGE_SIZE
  }) : []
  const editing = editId ? await prisma.askQuestion.findUnique({ where: { id: editId } }) : null
  const pageLink = (next: number) => `/internal/questions?${new URLSearchParams({ tab, page: String(next), ...(status ? { status } : {}), ...(questionId ? { question: questionId } : {}) })}`
  const pendingQuestions = counts.filter((row) => row.kind === "visitor" && (row.status === "pending" || row.status === "unlisted")).reduce((sum, row) => sum + row._count, 0)
  return (
    <main className="min-w-0 space-y-8 pb-12">
      <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Community</p><h1 className="mt-1 font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">Anonymous Q&A</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Manage visitor questions and audience responses. Share links privately, choose what appears publicly, and continue conversations on Facebook.</p></div>
        <Link href="/ask" target="_blank" rel="noopener noreferrer" className="btn-secondary shrink-0 self-start sm:self-auto">View public page ↗</Link>
      </header>
      <nav aria-label="Q&A sections" className="flex flex-wrap gap-2 rounded-lg border border-border bg-muted/20 p-2">
        {[{ key: "inbox", label: "Visitor questions", count: pendingQuestions }, { key: "prompts", label: "Your audience questions", count: null }, { key: "answers", label: "Anonymous answers", count: pendingAnswers }].map((item) => <Link key={item.key} href={`/internal/questions?tab=${item.key}`} aria-current={tab === item.key ? "page" : undefined} className={`brand-focus inline-flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${tab === item.key ? "border-border bg-card text-primary shadow-sm" : "border-transparent text-muted-foreground hover:bg-card hover:text-foreground"}`}>{item.label}{item.count !== null ? <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs tabular-nums text-primary" aria-label={`${item.count} awaiting review`}>{item.count}</span> : null}</Link>)}
      </nav>
      {tab === "inbox" ? <QuestionShareLink /> : null}
      {tab === "prompts" && !editing ? <details className="admin-card"><summary className="brand-focus cursor-pointer rounded-md font-heading font-bold">+ Ask your audience a question</summary><div className="mt-5 max-w-3xl border-t border-border pt-5"><QuestionEditor /></div></details> : null}
      {editing ? (
        <section className="admin-card">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
            <h2 className="font-heading text-xl font-black">Manage question</h2>
            <Link href={`/internal/questions?tab=${editing.kind === "prompt" ? "prompts" : "inbox"}`} className="btn-secondary">Close editor</Link>
          </div>
          <div className="mb-6">{isQuestionPublished(editing.status) ? <QuestionVisibilityToggle id={editing.id} version={editing.updatedAt.toISOString()} visible={editing.status === "published"} /> : <PublishQuestionButton id={editing.id} version={editing.updatedAt.toISOString()} />}</div>
          <div className="mb-6">{isQuestionPublished(editing.status) ? <UnpublishQuestionButton id={editing.id} version={editing.updatedAt.toISOString()} /> : <DeleteQuestionButton id={editing.id} version={editing.updatedAt.toISOString()} />}</div>
          {editing.kind === "prompt" ? <div className="mb-6"><AnswerShareLink key={`share-${editing.id}`} id={editing.id} status={editing.status} acceptingAnswers={editing.acceptingAnswers} /></div> : null}
          <div className="max-w-3xl"><QuestionEditor key={editing.id} question={{ id: editing.id, kind: editing.kind, body: editing.body, status: editing.status, facebookUrl: editing.facebookUrl, acceptingAnswers: editing.acceptingAnswers, version: editing.updatedAt.toISOString() }} /></div>
        </section>
      ) : null}
      <form method="get" data-toast-managed="true" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="tab" value={tab} />
        {questionId ? <input type="hidden" name="question" value={questionId} /> : null}
        <label className="min-w-0 max-w-full text-sm font-bold">Filter visibility
          <PremiumPicker key={`${tab}-${status || "all"}`} name="status" defaultValue={status || ""} className="mt-2" options={[{ value: "", label: "All statuses" }, ...statuses.map((value) => ({ value, label: tab === "answers" ? value : questionStatusLabel(value) }))]} />
        </label>
        <button type="submit" className="btn-primary h-12 shrink-0 px-8">Filter</button>
        {questionId ? <Link href="/internal/questions?tab=answers" className="inline-flex min-h-12 items-center text-sm text-primary">Show answers to all questions</Link> : null}
      </form>
      <div className="space-y-5">
        {!(tab === "answers" ? answers : questions).length ? <div className="admin-card py-12 text-center"><h2 className="font-heading text-lg font-bold">No contributions in this view yet</h2><p className="mt-2 text-sm text-muted-foreground">Try another visibility filter, or share a question link to invite contributions.</p></div> : null}
        {questions.slice(0, PAGE_SIZE).map((question) => (
          <article key={question.id} className="admin-card min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3"><StatusBadge status={question.status} /><span className="text-xs text-muted-foreground">{question.createdAt.toLocaleDateString("en-GB", { timeZone: "UTC" })}</span></div>
            <p className="mt-4 whitespace-pre-wrap break-words font-sans text-base font-normal leading-7 text-foreground">{question.body}</p>
            <div className="mt-4"><FacebookLink url={question.facebookUrl} prompt={question.kind === "prompt"} /></div>
            <div className="mt-5 flex flex-wrap items-start gap-3 border-t border-border pt-4 text-sm font-normal text-primary [&>a]:min-h-11">
              {isQuestionPublished(question.status) ? <QuestionVisibilityToggle id={question.id} version={question.updatedAt.toISOString()} visible={question.status === "published"} /> : <PublishQuestionButton id={question.id} version={question.updatedAt.toISOString()} />}
              <Link className="btn-secondary" href={`${pageLink(page)}&edit=${question.id}`}>Manage question</Link>
              {question.kind === "prompt" ? <Link className="btn-secondary" href={`/internal/questions?tab=answers&question=${question.id}`}>Review answers ({question._count.answers})</Link> : null}
              {question.status === "published" ? <Link className="btn-secondary" href={`/ask/${question.id}`} target="_blank" rel="noopener noreferrer">View published question ↗</Link> : null}
              {isQuestionPublished(question.status) ? <UnpublishQuestionButton id={question.id} version={question.updatedAt.toISOString()} /> : <DeleteQuestionButton id={question.id} version={question.updatedAt.toISOString()} />}
            </div>
            {question.kind === "prompt" ? <AnswerShareLink id={question.id} status={question.status} acceptingAnswers={question.acceptingAnswers} /> : null}
          </article>
        ))}
        {answers.slice(0, PAGE_SIZE).map((answer) => <article key={answer.id} className="admin-card min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="label">Anonymous answer</p><StatusBadge status={answer.status} answer /></div>
          <div className="mt-4 rounded-md border border-border bg-muted/20 p-4"><p className="label">In response to</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{answer.question.body}</p><p className="mt-2 text-xs text-muted-foreground">{questionStatusLabel(answer.question.status)}</p></div>
          <p className="my-5 whitespace-pre-wrap break-words font-sans text-sm font-normal leading-7 text-foreground">{answer.body}</p>
          <div className="border-t border-border pt-4"><AnswerModeration key={answer.id} id={answer.id} status={answer.status} version={answer.updatedAt.toISOString()} /></div>
        </article>)}
      </div>
      <nav aria-label="Moderation pages" className="flex justify-between gap-4 text-sm font-bold">{page > 1 ? <Link href={pageLink(page - 1)}>← Previous</Link> : <span />}{(tab === "answers" ? answers : questions).length > PAGE_SIZE ? <Link href={pageLink(page + 1)}>Next →</Link> : null}</nav>
    </main>
  )
}
