import Link from "next/link"
import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ASK_STATUSES, ASK_QUESTION_STATUSES, isQuestionPublished, questionStatusLabel, askPage, askId } from "@/lib/ask-validation"
import { QuestionEditor, AnswerModeration, UnpublishQuestionButton, DeleteQuestionButton } from "@/components/ask/AskAdminForms"
import { FacebookLink } from "@/components/ask/FacebookLink"
import { AnswerShareLink } from "@/components/ask/AnswerShareLink"

export const dynamic = "force-dynamic"
const PAGE_SIZE = 20
type Search = { tab?: string; status?: string; page?: string; edit?: string; question?: string }

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
  const pendingQuestions = counts.filter((row) => row.kind === "visitor" && row.status === "pending").reduce((sum, row) => sum + row._count, 0)
  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      <header><p className="eyebrow">Community</p><h1 className="mt-2 font-heading text-3xl font-black">Anonymous Q&A</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Review anonymous questions, ask your audience, and approve their responses. Add the link to your Facebook post to connect each question to its conversation.</p><Link href="/ask" target="_blank" className="mt-3 inline-block text-sm font-bold text-primary">View public page ↗</Link></header>
      <nav aria-label="Q&A sections" className="flex flex-wrap gap-3">
        {[{ key: "inbox", label: `Visitor questions (${pendingQuestions} pending)` }, { key: "prompts", label: "Your audience questions" }, { key: "answers", label: `Anonymous answers (${pendingAnswers} pending)` }].map((item) => <Link key={item.key} href={`/internal/questions?tab=${item.key}`} aria-current={tab === item.key ? "page" : undefined} className={`rounded-xl border px-4 py-3 text-sm font-bold ${tab === item.key ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{item.label}</Link>)}
      </nav>
      {tab === "prompts" && !editing ? <details className="rounded-2xl border border-border bg-card p-6"><summary className="cursor-pointer font-bold">+ Ask your audience a question</summary><div className="mt-6"><QuestionEditor /></div></details> : null}
      {editing ? (
        <section className="rounded-2xl border border-primary/30 bg-card p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="font-heading text-xl font-black">Manage question</h2>
            <Link href={`/internal/questions?tab=${editing.kind === "prompt" ? "prompts" : "inbox"}`} className="text-sm text-primary">Close editor</Link>
          </div>
          <div className="mb-6">{isQuestionPublished(editing.status) ? <UnpublishQuestionButton id={editing.id} version={editing.updatedAt.toISOString()} /> : <DeleteQuestionButton id={editing.id} version={editing.updatedAt.toISOString()} />}</div>
          {editing.kind === "prompt" ? <div className="mb-6"><AnswerShareLink key={`share-${editing.id}`} id={editing.id} status={editing.status} acceptingAnswers={editing.acceptingAnswers} /></div> : null}
          <QuestionEditor key={editing.id} question={{ id: editing.id, kind: editing.kind, body: editing.body, status: editing.status, facebookUrl: editing.facebookUrl, acceptingAnswers: editing.acceptingAnswers, version: editing.updatedAt.toISOString() }} />
        </section>
      ) : null}
      <form method="get" data-toast-managed="true" className="flex flex-wrap items-end gap-3"><input type="hidden" name="tab" value={tab} />{questionId ? <input type="hidden" name="question" value={questionId} /> : null}<label className="text-sm font-bold">Filter visibility<select name="status" defaultValue={status || ""} className="field mt-2"><option value="">All statuses</option>{statuses.map((value) => <option key={value} value={value}>{tab === "answers" ? value : questionStatusLabel(value)}</option>)}</select></label><button type="submit" className="btn-primary">Filter</button>{questionId ? <Link href="/internal/questions?tab=answers" className="text-sm text-primary">Show answers to all questions</Link> : null}</form>
      <div className="space-y-5">
        {!(tab === "answers" ? answers : questions).length ? <p className="rounded-xl border border-dashed border-border p-8 text-muted-foreground">No contributions in this view yet.</p> : null}
        {questions.slice(0, PAGE_SIZE).map((question) => (
          <article key={question.id} className="rounded-2xl border border-border bg-card p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{questionStatusLabel(question.status)} · {question.createdAt.toLocaleDateString("en-GB", { timeZone: "UTC" })}</p>
            <p className="mt-3 whitespace-pre-wrap break-words text-lg font-semibold">{question.body}</p>
            <div className="mt-4"><FacebookLink url={question.facebookUrl} prompt={question.kind === "prompt"} /></div>
            <div className="mt-5 flex flex-wrap items-center gap-5 text-sm font-bold text-primary">
              <Link href={`${pageLink(page)}&edit=${question.id}`}>Manage question</Link>
              {question.kind === "prompt" ? <Link href={`/internal/questions?tab=answers&question=${question.id}`}>Review answers ({question._count.answers})</Link> : null}
              {question.status === "published" ? <Link href={`/ask/${question.id}`} target="_blank">View published question ↗</Link> : null}
              {isQuestionPublished(question.status) ? <UnpublishQuestionButton id={question.id} version={question.updatedAt.toISOString()} /> : <DeleteQuestionButton id={question.id} version={question.updatedAt.toISOString()} />}
            </div>
            {question.kind === "prompt" ? <AnswerShareLink id={question.id} status={question.status} acceptingAnswers={question.acceptingAnswers} /> : null}
          </article>
        ))}
        {answers.slice(0, PAGE_SIZE).map((answer) => <article key={answer.id} className="rounded-2xl border border-border bg-card p-6"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Anonymous answer · {answer.status}</p><p className="mt-3 text-sm text-muted-foreground">To: {answer.question.body}</p><p className="mt-1 text-xs text-muted-foreground">Question visibility: {answer.question.status}</p><p className="mt-4 whitespace-pre-wrap break-words leading-7">{answer.body}</p><AnswerModeration key={answer.id} id={answer.id} status={answer.status} version={answer.updatedAt.toISOString()} /></article>)}
      </div>
      <nav aria-label="Moderation pages" className="flex justify-between gap-4 text-sm font-bold">{page > 1 ? <Link href={pageLink(page - 1)}>← Previous</Link> : <span />}{(tab === "answers" ? answers : questions).length > PAGE_SIZE ? <Link href={pageLink(page + 1)}>Next →</Link> : null}</nav>
    </div>
  )
}
