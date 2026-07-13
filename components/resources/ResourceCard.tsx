import Link from "next/link"
import { ArrowRight, Download, FileText, Lock, MessageSquare, Play } from "lucide-react"

import {
  accessTypeLabel,
  audienceLabel,
  categoryLabel,
  formatResourcePrice,
  resourceTypeLabel,
  type ResourceRow
} from "@/lib/resources"
import { ResourceVideoThumbnail } from "@/components/resources/ResourceVideoThumbnail"

function typeIcon(type: string) {
  if (type === "video") return Play
  if (type === "prompt") return MessageSquare
  if (type === "download") return Download
  return FileText
}

export function ResourceCard({ resource }: { resource: ResourceRow }) {
  const Icon = typeIcon(resource.resourceType)
  const price = formatResourcePrice(resource)
  const generatedVideoThumbnail = resource.resourceType === "video" && !resource.thumbnailUrl

  return (
    <Link href={`/resources/${resource.slug}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
      {resource.thumbnailUrl ? (
        <div className="aspect-[16/10] overflow-hidden bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resource.thumbnailUrl} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        </div>
      ) : resource.resourceType === "video" ? (
        <ResourceVideoThumbnail title={resource.title} className="transition-transform duration-500 group-hover:scale-[1.02]" />
      ) : (
        <div className="flex aspect-[16/10] items-center justify-center bg-muted/30 text-primary">
          <Icon className="h-10 w-10" />
        </div>
      )}
      <div className="flex flex-1 flex-col p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-primary/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
            {resourceTypeLabel(resource.resourceType)}
          </span>
          {resource.accessType !== "free" ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <Lock className="h-3 w-3" />
              {accessTypeLabel(resource.accessType)}
            </span>
          ) : null}
        </div>
        {!generatedVideoThumbnail ? (
          <h3 className="mt-4 font-heading text-xl font-black leading-tight text-foreground group-hover:text-primary">
            {resource.title}
          </h3>
        ) : null}
        <p className={generatedVideoThumbnail ? "mt-4 line-clamp-3 text-sm leading-relaxed text-muted-foreground" : "mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground"}>
          {resource.summary}
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-bold text-muted-foreground">
          <span>{audienceLabel(resource.audienceKey)}</span>
          <span>·</span>
          <span>{categoryLabel(resource.categoryKey)}</span>
        </div>
        <div className="mt-auto flex items-center justify-between gap-4 pt-6">
          <span className="text-sm font-black text-foreground">{price || "Free"}</span>
          <span className="inline-flex items-center text-sm font-black text-primary">
            Open <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </Link>
  )
}
