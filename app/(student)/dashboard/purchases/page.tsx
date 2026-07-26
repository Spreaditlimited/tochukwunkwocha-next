import Link from "next/link"
import {
  ArrowRight,
  CheckCircle2,
  Download,
  ExternalLink,
  PackageOpen,
  ShoppingBag,
  Truck
} from "lucide-react"

import {
  EmptyStudentState,
  StudentDashboardCard,
  StudentDashboardShell
} from "@/components/student-dashboard/StudentDashboardShell"
import { formatShopMoney, listStudentShopOrders } from "@/lib/shop"
import { requireStudent } from "@/lib/student-auth"
import { formatDate } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function StudentPurchasesPage() {
  const session = await requireStudent()
  const orders = await listStudentShopOrders(session.account.id, session.account.email)
  const downloadCount = orders.reduce((total, order) => total + order.entitlements.length, 0)

  return (
    <StudentDashboardShell
      account={session.account}
      active="purchases"
      title="My Purchases"
      eyebrow="Order Library"
    >
      <StudentDashboardCard className="bg-gradient-to-br from-card to-muted/30">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="max-w-2xl">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <PackageOpen className="h-5 w-5" />
            </div>
            <p className="eyebrow text-primary">Your shop orders</p>
            <h2 className="mt-2 font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">
              Downloads and deliveries
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Download digital workbooks, track merchandise deliveries, and keep your receipts together.
            </p>
            {orders.length ? (
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs font-bold text-muted-foreground">
                  {orders.length} {orders.length === 1 ? "order" : "orders"}
                </span>
                <span className="rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs font-bold text-muted-foreground">
                  {downloadCount} {downloadCount === 1 ? "download" : "downloads"}
                </span>
              </div>
            ) : null}
          </div>
          <Link href="/dashboard/shop" className="btn-secondary group shrink-0 shadow-sm">
            <ShoppingBag className="h-4 w-4" />
            Browse the shop
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </StudentDashboardCard>

      <section className="mt-8 space-y-6">
        {orders.length ? (
          orders.map((order) => (
            <StudentDashboardCard key={order.orderUuid} className="overflow-hidden !p-0">
              <div className="flex flex-col gap-4 border-b border-border bg-muted/20 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-black uppercase tracking-wider text-primary">{order.orderNumber}</p>
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      Paid
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Purchased {formatDate(order.paidAt || order.createdAt)}
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Order total</p>
                  <p className="mt-1 font-heading text-xl font-black text-foreground">
                    {formatShopMoney(order.totalMinor, order.currency)}
                  </p>
                </div>
              </div>
              <div className="space-y-4 p-6">
                {order.items.map((item) => {
                  const entitlement = order.entitlements.find(
                    (candidate) => candidate.orderItemId === item.id
                  )
                  return (
                    <div key={item.itemUuid} className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-background p-5 sm:flex-row sm:items-center">
                      <div className="min-w-0">
                        <p className="font-heading text-base font-black text-foreground">{item.productTitleSnapshot}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{item.variantTitleSnapshot}</span>
                          <span aria-hidden="true">·</span>
                          <span>Quantity {item.quantity}</span>
                          <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                            {item.fulfillmentTypeSnapshot === "physical" ? "Merchandise" : "Digital"}
                          </span>
                        </div>
                      </div>
                      {entitlement ? (
                        <a href={`/api/shop/download/${entitlement.entitlementUuid}`} className="btn-primary shrink-0 shadow-sm">
                          <Download className="h-4 w-4" /> Download
                        </a>
                      ) : item.fulfillmentTypeSnapshot === "physical" ? (
                        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
                          <p className="inline-flex items-center gap-2 font-black text-foreground">
                            <Truck className="h-4 w-4 text-primary" />
                            {order.shipment?.status === "shipped" ? "Shipped" : order.shipment?.status === "delivered" ? "Delivered" : "Being prepared"}
                          </p>
                          {order.shipment?.trackingUrl ? (
                            <a href={order.shipment.trackingUrl} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 text-xs font-bold text-primary">
                              Track delivery <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </StudentDashboardCard>
          ))
        ) : (
          <EmptyStudentState
            icon="file"
            title="No shop purchases yet"
            description={`Products purchased with ${session.account.email} will appear here.`}
            action={(
              <Link href="/dashboard/shop" className="btn-primary">
                <ShoppingBag className="h-4 w-4" />
                Visit the shop
              </Link>
            )}
          />
        )}
      </section>
    </StudentDashboardShell>
  )
}
