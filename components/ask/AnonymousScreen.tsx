import type { ReactNode } from "react"

export function AnonymousScreen({ title, description, eyebrow, children, contentTitle = false }: {
  title: string
  description: string
  eyebrow: string
  children: ReactNode
  contentTitle?: boolean
}) {
  return <main className="min-h-dvh bg-background px-4 py-6 text-foreground sm:px-6 sm:py-12">
    <div className="mx-auto w-full max-w-xl space-y-5">
      <section className="admin-card min-w-0 sm:p-6" aria-labelledby="anonymous-screen-title">
        <header className="border-b border-border pb-5">
          <p className="label">{eyebrow}</p>
          <h1 id="anonymous-screen-title" className={`mt-2 whitespace-pre-wrap break-words text-xl leading-8 sm:text-2xl ${contentTitle ? "font-sans font-normal" : "font-heading font-black tracking-tight"}`}>{title}</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
        </header>
        <div className="pt-6">{children}</div>
      </section>
      <p className="px-1 text-center text-xs leading-5 text-muted-foreground">No name, email, or account required.</p>
    </div>
  </main>
}
