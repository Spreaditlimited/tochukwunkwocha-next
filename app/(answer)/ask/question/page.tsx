import { AskForm } from "@/components/ask/AskForm"
import { AnonymousScreen } from "@/components/ask/AnonymousScreen"
import { buildMetadata } from "@/lib/site-seo"

export const metadata = buildMetadata({
  title: "Ask Tochukwu anonymously",
  description: "Send Tochukwu a private anonymous question. No name or account required.",
  path: "/ask/question",
  noIndex: true
})

// Outside the public layout, like the lightweight anonymous answer page.
export default function AnonymousQuestionPage() {
  return <AnonymousScreen
    eyebrow="Ask a question"
    title="Ask Tochukwu anonymously"
    description="Your question comes to Tochukwu privately. He decides whether to make it publicly visible."
  >
    <AskForm compact />
  </AnonymousScreen>
}
