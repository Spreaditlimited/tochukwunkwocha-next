import Link from "next/link"
import { notFound } from "next/navigation"
import { 
  ArrowLeft, 
  BookOpen, 
  Download, 
  ExternalLink, 
  Info, 
  Layers, 
  Lock, 
  Play,
  TerminalSquare 
} from "lucide-react"

import { ResourceArticleContent } from "@/components/resources/ResourceArticleContent"
import { ResourceLeadForm } from "@/components/resources/ResourceLeadForm"
import { ResourcePromptBlock } from "@/components/resources/ResourcePromptBlock"
import {
  accessTypeLabel,
  audienceLabel,
  categoryLabel,
  formatResourcePrice,
  getResourceBySlug,
  resourceTypeLabel
} from "@/lib/resources"
import { buildMetadata } from "@/lib/site-seo"

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const resource = await getResourceBySlug(slug)
  
  if (!resource) {
    return buildMetadata({
      title: "AI Resource",
      description: "Practical AI resource from Tochukwu Tech and AI Academy.",
      path: `/resources/${slug}`
    })
  }
  
  return buildMetadata({
    title: resource.seoTitle || resource.title,
    description: resource.seoDescription || resource.summary,
    path: `/resources/${resource.slug}`,
    image: resource.ogImage || resource.thumbnailUrl
  })
}

const sectionContainer = "site-container"

export default async function ResourceDetailPage({ params }: PageProps) {
  const { slug } = await params
  const resource = await getResourceBySlug(slug)
  
  if (!resource) notFound()

  const price = formatResourcePrice(resource)
  const hasDownload = Boolean(resource.downloadUrl)
  const canAccessDirectly = resource.accessType === "free"

  return (
    <main className="relative bg-background">
      {/* Editorial Background Grid */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

      <section className="py-16 lg:py-24">
        <div className={sectionContainer}>
          
          <Link 
            href="/resources" 
            className="mb-10 inline-flex items-center text-sm font-bold text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Library
          </Link>

          <div className="grid gap-12 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px] lg:items-start lg:gap-16">
            
            {/* Main Editorial Article Column */}
            <article className="min-w-0">
              
              {/* Meta Tags */}
              <div className="mb-6 flex flex-wrap gap-3">
                <span className="eyebrow inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-primary">
                  <BookOpen className="h-3.5 w-3.5" />
                  {resourceTypeLabel(resource.resourceType)}
                </span>
                <span className="eyebrow inline-flex items-center rounded-full border border-border bg-muted/50 px-3 py-1 text-muted-foreground">
                  {audienceLabel(resource.audienceKey)}
                </span>
                <span className="eyebrow inline-flex items-center rounded-full border border-border bg-muted/50 px-3 py-1 text-muted-foreground">
                  {categoryLabel(resource.categoryKey)}
                </span>
              </div>

              {/* Title & Summary */}
              <h1 className="font-heading text-4xl font-black leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                {resource.title}
              </h1>
              <p className="mt-8 text-lg leading-relaxed text-muted-foreground sm:text-xl">
                {resource.summary}
              </p>

              {/* Cover Image / Thumbnail */}
              {resource.thumbnailUrl && (
                <figure className="surface-raised mt-12 overflow-hidden bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={resource.thumbnailUrl} 
                    alt={resource.title} 
                    className="w-full object-cover" 
                  />
                </figure>
              )}

              {/* Video Player Block */}
              {resource.videoUrl && (
                <div className="surface-raised mt-12 bg-brand-ink p-8 text-white sm:p-12">
                  <div className="mb-6 inline-flex items-center gap-2">
                    <Play className="h-5 w-5 text-sky-400" />
                    <span className="eyebrow text-sky-400">Video Resource</span>
                  </div>
                  <h2 className="mb-6 font-heading text-2xl font-black tracking-tight sm:text-3xl">
                    Watch the tutorial or breakdown.
                  </h2>
                  <a 
                    href={resource.videoUrl} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="btn-inverse inline-flex px-8 py-3.5 text-base"
                  >
                    Open Video Player <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </div>
              )}

              {/* Main Body Content */}
              {resource.bodyContent && (
                <section className="mt-12 prose prose-lg dark:prose-invert max-w-none prose-headings:font-heading prose-headings:font-black prose-a:text-primary hover:prose-a:text-primary/80 sm:mt-16">
                  <ResourceArticleContent content={resource.bodyContent} />
                </section>
              )}

              {/* Prompt Block */}
              {resource.promptText && (
                <section className="surface-raised mt-12 bg-muted/20 p-6 sm:mt-16 sm:p-10">
                  <div className="mb-6 flex items-center gap-3 text-primary">
                    <TerminalSquare className="h-6 w-6" />
                    <p className="eyebrow">The Prompt</p>
                  </div>
                  <ResourcePromptBlock prompt={resource.promptText} />
                </section>
              )}

              {/* Use Case & Customization Grid */}
              {(resource.useCaseText || resource.customizationNotes) && (
                <section className="mt-12 grid gap-6 sm:mt-16 md:grid-cols-2">
                  {resource.useCaseText && (
                    <div className="surface-raised bg-card p-8">
                      <div className="mb-5 inline-flex rounded-lg bg-primary/10 p-3 text-primary">
                        <Layers className="h-6 w-6" />
                      </div>
                      <h2 className="font-heading text-xl font-black text-foreground">Operational Use Case</h2>
                      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                        {resource.useCaseText}
                      </p>
                    </div>
                  )}
                  
                  {resource.customizationNotes && (
                    <div className="surface-raised bg-card p-8">
                      <div className="mb-5 inline-flex rounded-lg bg-primary/10 p-3 text-primary">
                        <Info className="h-6 w-6" />
                      </div>
                      <h2 className="font-heading text-xl font-black text-foreground">How to Customize</h2>
                      <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                        {resource.customizationNotes}
                      </p>
                    </div>
                  )}
                </section>
              )}

            </article>

            {/* Sticky Action Sidebar */}
            <aside className="lg:sticky lg:top-24">
              <div className="surface-raised bg-card p-8">
                
                <p className="eyebrow">Resource Access</p>
                <h2 className="mt-3 font-heading text-3xl font-black text-foreground">
                  {accessTypeLabel(resource.accessType)}
                </h2>
                
                {price && (
                  <p className="mt-4 font-heading text-4xl font-black text-foreground">{price}</p>
                )}

                <div className="mt-6 pt-6">
                  <p className="text-base leading-relaxed text-muted-foreground">
                    {resource.accessType === "paid"
                      ? "This resource is configured as a premium asset. Complete the checkout process to gain immediate access."
                      : resource.accessType === "bundle_only"
                        ? "This specialized resource is exclusively available as part of a comprehensive paid toolkit bundle."
                        : resource.accessType === "gated"
                          ? "Enter your details below to unlock and download this free resource instantly."
                          : "This resource is completely free and available for immediate download."}
                  </p>

                  {/* Actions */}
                  <div className="mt-8 space-y-4">
                    {canAccessDirectly && hasDownload && (
                      <a 
                        href={resource.downloadUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="btn-primary w-full justify-center py-4 text-base"
                      >
                        <Download className="mr-2 h-5 w-5" /> Download Resource
                      </a>
                    )}

                    {resource.accessType === "gated" && hasDownload && (
                      <div className="rounded-xl border border-border bg-muted/30 p-5">
                        <ResourceLeadForm resourceUuid={resource.resourceUuid} downloadUrl={resource.downloadUrl} />
                      </div>
                    )}

                    {(resource.accessType === "paid" || resource.accessType === "bundle_only") && (
                      <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-4 text-sm font-medium text-foreground">
                        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <p>Resource checkout utilizes the unified secure payment layer. Access instructions will be emailed upon completion.</p>
                      </div>
                    )}

                    {resource.relatedCourseSlug && (
                      <div className="pt-4">
                        <p className="eyebrow mb-3">Deepen Your Knowledge</p>
                        <Link 
                          href={`/courses/${resource.relatedCourseSlug}`} 
                          className="btn-secondary w-full justify-center py-4 text-base"
                        >
                          View Related Programme
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
                
              </div>
            </aside>
            
          </div>
        </div>
      </section>
    </main>
  )
}
