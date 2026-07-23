import { 
  Activity,
  Banknote, 
  CheckCircle2, 
  Coins,
  Network, 
  ReceiptText, 
  ShieldCheck,
  Wallet
} from "lucide-react"

import { PremiumPicker } from "@/components/PremiumPicker"
import { DashboardStatCard, DashboardStatsVisibility } from "@/components/dashboard/DashboardStatsVisibility"
import { listAffiliateAdminData } from "@/lib/admin-affiliates"
import { formatDate } from "@/lib/utils"
import { runAffiliatePayoutBatchAction, saveAffiliateCourseRuleAction } from "./actions"

export const dynamic = "force-dynamic"

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function param(params: Record<string, string | string[] | undefined>, key: string, fallback = "") {
  const value = params[key]
  return Array.isArray(value) ? value[0] || fallback : value || fallback
}

function money(minor: number, currency: string) {
  const ccy = String(currency || "NGN").toUpperCase()
  try {
    return new Intl.NumberFormat(ccy === "USD" ? "en-US" : "en-NG", { style: "currency", currency: ccy }).format(Number(minor || 0) / 100)
  } catch {
    return `${ccy} ${(Number(minor || 0) / 100).toLocaleString()}`
  }
}

function metadataText(value: Record<string, unknown>) {
  return [
    value.courseSlug ? `course=${String(value.courseSlug)}` : "",
    value.affiliateCodeResolved ? `aff=${String(value.affiliateCodeResolved)}` : "",
    value.affiliateCode ? `aff=${String(value.affiliateCode)}` : "",
    Number(value.commissionAmountMinor || 0) > 0 ? `commission_minor=${String(value.commissionAmountMinor)}` : ""
  ].filter(Boolean).join(" | ") || "-"
}

export default async function InternalAffiliatesPage({ searchParams }: PageProps) {
  const params = await searchParams || {}
  const sort = param(params, "sort", "latest_desc")
  const payoutRaw = param(params, "payout", "")
  const data = await listAffiliateAdminData(sort)
  const courseOptions = data.courses.map((course) => ({ value: course.slug, label: course.label || course.slug }))
  const periodModeOptions = [
    { value: "month_end", label: "Month End (Processes Previous Month)" },
    { value: "custom", label: "Custom Period Window" }
  ]
  const sortOptions = [
    { value: "latest_desc", label: "Latest commission first" },
    { value: "latest_asc", label: "Oldest commission first" },
    { value: "earned_desc", label: "Highest earned first" },
    { value: "approved_desc", label: "Highest approved first" },
    { value: "paid_desc", label: "Highest paid first" }
  ]
  
  let payoutResult: Record<string, unknown> | null = null
  try {
    payoutResult = payoutRaw ? JSON.parse(payoutRaw) : null
  } catch {
    payoutResult = null
  }

  return (
    <main className="space-y-8 pb-12">
      
      {/* Header */}
      <div className="flex flex-col gap-6 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow text-primary">Revenue</p>
          <h1 className="mt-1 font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Affiliate Operations
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Configure partner commission rules, orchestrate payout batches, review aggregate earnings, and audit real-time attribution events.
          </p>
        </div>
      </div>

      {/* Payout Result Alert */}
      {payoutResult && (
        <section className="overflow-hidden rounded-xl border border-primary/30 bg-primary/5 shadow-sm">
          <div className="flex items-center gap-3 border-b border-primary/20 bg-primary/10 p-4">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <h2 className="font-heading text-sm font-bold text-foreground">Payout Batch Execution Result</h2>
          </div>
          <div className="p-4">
            <pre className="max-h-96 overflow-auto rounded-lg border border-primary/20 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700">
              {JSON.stringify(payoutResult, null, 2)}
            </pre>
          </div>
        </section>
      )}

      <div className="grid gap-8 xl:grid-cols-2 xl:items-start">
        
        {/* Course Rules Module */}
        <section className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm xl:h-full">
          <div className="flex flex-col justify-between gap-4 border-b border-border bg-muted/20 p-6 sm:flex-row sm:items-start sm:p-8">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-heading text-xl font-black text-foreground">Course Rules</h2>
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  Define global commission logic per programme.
                </p>
              </div>
            </div>
            <div className="shrink-0 rounded-lg border border-border bg-background px-3 py-1.5 text-center shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Active Rules</p>
              <p className="font-heading text-lg font-black text-foreground">{data.rules.length}</p>
            </div>
          </div>
          
          <form action={saveAffiliateCourseRuleAction} className="border-b border-border p-6 sm:p-8">
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              <label className="block lg:col-span-2">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Programme</span>
                <PremiumPicker name="courseSlug" options={courseOptions} />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Eligibility</span>
                <PremiumPicker
                  name="isAffiliateEligible"
                  defaultValue="1"
                  options={[
                    { value: "1", label: "Eligible" },
                    { value: "0", label: "Not Eligible" }
                  ]}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Type</span>
                <PremiumPicker
                  name="commissionType"
                  defaultValue="percentage"
                  options={[
                    { value: "percentage", label: "Percentage (bps)" },
                    { value: "fixed", label: "Fixed (minor)" }
                  ]}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Value (1000 = 10%)</span>
                <input name="commissionValue" type="number" min="0" step="1" placeholder="e.g. 1000" className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Currency</span>
                <input name="commissionCurrency" defaultValue="NGN" placeholder="NGN" className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Min Order (Minor)</span>
                <input name="minOrderAmountMinor" type="number" min="0" step="1" placeholder="e.g. 1000000" className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Hold Days</span>
                <input name="holdDays" type="number" min="0" step="1" defaultValue="30" placeholder="30" className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
              </label>
              <div className="flex items-end">
                <button className="btn-primary w-full justify-center shadow-sm" type="submit">
                  Save Rule
                </button>
              </div>
            </div>
          </form>

          <div className="relative flex-1 bg-background">
            <div className="absolute inset-0 max-h-[300px] overflow-auto sm:max-h-none scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20">
              <table className="w-full min-w-[56rem] text-left text-xs whitespace-nowrap">
                <thead className="sticky top-0 z-10 border-b border-border bg-muted/90 uppercase tracking-widest text-muted-foreground backdrop-blur-md">
                  <tr>
                    <th className="px-6 py-3">Course</th>
                    <th className="px-6 py-3">Eligible</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Value</th>
                    <th className="px-6 py-3">Hold Days</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.rules.length ? data.rules.map((rule) => (
                    <tr key={rule.courseSlug} className="transition-colors hover:bg-muted/5">
                      <td className="px-6 py-3.5 font-mono text-[11px] font-bold text-foreground">{rule.courseSlug}</td>
                      <td className="px-6 py-3.5">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${rule.isAffiliateEligible ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                          {rule.isAffiliateEligible ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-medium text-foreground">{rule.commissionType}</td>
                      <td className="px-6 py-3.5">
                        <span className="font-heading font-black text-foreground">{rule.commissionValue}</span>
                        <span className="ml-1 text-[10px] font-bold text-muted-foreground">{rule.commissionCurrency}</span>
                      </td>
                      <td className="px-6 py-3.5 font-mono text-muted-foreground">{rule.holdDays}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-sm font-semibold text-muted-foreground">No affiliate rules established.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Payout Batch Module */}
        <section className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm xl:h-full">
          <div className="flex items-center gap-3 border-b border-border bg-muted/20 p-6 sm:p-8">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Banknote className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-heading text-xl font-black text-foreground">Run Payout Batch</h2>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                Process matured commissions for payout orchestration.
              </p>
            </div>
          </div>
          
          <form action={runAffiliatePayoutBatchAction} className="p-6 sm:p-8">
            <div className="grid gap-5 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Period Mode</span>
                <PremiumPicker name="periodMode" defaultValue="month_end" options={periodModeOptions} />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Start Date (Custom)</span>
                <input name="periodStart" placeholder="YYYY-MM-DD" className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">End Date (Custom)</span>
                <input name="periodEnd" placeholder="YYYY-MM-DD" className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Scheduled Execution Date</span>
                <input name="scheduledFor" placeholder="YYYY-MM-DD (Defaults to immediate)" className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Target Country Code</span>
                <input name="countryCode" defaultValue="NG" className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Target Currency</span>
                <input name="currency" defaultValue="NGN" className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Payout Provider Configuration</span>
                <input name="payoutProvider" defaultValue="paystack" className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
              </label>
              <div className="pt-2 md:col-span-2">
                <button className="btn-primary w-full justify-center shadow-sm" type="submit">
                  Execute Batch Process
                </button>
              </div>
            </div>
          </form>
        </section>

      </div>

      {/* Affiliate Commission Summary */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-muted/20 p-6 sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ReceiptText className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-heading text-xl font-black text-foreground">Commission Summary</h2>
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  Partner earnings aggregated by payout status.
                </p>
              </div>
            </div>
            <form className="shrink-0 w-full sm:w-auto">
              <PremiumPicker name="sort" defaultValue={sort} options={sortOptions} className="sm:w-64" />
              <button className="mt-2 w-full rounded-lg border border-border bg-card px-4 py-2 text-xs font-black uppercase tracking-widest text-muted-foreground transition hover:border-primary/40 hover:bg-primary/10 hover:text-primary sm:w-auto" type="submit">
                Apply sort
              </button>
            </form>
          </div>

          <DashboardStatsVisibility storageKey="tochukwu-internal-affiliates-stats">
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.commissionSummary.totalsByCurrency.length ? data.commissionSummary.totalsByCurrency.map((item) => (
              <DashboardStatCard key={item.currency} statKey={`${item.currency} commissions`} label={`${item.currency} Total Earned`}
                value={<><span className="block">{money(item.earnedMinor, item.currency)}</span><span className="mt-2 block text-[10px] uppercase tracking-widest text-muted-foreground">Approved: {money(item.approvedMinor, item.currency)} · Paid: {money(item.paidMinor, item.currency)}</span></>}
                icon={<Wallet className="h-4 w-4" />} className="bg-background" valueClassName="text-2xl" />
            )) : (
              <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 sm:col-span-2 lg:col-span-4">
                <p className="text-sm font-semibold text-muted-foreground">No affiliate commissions recorded yet.</p>
              </div>
            )}
          </div>
          </DashboardStatsVisibility>
        </div>

        <div className="max-h-[600px] overflow-auto bg-background scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20">
          <table className="w-full min-w-[74rem] text-left text-sm whitespace-nowrap">
            <thead className="sticky top-0 z-10 border-b border-border bg-card/90 text-[10px] font-bold uppercase tracking-widest text-muted-foreground backdrop-blur-md">
              <tr>
                <th className="px-6 py-4">Affiliate Partner</th>
                <th className="px-6 py-4">Affiliate Code</th>
                <th className="px-6 py-4">Total Earned</th>
                <th className="px-6 py-4">Approved</th>
                <th className="px-6 py-4">Paid</th>
                <th className="px-6 py-4">Pending</th>
                <th className="px-6 py-4">Blocked</th>
                <th className="px-6 py-4">Txn Count</th>
                <th className="px-6 py-4">Latest Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.commissionSummary.affiliates.length ? data.commissionSummary.affiliates.map((item) => (
                <tr key={`${item.profileId}-${item.currency}`} className="transition-colors hover:bg-muted/5">
                  <td className="px-6 py-4">
                    <p className="font-heading font-bold text-foreground">{item.fullName || "Unknown Affiliate"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.email || `Account #${item.accountId}`}</p>
                  </td>
                  <td className="px-6 py-4 font-mono text-[11px] font-semibold text-foreground">
                    <span className="rounded bg-muted/50 px-2 py-1">{item.affiliateCode}</span>
                  </td>
                  <td className="px-6 py-4 font-heading text-sm font-black text-foreground">{money(item.earnedMinor, item.currency)}</td>
                  <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-semibold">{money(item.approvedMinor, item.currency)}</td>
                  <td className="px-6 py-4 text-primary font-semibold">{money(item.paidMinor, item.currency)}</td>
                  <td className="px-6 py-4 text-amber-600 dark:text-amber-400">{money(item.pendingMinor, item.currency)}</td>
                  <td className="px-6 py-4 text-destructive">{money(item.blockedMinor, item.currency)}</td>
                  <td className="px-6 py-4 font-mono text-muted-foreground">{item.totalCount}</td>
                  <td className="px-6 py-4 text-xs font-medium text-muted-foreground">{formatDate(item.latestCommissionAt)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center">
                    <div className="mx-auto flex flex-col items-center justify-center">
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <Coins className="h-6 w-6" />
                      </div>
                      <h3 className="font-heading text-lg font-bold text-foreground">No Partners Found</h3>
                      <p className="mt-1 text-sm text-muted-foreground">There is no commission data available to display.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Attribution Audit Ledger */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-muted/20 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Network className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-heading text-xl font-black text-foreground">Attribution Audit Trail</h2>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                Chronological ledger of affiliate clicks, session resolution, and commission evaluations.
              </p>
            </div>
          </div>
        </div>

        <div className="max-h-[600px] overflow-auto bg-background scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20">
          <table className="w-full min-w-[74rem] text-left text-sm whitespace-nowrap">
            <thead className="sticky top-0 z-10 border-b border-border bg-card/90 text-[10px] font-bold uppercase tracking-widest text-muted-foreground backdrop-blur-md">
              <tr>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Event Type</th>
                <th className="px-6 py-4">Target Entity</th>
                <th className="px-6 py-4">Resolution / Reason</th>
                <th className="px-6 py-4">Extracted Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.audit.length ? data.audit.map((item) => {
                const reason = String(item.metadata.reason || item.metadata.rejectionReason || item.metadata.attributionStatus || "")
                const target = [item.targetType, item.targetId].filter(Boolean).join(": ")
                const isError = reason.toLowerCase().includes("fail") || reason.toLowerCase().includes("reject") || reason.toLowerCase().includes("not_eligible")
                
                return (
                  <tr key={item.id} className="transition-colors hover:bg-muted/5">
                    <td className="px-6 py-4 text-xs font-medium text-muted-foreground">{formatDate(item.createdAt)}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex rounded-md bg-muted/50 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-foreground">
                        {item.eventType}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-[11px] text-muted-foreground">{target || "-"}</td>
                    <td className="px-6 py-4">
                      {reason ? (
                        <span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${isError ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                          {reason}
                        </span>
                      ) : "-"}
                    </td>
                    <td className="px-6 py-4 font-mono text-[10px] leading-relaxed text-muted-foreground">
                      {metadataText(item.metadata)}
                    </td>
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="mx-auto flex flex-col items-center justify-center">
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <Activity className="h-6 w-6" />
                      </div>
                      <h3 className="font-heading text-lg font-bold text-foreground">No Audit Logs</h3>
                      <p className="mt-1 text-sm text-muted-foreground">System has not recorded any attribution events.</p>
                    </div>
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
