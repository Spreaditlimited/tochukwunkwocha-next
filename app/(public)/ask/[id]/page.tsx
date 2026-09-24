import Link from "next/link"
import { notFound } from "next/navigation"
import { AskForm } from "@/components/ask/AskForm"
import { FacebookLink } from "@/components/ask/FacebookLink"
import { ASK_PAGE_SIZE, getPublicQuestion } from "@/lib/ask"
import { askId, askPage } from "@/lib/ask-validation"
import { buildMetadata } from "@/lib/site-seo"

export const dynamic = "force-dynamic"
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string }> }

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  return buildMetadata({ title: "Community question | Ask Tochukwu", description: "Share an anonymous perspective and follow the conversation on Facebook.", path: `/ask/${id}`, noIndex: true })
}

export default async function QuestionPage({ params, searchParams }: Props) {
  const { id } = await params
  try { askId(id) } catch { notFound() }
  const page = askPage((await searchParams).page)
  const question = await getPublicQuestion(id, page)
  if (!question) notFound()
  const prompt = question.kind === "prompt"
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 sm:px-6 lg:py-20">
      <Link href="/ask" className="text-sm font-semibold text-primary">← All questions</Link>
      <article className="mt-8 rounded-2xl border border-border bg-card p-6 sm:p-8">
        <p className="eyebrow">{prompt ? "Tochukwu asks you" : "Asked anonymously"}</p>
        <h1 className="mt-4 whitespace-pre-wrap break-words font-heading text-2xl font-black leading-snug sm:text-3xl">{question.body}</h1>
        <div className="mt-6"><FacebookLink url={question.facebookUrl} prompt={prompt} /></div>
        <p className="mt-3 text-xs text-muted-foreground">Answers from Tochukwu and further conversation are on Facebook. You may need to sign in there.</p>
      </article>
      {prompt ? <>
        <section className="mt-10" aria-labelledby="answer-heading">
          <h2 id="answer-heading" className="mb-5 font-heading text-2xl font-black">Share your perspective</h2>
          {question.acceptingAnswers ? <AskForm questionId={question.id} /> : <p className="text-muted-foreground">Anonymous submissions for this question are now closed. You can still follow the conversation on Facebook.</p>}
        </section>
        <section className="mt-12" aria-labelledby="responses-heading">
          <h2 id="responses-heading" className="font-heading text-2xl font-black">Anonymous answers ({question._count.answers})</h2>
          <p className="mt-2 text-sm text-muted-foreground">Responses appear after review. Continue the conversation on Facebook.</p>
          <div className="mt-6 space-y-4">
            {!question.answers.length ? <p className="rounded-xl border border-dashed border-border p-6 text-muted-foreground">{page > 1 ? "No more answers on this page." : "No approved answers yet."}</p> : null}
            {question.answers.slice(0, ASK_PAGE_SIZE).map((answer) => <article key={answer.id} className="rounded-xl border border-border bg-card p-6"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Anonymous perspective</p><p className="mt-3 whitespace-pre-wrap break-words leading-7">{answer.body}</p></article>)}
          </div>
          <nav aria-label="Answer pages" className="mt-6 flex justify-between gap-4 text-sm font-bold">
            {page > 1 ? <Link href={`/ask/${id}?page=${page - 1}`}>← Newer answers</Link> : <span />}
            {question.answers.length > ASK_PAGE_SIZE ? <Link href={`/ask/${id}?page=${page + 1}`}>Older answers →</Link> : null}
          </nav>
        </section>
      </> : null}
    </main>
  )
}
