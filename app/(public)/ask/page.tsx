import Link from "next/link"
import { ArrowRight, MessageCircle, ShieldCheck } from "lucide-react"
import { AskForm } from "@/components/ask/AskForm"
import { FacebookLink } from "@/components/ask/FacebookLink"
import { ASK_PAGE_SIZE, listPublicQuestions } from "@/lib/ask"
import { askPage } from "@/lib/ask-validation"
import { buildMetadata } from "@/lib/site-seo"

export const dynamic = "force-dynamic"
export const metadata = buildMetadata({ title: "Ask Tochukwu", description: "Ask Tochukwu anonymously, share your perspective, and follow the answers and conversations on Facebook.", path: "/ask" })

export default async function AskPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = askPage((await searchParams).page)
  let rows: Awaited<ReturnType<typeof listPublicQuestions>> = []
  let unavailable = false
  try { rows = await listPublicQuestions(page) } catch { unavailable = true }
  return (
    <main>
      <section className="relative overflow-hidden bg-brand-ink pt-16 text-white lg:pt-24">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-sky/15 blur-[150px]" />
        <div className="site-container relative z-10 pb-16 lg:pb-24">
          <p className="mb-5 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-sky-300"><MessageCircle className="h-4 w-4" /> A space to ask & share</p>
          <h1 className="font-heading text-4xl font-black tracking-tight sm:text-6xl">Ask me. Or lend your voice.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">Ask me a question anonymously, or answer one I’ve put to you. I share my answers and continue the conversations on my Facebook profile.</p>
          <a href="#ask-question" className="btn-inverse mt-8 gap-2 px-5 py-3 font-bold">Ask Tochukwu <ArrowRight className="h-4 w-4" /></a>
        </div>
      </section>
      <div className="site-container grid items-start gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:py-16">
        <section aria-labelledby="questions-heading" className="min-w-0 space-y-6">
          <div>
            <p className="eyebrow">From this community</p>
            <h2 id="questions-heading" className="mt-2 font-heading text-2xl font-black">Questions & shared perspectives</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Browse approved contributions below. Follow each Facebook link for answers and conversation. Facebook may ask you to sign in.</p>
          </div>
          {unavailable ? <p role="status" className="rounded-2xl border border-border bg-card p-6 text-muted-foreground">Questions are temporarily unavailable. Please check back shortly.</p> : !rows.length ? <p className="rounded-2xl border border-dashed border-border p-8 text-muted-foreground">{page > 1 ? "No more questions on this page." : "The conversation starts with a question. Approved questions and audience prompts will appear here."}</p> : null}
          {rows.slice(0, ASK_PAGE_SIZE).map((question) => (
            <article key={question.id} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">{question.kind === "prompt" ? "Tochukwu asks you" : "Someone asked anonymously"}</p>
              <h3 className="mt-3 whitespace-pre-wrap break-words font-heading text-xl font-bold leading-8"><Link href={`/ask/${question.id}`} className="hover:text-primary">{question.body}</Link></h3>
              <div className="mt-5"><FacebookLink url={question.facebookUrl} prompt={question.kind === "prompt"} /></div>
              {question.kind === "prompt" ? <Link href={`/ask/${question.id}`} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold">{question._count.answers} approved {question._count.answers === 1 ? "answer" : "answers"} · {question.acceptingAnswers ? "Add yours anonymously" : "Read responses"}<ArrowRight className="h-4 w-4" /></Link> : null}
            </article>
          ))}
          <nav aria-label="Question pages" className="flex justify-between gap-4 text-sm font-bold">
            {page > 1 ? <Link href={`/ask?page=${page - 1}`}>← Newer questions</Link> : <span />}
            {rows.length > ASK_PAGE_SIZE ? <Link href={`/ask?page=${page + 1}`}>Older questions →</Link> : null}
          </nav>
        </section>
        <section id="ask-question" aria-labelledby="ask-heading" className="scroll-mt-24 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h2 id="ask-heading" className="mb-3 mt-3 font-heading text-2xl font-black">Ask Tochukwu</h2>
          <p className="mb-6 text-sm leading-6 text-muted-foreground">Your question comes to me privately. I choose which questions to share and answer on Facebook.</p>
          {unavailable ? <p className="text-sm text-muted-foreground">Submissions will reopen when this page is available.</p> : <AskForm />}
        </section>
      </div>
    </main>
  )
}
