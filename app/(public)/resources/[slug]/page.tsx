import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { 
  ArrowLeft, 
  BookOpen, 
  Download, 
  Info, 
  Layers, 
  Lock, 
  Play,
  TerminalSquare 
} from "lucide-react"

import { ResourceArticleContent } from "@/components/resources/ResourceArticleContent"
import { ResourceLeadForm } from "@/components/resources/ResourceLeadForm"
import { ResourcePromptBlock } from "@/components/resources/ResourcePromptBlock"
import { ResourceSubscribeForm } from "@/components/resources/ResourceSubscribeForm"
import {
  accessTypeLabel,
  audienceLabel,
  categoryLabel,
  formatResourcePrice,
  getResourceBySlug,
  resourceTypeLabel,
  youtubeEmbedInfo
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
  const isDownloadableResource = resource.resourceType === "download"
  const canAccessDirectly = resource.accessType === "free" && isDownloadableResource
  const pdfDownloadUrl = `/api/resources/${resource.slug}/download`
  const shouldProtectInlineContent = isDownloadableResource || resource.accessType === "gated"
  const videoEmbed = youtubeEmbedInfo(resource.videoUrl)
  if (resource.resourceType === "video" && !videoEmbed) notFound()

  return (
    <main className="relative bg-background">
      <section className="relative overflow-hidden bg-brand-ink py-16 text-white lg:py-24">
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
            <div className="mb-6 flex flex-wrap justify-center gap-3">
              <span className="eyebrow inline-flex items-center gap-1.5 rounded-full border border-brand-sky/30 bg-brand-sky/10 px-3 py-1 text-brand-sky">
                <BookOpen className="h-3.5 w-3.5" />
                {resourceTypeLabel(resource.resourceType)}
              </span>
              <span className="eyebrow inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">
                {audienceLabel(resource.audienceKey)}
              </span>
              <span className="eyebrow inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">
                {categoryLabel(resource.categoryKey)}
              </span>
            </div>

            <h1 className="font-heading text-5xl font-black leading-[1.1] tracking-tighter text-white sm:text-6xl lg:text-7xl">
              {resource.title}
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-slate-300 sm:text-xl">
              {resource.summary}
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-24">
        <div className={sectionContainer}>
          <div className="grid gap-12 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px] lg:items-start lg:gap-16">
            
            {/* Main Editorial Article Column */}
            <article className="min-w-0">

              {/* Cover Image / Thumbnail */}
              {resource.thumbnailUrl && (
                <figure className="surface-raised relative aspect-video overflow-hidden bg-muted">
                  <Image
                    src={resource.thumbnailUrl} 
                    alt={resource.title} 
                    fill
                    sizes="(min-width: 1024px) 768px, 100vw"
                    className="object-cover"
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
                  {videoEmbed ? (
                    <div className={videoEmbed.isShort
                      ? "mx-auto mb-2 w-full max-w-[24rem] overflow-hidden rounded-lg border border-white/10 bg-black shadow-2xl"
                      : "mb-2 overflow-hidden rounded-lg border border-white/10 bg-black shadow-2xl"
                    }>
                      <iframe
                        src={videoEmbed.embedUrl}
                        title={resource.title}
                        className={videoEmbed.isShort ? "aspect-[9/16] w-full" : "aspect-video w-full"}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </div>
                  ) : null}
                </div>
              )}

              {shouldProtectInlineContent && (
                <section className="surface-raised mt-12 bg-card p-8 sm:mt-16 sm:p-10">
                  <div className="mb-5 inline-flex rounded-lg bg-primary/10 p-3 text-primary">
                    <Download className="h-6 w-6" />
                  </div>
                  <h2 className="font-heading text-2xl font-black tracking-tight text-foreground">
                    Download the complete PDF
                  </h2>
                  <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                    Get the complete worksheet, checklist, or planner in a clean PDF format you can use immediately. It is designed for focused action, not casual reading.
                  </p>
                  <div className="mt-8 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-border bg-muted/30 p-4">
                      <p className="eyebrow text-primary">Format</p>
                      <p className="mt-2 text-sm font-bold text-foreground">PDF download</p>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/30 p-4">
                      <p className="eyebrow text-primary">Audience</p>
                      <p className="mt-2 text-sm font-bold text-foreground">{audienceLabel(resource.audienceKey)}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/30 p-4">
                      <p className="eyebrow text-primary">Category</p>
                      <p className="mt-2 text-sm font-bold text-foreground">{categoryLabel(resource.categoryKey)}</p>
                    </div>
                  </div>
                </section>
              )}

              {/* Main Body Content */}
              {!shouldProtectInlineContent && resource.bodyContent && (
                <section className="mt-12 prose prose-lg dark:prose-invert max-w-none prose-headings:font-heading prose-headings:font-black prose-a:text-primary hover:prose-a:text-primary/80 sm:mt-16">
                  <ResourceArticleContent content={resource.bodyContent} />
                </section>
              )}

              {/* Prompt Block */}
              {!shouldProtectInlineContent && resource.promptText && (
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
                          : isDownloadableResource
                            ? "This resource is completely free and available as a PDF download."
                            : "This resource is completely free. Subscribe below to receive new practical AI resources when they are published."}
                  </p>

                  {/* Actions */}
                  <div className="mt-8 space-y-4">
                    {canAccessDirectly && (
                      <a 
                        href={pdfDownloadUrl}
                        className="btn-primary w-full justify-center py-4 text-base"
                      >
                        <Download className="mr-2 h-5 w-5" /> Download PDF
                      </a>
                    )}

                    {resource.accessType === "gated" && (
                      <div className="rounded-xl border border-border bg-muted/30 p-5">
                        <ResourceLeadForm resourceUuid={resource.resourceUuid} />
                      </div>
                    )}

                    {resource.accessType === "free" && !isDownloadableResource && (
                      <ResourceSubscribeForm />
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
