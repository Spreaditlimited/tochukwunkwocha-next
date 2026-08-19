import Link from "next/link"
import { ArrowRight, PackageOpen, ShoppingBag } from "lucide-react"

import {
  EmptyStudentState,
  StudentDashboardCard,
  StudentDashboardShell
} from "@/components/student-dashboard/StudentDashboardShell"
import { ShopProductCard } from "@/components/shop/ShopProductCard"
import { listPublishedShopProducts } from "@/lib/shop"
import { requireStudent } from "@/lib/student-auth"

export const dynamic = "force-dynamic"

export default async function StudentShopPage() {
  const session = await requireStudent()
  const products = await listPublishedShopProducts()

  return (
    <StudentDashboardShell
      account={session.account}
      active="shop"
      title="Shop"
      eyebrow="Student Shop"
    >
      <StudentDashboardCard className="bg-gradient-to-br from-card to-muted/30">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="max-w-2xl">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <p className="eyebrow text-primary">Prompt to Profit™ Workbooks</p>
            <h2 className="mt-2 font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">
              Keep building at your own pace
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Browse practical workbooks and learning products. Purchases made with your student email will appear in My Purchases.
            </p>
          </div>
          <Link href="/dashboard/purchases" className="btn-secondary group shrink-0 shadow-sm">
            <PackageOpen className="h-4 w-4" />
            My Purchases
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </StudentDashboardCard>

      <section className="mt-8">
        {products.length ? (
          <>
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow text-primary">Available now</p>
                <h2 className="mt-1 font-heading text-xl font-black tracking-tight text-foreground sm:text-2xl">
                  Software workbooks
                </h2>
              </div>
              <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-bold text-muted-foreground shadow-sm">
                {products.length} {products.length === 1 ? "workbook" : "workbooks"}
              </span>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {products.map((product) => (
                <ShopProductCard key={product.productUuid} product={product} dashboard />
              ))}
            </div>
          </>
        ) : (
          <EmptyStudentState
            icon="book"
            title="Products are being prepared"
            description="The first workbooks will appear here when pricing and availability are confirmed."
          />
        )}
      </section>
    </StudentDashboardShell>
  )
}
