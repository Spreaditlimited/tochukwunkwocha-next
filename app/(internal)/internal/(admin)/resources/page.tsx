import Link from "next/link"
import {
  Archive,
  BookOpenCheck,
  Download,
  ExternalLink,
  FileText,
  Layers,
  MessageSquare,
  PackagePlus,
  Play,
  Plus,
  Save,
  Search,
  Sparkles,
  Youtube
} from "lucide-react"

import {
  accessTypeLabel,
  audienceLabel,
  categoryLabel,
  formatResourcePrice,
  listAdminBundles,
  listAdminResources,
  resourceAccessTypes,
  resourceAudiences,
  resourceCategories,
  resourceTypeLabel,
  resourceTypes
} from "@/lib/resources"
import { PremiumPicker } from "@/components/PremiumPicker"
import { formatDate } from "@/lib/utils"
import { generateResourceDraftAction, saveResourceAction, saveResourceBundleAction } from "./actions"

export const dynamic = "force-dynamic"

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function param(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key]
  return Array.isArray(value) ? value[0] || "" : value || ""
}

function typeIcon(type: string) {
  if (type === "video") return Play
  if (type === "prompt") return MessageSquare
  if (type === "download") return Download
  return FileText
}

export default async function InternalResourcesPage({ searchParams }: PageProps) {
  const params = await searchParams || {}
  const q = param(params, "q")
  const [resources, bundles] = await Promise.all([
    listAdminResources(q),
    listAdminBundles()
  ])

  const publishedCount = resources.filter((resource) => resource.status === "published").length
  const paidCount = resources.filter((resource) => resource.accessType === "paid" || resource.accessType === "bundle_only").length
  const gatedCount = resources.filter((resource) => resource.accessType === "gated").length
  const resourceTypeOptions = resourceTypes.map((type) => ({ value: type.key, label: type.label }))
  const generatedResourceTypeOptions = resourceTypes
    .filter((type) => type.key === "prompt")
    .map((type) => ({ value: type.key, label: type.label }))
  const resourceAudienceOptions = resourceAudiences.map((audience) => ({ value: audience.key, label: audience.label }))
  const resourceAudienceOptionsWithGeneral = [{ value: "", label: "General" }, ...resourceAudienceOptions]
  const resourceCategoryOptions = resourceCategories.map((category) => ({ value: category.key, label: category.label }))
  const resourceAccessOptions = resourceAccessTypes.map((type) => ({ value: type.key, label: type.label }))
  const statusOptions = [
    { value: "draft", label: "Draft" },
    { value: "published", label: "Published" }
  ]

  return (
    <main className="space-y-8 pb-12">
      <div className="flex flex-col gap-6 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow text-primary">Resource Universe</p>
          <h1 className="mt-1 flex items-center gap-3 font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BookOpenCheck className="h-5 w-5" />
            </span>
            Resources & Toolkits
          </h1>
  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Manage prompt playbooks and videos for specific Nigerian audiences.
          </p>
        </div>
        <Link href="/resources" className="btn-secondary shrink-0">
          <ExternalLink className="h-4 w-4" />
          Public Library
        </Link>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Published Resources", value: publishedCount, icon: BookOpenCheck },
          { label: "Gated Assets", value: gatedCount, icon: Sparkles },
          { label: "Archived / Paid Assets", value: paidCount, icon: Archive }
        ].map((card) => (
          <article key={card.label} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{card.label}</p>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <card.icon className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-5 font-heading text-4xl font-black text-foreground">{card.value.toLocaleString("en")}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border bg-muted/20 p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-heading text-xl font-black text-foreground">Generate Prompt Draft</h2>
                <p className="mt-1 text-sm text-muted-foreground">Use AI to create a reviewable prompt resource. Videos are added separately with a YouTube link.</p>
              </div>
            </div>
          </div>
          <form action={generateResourceDraftAction} className="grid gap-4 p-6 lg:grid-cols-2">
            <input type="hidden" name="accessType" value="free" />
            <label className="block lg:col-span-2">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Prompt Topic</span>
              <input name="topic" className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary" placeholder="AI for school owners: parent communication" required />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Type</span>
              <PremiumPicker name="resourceType" options={generatedResourceTypeOptions} />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Audience</span>
              <PremiumPicker name="audienceKey" options={resourceAudienceOptions} />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Category</span>
              <PremiumPicker name="categoryKey" options={resourceCategoryOptions} />
            </label>
            <button className="btn-primary h-12 justify-center whitespace-nowrap self-end" type="submit">
              <Sparkles className="h-4 w-4" />
              Generate Prompt
            </button>
          </form>
        </article>

        <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border bg-muted/20 p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
                <Youtube className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-heading text-xl font-black text-foreground">Add YouTube Video</h2>
                <p className="mt-1 text-sm text-muted-foreground">Add a public video resource with a YouTube or Shorts URL.</p>
              </div>
            </div>
          </div>
          <form action={saveResourceAction} className="grid gap-4 p-6 sm:grid-cols-2">
            <input type="hidden" name="resourceType" value="video" />
            <input type="hidden" name="accessType" value="free" />
            <label className="block sm:col-span-2">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Video Title</span>
              <input name="title" className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary" placeholder="How to use AI to revise WAEC Biology" required />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">YouTube URL</span>
              <input name="videoUrl" type="url" className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary" placeholder="https://www.youtube.com/watch?v=..." required />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Audience</span>
              <PremiumPicker name="audienceKey" options={resourceAudienceOptions} />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Category</span>
              <PremiumPicker name="categoryKey" options={resourceCategoryOptions} />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Short Summary</span>
              <textarea name="summary" rows={3} className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary" placeholder="Briefly explain what the viewer will learn." />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Thumbnail URL</span>
              <input name="thumbnailUrl" type="url" className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</span>
              <PremiumPicker name="status" options={statusOptions} />
            </label>
            <button className="btn-primary h-12 justify-center sm:col-span-2" type="submit">
              <Save className="h-4 w-4" />
              Save Video
            </button>
          </form>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border bg-muted/20 p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Plus className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-heading text-xl font-black text-foreground">Create Resource</h2>
                <p className="mt-1 text-sm text-muted-foreground">Create a prompt playbook or video resource.</p>
              </div>
            </div>
          </div>
          <form action={saveResourceAction} className="grid gap-5 p-6 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Title</span>
              <input name="title" className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary" placeholder="AI Toolkit for Nigerian Teachers" required />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Type</span>
              <PremiumPicker name="resourceType" options={resourceTypeOptions} />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Access</span>
              <PremiumPicker name="accessType" options={resourceAccessOptions} />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Audience</span>
              <PremiumPicker name="audienceKey" options={resourceAudienceOptions} />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Category</span>
              <PremiumPicker name="categoryKey" options={resourceCategoryOptions} />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Summary</span>
              <textarea name="summary" rows={3} className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary" placeholder="Short public description of the resource." />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Context / Notes</span>
              <textarea name="bodyContent" rows={6} className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary" placeholder="Audience context, video notes, or how the prompt should be used." />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Prompt Text</span>
              <textarea name="promptText" rows={5} className="w-full rounded-xl border border-input bg-background px-4 py-3 font-mono text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" placeholder="Paste the actual prompt here when this is a prompt resource." />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Use Case</span>
              <textarea name="useCaseText" rows={4} className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">How to Customize</span>
              <textarea name="customizationNotes" rows={4} className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Video URL / Embed URL</span>
              <input name="videoUrl" className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Reserved URL</span>
              <input name="downloadUrl" className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Thumbnail / OG Image</span>
              <input name="thumbnailUrl" className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Related Course Slug</span>
              <input name="relatedCourseSlug" className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary" placeholder="prompt-to-profit" />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">NGN Price</span>
              <input name="priceNgn" type="number" min="0" step="1" className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">USD Price</span>
              <input name="priceUsd" type="number" min="0" step="1" className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Brevo List ID</span>
              <input name="brevoListId" type="number" min="0" step="1" className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</span>
              <PremiumPicker name="status" options={statusOptions} />
            </label>
            <div className="flex items-end justify-between gap-4 md:col-span-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3">
                <input name="featured" type="checkbox" className="h-4 w-4 rounded border-input text-primary focus:ring-primary" />
                <span className="text-sm font-bold text-foreground">Feature this resource</span>
              </label>
              <button className="btn-primary" type="submit">
                <Save className="h-4 w-4" />
                Save Resource
              </button>
            </div>
          </form>
        </article>

        <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border bg-muted/20 p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <PackagePlus className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-heading text-xl font-black text-foreground">Create Toolkit Bundle</h2>
                <p className="mt-1 text-sm text-muted-foreground">Bundle resources into a paid toolkit offer.</p>
              </div>
            </div>
          </div>
          <form action={saveResourceBundleAction} className="space-y-5 p-6">
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Toolkit Title</span>
              <input name="title" className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary" placeholder="AI Toolkit for School Owners" required />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Audience</span>
              <PremiumPicker name="audienceKey" options={resourceAudienceOptionsWithGeneral} />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Summary</span>
              <textarea name="summary" rows={3} className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Description</span>
              <textarea name="description" rows={5} className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">NGN Price</span>
                <input name="priceNgn" type="number" min="0" step="1" className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">USD Price</span>
                <input name="priceUsd" type="number" min="0" step="1" className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
              </label>
            </div>
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Bundle Items</p>
              <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-border bg-background p-3">
                {resources.length ? resources.map((resource) => (
                  <label key={resource.resourceUuid} className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted/40">
                    <input name="resourceUuids" value={resource.resourceUuid} type="checkbox" className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-primary" />
                    <span>
                      <span className="block font-bold text-foreground">{resource.title}</span>
                      <span className="text-xs font-medium text-muted-foreground">{resourceTypeLabel(resource.resourceType)} · {accessTypeLabel(resource.accessType)}</span>
                    </span>
                  </label>
                )) : (
                  <p className="py-8 text-center text-sm font-semibold text-muted-foreground">Create resources before building bundles.</p>
                )}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</span>
                <PremiumPicker name="status" options={statusOptions} />
              </label>
              <label className="flex cursor-pointer items-center gap-3 self-end rounded-xl border border-border bg-muted/20 px-4 py-3">
                <input name="featured" type="checkbox" className="h-4 w-4 rounded border-input text-primary focus:ring-primary" />
                <span className="text-sm font-bold text-foreground">Featured</span>
              </label>
            </div>
            <button className="btn-primary w-full justify-center" type="submit">
              <Save className="h-4 w-4" />
              Save Toolkit
            </button>
          </form>
        </article>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow text-primary">Library Registry</p>
            <h2 className="mt-1 font-heading text-xl font-black text-foreground">Resources</h2>
          </div>
          <form className="relative w-full sm:w-96">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input name="q" defaultValue={q} className="w-full rounded-xl border border-input bg-card py-3 pl-11 pr-4 text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary" placeholder="Search resources..." />
          </form>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="max-h-[44rem] overflow-auto">
            <table className="w-full min-w-[88rem] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Resource</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Audience</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Access</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Updated</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Public</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {resources.length ? resources.map((resource) => {
                  const Icon = typeIcon(resource.resourceType)
                  return (
                    <tr key={resource.resourceUuid} className="hover:bg-muted/10">
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Icon className="h-5 w-5" />
                          </span>
                          <div className="min-w-0">
                            <p className="font-heading text-sm font-black text-foreground">{resource.title}</p>
                            <p className="mt-1 font-mono text-xs text-muted-foreground">/resources/{resource.slug}</p>
                            <p className="mt-1 text-xs font-semibold text-muted-foreground">{resourceTypeLabel(resource.resourceType)} · {categoryLabel(resource.categoryKey)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-muted-foreground">{audienceLabel(resource.audienceKey)}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex rounded-md border border-border bg-muted/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          {accessTypeLabel(resource.accessType)}
                        </span>
                        {formatResourcePrice(resource) ? <p className="mt-1 text-xs font-black text-foreground">{formatResourcePrice(resource)}</p> : null}
                      </td>
                      <td className="px-6 py-4">
                        <span className={resource.status === "published"
                          ? "inline-flex rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400"
                          : "inline-flex rounded-md border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400"
                        }>
                          {resource.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-muted-foreground">{formatDate(resource.updatedAt)}</td>
                      <td className="px-6 py-4 text-right">
                        {resource.status === "published" ? (
                          <Link href={`/resources/${resource.slug}`} className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold text-muted-foreground hover:border-primary/40 hover:text-primary">
                            View <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                          </Link>
                        ) : (
                          <span className="text-xs font-semibold text-muted-foreground">Draft</span>
                        )}
                      </td>
                    </tr>
                  )
                }) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-14 text-center text-sm font-semibold text-muted-foreground">
                      No resources found yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="eyebrow text-primary">Commercial Toolkit Offers</p>
          <h2 className="mt-1 font-heading text-xl font-black text-foreground">Bundles</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {bundles.length ? bundles.map((bundle) => (
            <article key={bundle.bundleUuid} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary">{audienceLabel(bundle.audienceKey || "General")}</p>
                  <h3 className="mt-2 font-heading text-lg font-black text-foreground">{bundle.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{bundle.summary}</p>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Layers className="h-5 w-5" />
                </span>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3 text-xs font-bold text-muted-foreground">
                <span>{bundle.resourceCount} resources</span>
                {formatResourcePrice(bundle) ? <span>{formatResourcePrice(bundle)}</span> : null}
                <span>{bundle.status}</span>
              </div>
            </article>
          )) : (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
              <p className="text-sm font-semibold text-muted-foreground">No toolkit bundles created yet.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
