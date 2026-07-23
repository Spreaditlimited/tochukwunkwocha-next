import Link from "next/link"
import { ArrowLeft, PlayCircle, Video } from "lucide-react"

import { ResourceCard } from "@/components/resources/ResourceCard"
import { listPublishedResources } from "@/lib/resources"
import { buildMetadata } from "@/lib/site-seo"

export const dynamic = "force-dynamic"

export const metadata = buildMetadata({
  title: "AI Video Library",
  description: "Short practical AI videos for Nigerian learners, parents, teachers, businesses, schools, founders, and public institutions.",
  path: "/resources/videos"
})

const sectionContainer = "site-container"

export default async function ResourceVideosPage() {
  const resources = await listPublishedResources({ type: "video", limit: 60 })

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
              <PlayCircle className="h-4 w-4" />
              Video Library
            </p>
            <h1 className="font-heading text-5xl font-black leading-[1.1] tracking-tighter text-white sm:text-6xl lg:text-7xl">
              Short, practical <span className="bg-gradient-to-r from-brand-sky to-primary bg-clip-text text-transparent">AI videos</span>.
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-slate-300 sm:text-xl">
              A growing library of quick, useful videos for learning and applying AI in real contexts.
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
              Available Videos
            </h2>
          </div>
          
          {resources.length > 0 ? (
            /* We use up to 4 columns here (xl:grid-cols-4) to gracefully handle the mix of portrait and landscape thumbnail ratios. */
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {resources.map((resource) => (
                <ResourceCard key={resource.resourceUuid} resource={resource} />
              ))}
            </div>
          ) : (
            <div className="surface-raised flex flex-col items-center justify-center bg-card p-16 text-center">
              <Video className="mb-4 h-10 w-10 text-muted-foreground/50" />
              <p className="font-heading text-xl font-bold">No videos available.</p>
              <p className="mt-2 text-muted-foreground">
                Check back soon for new practical AI tutorials and short visual guides.
              </p>
            </div>
          )}
        </div>
      </section>

    </main>
  )
}
