import Link from "next/link"
import { 
  ArrowRight, 
  BookOpen, 
  MessageSquare, 
  Play, 
  Sparkles, 
  Users 
} from "lucide-react"

import { ResourceCard } from "@/components/resources/ResourceCard"
import {
  listPublishedResources,
  resourceAudiences,
  type ResourceRow
} from "@/lib/resources"
import { buildMetadata } from "@/lib/site-seo"

export const dynamic = "force-dynamic"

export const metadata = buildMetadata({
  title: "AI Prompts and Videos",
  description: "Practical AI prompts and videos for learners, parents, teachers, school owners, job seekers, business owners, founders, and public institutions.",
  path: "/resources"
})

const sectionContainer = "site-container"

function ResourceStrip({ 
  title, 
  eyebrow, 
  href, 
  resources, 
  bg = "bg-background" 
}: { 
  title: string; 
  eyebrow: string;
  href: string; 
  resources: ResourceRow[];
  bg?: string;
}) {
  return (
    <section className={`${bg} py-20 lg:py-28`}>
      <div className={sectionContainer}>
        <div className="mb-12 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2 className="mt-2 font-heading text-3xl font-black tracking-tight">{title}</h2>
          </div>
          <Link href={href} className="group inline-flex items-center text-sm font-bold text-foreground transition-colors hover:text-primary">
            View Collection <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
        
        {resources.length ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {resources.map((resource) => (
              <ResourceCard key={resource.resourceUuid} resource={resource} />
            ))}
          </div>
        ) : (
          <div className="surface-raised flex flex-col items-center justify-center bg-card p-16 text-center">
            <BookOpen className="mb-4 h-10 w-10 text-muted-foreground/50" />
            <p className="font-heading text-xl font-bold">No publications found.</p>
            <p className="mt-2 text-muted-foreground">Check back soon for new resources.</p>
          </div>
        )}
      </div>
    </section>
  )
}

export default async function ResourcesPage() {
  const [featured, videos, prompts] = await Promise.all([
    listPublishedResources({ type: "prompt", limit: 6 }),
    listPublishedResources({ type: "video", limit: 3 }),
    listPublishedResources({ type: "prompt", limit: 3 })
  ])

  return (
    <main>
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden bg-brand-ink pt-16 text-white lg:pt-24">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-sky/15 blur-[150px]" />
        
        <div className={`${sectionContainer} relative z-10 pb-16 lg:pb-24`}>
          <div className="mx-auto max-w-4xl text-center">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-sky-400">
              <Sparkles className="h-4 w-4" />
              The Knowledge Library
            </p>
            <h1 className="font-heading text-5xl font-black tracking-tighter text-white sm:text-6xl lg:text-7xl lg:leading-[1.1]">
              AI prompts and videos for <span className="bg-gradient-to-r from-sky-400 to-primary bg-clip-text text-transparent">real audiences.</span>
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-slate-400">
              Practical prompt playbooks and short videos for learners, parents, teachers, schools, business owners, founders, and public-sector teams.
            </p>
            <div className="mx-auto mt-10 flex max-w-xl flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/resources/videos" className="btn-primary w-full px-8 py-4 text-base sm:w-auto">
                <Play className="mr-2 h-4 w-4" /> Watch Videos
              </Link>
              <Link href="/resources/prompts" className="btn-secondary w-full px-8 py-4 text-base sm:w-auto">
                <MessageSquare className="mr-2 h-4 w-4" /> Browse Prompts
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Explore by Audience (Bento Grid) */}
      <section className="bg-muted/20 py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="mb-12 max-w-3xl">
            <p className="eyebrow">Audience Direction</p>
            <h2 className="mt-2 font-heading text-3xl font-black tracking-tight">Explore by Audience</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              The goal is practical, local, outcome-based AI education. Start from the group you serve or belong to.
            </p>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {resourceAudiences.map((audience) => (
              <Link 
                key={audience.key} 
                href={`/resources/audiences/${audience.key}`} 
                className="surface-raised group flex flex-col justify-between bg-card p-6 transition-all hover:border-primary/50 hover:shadow-md"
              >
                <div>
                  <div className="mb-5 inline-flex rounded-lg bg-primary/10 p-3 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Users className="h-6 w-6" />
                  </div>
                  <h3 className="font-heading text-xl font-bold">{audience.label}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{audience.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Featured Resources */}
      <ResourceStrip 
        eyebrow="Prompt Library" 
        title="Featured Prompt Playbooks" 
        href="/resources/prompts" 
        resources={featured} 
        bg="bg-background"
      />

      {/* 4. Content Specific Strips */}
      <ResourceStrip 
        eyebrow="Visual Learning" 
        title="Short Videos" 
        href="/resources/videos" 
        resources={videos} 
        bg="bg-muted/20"
      />
      
      <ResourceStrip 
        eyebrow="Implementation" 
        title="Prompt Playbooks" 
        href="/resources/prompts" 
        resources={prompts} 
        bg="bg-background"
      />

      {/* 5. Final CTA */}
      <section className="py-24 text-center lg:py-32">
        <div className="mx-auto max-w-3xl px-5 sm:px-6 lg:px-8">
          <h2 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">
            Need a structured learning path?
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            Prompts and videos help you start. Programmes help you build complete practical outcomes with guidance, feedback, and accountability.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link className="btn-primary px-8 py-3.5 text-base" href="/courses">
              Explore Programmes
            </Link>
            <Link className="btn-secondary px-8 py-3.5 text-base" href="/resources/videos">
              Watch Videos
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
