import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  Calendar,
  Clock,
  FileText,
  Mail,
  Scale,
  ShieldCheck
} from "lucide-react"

import { PUBLIC_AFFILIATE_TERMS_VERSION } from "@/lib/affiliate-onboarding"
import { buildMetadata } from "@/lib/site-seo"

export const metadata: Metadata = buildMetadata({ title: "Affiliate Partner Agreement", description: "Terms governing participation in the Affiliate Partner Programme.", path: "/affiliate/terms" })

const sections = [
  ["1. Eligibility", "You must be at least 18 years old, provide accurate registration and payout information, and maintain an active, eligible partner account. Active school-linked student accounts are not eligible."],
  ["2. Referral Tracking", "Eligible referrals must use your assigned referral code or link. Tracking depends on the code being present when an eligible order is created. You may not alter, conceal, or misuse referral tracking."],
  ["3. Commissions", "Commission rates, eligible programmes, minimum order amounts, and hold periods are displayed in the partner dashboard and may vary by programme. A commission is not payable until it has passed its review period and is approved."],
  ["4. Refunds and Reversals", "Commissions may be withheld or reversed when an order is refunded, disputed, cancelled, fraudulent, duplicated, unpaid, or otherwise ineligible."],
  ["5. Prohibited Activity", "Self-referrals, fake accounts, misleading claims, spam, paid impersonation, trademark misuse, unlawful promotion, and attempts to manipulate tracking or payouts are prohibited."],
  ["6. Brand and Content", "You may accurately describe eligible Academy programmes but may not claim to be an employee, agent, or authorised spokesperson. Academy names, marks, and content may not be modified or used in a misleading way."],
  ["7. Payouts", "Payouts are subject to the published minimum threshold, account verification, fraud review, provider availability, and a supported payout destination. The current automated payout route supports verified Nigerian bank accounts in NGN."],
  ["8. Taxes", "You are responsible for determining and meeting any tax, reporting, registration, or other obligations that apply to your affiliate earnings."],
  ["9. Suspension and Termination", "We may suspend or terminate participation, block referrals, or withhold disputed commissions where there is suspected abuse, fraud, policy breach, legal risk, or inaccurate information."],
  ["10. Changes", "Commission rules and this agreement may be updated prospectively. The version accepted during registration is recorded with your account."],
  ["11. No Earnings Guarantee", "Participation does not guarantee referrals, commissions, business results, or any minimum level of income."],
  ["12. General Terms", "The website Terms and Conditions and Privacy Policy also apply. Where this agreement specifically addresses affiliate participation, this agreement governs that activity."]
]

const sectionContainer = "mx-auto w-full max-w-7xl px-5 sm:px-6 lg:px-8"

export default function AffiliateTermsPage() {
  return (
    <main className="min-h-screen bg-muted/20 pb-24">
      <section className="relative overflow-hidden bg-brand-ink pt-16 text-white lg:pt-24">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-sky/15 blur-[150px]" />

        <div className={`${sectionContainer} relative z-10 pb-16 lg:pb-24`}>
          <div className="max-w-3xl">
            <p className="eyebrow mb-6 inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-1.5 text-sky-400">
              <Scale className="h-4 w-4" />
              Legal Policies
            </p>
            <h1 className="font-heading text-4xl font-black tracking-tighter sm:text-5xl lg:text-6xl">
              Affiliate Partner Agreement
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-slate-300">
              These terms govern participation in the Affiliate Partner Programme, including referrals, commissions, acceptable promotion, and payouts.
            </p>
          </div>
        </div>
      </section>

      <section className="py-12 lg:py-20">
        <div className={sectionContainer}>
          <div className="grid items-start gap-12 lg:grid-cols-[320px_1fr] lg:gap-16">
            <aside className="grid gap-6 lg:sticky lg:top-28">
              <div className="surface-raised bg-card p-6">
                <p className="eyebrow mb-4 text-muted-foreground">Document Details</p>
                <ul className="grid gap-4">
                  <li className="flex items-center gap-3 text-sm font-medium text-foreground">
                    <Calendar className="h-4 w-4 text-primary" />
                    Last Updated: September 4, 2026
                  </li>
                  <li className="flex items-center gap-3 text-sm font-medium text-foreground">
                    <Clock className="h-4 w-4 text-primary" />
                    Version: {PUBLIC_AFFILIATE_TERMS_VERSION}
                  </li>
                  <li className="flex items-center gap-3 text-sm font-medium text-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Legally Binding
                  </li>
                </ul>
              </div>

              <div className="surface-raised bg-card p-6">
                <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <h2 className="font-heading text-lg font-bold">Agreement questions?</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Contact our support team if you need clarification about referrals, commission eligibility, or payouts.
                </p>
                <Link
                  href="mailto:support@tochukwunkwocha.com"
                  className="mt-6 inline-flex w-full items-center justify-center rounded-md border border-border bg-background px-4 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-muted"
                >
                  <Mail className="mr-2 h-4 w-4" /> Email Support
                </Link>
                <Link href="/affiliate" className="mt-4 flex items-center justify-between text-sm font-bold text-primary hover:underline">
                  Affiliate Programme <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/privacy-policy" className="mt-4 flex items-center justify-between text-sm font-bold text-primary hover:underline">
                  Read Privacy Policy <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </aside>

            <div className="surface-raised bg-card p-6 sm:p-10 lg:p-12">
              <div className="prose prose-slate max-w-none dark:prose-invert">
                <p className="mb-10 text-lg leading-relaxed text-muted-foreground">
                  By registering for, activating, or using an affiliate account, you agree to this Affiliate Partner Agreement. Please read every section carefully before sharing a referral link.
                </p>

                <div className="grid gap-12">
                  {sections.map(([title, body]) => {
                    const [number, ...titleParts] = title.split(". ")
                    return (
                      <section key={title} className="group relative">
                        <div className="mb-4 inline-flex items-center justify-center rounded-md bg-muted/50 px-3 py-1 text-sm font-black text-primary">
                          Section {number}
                        </div>
                        <h2 className="border-b border-border pb-4 font-heading text-2xl font-black tracking-tight text-foreground">
                          {titleParts.join(". ")}
                        </h2>
                        <p className="mt-5 text-base leading-relaxed text-muted-foreground">{body}</p>
                      </section>
                    )
                  })}
                </div>

                <div className="mt-12 flex flex-wrap gap-4 border-t border-border pt-8">
                  <Link href="/affiliate/register" className="btn-primary">
                    Register as a Partner <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                  <Link href="/terms-and-conditions" className="btn-secondary">Website Terms</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
