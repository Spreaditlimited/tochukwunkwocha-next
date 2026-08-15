import Link from "next/link"
import type { Metadata } from "next"
import type { ComponentType } from "react"
import { 
  AlertTriangle, 
  BarChart2, 
  CheckCircle2, 
  Eye, 
  FileTerminal, 
  MousePointerClick, 
  Search, 
  Sparkles, 
  Target, 
  TrendingUp, 
  X
} from "lucide-react"

import { formatDate } from "@/lib/utils"
import { DashboardStatCard, DashboardStatsVisibility } from "@/components/dashboard/DashboardStatsVisibility"
import { getSeoStats, listSeoImportRuns, listSeoOpportunities } from "@/lib/seo"
import { buildMetadata } from "@/lib/site-seo"
import { generateSeoDraftAction, updateOpportunityStatusAction } from "./actions"
import { GscImportControl } from "./GscImportControl"
import { GenerateDraftButton } from "./GenerateDraftButton"
import { GenerateArticleButton } from "./GenerateArticleButton"

export const dynamic = "force-dynamic"

export const metadata: Metadata = buildMetadata({
  title: "SEO Opportunities",
  description: "Internal Search Console SEO opportunity queue.",
  path: "/internal/seo",
  noIndex: true
})

function number(value: unknown) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0))
}

function percent(value: unknown) {
  return `${(Number(value || 0) * 100).toFixed(2)}%`
}

export default async function SeoQueuePage({
  searchParams
}: {
  searchParams?: Promise<{ status?: string; type?: string; error?: string }>
}) {
  const params = searchParams ? await searchParams : {}
  const currentStatus = params.status || "open"
  const currentType = params.type || "all"
  
  let stats = {
    open: 0,
    reviewing: 0,
    dismissed: 0,
    importedRows: 0,
    latestImportAt: null as Date | null,
    latestImportSource: null as string | null,
    latestImportRows: 0,
    latestImportStartDate: null as Date | null,
    latestImportEndDate: null as Date | null
  }
  let opportunities: Awaited<ReturnType<typeof listSeoOpportunities>> = []
  let importRuns: Awaited<ReturnType<typeof listSeoImportRuns>> = []
  let setupMissing = false

  try {
    stats = await getSeoStats()
    opportunities = await listSeoOpportunities(currentStatus, currentType)
    importRuns = await listSeoImportRuns()
  } catch {
    setupMissing = true
  }

  const statCards: Array<{
    label: string
    key: "open" | "reviewing" | "dismissed" | "importedRows"
    icon: ComponentType<{ className?: string }>
    color: string
    bg: string
    border: string
  }> = [
    { label: "Open Opportunities", key: "open", icon: Search, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", border: "hover:border-amber-500/40" },
    { label: "In Review", key: "reviewing", icon: Sparkles, color: "text-primary", bg: "bg-primary/10", border: "hover:border-primary/40" },
    { label: "Dismissed", key: "dismissed", icon: AlertTriangle, color: "text-muted-foreground", bg: "bg-muted", border: "hover:border-border" },
    { label: "Imported Rows", key: "importedRows", icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", border: "hover:border-emerald-500/40" }
  ]

  const tabs = ["open", "reviewing", "dismissed", "all"]
  const activeRun = importRuns.find((run) => run.status === "started") || importRuns[0] || null
  const latestCompleted = importRuns.find((run) => run.status === "completed") || null

  return (
    <main className="space-y-8 pb-12">
      
      {/* Header & Filters */}
      <div className="flex flex-col gap-6 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow text-primary">SEO Automation</p>
          <h1 className="mt-1 font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Search Console Opportunities
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
            Review automatically surfaced content gaps and performance improvements based on real search impression data.
          </p>
        </div>
        
        {/* Segmented Control Tabs */}
        <div className="flex shrink-0 overflow-hidden rounded-lg border border-border bg-muted/20 p-1">
          {tabs.map((status) => (
            <Link 
              key={status} 
              href={`/internal/seo?status=${status}&type=${currentType}`}
              className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-xs font-bold capitalize transition-all ${
                currentStatus === status 
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border" 
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              {status}
            </Link>
          ))}
        </div>
      </div>

      {/* System Alerts */}
      {setupMissing && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-600 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="font-semibold leading-relaxed">
            SEO tables are not available yet. Run <code className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-xs">npm run db:setup:seo</code> after setting your database URL.
          </p>
        </div>
      )}

      {params.error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="font-semibold leading-relaxed">{params.error}</p>
        </div>
      )}

      {/* Primary Pulse Metrics */}
      <DashboardStatsVisibility storageKey="tochukwu-internal-seo-stats">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(({ label, key, icon: Icon, bg, color, border }) => (
          <DashboardStatCard key={label} statKey={label} label={label} value={number(stats[key])}
            icon={<Icon className="h-5 w-5" />} iconClassName={`${bg} ${color}`} className={border} />
        ))}
      </div>
      </DashboardStatsVisibility>

      <GscImportControl
        latestCompletedEndDate={latestCompleted?.sourceEndDate?.toISOString().slice(0, 10) || null}
        initialRun={activeRun ? {
          runUuid: activeRun.runUuid,
          startDate: activeRun.sourceStartDate?.toISOString().slice(0, 10) || "",
          endDate: activeRun.sourceEndDate?.toISOString().slice(0, 10) || "",
          rowCount: activeRun.rowCount,
          status: activeRun.status,
          error: activeRun.errorMessage,
          elapsedSeconds: Math.max(0, Math.floor(((activeRun.completedAt || new Date()).getTime() - activeRun.startedAt.getTime()) / 1000)),
          percent: ["completed", "failed"].includes(activeRun.status) ? 100 : 8,
          stage: activeRun.status === "completed" ? "Import completed and SEO opportunities refreshed" : activeRun.status === "failed" ? "Import stopped with an error" : "Reconnecting to the saved import job",
          ready: ["completed", "failed"].includes(activeRun.status)
        } : null}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div><p className="text-xs font-bold uppercase tracking-widest text-primary">Opportunity type</p><p className="mt-1 text-xs text-muted-foreground">Separate metadata fixes, existing-article improvements, and unmet keyword demand for new articles.</p></div>
        <div className="flex flex-wrap gap-2">{["all", "low_ctr", "ranking_push", "new_content"].map((type) => <Link key={type} href={`/internal/seo?status=${currentStatus}&type=${type}`} className={`rounded-lg border px-3 py-2 text-xs font-bold ${currentType === type ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{type.replace(/_/g, " ")}</Link>)}</div>
      </div>

      {/* Technical Instruction Panel */}
      <div className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-sm lg:grid-cols-[1fr_auto] lg:items-center sm:p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <FileTerminal className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-heading text-sm font-bold text-foreground">Google Search Console Connection</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Use the authenticated importer above, or call <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground font-bold">/api/cron/search-console</code> with its bearer secret. Run <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground font-bold">npm run db:setup:seo</code> once per database.
            </p>
          </div>
        </div>
        <div className="grid gap-2 rounded-lg border border-border bg-muted/10 p-3 text-xs font-semibold text-muted-foreground sm:grid-cols-2 lg:min-w-[360px]">
          <div>
            <span className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Latest Import</span>
            <span className="text-foreground">{formatDate(stats.latestImportAt) || "None recorded"}</span>
          </div>
          <div>
            <span className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Rows</span>
            <span className="text-foreground">{number(stats.latestImportRows)}</span>
          </div>
          <div>
            <span className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Source</span>
            <span className="text-foreground">{stats.latestImportSource || "Not recorded"}</span>
          </div>
          <div>
            <span className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">GSC Window</span>
            <span className="text-foreground">
              {stats.latestImportStartDate && stats.latestImportEndDate
                ? `${formatDate(stats.latestImportStartDate)} - ${formatDate(stats.latestImportEndDate)}`
                : "Not recorded"}
            </span>
          </div>
        </div>
      </div>

      {/* Opportunities List */}
      <div className="space-y-4">
        <h2 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Actionable Queue
        </h2>
        
        {opportunities.length ? opportunities.map((opportunity) => {
          const latestChange = opportunity.changes[0]
          const isNewContentOpportunity = opportunity.opportunityType === "new_content"
          const needsNewArticle = isNewContentOpportunity && !opportunity.pidBlog
          return (
            <article 
              key={opportunity.pidOpportunity} 
              className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6 shadow-sm transition-colors hover:border-primary/20 xl:flex-row xl:items-start xl:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-2"><p className="inline-flex items-center rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">{opportunity.opportunityType.replace(/_/g, " ")}</p><p className="rounded bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{opportunity.status}</p><p className="rounded border border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">CTA: {(opportunity.recommendedCta || "general").replace(/_/g, " ")}</p></div>
                <h3 className="mt-3 font-heading text-xl font-bold text-foreground">
                  {needsNewArticle ? `New article: ${opportunity.primaryQuery}` : opportunity.blog?.blogTitle || opportunity.blogSlug || opportunity.pageUrl}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {opportunity.recommendation}
                </p>
                
                {/* Metric Data Blocks */}
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-6 rounded-lg border border-border bg-muted/10 p-4">
                  <div>
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      <Search className="h-3 w-3" /> Query
                    </p>
                    <p className="mt-1 truncate font-mono text-sm font-bold text-foreground" title={opportunity.primaryQuery || "unknown"}>
                      {opportunity.primaryQuery || "unknown"}
                    </p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      <MousePointerClick className="h-3 w-3" /> Clicks
                    </p>
                    <p className="mt-1 font-heading text-sm font-black text-foreground">
                      {number(opportunity.clicks)}
                    </p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      <Eye className="h-3 w-3" /> Impr.
                    </p>
                    <p className="mt-1 font-heading text-sm font-black text-foreground">
                      {number(opportunity.impressions)}
                    </p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      <BarChart2 className="h-3 w-3" /> CTR
                    </p>
                    <p className="mt-1 font-heading text-sm font-black text-foreground">
                      {percent(opportunity.ctr)}
                    </p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      <Target className="h-3 w-3" /> Pos.
                    </p>
                    <p className="mt-1 font-heading text-sm font-black text-foreground">
                      {Number(opportunity.position || 0).toFixed(1)}
                    </p>
                  </div>
                  <div><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Confidence</p><p className="mt-1 font-heading text-sm font-black text-foreground">{(Number(opportunity.confidence || 0) * 100).toFixed(1)}%</p></div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex shrink-0 flex-col gap-2 sm:flex-row xl:flex-col">
                {opportunity.pidBlog && <Link className="inline-flex w-full items-center justify-center rounded-lg border border-border bg-card px-6 py-2.5 text-sm font-bold" href={`/internal/blog/${opportunity.pidBlog}`}>{isNewContentOpportunity ? "Edit Generated Draft" : "Edit Blog"}</Link>}
                <a className="inline-flex w-full items-center justify-center rounded-lg border border-border bg-card px-6 py-2.5 text-sm font-bold" href={opportunity.pageUrl} target="_blank" rel="noopener noreferrer">{isNewContentOpportunity ? "Current Ranking Page" : "Public Page"}</a>
                {needsNewArticle ? (
                  <GenerateArticleButton pidOpportunity={opportunity.pidOpportunity} initialStatus={latestChange?.changeType === "new_article" ? latestChange.status : null} />
                ) : !isNewContentOpportunity && latestChange && latestChange.status !== "rejected" ? (
                  <Link 
                    className="inline-flex w-full items-center justify-center rounded-lg border border-primary/20 bg-primary/10 px-6 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground shadow-sm sm:w-auto xl:w-full" 
                    href={`/internal/seo/changes/${latestChange.pidChange}`}
                  >
                    <Eye className="mr-2 h-4 w-4" /> Review Draft
                  </Link>
                ) : !isNewContentOpportunity && opportunity.pidBlog ? (
                  <form action={generateSeoDraftAction} className="w-full sm:w-auto xl:w-full">
                    <input type="hidden" name="pidOpportunity" value={opportunity.pidOpportunity} />
                    <GenerateDraftButton />
                  </form>
                ) : null}
                {opportunity.status !== "reviewing" && <form action={updateOpportunityStatusAction} className="w-full sm:w-auto xl:w-full">
                  <input type="hidden" name="pidOpportunity" value={opportunity.pidOpportunity} />
                  <input type="hidden" name="status" value="reviewing" />
                  <button className="inline-flex w-full items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10 px-6 py-2.5 text-sm font-bold text-blue-700" type="submit"><CheckCircle2 className="mr-2 h-4 w-4" />Mark for Review</button>
                </form>}
                <form action={updateOpportunityStatusAction} className="w-full sm:w-auto xl:w-full">
                  <input type="hidden" name="pidOpportunity" value={opportunity.pidOpportunity} />
                  <input type="hidden" name="status" value="dismissed" />
                  <button 
                    className="inline-flex w-full items-center justify-center rounded-lg border border-border bg-card px-6 py-2.5 text-sm font-bold text-muted-foreground transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive shadow-sm" 
                    type="submit"
                  >
                    <X className="mr-2 h-4 w-4" /> Dismiss
                  </button>
                </form>
              </div>
            </article>
          )
        }) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/10 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <TrendingUp className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-heading text-lg font-bold text-foreground">No Opportunities Found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              There are no {currentStatus} SEO opportunities currently in the queue.
            </p>
          </div>
        )}
      </div>
      
    </main>
  )
}
