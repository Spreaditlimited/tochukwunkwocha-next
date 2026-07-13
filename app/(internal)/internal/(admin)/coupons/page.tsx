import { 
  BookOpen, 
  CheckCircle2, 
  Clock, 
  PauseCircle, 
  Percent, 
  PlusCircle, 
  Save, 
  Ticket, 
  TrendingUp 
} from "lucide-react"

import { prisma } from "@/lib/prisma"
import { PremiumPicker } from "@/components/PremiumPicker"
import { formatMinorCurrency } from "@/lib/student-dashboard"
import { formatDate } from "@/lib/utils"
import { saveCouponAction, toggleCouponAction } from "./actions"

export const dynamic = "force-dynamic"

type CouponRow = {
  code: string
  description: string | null
  discountType: string
  percentOff: number | string | null
  fixedNgnMinor: number | bigint | null
  fixedGbpMinor: number | bigint | null
  courseSlug: string | null
  startsAt: Date | null
  endsAt: Date | null
  maxUses: number | bigint | null
  maxUsesPerEmail: number | bigint | null
  isActive: number | bigint | boolean
  redemptionCount: number | bigint
  updatedAt: Date | null
}

async function ensureCouponTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS course_coupons (
      id BIGINT NOT NULL AUTO_INCREMENT,
      code VARCHAR(40) NOT NULL,
      description VARCHAR(240) NULL,
      discount_type VARCHAR(16) NOT NULL,
      percent_off DECIMAL(6,2) NULL,
      fixed_ngn_minor INT NULL,
      fixed_gbp_minor INT NULL,
      course_slug VARCHAR(120) NULL,
      starts_at DATETIME NULL,
      ends_at DATETIME NULL,
      max_uses INT NULL,
      max_uses_per_email INT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_coupon_code (code),
      KEY idx_coupon_active_dates (is_active, starts_at, ends_at),
      KEY idx_coupon_course_slug (course_slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS coupon_redemptions (
      id BIGINT NOT NULL AUTO_INCREMENT,
      coupon_id BIGINT NOT NULL,
      order_uuid VARCHAR(64) NOT NULL,
      email VARCHAR(255) NOT NULL,
      currency VARCHAR(8) NOT NULL,
      discount_minor INT NOT NULL,
      created_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_coupon_order (coupon_id, order_uuid),
      KEY idx_coupon_redemptions_coupon (coupon_id, created_at),
      KEY idx_coupon_redemptions_email (coupon_id, email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

async function listCoupons() {
  await ensureCouponTables()
  return prisma.$queryRaw<CouponRow[]>`
    SELECT
      c.code,
      c.description,
      c.discount_type AS discountType,
      c.percent_off AS percentOff,
      c.fixed_ngn_minor AS fixedNgnMinor,
      c.fixed_gbp_minor AS fixedGbpMinor,
      c.course_slug AS courseSlug,
      c.starts_at AS startsAt,
      c.ends_at AS endsAt,
      c.max_uses AS maxUses,
      c.max_uses_per_email AS maxUsesPerEmail,
      c.is_active AS isActive,
      c.updated_at AS updatedAt,
      COUNT(r.id) AS redemptionCount
    FROM course_coupons c
    LEFT JOIN coupon_redemptions r ON r.coupon_id = c.id
    GROUP BY c.id
    ORDER BY c.updated_at DESC
    LIMIT 150
  `
}

function describeDiscount(coupon: CouponRow) {
  if (coupon.discountType === "percent") return `${Number(coupon.percentOff || 0)}% off`
  const parts = []
  if (coupon.fixedNgnMinor) parts.push(formatMinorCurrency("NGN", Number(coupon.fixedNgnMinor)))
  if (coupon.fixedGbpMinor) parts.push(formatMinorCurrency("GBP", Number(coupon.fixedGbpMinor)))
  return parts.join(" / ") || "Fixed discount"
}

export default async function InternalCouponsPage() {
  const coupons = await listCoupons()
  const discountTypeOptions = [
    { value: "percent", label: "Percentage Off" },
    { value: "fixed", label: "Fixed Amount" }
  ]

  return (
    <main className="space-y-8 pb-12">
      
      {/* Header */}
      <div className="flex flex-col gap-6 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow text-primary">Revenue Operations</p>
          <h1 className="mt-1 font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Coupon Management
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Create, configure, and monitor discount codes used during public checkout and manual provisioning.
          </p>
        </div>
      </div>

      {/* Creation Module */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-muted/20 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-heading text-xl font-black text-foreground">Create New Coupon</h2>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                Define the discount parameters, eligibility, and constraints.
              </p>
            </div>
          </div>
        </div>
        
        <form action={saveCouponAction} className="p-6 sm:p-8">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Coupon Code</span>
              <input name="code" className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm font-bold uppercase tracking-wider outline-none transition-colors placeholder:font-medium placeholder:normal-case placeholder:tracking-normal focus:border-primary focus:ring-1 focus:ring-primary" placeholder="e.g. EARLYBIRD" required />
            </label>
            <label className="block lg:col-span-2">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Internal Description</span>
              <input name="description" className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" placeholder="e.g. Black Friday 2026 promotion" />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Programme Constraint</span>
              <input name="courseSlug" className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" placeholder="Optional course slug" />
            </label>
            
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Discount Type</span>
              <PremiumPicker name="discountType" options={discountTypeOptions} />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Percentage Off</span>
              <input name="percentOff" type="number" min="0" max="100" step="0.01" placeholder="%" className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Fixed NGN Limit</span>
              <input name="fixedNgn" type="number" min="0" step="1" placeholder="₦" className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Fixed GBP Limit</span>
              <input name="fixedGbp" type="number" min="0" step="1" placeholder="£" className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" />
            </label>
            
            <div className="flex items-end justify-between gap-4 lg:col-span-4">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3 transition-colors hover:bg-muted/40">
                <input name="isActive" type="checkbox" defaultChecked className="h-4 w-4 rounded border-input text-primary focus:ring-primary" />
                <span className="text-sm font-bold text-foreground">Activate immediately</span>
              </label>
              <button className="btn-primary w-full shadow-sm sm:w-auto" type="submit">
                <Save className="mr-2 h-4 w-4" /> Save Coupon
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* Coupon Registry */}
      <section>
        <h2 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Active & Legacy Coupons
        </h2>
        
        <div className="grid gap-4">
          {coupons.length ? coupons.map((coupon) => {
            const active = Number(coupon.isActive) === 1
            return (
              <article key={coupon.code} className="group overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-300 hover:border-primary/30 hover:shadow-md">
                <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between">
                  
                  {/* Coupon Information */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`inline-flex rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest shadow-sm ${
                        active ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "border-border bg-muted text-muted-foreground"
                      }`}>
                        {active ? "Active" : "Paused"}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                        <TrendingUp className="h-3.5 w-3.5" /> {Number(coupon.redemptionCount || 0)} Redemptions
                      </span>
                    </div>
                    
                    <h3 className="mt-3 font-heading text-2xl font-black uppercase tracking-wider text-foreground">
                      {coupon.code}
                    </h3>
                    <p className="mt-1.5 text-sm font-medium text-muted-foreground">
                      {coupon.description || "No internal description provided."}
                    </p>
                    
                    <div className="mt-5 grid grid-cols-2 gap-4 rounded-xl border border-border bg-muted/20 p-4 md:grid-cols-4">
                      <div>
                        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          <Percent className="h-3 w-3" /> Discount
                        </p>
                        <p className="mt-1 font-heading text-sm font-bold text-foreground">
                          {describeDiscount(coupon)}
                        </p>
                      </div>
                      <div>
                        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          <BookOpen className="h-3 w-3" /> Scope
                        </p>
                        <p className="mt-1 truncate font-heading text-sm font-bold text-foreground" title={coupon.courseSlug || "Global"}>
                          {coupon.courseSlug || "Global (All)"}
                        </p>
                      </div>
                      <div>
                        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          <Clock className="h-3 w-3" /> Expiration
                        </p>
                        <p className="mt-1 font-heading text-sm font-bold text-foreground">
                          {coupon.endsAt ? formatDate(coupon.endsAt) : "Never"}
                        </p>
                      </div>
                      <div>
                        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          <Ticket className="h-3 w-3" /> Updated
                        </p>
                        <p className="mt-1 font-heading text-sm font-bold text-muted-foreground">
                          {formatDate(coupon.updatedAt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="shrink-0 lg:w-40">
                    <form action={toggleCouponAction}>
                      <input type="hidden" name="code" value={coupon.code} />
                      <input type="hidden" name="isActive" value={active ? "0" : "1"} />
                      <button 
                        className={`inline-flex w-full items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-bold shadow-sm transition-all hover:-translate-y-0.5 sm:w-auto lg:w-full ${
                          active 
                            ? "border-border bg-card text-muted-foreground hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-600" 
                            : "border-primary/20 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                        }`} 
                        type="submit"
                      >
                        {active ? (
                          <><PauseCircle className="mr-2 h-4 w-4" /> Pause</>
                        ) : (
                          <><CheckCircle2 className="mr-2 h-4 w-4" /> Activate</>
                        )}
                      </button>
                    </form>
                  </div>
                  
                </div>
              </article>
            )
          }) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/10 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Ticket className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-heading text-lg font-bold text-foreground">No Coupons Found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                There are currently no discount codes configured in the system.
              </p>
            </div>
          )}
        </div>
      </section>
      
    </main>
  )
}
