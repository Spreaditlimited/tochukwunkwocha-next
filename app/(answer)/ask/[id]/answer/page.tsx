import { notFound } from "next/navigation"
import { AskForm } from "@/components/ask/AskForm"
import { AnonymousScreen } from "@/components/ask/AnonymousScreen"
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
    <AnonymousScreen contentTitle eyebrow="Tochukwu asks" title={question.body} description="Share your perspective anonymously. Your answer is reviewed before it can be shared publicly.">
      {question.acceptingAnswers ? <AskForm questionId={question.id} compact /> : <div role="status" className="rounded-lg border border-border bg-muted/20 p-4">
        <p className="text-sm font-bold text-foreground">Responses are closed</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">This question is no longer accepting answers. Thank you for your interest.</p>
      </div>}
    </AnonymousScreen>
  )
}
