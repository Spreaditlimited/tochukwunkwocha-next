import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, BookOpen, Users } from "lucide-react"

import { ResourceCard } from "@/components/resources/ResourceCard"
import { listPublishedResources, resourceAudiences } from "@/lib/resources"
import { buildMetadata } from "@/lib/site-seo"

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ slug: string }>
}

function getAudience(slug: string) {
  return resourceAudiences.find((audience) => audience.key === slug)
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const audience = getAudience(slug)
  
  if (!audience) {
    return buildMetadata({
      title: "AI Prompts and Videos",
      description: "Practical AI prompts and videos from Tochukwu Tech and AI Academy.",
      path: `/resources/audiences/${slug}`
    })
  }
  
  return buildMetadata({
    title: `AI Prompts and Videos for ${audience.label}`,
    description: audience.description,
    path: `/resources/audiences/${audience.key}`
  })
}

const sectionContainer = "site-container"

export default async function ResourceAudiencePage({ params }: PageProps) {
  const { slug } = await params
  const audience = getAudience(slug)
  
  if (!audience) notFound()

  const resources = await listPublishedResources({ audience: audience.key, limit: 80 })

  return (
    <main className="bg-background">
      
      {/* Editorial Hero Section */}
      <section className="relative overflow-hidden bg-brand-ink pb-20 pt-16 text-white lg:pb-28 lg:pt-24">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]"></div>
        <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-sky/15 blur-[150px]"></div>
        
        <div className={`${sectionContainer} relative z-10`}>
          <Link 
            href="/resources" 
            className="mb-10 inline-flex items-center text-sm font-bold text-slate-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Library
          </Link>

          <div className="mx-auto max-w-4xl text-center">
            <p className="eyebrow mb-6 inline-flex items-center gap-2 rounded-full border border-brand-sky/30 bg-brand-sky/10 px-4 py-1.5 text-brand-sky">
              <Users className="h-4 w-4" />
              Audience Library
            </p>
            <h1 className="font-heading text-5xl font-black leading-[1.1] tracking-tighter text-white sm:text-6xl lg:text-7xl">
              AI prompts and videos for <span className="bg-gradient-to-r from-brand-sky to-primary bg-clip-text text-transparent">{audience.label.toLowerCase()}</span>.
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-slate-300 sm:text-xl">
              {audience.description}
            </p>
          </div>
        </div>
      </section>

      {/* Main Resources Grid */}
      <section className="py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="mb-12">
            <p className="eyebrow">Complete Collection</p>
            <h2 className="mt-3 font-heading text-3xl font-black tracking-tight lg:text-4xl">
              Available Resources
            </h2>
          </div>
          
          {resources.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {resources.map((resource) => (
                <ResourceCard key={resource.resourceUuid} resource={resource} />
              ))}
            </div>
          ) : (
            <div className="surface-raised flex flex-col items-center justify-center bg-card p-16 text-center">
              <BookOpen className="mb-4 h-10 w-10 text-muted-foreground/50" />
              <p className="font-heading text-xl font-bold">No prompts or videos available.</p>
              <p className="mt-2 text-muted-foreground">
                Check back soon for new prompts and videos tailored to {audience.label.toLowerCase()}.
              </p>
            </div>
          )}
        </div>
      </section>

    </main>
  )
}
