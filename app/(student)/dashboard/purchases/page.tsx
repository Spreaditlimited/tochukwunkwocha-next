import Link from "next/link"
import { Download, ExternalLink, PackageOpen, Truck } from "lucide-react"

import {
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

  return (
    <StudentDashboardShell
      account={session.account}
      active="purchases"
      title="My Purchases"
      eyebrow="Order Library"
    >
      <StudentDashboardCard>
        <p className="eyebrow text-primary">Your shop orders</p>
        <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="font-heading text-2xl font-black text-foreground">Downloads and deliveries</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Download digital workbooks, check printed-order progress, and keep your receipts together.
            </p>
          </div>
          <Link href="/dashboard/shop" className="btn-secondary shrink-0">Browse the shop</Link>
        </div>
      </StudentDashboardCard>

      <section className="mt-6 space-y-5">
        {orders.length ? (
          orders.map((order) => (
            <StudentDashboardCard key={order.orderUuid}>
              <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-primary">{order.orderNumber}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Purchased {formatDate(order.paidAt || order.createdAt)}</p>
                </div>
                <p className="font-heading text-lg font-black text-foreground">
                  {formatShopMoney(order.totalMinor, order.currency)}
                </p>
              </div>
              <div className="mt-4 space-y-4">
                {order.items.map((item) => {
                  const entitlement = order.entitlements.find(
                    (candidate) => candidate.orderItemId === item.id
                  )
                  return (
                    <div key={item.itemUuid} className="flex flex-col justify-between gap-4 rounded-lg bg-muted/30 p-4 sm:flex-row sm:items-center">
                      <div>
                        <p className="text-sm font-black text-foreground">{item.productTitleSnapshot}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.variantTitleSnapshot} · Quantity {item.quantity}</p>
                      </div>
                      {entitlement ? (
                        <a href={`/api/shop/download/${entitlement.entitlementUuid}`} className="btn-primary shrink-0">
                          <Download className="h-4 w-4" /> Download
                        </a>
                      ) : item.fulfillmentTypeSnapshot === "physical" ? (
                        <div className="text-sm">
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
          <StudentDashboardCard className="text-center">
            <PackageOpen className="mx-auto h-10 w-10 text-primary" />
            <h2 className="mt-3 font-heading text-xl font-black text-foreground">No shop purchases yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">Products purchased with {session.account.email} will appear here.</p>
            <Link href="/dashboard/shop" className="btn-primary mt-5">Visit the shop</Link>
          </StudentDashboardCard>
        )}
      </section>
    </StudentDashboardShell>
  )
}
