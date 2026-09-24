"use client"

export default function AskError({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-3xl px-5 py-20"><h1 className="font-heading text-3xl font-black">Please try again shortly</h1><p className="my-5 text-muted-foreground">We could not load this question. Your unpublished submissions remain private.</p><button type="button" onClick={reset} className="btn-primary">Try again</button></main>
}
