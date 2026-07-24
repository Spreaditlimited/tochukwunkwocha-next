import Link from "next/link"
import { ArrowLeft, MessageSquare, Search, TerminalSquare } from "lucide-react"

import { PremiumPicker } from "@/components/PremiumPicker"
import { ResourceCard } from "@/components/resources/ResourceCard"
import { listPublishedResources, resourceAudiences, resourceCategories } from "@/lib/resources"
import { buildMetadata } from "@/lib/site-seo"

export const dynamic = "force-dynamic"

export const metadata = buildMetadata({
  title: "AI Prompt Playbooks",
  description: "Practical AI prompts with use cases and customization notes for work, school, business, projects, and public-sector productivity.",
  path: "/resources/prompts"
})

const sectionContainer = "site-container"

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function param(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key]
  return Array.isArray(value) ? value[0] || "" : value || ""
}

export default async function ResourcePromptsPage({ searchParams }: PageProps) {
  const params = await searchParams || {}
  const q = param(params, "q")
  const audience = param(params, "audience")
  const category = param(params, "category")
  const resources = await listPublishedResources({ type: "prompt", search: q, audience, category, limit: 240 })
  const audienceOptions = [
    { value: "", label: "All audiences" },
    ...resourceAudiences.map((item) => ({ value: item.key, label: item.label }))
  ]
  const categoryOptions = [
    { value: "", label: "All categories" },
    ...resourceCategories.map((item) => ({ value: item.key, label: item.label }))
  ]

  return (
    <main className="bg-background">
      
      {/* Editorial Hero Section */}
      <section className="relative overflow-hidden bg-brand-ink pb-20 pt-16 text-white lg:pb-28 lg:pt-24">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]"></div>
        <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-sky/15 blur-[150px]"></div>
        
        <div className={`${sectionContainer} relative z-10`}>
          <Link 
            href="/resources" 
            className="mx-auto mb-10 flex w-fit items-center text-sm font-bold text-slate-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Library
          </Link>

          <div className="mx-auto max-w-4xl text-center">
            <p className="eyebrow mb-6 inline-flex items-center gap-2 rounded-full border border-brand-sky/30 bg-brand-sky/10 px-4 py-1.5 text-brand-sky">
              <MessageSquare className="h-4 w-4" />
              Prompt Playbooks
            </p>
            <h1 className="font-heading text-5xl font-black leading-[1.1] tracking-tighter text-white sm:text-6xl lg:text-7xl">
              Prompts with context, not random <span className="bg-gradient-to-r from-brand-sky to-primary bg-clip-text text-transparent">prompt dumps</span>.
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-slate-300 sm:text-xl">
              Each prompt explains who it helps, when to use it, how to customize it, and what operational outcome to expect.
            </p>
          </div>
        </div>
      </section>

      {/* Main Resources Grid */}
      <section className="py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="mb-8">
            <p className="eyebrow">Searchable Database</p>
            <h2 className="mt-3 font-heading text-3xl font-black tracking-tight lg:text-4xl">
              Prompt Database
            </h2>
          </div>

          <form className="surface-raised mb-10 grid gap-4 bg-card p-5 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-end">
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Search prompts</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  name="q"
                  defaultValue={q}
                  placeholder="Search by work, audience, task, prompt, or outcome"
                  className="w-full rounded-xl border border-input bg-background py-3 pl-11 pr-4 text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Audience</span>
              <PremiumPicker name="audience" defaultValue={audience} options={audienceOptions} />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Category</span>
              <PremiumPicker name="category" defaultValue={category} options={categoryOptions} />
            </label>
            <button className="btn-primary h-12 justify-center" type="submit">
              <Search className="h-4 w-4" />
              Search
            </button>
          </form>

          <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-muted-foreground">
              Showing {resources.length.toLocaleString("en")} prompt{resources.length === 1 ? "" : "s"}
            </p>
            {(q || audience || category) ? (
              <Link href="/resources/prompts" className="text-sm font-black text-primary hover:text-primary/80">
                Clear filters
              </Link>
            ) : null}
          </div>
          
          {resources.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {resources.map((resource) => (
                <ResourceCard key={resource.resourceUuid} resource={resource} />
              ))}
            </div>
          ) : (
            <div className="surface-raised flex flex-col items-center justify-center bg-card p-16 text-center">
              <TerminalSquare className="mb-4 h-10 w-10 text-muted-foreground/50" />
              <p className="font-heading text-xl font-bold">No prompts available.</p>
              <p className="mt-2 text-muted-foreground">
                Check back soon for new structured prompt playbooks.
              </p>
            </div>
          )}
        </div>
      </section>

    </main>
  )
}
