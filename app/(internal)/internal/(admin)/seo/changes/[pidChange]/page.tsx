import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { 
  AlertTriangle, 
  ArrowLeft, 
  Check, 
  CheckCircle2, 
  FileCode2, 
  History, 
  ShieldCheck, 
  Sparkles, 
  X 
} from "lucide-react"

import { getSeoChange } from "@/lib/seo"
import { buildMetadata } from "@/lib/site-seo"
import { applySeoChangeAction, rejectSeoChangeAction } from "../../actions"

export const dynamic = "force-dynamic"

export const metadata: Metadata = buildMetadata({
  title: "SEO Draft Review",
  description: "Internal SEO draft review screen.",
  path: "/internal/seo/changes",
  noIndex: true
})

export default async function SeoChangePage({
  params,
  searchParams
}: {
  params: Promise<{ pidChange: string }>
  searchParams?: Promise<{ applied?: string; rejected?: string }>
}) {
  const { pidChange } = await params
  const query = searchParams ? await searchParams : {}
  const change = await getSeoChange(pidChange)
  
  if (!change) notFound()

  const isDraft = change.status === "draft"

  return (
    <main className="space-y-8 pb-12">
      
      {/* Header & Navigation */}
      <div className="flex flex-col gap-6 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link 
            href="/internal/seo" 
            className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to SEO Queue
          </Link>
          <div className="mt-4 flex items-center gap-3">
            <h1 className="font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">
              {change.blog?.blogTitle || "SEO Draft Review"}
            </h1>
            <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${
              change.status === 'applied' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
              change.status === 'rejected' ? 'border-destructive/20 bg-destructive/10 text-destructive' :
              'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400'
            }`}>
              {change.status}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
            Review the proposed metadata and FAQ changes before applying them to the live page.
          </p>
        </div>
      </div>

      {/* Action Notifications */}
      {query.applied && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="font-semibold leading-relaxed">Draft successfully applied to the live content.</p>
        </div>
      )}
      
      {query.rejected && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-600 dark:text-amber-400 animate-in fade-in slide-in-from-top-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="font-semibold leading-relaxed">Draft has been rejected and will not be applied.</p>
        </div>
      )}

      {/* Diff View Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        
        {/* Before State */}
        <section className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-3 border-b border-border bg-muted/20 p-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <History className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Current State</p>
              <h2 className="font-heading text-sm font-bold text-foreground">Before</h2>
            </div>
          </div>
          <div className="relative flex-1 bg-muted/10 p-5">
            <pre className="h-[520px] overflow-auto rounded-lg border border-border bg-background p-4 font-mono text-[11px] leading-relaxed text-muted-foreground scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20">
              {JSON.stringify(change.before, null, 2)}
            </pre>
          </div>
        </section>

        {/* After State */}
        <section className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm ring-1 ring-primary/5">
          <div className="flex items-center gap-3 border-b border-border bg-primary/5 p-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/20 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Proposed Update</p>
              <h2 className="font-heading text-sm font-bold text-foreground">After</h2>
            </div>
          </div>
          <div className="relative flex-1 bg-muted/10 p-5">
            <pre className="h-[520px] overflow-auto rounded-lg border border-border bg-background p-4 font-mono text-[11px] leading-relaxed text-foreground scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20">
              {JSON.stringify(change.after, null, 2)}
            </pre>
          </div>
        </section>
        
      </div>

      {/* Validation Block */}
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-3 border-b border-border bg-muted/20 p-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">System Checks</p>
            <h2 className="font-heading text-sm font-bold text-foreground">Validation Results</h2>
          </div>
        </div>
        <div className="p-5">
          <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-background p-4 font-mono text-[11px] leading-relaxed text-muted-foreground scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20">
            {JSON.stringify(change.validation, null, 2)}
          </pre>
        </div>
      </section>

      {/* Action Bar */}
      <div className="sticky bottom-6 mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-border bg-card/90 p-4 shadow-xl backdrop-blur-xl sm:flex-row sm:p-6">
        <div>
          <p className="font-heading text-sm font-bold text-foreground">
            {isDraft ? "Ready to deploy?" : "Review Complete"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isDraft ? "Applying these changes will immediately update the live content." : `This draft has already been ${change.status}.`}
          </p>
        </div>
        
        <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto sm:flex-row">
          <form action={rejectSeoChangeAction} className="w-full sm:w-auto">
            <input type="hidden" name="pidChange" value={change.pidChange} />
            <button 
              className="inline-flex w-full items-center justify-center rounded-lg border border-border bg-background px-6 py-2.5 text-sm font-bold text-muted-foreground transition-all hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto shadow-sm" 
              type="submit" 
              disabled={!isDraft}
            >
              <X className="mr-2 h-4 w-4" /> Reject Draft
            </button>
          </form>
          
          <form action={applySeoChangeAction} className="w-full sm:w-auto">
            <input type="hidden" name="pidChange" value={change.pidChange} />
            <button 
              className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto" 
              type="submit" 
              disabled={!isDraft}
            >
              <Check className="mr-2 h-4 w-4" /> Apply Metadata & FAQ
            </button>
          </form>
        </div>
      </div>
      
    </main>
  )
}
