import Link from "next/link"
import { 
  BarChart3, 
  ExternalLink, 
  FileText, 
  Mail, 
  Megaphone, 
  MousePointerClick, 
  RefreshCw, 
  Users 
} from "lucide-react"

import { PremiumPicker } from "@/components/PremiumPicker"
import { getMarketingDashboard, type MarketingChartRow } from "@/lib/marketing"
import { requireAdmin } from "@/lib/auth"
import { formatDate } from "@/lib/utils"
import { MetaAdsCampaignBuilder } from "./MetaAdsCampaignBuilder"
import { MetaAdsConnectionCard } from "./MetaAdsConnectionCard"

export const dynamic = "force-dynamic"

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function param(params: Record<string, string | string[] | undefined>, key: string, fallback = "") {
  const value = params[key]
  return Array.isArray(value) ? value[0] || fallback : value || fallback
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en").format(Number(value || 0))
}

function BarList({ rows, emptyText }: { rows: MarketingChartRow[]; emptyText: string }) {
  const max = rows.reduce((acc, row) => Math.max(acc, Number(row.leads || 0)), 1)
  if (!rows.length) return (
    <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border bg-muted/10">
      <p className="text-sm font-semibold text-muted-foreground">{emptyText}</p>
    </div>
  )
  return (
    <div className="space-y-5">
      {rows.map((row) => {
        const width = Math.max(2, Math.round((Number(row.leads || 0) / max) * 100))
        return (
          <div key={row.label} className="group">
            <div className="mb-2 flex items-center justify-between gap-4">
              <p className="min-w-0 truncate text-sm font-bold text-foreground transition-colors group-hover:text-primary" title={row.label}>
                {row.label}
              </p>
              <p className="shrink-0 font-heading text-sm font-black text-foreground">
                {formatNumber(row.leads)}
              </p>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
              <div 
                className="h-full rounded-full bg-primary transition-all duration-500 ease-out" 
                style={{ width: `${width}%` }} 
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DailyChart({ rows }: { rows: MarketingChartRow[] }) {
  const max = rows.reduce((acc, row) => Math.max(acc, Number(row.leads || 0)), 1)
  if (!rows.length) {
    return (
      <div className="flex min-h-[250px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/10">
        <p className="text-sm font-semibold text-muted-foreground">No daily lead data available yet.</p>
      </div>
    )
  }
  return (
    <div className="flex min-h-[250px] items-end gap-1.5 sm:gap-2 rounded-xl bg-muted/10 p-4 sm:px-6 sm:pb-6 sm:pt-8">
      {rows.map((row) => {
        const height = Math.max(8, Math.round((Number(row.leads || 0) / max) * 200))
        return (
          <div key={row.label} className="group flex min-w-[12px] flex-1 flex-col items-center justify-end gap-3">
            {/* Tooltip implementation is tricky without client JS, so we use title */}
            <div 
              className="w-full rounded-t-md bg-primary/70 transition-all duration-300 hover:bg-primary" 
              style={{ height }} 
              title={`${row.label}: ${formatNumber(row.leads)} leads`} 
            />
            <span className="hidden max-w-[40px] -rotate-45 truncate text-[10px] font-bold tracking-wider text-muted-foreground sm:block">
              {row.label.slice(5)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default async function MarketingPage({ searchParams }: PageProps) {
  const session = await requireAdmin("/internal/marketing")
  const params = await searchParams || {}
  const days = Math.min(365, Math.max(1, Number(param(params, "days", "30")) || 30))
  const dashboard = await getMarketingDashboard({ days, limit: 150 })
  const dayOptions = [
    { value: "7", label: "Last 7 days" },
    { value: "30", label: "Last 30 days" },
    { value: "90", label: "Last 90 days" },
    { value: "180", label: "Last 180 days" },
    { value: "365", label: "Last 365 days" }
  ]

  const summaryCards = [
    { label: "Selected Period", value: dashboard.summary.periodLeads, desc: "Leads captured in range", icon: BarChart3, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", border: "hover:border-amber-500/40" },
    { label: "All Time", value: dashboard.summary.totalLeads, desc: "Total stored leads", icon: Users, color: "text-primary", bg: "bg-primary/10", border: "hover:border-primary/40" },
    { label: "Unique Emails", value: dashboard.summary.uniqueEmails, desc: "Deduplicated email count", icon: Mail, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10", border: "hover:border-sky-500/40" },
    { label: "Pages Converting", value: dashboard.summary.convertingPages, desc: "Pages with at least one lead", icon: MousePointerClick, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", border: "hover:border-emerald-500/40" }
  ]

  return (
    <main className="space-y-8 pb-12">
      
      {/* Header & Controls */}
      <div className="flex flex-col justify-between gap-6 border-b border-border pb-6 lg:flex-row lg:items-end">
        <div>
          <p className="eyebrow text-primary">Lead Capture</p>
          <h1 className="mt-1 flex items-center gap-3 font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Megaphone className="h-5 w-5" />
            </span>
            Website Lead Performance
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Analyze subscriber attribution and conversion metrics from your public lead popups and blog PDF offers.
          </p>
        </div>
        
        <form className="flex flex-wrap items-end gap-3">
          <label className="block w-full sm:w-auto">
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Date Range</span>
            <PremiumPicker name="days" defaultValue={String(days)} options={dayOptions} className="sm:w-48" />
          </label>
          <button className="btn-primary w-full justify-center shadow-sm sm:w-auto" type="submit">
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </button>
        </form>
      </div>

      <MetaAdsConnectionCard />

      <MetaAdsCampaignBuilder isOwner={session.isOwner} />

      {/* Summary Metrics */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <article 
            key={card.label} 
            className={`group flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5 ${card.border}`}
          >
            <div className="flex items-center justify-between gap-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {card.label}
              </p>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${card.bg} ${card.color} transition-transform group-hover:scale-110`}>
                <card.icon className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-6">
              <p className="font-heading text-4xl font-black text-foreground">
                {formatNumber(card.value)}
              </p>
              <p className="mt-1.5 text-xs font-medium text-muted-foreground">
                {card.desc}
              </p>
            </div>
          </article>
        ))}
      </section>

      {/* Primary Charts */}
      <section className="grid gap-6 xl:grid-cols-3">
        <article className="rounded-2xl border border-border bg-card p-6 shadow-sm xl:col-span-2">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-black text-foreground">Daily Lead Trend</h2>
              <p className="text-xs font-medium text-muted-foreground">Subscribers captured per day across all channels.</p>
            </div>
          </div>
          <DailyChart rows={dashboard.daily} />
        </article>
        
        <article className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Megaphone className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-black text-foreground">Top Sources</h2>
              <p className="text-xs font-medium text-muted-foreground">UTM source & popup tracking.</p>
            </div>
          </div>
          <BarList rows={dashboard.sources} emptyText="No source data found for this period." />
        </article>
      </section>

      {/* Secondary Charts */}
      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-black text-foreground">Top Converting Pages</h2>
              <p className="text-xs font-medium text-muted-foreground">Pages where forms generated leads.</p>
            </div>
          </div>
          <BarList rows={dashboard.pages} emptyText="No page data found for this period." />
        </article>
        
        <article className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Megaphone className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-black text-foreground">Campaigns</h2>
              <p className="text-xs font-medium text-muted-foreground">UTM campaign performance.</p>
            </div>
          </div>
          <BarList rows={dashboard.campaigns} emptyText="No campaign data found for this period." />
        </article>
      </section>

      {/* Recent Leads Ledger */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-muted/20 p-6 sm:p-8">
          <p className="eyebrow text-primary">Ledger</p>
          <h2 className="mt-1 font-heading text-xl font-bold text-foreground">Recent Leads</h2>
          <p className="mt-1 text-sm text-muted-foreground">Latest subscriber records with full attribution breakdown.</p>
        </div>
        
        <div className="max-h-[42rem] overflow-auto">
          <table className="w-full min-w-[86rem] text-left text-sm whitespace-nowrap">
            <thead className="sticky top-0 z-10 border-b border-border bg-card/90 backdrop-blur-sm">
              <tr>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Lead Profile</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Capture Page</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Traffic Source</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Campaign</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Lead Magnet</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Referrer</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Date Captured</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {dashboard.recentLeads.length ? dashboard.recentLeads.map((lead) => (
                <tr key={lead.leadUuid} className="transition-colors hover:bg-muted/5">
                  <td className="px-6 py-4">
                    <p className="font-heading font-bold text-foreground">{lead.firstName || "No name provided"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{lead.email}</p>
                  </td>
                  <td className="px-6 py-4">
                    {lead.pageUrl ? (
                      <Link 
                        href={lead.pageUrl} 
                        target="_blank" 
                        className="inline-flex items-center gap-1.5 font-bold text-primary transition-colors hover:text-primary/80"
                      >
                        {lead.pathname || "/"} <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    ) : (
                      <p className="font-bold text-foreground">{lead.pathname || "/"}</p>
                    )}
                    <p className="mt-1.5 inline-flex items-center rounded bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {lead.pageType || "site"}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-bold text-foreground">{lead.utmSource || lead.source || "direct / unknown"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Medium: {lead.utmMedium || "-"}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium text-foreground">{lead.utmCampaign || "-"}</span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-bold text-foreground truncate max-w-[200px]" title={lead.leadMagnetTitle || ""}>
                      {lead.leadMagnetTitle || "-"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground truncate max-w-[200px]">
                      {lead.leadMagnetSlug || lead.leadTrack || "-"}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="max-w-[200px] truncate text-xs text-muted-foreground" title={lead.referrer || ""}>
                      {lead.referrer || "-"}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-muted-foreground">
                    {formatDate(lead.createdAt)}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm font-semibold text-muted-foreground">
                    No leads captured during this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      
    </main>
  )
}
