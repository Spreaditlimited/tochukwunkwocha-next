import { notFound } from "next/navigation"
import { AskForm } from "@/components/ask/AskForm"
import { getAnswerPrompt } from "@/lib/ask"
import { askId, askAnswerPath } from "@/lib/ask-validation"
import { buildMetadata } from "@/lib/site-seo"

export const dynamic = "force-dynamic"
type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  try { askId(id) } catch { notFound() }
  return buildMetadata({ title: "Leave an anonymous answer", description: "Share your answer with Tochukwu. No name or account required.", path: askAnswerPath(id), noIndex: true })
}

// Outside the public layout: no header, footer, popups, or discussion feed.
export default async function AnswerPage({ params }: Props) {
  const { id } = await params
  try { askId(id) } catch { notFound() }
  const question = await getAnswerPrompt(id)
  if (!question) notFound()
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-8 sm:px-6 sm:py-12">
      <p className="text-xs font-bold uppercase tracking-wider text-primary">Tochukwu asks</p>
      <h1 className="mb-6 mt-3 whitespace-pre-wrap break-words font-heading text-xl font-bold leading-8 sm:text-2xl">{question.body}</h1>
      {question.acceptingAnswers ? <AskForm questionId={question.id} compact /> : <p role="status" className="rounded-xl border border-border p-5 text-sm leading-6 text-muted-foreground">This question is no longer accepting answers. Thank you for your interest.</p>}
    </main>
  )
}
