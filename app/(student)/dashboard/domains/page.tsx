import Link from "next/link"
import {
  Calendar,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Globe,
  Network,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Settings
} from "lucide-react"

import { updateDomainAutoRenewAction } from "@/app/(student)/dashboard/actions"
import { DomainActionsPanel } from "@/components/student-dashboard/DomainActionsPanel"
import {
  EmptyStudentState,
  StudentDashboardCard,
  StudentDashboardShell
} from "@/components/student-dashboard/StudentDashboardShell"
import {
  formatMinorCurrency,
  listStudentDomainNetlifyAccess,
  listStudentDomainOrders,
  listStudentDomains,
  statusLabel,
  statusTone
} from "@/lib/student-dashboard"
import { requireStudent } from "@/lib/student-auth"
import { formatDate } from "@/lib/utils"

export const dynamic = "force-dynamic"

function serviceLabel(value: string) {
  return String(value || "").replace(/_/g, " ").replace(/-/g, " ")
}

function byDomain<T extends { domainName: string }>(items: T[]) {
  return new Map(items.map((item) => [item.domainName, item]))
}

export default async function StudentDomainsPage() {
  const session = await requireStudent()
  const domains = await listStudentDomains(session.account.id)
  const orders = await listStudentDomainOrders(session.account.id)
  const netlifyRows = await listStudentDomainNetlifyAccess(session.account.id)
  const netlifyByDomain = byDomain(netlifyRows)
  const activeDomains = domains.filter((domain) => domain.status.toLowerCase() === "registered").length
  const nextRenewal = domains
    .map((domain) => domain.renewalDueAt)
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => a.getTime() - b.getTime())[0] || null

  return (
    <StudentDashboardShell
      account={session.account}
      active="domains"
      title="Domains"
      eyebrow="Web Assets"
    >
      <div className="grid gap-8">
        
        {/* 1. High-Level Metrics */}
        <section className="grid gap-4 sm:grid-cols-3">
          <StudentDashboardCard className="flex flex-col justify-between p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total Domains</p>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Globe className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-6">
              <p className="font-heading text-3xl font-black text-foreground">{domains.length}</p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">{activeDomains} registered</p>
            </div>
          </StudentDashboardCard>
          
          <StudentDashboardCard className="flex flex-col justify-between p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Recent Orders</p>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <CreditCard className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-6">
              <p className="font-heading text-3xl font-black text-foreground">{orders.length}</p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">Payments & requests</p>
            </div>
          </StudentDashboardCard>
          
          <StudentDashboardCard className="flex flex-col justify-between p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Next Renewal</p>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <RefreshCw className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-6">
              <p className="font-heading text-2xl font-black text-foreground">{nextRenewal ? formatDate(nextRenewal) : "Not scheduled"}</p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">Based on registered domains</p>
            </div>
          </StudentDashboardCard>
        </section>

        {/* 2. Portfolio Management & Preferences (Split Card) */}
        <StudentDashboardCard className="p-0 overflow-hidden">
          <div className="grid lg:grid-cols-[1fr_0.8fr]">
            <div className="p-6 sm:p-8">
              <p className="eyebrow text-primary">Domain Portfolio</p>
              <h2 className="mt-2 font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                Manage your digital real estate.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Your purchased domains, pending orders, renewal preferences, and Netlify connection requests live here.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/services/domain-registration" className="btn-primary">
                  <Search className="mr-2 h-4 w-4" /> Register New Domain
                </Link>
                <a href="#owned-domains" className="btn-secondary">
                  <Globe className="mr-2 h-4 w-4 text-muted-foreground" /> View Owned Domains
                </a>
              </div>
            </div>

            <div className="border-t border-border bg-muted/10 p-6 sm:p-8 lg:border-l lg:border-t-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Settings className="h-3.5 w-3.5" /> Domain Preferences
              </p>
              <h3 className="mt-3 font-heading text-lg font-black text-foreground">Auto-renew settings</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                This preference is used as the default when you register or renew domains from your account.
              </p>
              <form action={updateDomainAutoRenewAction} className="mt-6">
                <label className="group relative flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border bg-background p-5 transition-colors hover:border-primary/20">
                  <div>
                    <span className="block text-sm font-bold text-foreground">Auto-renew default</span>
                    <span className="mt-1 block text-xs font-medium text-muted-foreground">
                      {session.account.domainsAutoRenewEnabled ? "Currently enabled" : "Currently disabled"}
                    </span>
                  </div>
                  {/* Custom Toggle Switch */}
                  <div className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors">
                    <input
                      name="autoRenewEnabled"
                      type="checkbox"
                      defaultChecked={session.account.domainsAutoRenewEnabled}
                      className="peer sr-only"
                    />
                    <div className="h-6 w-11 rounded-full bg-muted-foreground/30 transition-colors peer-checked:bg-primary peer-focus:ring-2 peer-focus:ring-primary/30"></div>
                    <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5"></div>
                  </div>
                </label>
                <button type="submit" className="btn-secondary mt-4 w-full text-xs">
                  Save Preference
                </button>
              </form>
            </div>
          </div>
        </StudentDashboardCard>

        <DomainActionsPanel domains={domains.map((domain) => ({ domainName: domain.domainName, status: domain.status }))} />

        {/* 4. Owned Domains List */}
        <section id="owned-domains" className="mt-4 grid gap-6">
          <div>
            <p className="eyebrow text-primary">Owned Domains</p>
            <h2 className="mt-1 font-heading text-2xl font-black text-foreground">Your Domain Assets</h2>
          </div>

          {domains.length ? (
            <div className="grid gap-6">
              {domains.map((domain) => {
                const netlify = netlifyByDomain.get(domain.domainName)
                
                return (
                  <StudentDashboardCard key={domain.domainName} className="p-0 overflow-hidden">
                    <div className="grid xl:grid-cols-[1fr_320px]">
                      
                      {/* Domain Details (Left Pane) */}
                      <div className="p-6 sm:p-8">
                        <div className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-start">
                          <div>
                            <p className="font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                              {domain.domainName}
                            </p>
                            <p className="mt-2 text-sm font-medium text-muted-foreground">
                              {domain.provider || "Provider not recorded"} 
                              <span className="mx-2 text-border">•</span> 
                              {domain.years} year{domain.years === 1 ? "" : "s"}
                            </p>
                          </div>
                          <span className={`inline-flex w-fit items-center rounded-md border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest ${statusTone(domain.status)}`}>
                            {statusLabel(domain.status)}
                          </span>
                        </div>

                        {/* Grid Data */}
                        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                              <Calendar className="h-3 w-3" /> Registered
                            </p>
                            <p className="mt-2 text-sm font-semibold text-foreground">{formatDate(domain.registeredAt)}</p>
                          </div>
                          <div>
                            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                              <RefreshCw className="h-3 w-3" /> Renewal Due
                            </p>
                            <p className="mt-2 text-sm font-semibold text-foreground">{formatDate(domain.renewalDueAt)}</p>
                          </div>
                          <div>
                            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                              <CreditCard className="h-3 w-3" /> Purchase
                            </p>
                            <p className="mt-2 text-sm font-semibold text-foreground">
                              {domain.purchaseAmountMinor ? formatMinorCurrency(domain.purchaseCurrency, domain.purchaseAmountMinor) : "Not recorded"}
                            </p>
                          </div>
                          <div>
                            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                              <ShieldCheck className="h-3 w-3" /> Auto Renew
                            </p>
                            <p className={`mt-2 text-sm font-bold ${domain.autoRenewEnabled ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                              {domain.autoRenewEnabled ? "Enabled" : "Disabled"}
                            </p>
                          </div>
                        </div>

                        {/* Service Tags */}
                        {domain.selectedServices.length ? (
                          <div className="mt-6 pt-6 border-t border-border flex flex-wrap gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mr-2 flex items-center">
                              Attached Services:
                            </span>
                            {domain.selectedServices.map((service) => (
                              <span key={service} className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-bold capitalize text-foreground shadow-sm">
                                {serviceLabel(service)}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      {/* Technical Status (Right Pane) */}
                      <div className="border-t border-border bg-muted/10 p-6 sm:p-8 xl:border-l xl:border-t-0">
                        <div className="grid gap-6">
                          
                          {/* DNS Status */}
                          <div>
                            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                              <Network className="h-3.5 w-3.5" /> DNS Management
                            </p>
                            <div className="mt-3 rounded-lg border border-border bg-background p-4 shadow-sm">
                              <p className="text-xs leading-relaxed text-muted-foreground">
                                DNS records are managed by the internal team while the Next DNS editor is being migrated.
                              </p>
                              <p className="mt-3 border-t border-border pt-3 text-[10px] font-bold uppercase tracking-widest text-primary">
                                Last synced: {formatDate(domain.lastSyncedAt)}
                              </p>
                            </div>
                          </div>

                          {/* Netlify Connection */}
                          <div>
                            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                              <Server className="h-3.5 w-3.5" /> Netlify Connection
                            </p>
                            <div className="mt-3 rounded-lg border border-border bg-background p-4 shadow-sm">
                              {netlify ? (
                                <div className="space-y-3 text-sm">
                                  <div className="flex justify-between border-b border-border pb-2">
                                    <span className="text-muted-foreground">Status</span>
                                    <span className="font-bold text-foreground">{statusLabel(netlify.status)}</span>
                                  </div>
                                  <div className="flex justify-between border-b border-border pb-2">
                                    <span className="text-muted-foreground">Project</span>
                                    <span className="font-semibold text-foreground">{netlify.netlifySiteName}</span>
                                  </div>
                                  <div className="flex flex-col gap-1 pb-2">
                                    <span className="text-xs text-muted-foreground">Temporary Subdomain</span>
                                    <span className="font-mono text-xs text-primary">{netlify.netlifyWorkspace}</span>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs leading-relaxed text-muted-foreground">
                                  No Netlify connection request has been submitted for this domain.
                                </p>
                              )}
                            </div>
                          </div>

                        </div>
                      </div>

                    </div>
                  </StudentDashboardCard>
                )
              })}
            </div>
          ) : (
            <StudentDashboardCard>
              <EmptyStudentState
                icon="globe"
                title="No registered domains"
                description="Domains registered and connected to this student account will appear here."
                action={
                  <Link href="/services/domain-registration" className="btn-primary shadow-sm">
                    Search Domains
                  </Link>
                }
              />
            </StudentDashboardCard>
          )}
        </section>

        {/* 5. Recent Orders */}
        <StudentDashboardCard className="p-0 overflow-hidden">
          <div className="border-b border-border bg-muted/20 p-6 sm:p-8">
            <p className="eyebrow text-primary">Billing</p>
            <h2 className="mt-1 font-heading text-xl font-bold text-foreground">Recent Domain Orders</h2>
          </div>
          <div className="p-6 sm:p-8">
            {orders.length ? (
              <div className="grid gap-4">
                {orders.map((order) => (
                  <div
                    key={order.orderUuid || `${order.domainName}-${order.createdAt?.toISOString()}`}
                    className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-background p-5 transition-colors hover:border-primary/20 sm:flex-row sm:items-center"
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <p className="font-heading text-base font-bold text-foreground">{order.domainName}</p>
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${statusTone(order.paymentStatus || order.status)}`}>
                          {statusLabel(order.paymentStatus || order.status)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm font-medium text-muted-foreground">
                        {formatMinorCurrency(order.purchaseCurrency, order.purchaseAmountMinor || 0)} 
                        <span className="mx-2 text-border">•</span> 
                        {order.provider || "Provider not recorded"} 
                        <span className="mx-2 text-border">•</span> 
                        {formatDate(order.createdAt)}
                      </p>
                      {order.notes ? <p className="mt-3 text-xs italic text-muted-foreground border-l-2 border-primary/30 pl-3">{order.notes}</p> : null}
                    </div>
                    
                    <div className="flex shrink-0 items-center gap-2 text-sm font-semibold text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      {statusLabel(order.status)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyStudentState
                icon="creditCard"
                title="No domain orders"
                description="Domain checkout records and historical payments connected to this account will appear here."
              />
            )}
          </div>
        </StudentDashboardCard>

      </div>
    </StudentDashboardShell>
  )
}
