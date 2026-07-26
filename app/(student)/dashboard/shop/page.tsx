import Link from "next/link"
import { ArrowRight, ShoppingBag } from "lucide-react"

import {
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
      <StudentDashboardCard>
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="eyebrow text-primary">Prompt to Profit™ Workbooks</p>
            <h2 className="mt-2 font-heading text-2xl font-black text-foreground">Keep building at your own pace</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Browse practical workbooks and learning products. Purchases made with your student email will appear in My Purchases.
            </p>
          </div>
          <Link href="/dashboard/purchases" className="btn-secondary shrink-0">
            My Purchases <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </StudentDashboardCard>

      <section className="mt-6">
        {products.length ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <ShopProductCard key={product.productUuid} product={product} dashboard />
            ))}
          </div>
        ) : (
          <StudentDashboardCard className="text-center">
            <ShoppingBag className="mx-auto h-9 w-9 text-primary" />
            <h2 className="mt-3 font-heading text-xl font-black text-foreground">Products are being prepared</h2>
            <p className="mt-2 text-sm text-muted-foreground">The first workbooks will appear here when pricing and availability are confirmed.</p>
          </StudentDashboardCard>
        )}
      </section>
    </StudentDashboardShell>
  )
}
