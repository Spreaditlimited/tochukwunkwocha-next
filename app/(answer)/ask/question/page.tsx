import { AskForm } from "@/components/ask/AskForm"
import { buildMetadata } from "@/lib/site-seo"

export const metadata = buildMetadata({
  title: "Ask Tochukwu anonymously",
  description: "Send Tochukwu a private anonymous question. No name or account required.",
  path: "/ask/question",
  noIndex: true
})

// Outside the public layout, like the lightweight anonymous answer page.
export default function AnonymousQuestionPage() {
  return <main className="mx-auto w-full max-w-xl px-5 py-8 sm:px-6 sm:py-12">
    <h1 className="mb-3 font-heading text-xl font-bold leading-8 sm:text-2xl">Ask Tochukwu anonymously</h1>
    <p className="mb-6 text-sm leading-6 text-muted-foreground">Your question comes to Tochukwu privately. He decides whether to make it publicly visible.</p>
    <AskForm compact />
  </main>
}
