import { Suspense } from "react"
import { CalendarClock, CreditCard, Globe2, Plus, ShieldCheck } from "lucide-react"

import { DomainRegistrationService } from "@/components/domains/DomainRegistrationService"
import { DomainPreferenceToggle } from "@/components/student-dashboard/DomainPreferenceToggle"
import { DomainRetryButton } from "@/components/student-dashboard/DomainRetryButton"
import { OwnedDomainCard } from "@/components/student-dashboard/OwnedDomainCard"
import { EmptyStudentState, StudentDashboardCard, StudentDashboardShell } from "@/components/student-dashboard/StudentDashboardShell"
import { listStudentDomainOrders, listStudentDomains, statusLabel, statusTone } from "@/lib/student-dashboard"
import { requireStudent } from "@/lib/student-auth"
import { formatDate } from "@/lib/utils"

export const dynamic = "force-dynamic"

function formatMoney(currency: string | null, amountMinor: number | null) {
  if (!currency || !amountMinor) return "-"
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(amountMinor / 100)
  } catch {
    return `${currency} ${(amountMinor / 100).toFixed(2)}`
  }
}

export default async function StudentDomainsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = (await searchParams) || {}
  const renewalState = Array.isArray(query.renewal) ? query.renewal[0] : query.renewal
  const returnedDomain = Array.isArray(query.domain) ? query.domain[0] : query.domain
  const returnedOrder = Array.isArray(query.order) ? query.order[0] : query.order
  const session = await requireStudent()
  const [domains, orders] = await Promise.all([
    listStudentDomains(session.account.id),
    listStudentDomainOrders(session.account.id)
  ])
  const pendingOrder = orders.find((order) => ["registration_in_progress", "registration_failed"].includes(order.status.toLowerCase()))
  const registeredDomains = domains.filter((domain) => domain.status.toLowerCase() === "registered").length
  const nextRenewal = domains
    .map((domain) => domain.renewalDueAt)
    .filter((value): value is Date => Boolean(value))
    .sort((left, right) => left.getTime() - right.getTime())[0] || null

  let meta = `Showing ${domains.length} domain(s) for ${session.account.email}.`
  if (renewalState === "success") {
    meta = returnedDomain
      ? `Renewal payment confirmed for ${returnedDomain}. Your renewal due date has been updated.`
      : "Renewal payment confirmed. Your renewal due date has been updated."
  } else if (renewalState === "failed") {
    meta = "Renewal payment was not completed. Please try again."
  } else if (returnedDomain === "payment_confirmed") {
    meta = returnedOrder
      ? `Payment confirmed. We are now registering your domain (order ${returnedOrder}).`
      : "Payment confirmed. We are now registering your domain."
  } else if (returnedDomain === "registration_failed") {
    meta = "Payment succeeded, but domain registration is pending. Use Retry Registration on the order card."
  }

  return (
    <StudentDashboardShell account={session.account} active="domains" title="My Domains" eyebrow="Web Assets">
      <div className="grid gap-8">
        <StudentDashboardCard className="overflow-hidden bg-gradient-to-br from-card to-muted/30">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <div className="max-w-2xl">
              <p className="eyebrow text-primary">Domain Portfolio</p>
              <h2 className="mt-2 font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">Manage your domains in one place.</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{meta}</p>
            </div>
            <a href="#domainRegisterSection" className="btn-primary shrink-0 shadow-sm"><Plus className="mr-2 h-4 w-4" />Register New Domain</a>
          </div>
        </StudentDashboardCard>

        <section className="grid gap-4 sm:grid-cols-3">
          <StudentDashboardCard className="flex flex-col justify-between p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
            <div className="flex items-center justify-between gap-4"><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Domains</p><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Globe2 className="h-5 w-5" /></div></div>
            <p className="mt-6 font-heading text-3xl font-black text-foreground">{domains.length}</p>
          </StudentDashboardCard>
          <StudentDashboardCard className="flex flex-col justify-between p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
            <div className="flex items-center justify-between gap-4"><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Registered</p><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><ShieldCheck className="h-5 w-5" /></div></div>
            <p className="mt-6 font-heading text-3xl font-black text-foreground">{registeredDomains}</p>
          </StudentDashboardCard>
          <StudentDashboardCard className="flex flex-col justify-between p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
            <div className="flex items-center justify-between gap-4"><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Next Renewal</p><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400"><CalendarClock className="h-5 w-5" /></div></div>
            <p className="mt-6 font-heading text-lg font-black text-foreground">{nextRenewal ? formatDate(nextRenewal) : "Not scheduled"}</p>
          </StudentDashboardCard>
        </section>

        <DomainPreferenceToggle initialEnabled={session.account.domainsAutoRenewEnabled} />

        <div>
          <Suspense fallback={<div className="rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground sm:p-8">Loading domain registration…</div>}>
            <DomainRegistrationService
              embedded
              account={{
                fullName: session.account.fullName,
                email: session.account.email,
                autoRenew: session.account.domainsAutoRenewEnabled
              }}
            />
          </Suspense>
        </div>

        <section>
          <div className="mb-6 flex items-end justify-between gap-4"><div><p className="eyebrow text-primary">Portfolio</p><h3 className="mt-1 font-heading text-2xl font-black text-foreground">Owned Domains</h3></div>{domains.length ? <span className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-bold text-muted-foreground">{domains.length} total</span> : null}</div>
          <div className="grid gap-5">
            {domains.length ? domains.map((domain) => (
              <OwnedDomainCard
                key={domain.domainName}
                domain={{
                  domainName: domain.domainName,
                  provider: domain.provider,
                  status: domain.status,
                  registeredAt: domain.registeredAt,
                  renewalDueAt: domain.renewalDueAt,
                  createdAt: domain.createdAt,
                  purchaseCurrency: domain.purchaseCurrency,
                  purchaseAmountMinor: domain.purchaseAmountMinor,
                  selectedServices: domain.selectedServices,
                  autoRenewEnabled: domain.autoRenewEnabled
                }}
              />
            )) : (
              <StudentDashboardCard><EmptyStudentState icon="globe" title={pendingOrder ? "Domain registration is being processed" : "No domain purchased yet"} description={pendingOrder ? "Your payment is confirmed. Once registration completes, your domain will appear here." : "Register your first domain to see renewal tracking here."} action={pendingOrder?.orderUuid ? <DomainRetryButton orderUuid={pendingOrder.orderUuid} /> : <a className="btn-primary" href="#domainRegisterSection">Register Domain</a>} /></StudentDashboardCard>
            )}
          </div>
        </section>

        <StudentDashboardCard className="overflow-hidden p-0">
          <div className="flex items-center justify-between gap-4 border-b border-border bg-muted/20 p-6 sm:p-8"><div><p className="eyebrow text-primary">Billing</p><h3 className="mt-1 font-heading text-xl font-bold text-foreground">Recent Domain Orders</h3></div><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground"><CreditCard className="h-5 w-5" /></div></div>
          <div className="p-6 sm:p-8"><div className="grid gap-4">
            {orders.length ? orders.map((order) => {
              const canRetry = ["registration_in_progress", "registration_failed"].includes(order.status.toLowerCase())
              return (
                <article key={order.orderUuid || `${order.domainName}-${String(order.createdAt)}`} className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-background p-5 transition-colors hover:border-primary/20 sm:flex-row sm:items-center">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><p className="font-heading text-base font-bold text-foreground">{order.domainName}</p><span className={`inline-flex rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${statusTone(order.status)}`}>{statusLabel(order.status)}</span></div><p className="mt-2 text-xs font-medium text-muted-foreground">{formatMoney(order.purchaseCurrency, order.purchaseAmountMinor)} <span className="mx-2 text-border">•</span> {formatDate(order.createdAt)}</p><p className="mt-1 truncate text-xs text-muted-foreground">Order: {order.orderUuid || "-"} • Add-ons: {order.selectedServices.length ? order.selectedServices.join(", ") : "None"} • Auto-renew: {order.autoRenewEnabled ? "On" : "Off"}</p></div>
                  {canRetry && order.orderUuid ? <div className="shrink-0"><DomainRetryButton orderUuid={order.orderUuid} /></div> : null}
                </article>
              )
            }) : <EmptyStudentState icon="creditCard" title="No domain orders" description="Your domain purchases and renewal records will appear here." />}
          </div></div>
        </StudentDashboardCard>
      </div>
    </StudentDashboardShell>
  )
}
