"use client"

export default function AnswerError({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-xl px-5 py-12"><h1 className="font-heading text-2xl font-bold">Please try again</h1><p className="my-4 text-sm text-muted-foreground">We could not load this question right now.</p><button type="button" onClick={reset} className="btn-primary">Try again</button></main>
}
