import { 
  Activity,
  CheckCircle2, 
  Clock, 
  CreditCard, 
  User, 
  WalletCards 
} from "lucide-react"

import { prisma } from "@/lib/prisma"
import { DashboardStatCard, DashboardStatsVisibility } from "@/components/dashboard/DashboardStatsVisibility"
import { formatMinorCurrency } from "@/lib/student-dashboard"
import { formatDate } from "@/lib/utils"

export const dynamic = "force-dynamic"

type PlanRow = {
  planUuid: string
  accountId: bigint
  courseSlug: string
  batchLabel: string | null
  firstName: string | null
  email: string | null
  currency: string | null
  targetAmountMinor: number | bigint | null
  totalPaidMinor: number | bigint | null
  status: string | null
  buyerType: string | null
  seatCount: number | bigint | null
  createdAt: Date | null
  lastPaymentAt: Date | null
  paymentCount: number | bigint
}

type PaymentRow = {
  paymentUuid: string
  planUuid: string
  provider: string | null
  providerReference: string | null
  currency: string | null
  amountMinor: number | bigint | null
  status: string | null
  createdAt: Date | null
  email: string | null
}

async function listInstallmentPlans() {
  return prisma.$queryRaw<PlanRow[]>`
    SELECT
      pl.plan_uuid AS planUuid,
      pl.account_id AS accountId,
      pl.course_slug AS courseSlug,
      pl.batch_label AS batchLabel,
      sa.full_name AS firstName,
      sa.email,
      pl.currency,
      pl.target_amount_minor AS targetAmountMinor,
      pl.total_paid_minor AS totalPaidMinor,
      pl.status,
      pl.buyer_type AS buyerType,
      pl.seat_count AS seatCount,
      pl.created_at AS createdAt,
      MAX(ip.created_at) AS lastPaymentAt,
      COUNT(ip.id) AS paymentCount
    FROM student_installment_plans pl
    LEFT JOIN student_accounts sa ON sa.id = pl.account_id
    LEFT JOIN student_installment_payments ip ON ip.plan_id = pl.id AND ip.status = 'paid'
    GROUP BY pl.id
    ORDER BY pl.created_at DESC
    LIMIT 150
  `.catch(() => [])
}

async function listPayments() {
  return prisma.$queryRaw<PaymentRow[]>`
    SELECT
      ip.payment_uuid AS paymentUuid,
      pl.plan_uuid AS planUuid,
      ip.provider,
      ip.provider_reference AS providerReference,
      ip.currency,
      ip.amount_minor AS amountMinor,
      ip.status,
      ip.created_at AS createdAt,
      sa.email
    FROM student_installment_payments ip
    JOIN student_installment_plans pl ON pl.id = ip.plan_id
    LEFT JOIN student_accounts sa ON sa.id = pl.account_id
    ORDER BY ip.created_at DESC
    LIMIT 120
  `.catch(() => [])
}

function PaymentStatusTone(status: string | null) {
  const s = String(status || "").toLowerCase()
  if (s === "paid" || s === "success" || s === "approved") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
  }
  if (s === "failed" || s === "rejected") {
    return "border-destructive/20 bg-destructive/10 text-destructive"
  }
  return "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
}

export default async function InternalInstallmentsPage() {
  const [plans, payments] = await Promise.all([listInstallmentPlans(), listPayments()])
  const activePlans = plans.filter((plan) => String(plan.status || "").toLowerCase() === "open").length
  const completedPlans = plans.filter((plan) => String(plan.status || "").toLowerCase() === "completed").length

  return (
    <main className="space-y-8 pb-12">
      
      {/* Header */}
      <div className="flex flex-col gap-6 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow text-primary">Revenue</p>
          <h1 className="mt-1 font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Installments Portfolio
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Monitor active payment plans, review recent top-ups, track completion progress, and audit outstanding balances.
          </p>
        </div>
      </div>

      {/* Summary Metrics */}
      <DashboardStatsVisibility storageKey="tochukwu-internal-installments-stats">
        <div className="grid gap-4 sm:grid-cols-3">
          <DashboardStatCard statKey="Total Plans" label="Total Plans" value={plans.length} icon={<WalletCards className="h-5 w-5" />} valueClassName="text-4xl" />
          <DashboardStatCard statKey="Active Open" label="Active / Open" value={activePlans} icon={<Activity className="h-5 w-5" />}
            iconClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400" valueClassName="text-4xl" />
          <DashboardStatCard statKey="Completed" label="Completed" value={completedPlans} icon={<CheckCircle2 className="h-5 w-5" />}
            iconClassName="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" valueClassName="text-4xl" />
        </div>
      </DashboardStatsVisibility>

      {/* Active Plans List */}
      <section>
        <h2 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Active & Recent Plans
        </h2>
        <div className="grid gap-4">
          {plans.length ? plans.map((plan) => {
            const target = Number(plan.targetAmountMinor || 0)
            const paid = Number(plan.totalPaidMinor || 0)
            const remaining = Math.max(0, target - paid)
            const currency = plan.currency || "NGN"
            const progress = target > 0 ? Math.min(100, Math.round((paid / target) * 100)) : 0
            const isCompleted = String(plan.status || "").toLowerCase() === "completed"

            return (
              <article key={plan.planUuid} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-colors hover:border-primary/20">
                <div className="flex flex-col gap-6 p-6 xl:flex-row xl:items-center xl:justify-between">
                  
                  {/* Plan Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`inline-flex rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${
                        isCompleted ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      }`}>
                        {plan.status || "open"}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                        <CreditCard className="h-3.5 w-3.5" /> {Number(plan.paymentCount || 0)} top-ups
                      </span>
                    </div>
                    
                    <h3 className="mt-4 font-heading text-xl font-black text-foreground">
                      {plan.courseSlug}
                    </h3>
                    
                    <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {plan.firstName || "Unknown Student"} 
                      <span className="text-muted-foreground font-normal">· {plan.email}</span>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                      <p><span className="font-bold uppercase tracking-widest text-foreground">Batch:</span> {plan.batchLabel || "Immediate Access"}</p>
                      <p><span className="font-bold uppercase tracking-widest text-foreground">Allocation:</span> {plan.buyerType || "student"} x {Number(plan.seatCount || 1)}</p>
                      <p className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Opened: {formatDate(plan.createdAt)}</p>
                    </div>
                  </div>

                  {/* Financials & Progress */}
                  <div className="w-full shrink-0 xl:w-[480px]">
                    <div className="grid grid-cols-3 gap-4 rounded-xl border border-border bg-muted/20 p-5">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Target</p>
                        <p className="mt-1 font-heading text-lg font-black text-foreground">{formatMinorCurrency(currency, target)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Paid</p>
                        <p className="mt-1 font-heading text-lg font-black text-emerald-600 dark:text-emerald-400">{formatMinorCurrency(currency, paid)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Balance</p>
                        <p className="mt-1 font-heading text-lg font-black text-foreground">{formatMinorCurrency(currency, remaining)}</p>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="col-span-3 mt-2">
                        <div className="flex items-center justify-between mb-1.5 text-xs font-bold text-muted-foreground">
                          <span>Completion</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-background ring-1 ring-border">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${isCompleted ? 'bg-emerald-500' : 'bg-primary'}`} 
                            style={{ width: `${progress}%` }} 
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                </div>
              </article>
            )
          }) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/10 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <WalletCards className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-heading text-lg font-bold text-foreground">No Plans Found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                There are currently no installment plans initialized in the system.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Recent Payments Ledger */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-muted/20 p-6 sm:p-8">
          <p className="eyebrow text-primary">Ledger</p>
          <h2 className="mt-1 font-heading text-xl font-bold text-foreground">Recent Installment Payments</h2>
          <p className="mt-1 text-sm text-muted-foreground">Top-up transactions across all active plans.</p>
        </div>
        
        <div className="max-h-[600px] overflow-auto bg-background scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20">
          <table className="w-full min-w-[64rem] text-left text-sm whitespace-nowrap">
            <thead className="sticky top-0 z-10 border-b border-border bg-card/90 text-[10px] font-bold uppercase tracking-widest text-muted-foreground backdrop-blur-md">
              <tr>
                <th className="px-6 py-4">Transaction ID</th>
                <th className="px-6 py-4">Learner Email</th>
                <th className="px-6 py-4">Provider / Ref</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payments.length ? payments.map((payment) => (
                <tr key={payment.paymentUuid} className="transition-colors hover:bg-muted/5">
                  <td className="px-6 py-4 font-mono text-[11px] font-semibold text-muted-foreground">
                    {payment.paymentUuid}
                  </td>
                  <td className="px-6 py-4 font-medium text-foreground">
                    {payment.email || "Unknown Profile"}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-bold text-foreground capitalize">{payment.provider || "Manual/Unknown"}</p>
                    {payment.providerReference && (
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{payment.providerReference}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest shadow-sm ${PaymentStatusTone(payment.status)}`}>
                      {payment.status || "Pending"}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-heading text-sm font-black text-foreground">
                    {formatMinorCurrency(payment.currency || "NGN", Number(payment.amountMinor || 0))}
                  </td>
                  <td className="px-6 py-4 text-right text-xs font-medium text-muted-foreground">
                    {formatDate(payment.createdAt)}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm font-semibold text-muted-foreground">
                    No installment transactions recorded yet.
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
