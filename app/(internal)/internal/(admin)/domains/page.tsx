import { 
  Activity,
  AlertTriangle,
  Calendar, 
  CheckCircle2, 
  Clock, 
  CreditCard,
  Globe, 
  RefreshCw, 
  Save, 
  Server, 
  ShoppingCart
} from "lucide-react"

import { prisma } from "@/lib/prisma"
import { PremiumPicker } from "@/components/PremiumPicker"
import { formatMinorCurrency } from "@/lib/student-dashboard"
import { ensureDomainRequestTables } from "@/lib/student-domain-actions"
import { formatDate } from "@/lib/utils"
import { updateDomainDnsAction, updateDomainNetlifyStatusAction } from "./actions"

export const dynamic = "force-dynamic"

type DomainRow = {
  accountId: bigint
  email: string
  domainName: string
  provider: string | null
  status: string | null
  years: number | bigint | null
  purchaseCurrency: string | null
  purchaseAmountMinor: number | bigint | null
  providerOrderId: string | null
  registeredAt: Date | null
  renewalDueAt: Date | null
  netlifyEmail: string | null
  netlifyWorkspace: string | null
  netlifySiteName: string | null
  netlifyStatus: string | null
  updatedAt: Date | null
}

type OrderRow = {
  orderUuid: string
  email: string
  domainName: string
  provider: string | null
  status: string | null
  paymentProvider: string | null
  paymentStatus: string | null
  purchaseCurrency: string | null
  purchaseAmountMinor: number | bigint | null
  providerOrderId: string | null
  notes: string | null
  createdAt: Date | null
}

async function listDomains() {
  await ensureDomainRequestTables()
  return prisma.$queryRaw<DomainRow[]>`
    SELECT
      ud.account_id AS accountId,
      ud.email,
      ud.domain_name AS domainName,
      ud.provider,
      ud.status,
      ud.years,
      ud.purchase_currency AS purchaseCurrency,
      ud.purchase_amount_minor AS purchaseAmountMinor,
      ud.provider_order_id AS providerOrderId,
      ud.registered_at AS registeredAt,
      ud.renewal_due_at AS renewalDueAt,
      (
        SELECT n.netlify_email
        FROM tochukwu_user_domain_netlify_access n
        WHERE n.account_id = ud.account_id AND n.domain_name = ud.domain_name
        ORDER BY n.updated_at DESC
        LIMIT 1
      ) AS netlifyEmail,
      (
        SELECT n.netlify_workspace
        FROM tochukwu_user_domain_netlify_access n
        WHERE n.account_id = ud.account_id AND n.domain_name = ud.domain_name
        ORDER BY n.updated_at DESC
        LIMIT 1
      ) AS netlifyWorkspace,
      (
        SELECT n.netlify_site_name
        FROM tochukwu_user_domain_netlify_access n
        WHERE n.account_id = ud.account_id AND n.domain_name = ud.domain_name
        ORDER BY n.updated_at DESC
        LIMIT 1
      ) AS netlifySiteName,
      (
        SELECT n.status
        FROM tochukwu_user_domain_netlify_access n
        WHERE n.account_id = ud.account_id AND n.domain_name = ud.domain_name
        ORDER BY n.updated_at DESC
        LIMIT 1
      ) AS netlifyStatus,
      ud.updated_at AS updatedAt
    FROM user_domains ud
    ORDER BY ud.created_at DESC
    LIMIT 150
  `.catch(() => [])
}

async function listOrders() {
  await ensureDomainRequestTables()
  return prisma.$queryRaw<OrderRow[]>`
    SELECT
      order_uuid AS orderUuid,
      email,
      domain_name AS domainName,
      provider,
      status,
      payment_provider AS paymentProvider,
      payment_status AS paymentStatus,
      purchase_currency AS purchaseCurrency,
      purchase_amount_minor AS purchaseAmountMinor,
      provider_order_id AS providerOrderId,
      notes,
      created_at AS createdAt
    FROM domain_orders
    ORDER BY created_at DESC
    LIMIT 100
  `.catch(() => [])
}

function StatusPill({ status }: { status: string | null }) {
  const raw = String(status || "unknown").toLowerCase()
  let colorClass = "border-border bg-muted text-muted-foreground"
  
  if (raw === "registered" || raw === "connected" || raw === "paid" || raw === "success") {
    colorClass = "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
  } else if (raw === "submitted" || raw === "in_review" || raw === "pending" || raw === "needs_action") {
    colorClass = "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
  } else if (raw === "rejected" || raw === "failed") {
    colorClass = "border-destructive/20 bg-destructive/10 text-destructive"
  }

  return (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest shadow-sm ${colorClass}`}>
      {raw.replace(/_/g, " ")}
    </span>
  )
}

export default async function InternalDomainsPage() {
  const [domains, orders] = await Promise.all([listDomains(), listOrders()])
  const registered = domains.filter((domain) => String(domain.status || "").toLowerCase() === "registered").length
  const renewalsDue = domains.filter((domain) => domain.renewalDueAt && new Date(domain.renewalDueAt).getTime() <= Date.now() + 30 * 24 * 60 * 60 * 1000).length
  const netlifyStatusOptions = [
    { value: "submitted", label: "Submitted" },
    { value: "in_review", label: "In Review" },
    { value: "connected", label: "Connected" },
    { value: "needs_action", label: "Needs Action" },
    { value: "rejected", label: "Rejected" }
  ]
  const dnsTypeOptions = ["A", "CNAME", "TXT", "MX"].map((type) => ({ value: type, label: type }))

  return (
    <main className="space-y-8 pb-12">
      
      {/* Header */}
      <div className="flex flex-col gap-6 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow text-primary">Infrastructure Operations</p>
          <h1 className="mt-1 font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Domain Registrar & DNS
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Manage provisioned domains, track registrar renewals, update DNS records, and review Netlify site integrations.
          </p>
        </div>
      </div>

      {/* Primary Pulse Metrics */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="group flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Portfolio</p>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-110">
              <Globe className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-6 font-heading text-4xl font-black text-foreground">{domains.length}</p>
        </div>
        
        <div className="group flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Successfully Registered</p>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 transition-transform group-hover:scale-110 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-6 font-heading text-4xl font-black text-foreground">{registered}</p>
        </div>

        <div className={`group flex flex-col justify-between rounded-xl border p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
          renewalsDue > 0 
            ? "border-rose-500/30 bg-rose-500/5 hover:border-rose-500/50 hover:shadow-rose-500/10" 
            : "border-border bg-card hover:border-primary/40 hover:shadow-primary/5"
        }`}>
          <div className="flex items-center justify-between gap-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Renewals Due (30d)</p>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-110 ${
              renewalsDue > 0 ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : "bg-muted text-muted-foreground"
            }`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-6 font-heading text-4xl font-black text-foreground">{renewalsDue}</p>
        </div>
      </section>

      {/* Active Domains Directory */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Registered Portfolio & Netlify Integration
          </h2>
        </div>
        
        <div className="grid gap-6">
          {domains.length ? domains.map((domain) => (
            <article key={`${domain.accountId}-${domain.domainName}`} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:border-primary/20">
              
              <div className="flex flex-col gap-0 lg:flex-row">
                {/* Domain Registration Profile (Left Pane) */}
                <div className="flex-1 p-6 sm:p-8">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <StatusPill status={domain.status} />
                    <span className="inline-flex rounded-md border border-border bg-muted/50 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground shadow-sm">
                      {domain.provider || "Unknown Provider"}
                    </span>
                  </div>
                  
                  <h3 className="font-heading text-2xl font-black text-foreground">{domain.domainName}</h3>
                  <p className="mt-1 font-medium text-muted-foreground">{domain.email}</p>
                  
                  <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-border bg-muted/10 p-5 lg:grid-cols-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Financials</p>
                      <p className="mt-1 font-heading text-sm font-black text-foreground">
                        {domain.purchaseAmountMinor ? formatMinorCurrency(domain.purchaseCurrency || "NGN", Number(domain.purchaseAmountMinor)) : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Term</p>
                      <p className="mt-1 font-heading text-sm font-black text-foreground">{Number(domain.years || 1)} Year(s)</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Provider ID</p>
                      <p className="mt-1 truncate font-mono text-sm font-bold text-muted-foreground" title={domain.providerOrderId || "None"}>
                        {domain.providerOrderId || "None"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Registered</p>
                      <p className="mt-1 font-heading text-sm font-bold text-muted-foreground">{formatDate(domain.registeredAt)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Renewal</p>
                      <p className={`mt-1 font-heading text-sm font-bold ${
                        domain.renewalDueAt && new Date(domain.renewalDueAt).getTime() <= Date.now() + 30 * 24 * 60 * 60 * 1000 
                          ? "text-rose-600 dark:text-rose-400" 
                          : "text-muted-foreground"
                      }`}>
                        {formatDate(domain.renewalDueAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Last Updated</p>
                      <p className="mt-1 font-heading text-sm font-bold text-muted-foreground">{formatDate(domain.updatedAt)}</p>
                    </div>
                  </div>
                </div>

                {/* Netlify Workspace (Right Pane) */}
                <div className="border-t border-border bg-muted/10 p-6 sm:p-8 lg:w-[400px] lg:shrink-0 lg:border-l lg:border-t-0">
                  <div className="flex items-center gap-2 mb-4">
                    <Server className="h-4 w-4 text-primary" />
                    <h4 className="font-heading text-sm font-bold uppercase tracking-widest text-muted-foreground">Netlify Configuration</h4>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Target Workspace</p>
                      <p className="mt-1 break-all font-mono text-xs font-semibold text-primary">{domain.netlifyWorkspace || "Not configured"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Site Name</p>
                      <p className="mt-1 font-medium text-foreground">{domain.netlifySiteName || "Not configured"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Access Email</p>
                      <p className="mt-1 text-xs text-muted-foreground">{domain.netlifyEmail || "Not configured"}</p>
                    </div>
                    
                    {domain.netlifyStatus && (
                      <form action={updateDomainNetlifyStatusAction} className="mt-6 rounded-xl border border-border bg-background p-4 shadow-inner">
                        <input type="hidden" name="accountId" value={String(domain.accountId)} />
                        <input type="hidden" name="domainName" value={domain.domainName} />
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Integration Status</p>
                        <div className="flex gap-2">
                          <PremiumPicker name="status" defaultValue={domain.netlifyStatus || "submitted"} options={netlifyStatusOptions} className="min-w-0 flex-1 [&>select]:h-10 [&>select]:text-xs" />
                          <button className="btn-secondary px-4 text-xs shadow-sm" type="submit">Save</button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              </div>

              {/* DNS Update Action Bar */}
              <div className="border-t border-border bg-card p-6 sm:p-8">
                <form action={updateDomainDnsAction}>
                  <input type="hidden" name="accountId" value={String(domain.accountId)} />
                  <input type="hidden" name="domainName" value={domain.domainName} />
                  
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                    <div className="grid flex-1 gap-4 sm:grid-cols-[100px_1fr_2fr_100px]">
                      <label className="block">
                        <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Type</span>
                        <PremiumPicker name="type" options={dnsTypeOptions} />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Host</span>
                        <input name="host" placeholder="@ or www" className="w-full rounded-lg border border-input bg-background/50 px-3 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary shadow-sm" />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Record Value</span>
                        <input name="value" placeholder="192.168.1.1" className="w-full rounded-lg border border-input bg-background/50 px-3 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary shadow-sm" />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">TTL</span>
                        <input name="ttl" defaultValue="3600" className="w-full rounded-lg border border-input bg-background/50 px-3 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary shadow-sm" />
                      </label>
                    </div>
                    <button className="btn-primary w-full justify-center lg:w-auto" type="submit">
                      <Save className="mr-2 h-4 w-4" /> Push DNS Update
                    </button>
                  </div>
                </form>
              </div>
              
            </article>
          )) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/10 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Globe className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-heading text-lg font-bold text-foreground">No Domains Provisioned</h3>
              <p className="mt-1 text-sm text-muted-foreground">There are currently no active domain requests or registrations in the system.</p>
            </div>
          )}
        </div>
      </section>

      {/* Orders Ledger */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-muted/20 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-heading text-xl font-black text-foreground">Domain Acquisition Ledger</h2>
              <p className="mt-1 text-sm font-medium text-muted-foreground">Recent transactions and provider mapping for domain orders.</p>
            </div>
          </div>
        </div>
        
        <div className="max-h-[500px] overflow-auto bg-background scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20">
          <table className="w-full min-w-[74rem] text-left text-sm whitespace-nowrap">
            <thead className="sticky top-0 z-10 border-b border-border bg-card/90 text-[10px] font-bold uppercase tracking-widest text-muted-foreground backdrop-blur-md">
              <tr>
                <th className="px-6 py-4">Target Domain</th>
                <th className="px-6 py-4">Registrant Account</th>
                <th className="px-6 py-4">Transaction Identity</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Financial Exchange</th>
                <th className="px-6 py-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.length ? orders.map((order) => (
                <tr key={order.orderUuid} className="transition-colors hover:bg-muted/5">
                  <td className="px-6 py-4">
                    <p className="font-heading font-bold text-foreground">{order.domainName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{order.provider || "Manual/Unknown"}</p>
                  </td>
                  <td className="px-6 py-4 font-medium text-foreground">
                    {order.email}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-mono text-[10px] font-semibold text-muted-foreground">{order.orderUuid}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CreditCard className="h-3 w-3" /> {order.paymentProvider || "direct"}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1.5">
                      <StatusPill status={order.status} />
                      <span className="w-fit inline-flex rounded bg-muted/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {order.paymentStatus || "Unknown"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-heading text-sm font-black text-foreground">
                    {order.purchaseAmountMinor ? formatMinorCurrency(order.purchaseCurrency || "NGN", Number(order.purchaseAmountMinor)) : "Not recorded"}
                  </td>
                  <td className="px-6 py-4 text-right text-xs font-medium text-muted-foreground">
                    {formatDate(order.createdAt)}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm font-semibold text-muted-foreground">
                    No recent domain registration orders found in the ledger.
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
