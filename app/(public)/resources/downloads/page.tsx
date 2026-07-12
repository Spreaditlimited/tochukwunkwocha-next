import Link from "next/link"
import { ArrowLeft, Download, FileText } from "lucide-react"

import { ResourceCard } from "@/components/resources/ResourceCard"
import { listPublishedResources } from "@/lib/resources"
import { buildMetadata } from "@/lib/site-seo"

export const dynamic = "force-dynamic"

export const metadata = buildMetadata({
  title: "AI Downloads, Templates and Checklists",
  description: "Downloadable AI worksheets, checklists, templates, toolkits, and practical implementation guides.",
  path: "/resources/downloads"
})

const sectionContainer = "site-container"

export default async function ResourceDownloadsPage() {
  const resources = await listPublishedResources({ type: "download", limit: 80 })

  return (
    <main className="bg-background">
      
      {/* Editorial Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-20 lg:pt-24 lg:pb-28">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        
        <div className={`${sectionContainer} relative z-10`}>
          <Link 
            href="/resources" 
            className="mb-10 inline-flex items-center text-sm font-bold text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Library
          </Link>

          <div className="max-w-4xl">
            <p className="eyebrow mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-primary">
              <Download className="h-4 w-4" />
              Downloads Hub
            </p>
            <h1 className="font-heading text-5xl font-black leading-[1.1] tracking-tighter text-foreground sm:text-6xl lg:text-7xl">
              Worksheets, templates, and <span className="text-primary italic">implementation kits</span>.
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Practical downloadable resources that help people apply AI instead of only reading about it.
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
              Available Downloads
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
              <FileText className="mb-4 h-10 w-10 text-muted-foreground/50" />
              <p className="font-heading text-xl font-bold">No downloads available.</p>
              <p className="mt-2 text-muted-foreground">
                Check back soon for new worksheets, checklists, and templates.
              </p>
            </div>
          )}
        </div>
      </section>

    </main>
  )
}
