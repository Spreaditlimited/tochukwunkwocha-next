import Link from "next/link"
import { 
  AlertTriangle, 
  Banknote, 
  CheckCircle2, 
  Clock, 
  Link2, 
  Network, 
  ShieldAlert, 
  ShieldCheck, 
  UsersRound, 
  Wallet,
  XCircle
} from "lucide-react"

import { CopyButton } from "@/components/student-dashboard/CopyButton"
import { AffiliatePayoutSetup } from "@/components/student-dashboard/AffiliatePayoutSetup"
import {
  EmptyStudentState,
  StudentDashboardCard,
  StudentDashboardShell
} from "@/components/student-dashboard/StudentDashboardShell"
import { TrademarkText } from "@/components/TrademarkText"
import { 
  courseName, 
  formatMinorCurrency, 
  getStudentAffiliateSummary, 
  statusLabel, 
  statusTone 
} from "@/lib/student-dashboard"
import { requireStudent } from "@/lib/student-auth"
import { formatDate } from "@/lib/utils"

export const dynamic = "force-dynamic"

function commissionLabel(input: {
  commissionType: string
  commissionValue: number
  commissionCurrency: string
  courseSlug: string
  projectedMinSeats: number
  projectedMinCommissionMinor: number
}) {
  const type = String(input.commissionType || "").toLowerCase()
  const base = type === "percentage"
    ? `${(Number(input.commissionValue || 0) / 100).toFixed(2).replace(/\.00$/, "")}%`
    : formatMinorCurrency(input.commissionCurrency, input.commissionValue)

  if (input.courseSlug === "prompt-to-profit-schools" && input.projectedMinSeats > 0 && input.projectedMinCommissionMinor > 0) {
    return `${base} per student (${formatMinorCurrency(input.commissionCurrency, input.projectedMinCommissionMinor)} at ${input.projectedMinSeats} students min)`
  }
  return base
}

export default async function StudentAffiliatePage() {
  const session = await requireStudent()
  const affiliate = await getStudentAffiliateSummary(session.account.id)
  const profile = affiliate.profile

  return (
    <StudentDashboardShell 
      account={session.account} 
      active="affiliate" 
      title="Affiliate Partner" 
      eyebrow="Affiliate Center"
    >
      {profile ? (
        <div className="grid gap-8">
          
          {/* Eligibility Alert */}
          {profile.eligibilityStatus !== "eligible" ? (
            <div className="flex items-start gap-4 rounded-xl border border-destructive/20 bg-destructive/10 p-5 shadow-sm">
              <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-destructive" />
              <div>
                <h3 className="font-heading text-lg font-bold text-destructive">Account Not Eligible</h3>
                <p className="mt-1 text-sm font-medium text-destructive/80">
                  {profile.eligibilityReason || "This account is not currently eligible for affiliate access."}
                </p>
              </div>
            </div>
          ) : null}

          {/* 1. Primary Earnings Metrics */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StudentDashboardCard className="flex flex-col justify-between p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pending</p>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Clock className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-6 font-heading text-3xl font-black text-foreground">
                {formatMinorCurrency(affiliate.earnings.currency, affiliate.earnings.pendingMinor)}
              </p>
            </StudentDashboardCard>
            
            <StudentDashboardCard className="flex flex-col justify-between p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Approved</p>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-6 font-heading text-3xl font-black text-foreground">
                {formatMinorCurrency(affiliate.earnings.currency, affiliate.earnings.approvedMinor)}
              </p>
            </StudentDashboardCard>
            
            <StudentDashboardCard className="flex flex-col justify-between p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Paid Out</p>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Wallet className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-6 font-heading text-3xl font-black text-foreground">
                {formatMinorCurrency(affiliate.earnings.currency, affiliate.earnings.paidMinor)}
              </p>
            </StudentDashboardCard>
            
            <StudentDashboardCard className="flex flex-col justify-between p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Blocked / Reversed</p>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <XCircle className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-6 font-heading text-3xl font-black text-foreground">
                {formatMinorCurrency(affiliate.earnings.currency, affiliate.earnings.blockedMinor)}
              </p>
            </StudentDashboardCard>
          </section>

          {/* 2. Link Generation & Management */}
          <div className="grid gap-8 xl:grid-cols-[1fr_1fr]">
            
            {/* Master Link */}
            <StudentDashboardCard className="p-0 overflow-hidden flex flex-col">
              <div className="border-b border-border bg-muted/20 p-6 sm:p-8">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Link2 className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="eyebrow text-primary">Master Affiliate Link</p>
                    <h2 className="mt-1 font-heading text-xl font-bold text-foreground">Share your primary link</h2>
                  </div>
                </div>
              </div>
              <div className="p-6 sm:p-8 flex-1 flex flex-col justify-center">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Send traffic directly to the main courses page. All purchases made through this link will be tracked to your account.
                </p>
                
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1 truncate rounded-lg border border-border bg-background p-4 font-mono text-sm text-foreground shadow-inner">
                    {profile.affiliateLink}
                  </div>
                  <CopyButton value={profile.affiliateLink} label="Copy Link" className="btn-primary py-4 px-6 shadow-sm" />
                </div>
                
                <div className="mt-6 inline-flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground w-fit border border-border/50">
                  Affiliate code: <span className="font-mono font-bold text-foreground">{profile.affiliateCode}</span>
                </div>
              </div>
            </StudentDashboardCard>

            {/* Direct Course Links */}
            <StudentDashboardCard className="p-0 overflow-hidden flex flex-col">
              <div className="border-b border-border bg-muted/20 p-6 sm:p-8">
                <p className="eyebrow text-primary">Direct Course Links</p>
                <h2 className="mt-1 font-heading text-xl font-bold text-foreground">Target specific courses</h2>
              </div>
              <div className="p-0 sm:p-0 flex-1 overflow-x-auto">
                {affiliate.directCourseLinks.length ? (
                  <table className="w-full text-left text-sm whitespace-nowrap sm:whitespace-normal">
                    <thead className="border-b border-border bg-muted/10">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Course</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {affiliate.directCourseLinks.map((item) => (
                        <tr key={item.courseSlug} className="transition-colors hover:bg-muted/5">
                          <td className="px-6 py-4">
                            <p className="font-heading font-bold text-foreground">
                              <TrademarkText text={courseName(item.courseSlug)} />
                            </p>
                            <p className="mt-1 font-mono text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-[300px]">
                              {item.link}
                            </p>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <CopyButton value={item.link} label="Copy" className="btn-secondary text-xs py-2 px-4" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-8">
                    <EmptyStudentState 
                      icon={Link2} 
                      title="No direct links yet" 
                      description="Eligible course links will appear when affiliate course rules are active." 
                    />
                  </div>
                )}
              </div>
            </StudentDashboardCard>

          </div>

          {/* 3. Program Rules & Payout Account */}
          <StudentDashboardCard className="p-0 overflow-hidden">
            <div className="grid lg:grid-cols-[1.2fr_0.8fr]">
              
              {/* How Earnings Work */}
              <div className="p-6 sm:p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-border pb-6">
                  <div>
                    <p className="eyebrow text-primary">Program Policies</p>
                    <h2 className="mt-1 font-heading text-2xl font-black text-foreground">How Earnings Work</h2>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      Commissions are tracked from your affiliate code, held during the review period, then moved to approved when they pass risk checks.
                    </p>
                  </div>
                  <span className={`inline-flex items-center whitespace-nowrap rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${statusTone(profile.eligibilityStatus)}`}>
                    {statusLabel(profile.eligibilityStatus)}
                  </span>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Hold Period</p>
                    <p className="mt-2 font-heading text-lg font-black text-foreground">
                      {affiliate.policy.defaultHoldDays > 0 ? `${affiliate.policy.defaultHoldDays} days` : "No hold"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Before commission matures</p>
                  </div>
                  <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Min Payout</p>
                    <p className="mt-2 font-heading text-lg font-black text-foreground">
                      {formatMinorCurrency(affiliate.policy.payoutCurrency, affiliate.policy.minPayoutMinor)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Approved threshold</p>
                  </div>
                  <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Provider</p>
                    <p className="mt-2 font-heading text-lg font-black capitalize text-foreground">
                      {profile.payoutProvider || "paystack"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Where available</p>
                  </div>
                </div>

                <div className="mt-6 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-relaxed text-amber-600 dark:text-amber-400">
                  <strong className="block mb-1 font-heading text-amber-700 dark:text-amber-300">Anti-Abuse Policy</strong>
                  {affiliate.policy.antiAbuseSummary}
                </div>
              </div>

              {/* Payout Account */}
              <div className="border-t border-border bg-muted/10 p-6 sm:p-8 lg:border-l lg:border-t-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Banknote className="h-3.5 w-3.5" /> Payout Destination
                </p>
                <h3 className="mt-3 font-heading text-lg font-black text-foreground">Bank Details</h3>
                
                {profile.payoutAccount ? (
                  <div className="mt-6 space-y-4">
                    <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Bank Name</p>
                      <p className="mt-1 font-semibold text-foreground">{profile.payoutAccount.bankName || "Not recorded"}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Account Holder</p>
                      <p className="mt-1 font-semibold text-foreground">{profile.payoutAccount.accountName || "Not verified"}</p>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{profile.payoutAccount.accountNumberMasked}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Currency</p>
                        <p className="mt-1 font-semibold text-foreground">{profile.payoutAccount.currency || profile.payoutCurrency}</p>
                      </div>
                      <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</p>
                        <p className={`mt-1 font-bold ${profile.payoutAccount.isVerified ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500"}`}>
                          {profile.payoutAccount.isVerified ? "Verified" : "Pending"}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 rounded-lg border border-border bg-background p-5 text-sm leading-relaxed text-muted-foreground text-center">
                    No payout account is saved yet.
                  </div>
                )}
                <AffiliatePayoutSetup />
              </div>
              
            </div>
          </StudentDashboardCard>

          {/* 4. Eligible Courses Ledger */}
          <StudentDashboardCard className="p-0 overflow-hidden">
            <div className="border-b border-border bg-muted/20 p-6 sm:p-8">
              <p className="eyebrow text-primary">Eligible Courses</p>
              <h2 className="mt-1 font-heading text-xl font-bold text-foreground">Courses generating commission</h2>
              {affiliate.policy.schoolReferralNote ? (
                <div className="mt-4 rounded-lg border border-primary/20 bg-primary/10 p-4 text-sm font-medium leading-relaxed text-primary w-fit">
                  {affiliate.policy.schoolReferralNote}
                </div>
              ) : null}
            </div>
            
            <div className="overflow-x-auto">
              {affiliate.eligibleCourses.length ? (
                <table className="w-full text-left text-sm whitespace-nowrap sm:whitespace-normal">
                  <thead className="border-b border-border bg-muted/5">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Course</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Commission</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Min Order</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Hold Days</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {affiliate.eligibleCourses.map((item) => (
                      <tr key={item.courseSlug} className="transition-colors hover:bg-muted/5">
                        <td className="px-6 py-4 font-heading font-bold text-foreground">
                          <TrademarkText text={courseName(item.courseSlug)} />
                        </td>
                        <td className="px-6 py-4 font-medium text-foreground">
                          <span className="inline-flex rounded-md border border-border bg-background px-2.5 py-1 shadow-sm">
                            {commissionLabel(item)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">{formatMinorCurrency(item.commissionCurrency, item.minOrderAmountMinor)}</td>
                        <td className="px-6 py-4 text-muted-foreground">{item.holdDays} days</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8">
                  <EmptyStudentState icon={UsersRound} title="No eligible courses" description="Affiliate course rules have not been activated yet." />
                </div>
              )}
            </div>
          </StudentDashboardCard>

          {/* 5. Referrals Ledger */}
          <StudentDashboardCard className="p-0 overflow-hidden">
            <div className="border-b border-border bg-muted/20 p-6 sm:p-8">
              <p className="eyebrow text-primary">Recent Referrals</p>
              <h2 className="mt-1 font-heading text-xl font-bold text-foreground">Commission Records</h2>
            </div>
            
            <div className="overflow-x-auto">
              {affiliate.referrals.length ? (
                <table className="w-full text-left text-sm whitespace-nowrap sm:whitespace-normal">
                  <thead className="border-b border-border bg-muted/5">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Date</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Course</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Buyer</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Amount</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Commission</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {affiliate.referrals.map((referral) => (
                      <tr key={referral.commissionUuid} className="transition-colors hover:bg-muted/5">
                        <td className="px-6 py-4 text-muted-foreground">{formatDate(referral.createdAt)}</td>
                        <td className="px-6 py-4 font-heading font-bold text-foreground">
                          <TrademarkText text={courseName(referral.courseSlug)} />
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{referral.buyerEmailMasked}</td>
                        <td className="px-6 py-4 text-muted-foreground">{formatMinorCurrency(referral.currency, referral.orderAmountMinor)}</td>
                        <td className="px-6 py-4 font-heading font-bold text-emerald-600 dark:text-emerald-400">
                          {formatMinorCurrency(referral.currency, referral.commissionAmountMinor)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center whitespace-nowrap rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${statusTone(referral.status)}`}>
                            {statusLabel(referral.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8">
                  <EmptyStudentState icon={Network} title="No referrals yet" description="Affiliate commissions connected to your profile will appear here." />
                </div>
              )}
            </div>
          </StudentDashboardCard>

          {/* 6. Payout History Ledger */}
          <StudentDashboardCard className="p-0 overflow-hidden">
            <div className="border-b border-border bg-muted/20 p-6 sm:p-8">
              <p className="eyebrow text-primary">Payout History</p>
              <h2 className="mt-1 font-heading text-xl font-bold text-foreground">Processed Payout Batches</h2>
            </div>
            
            <div className="overflow-x-auto">
              {affiliate.payouts.length ? (
                <table className="w-full text-left text-sm whitespace-nowrap sm:whitespace-normal">
                  <thead className="border-b border-border bg-muted/5">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Batch ID</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Period</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Amount</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {affiliate.payouts.map((payout) => (
                      <tr key={payout.batchUuid} className="transition-colors hover:bg-muted/5">
                        <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{payout.batchUuid}</td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {formatDate(payout.periodStart)} <span className="mx-2 text-border">→</span> {formatDate(payout.periodEnd)}
                        </td>
                        <td className="px-6 py-4 font-heading font-black text-foreground">
                          {formatMinorCurrency(payout.currency, payout.totalAmountMinor)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center whitespace-nowrap rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${statusTone(payout.status)}`}>
                            {statusLabel(payout.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8">
                  <EmptyStudentState icon={Banknote} title="No payout history yet" description="Completed payout batches will appear here." />
                </div>
              )}
            </div>
          </StudentDashboardCard>

        </div>
      ) : (
        <EmptyStudentState
          icon={AlertTriangle}
          title="Affiliate Profile Unavailable"
          description="We could not prepare your affiliate profile. Please ensure your student account is in good standing or contact support."
        />
      )}
    </StudentDashboardShell>
  )
}
