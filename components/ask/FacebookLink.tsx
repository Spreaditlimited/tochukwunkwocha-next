import { ArrowUpRight } from "lucide-react"

export function FacebookLink({ url, prompt = false }: { url: string | null; prompt?: boolean }) {
  if (!url) return <p className="text-sm text-muted-foreground">{prompt ? "A Facebook conversation link will appear here when available." : "Awaiting Tochukwu’s answer on Facebook."}</p>
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-primary underline underline-offset-4">
      {prompt ? "Join the conversation on Facebook" : "Read my answer on Facebook"}
      <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}
