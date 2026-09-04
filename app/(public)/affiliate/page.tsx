import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, BadgeCheck, Banknote, Clock3, Link2, TrendingUp, UsersRound } from "lucide-react"

import { listPublicAffiliateCourseRules } from "@/lib/affiliate-onboarding"
import { buildMetadata } from "@/lib/site-seo"

export const dynamic = "force-dynamic"

export const metadata: Metadata = buildMetadata({
  title: "Affiliate Partner Programme",
  description: "Earn commissions by referring learners and schools to practical AI programmes.",
  path: "/affiliate"
})

function courseName(slug: string) {
  const names: Record<string, string> = {
    "prompt-to-profit": "Prompt to Profit",
    "prompt-to-production": "Prompt to Profit Advanced",
    "prompt-to-profit-holiday": "Prompt to Profit Holiday",
    "prompt-to-profit-schools": "Prompt to Profit for Schools",
    "ai-for-everyday-business-owners": "AI for Everyday Business Owners"
  }
  return names[slug] || slug.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ")
}

function commission(rule: { commissionType: string; commissionValue: number; commissionCurrency: string }) {
  if (rule.commissionType === "percentage") return `${(rule.commissionValue / 100).toFixed(2).replace(/\.00$/, "")}%`
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: rule.commissionCurrency || "NGN" }).format(rule.commissionValue / 100)
}

export default async function AffiliateProgrammePage() {
  const rules = await listPublicAffiliateCourseRules()
  const minimumPayoutMinor = Math.max(0, Number(process.env.AFFILIATE_MIN_PAYOUT_NGN_MINOR || 100000))

  return (
    <main>
      <section className="relative overflow-hidden bg-brand-ink py-20 text-white lg:py-28">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:28px_28px]" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-400/15 blur-[150px]" />
        <div className="site-container relative z-10">
          <div className="mx-auto max-w-4xl text-center">
            <p className="eyebrow mb-6 inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-1.5 text-sky-400">
              <UsersRound className="h-4 w-4" /> Affiliate Partner Programme
            </p>
            <h1 className="font-heading text-5xl font-black tracking-tighter sm:text-6xl lg:text-7xl lg:leading-[1.08]">
              Share practical AI education. <span className="text-sky-400">Earn on every eligible referral.</span>
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-slate-300">
              Join without buying a course. You receive trackable referral links, a live earnings dashboard, verified bank payouts, and clear commission records.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/affiliate/register" className="btn-primary w-full px-8 py-4 text-base shadow-lg shadow-sky-500/20 sm:w-auto">
                Become an Affiliate <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link href="/affiliate/login" className="inline-flex w-full items-center justify-center rounded-md border border-white/20 bg-white/5 px-8 py-4 text-base font-bold text-white transition hover:bg-white/10 sm:w-auto">
                Partner Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-muted/20 py-16 lg:py-24">
        <div className="site-container">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Link2, title: "Trackable links", body: "Use your unique partner code across eligible programme pages." },
              { icon: TrendingUp, title: "Live earnings", body: "Follow pending, approved, paid, and reversed commissions." },
              { icon: Clock3, title: "Review protection", body: "Commissions mature after the programme's published hold period." },
              { icon: Banknote, title: "Verified payouts", body: "Receive approved NGN earnings through a verified Nigerian bank account." }
            ].map(({ icon: Icon, title, body }) => (
              <article key={title} className="surface-raised bg-card p-6 sm:p-8">
                <div className="mb-5 inline-flex rounded-lg bg-primary/10 p-3 text-primary"><Icon className="h-5 w-5" /></div>
                <h2 className="font-heading text-lg font-black">{title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="site-container grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <p className="eyebrow text-primary">Commission Schedule</p>
            <h2 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl">Know what you can earn before you share.</h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground">
              Programme rules are controlled centrally and the current rate is always shown in your dashboard. The minimum approved payout is {new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(minimumPayoutMinor / 100)}.
            </p>
            <div className="mt-8 rounded-xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm leading-relaxed text-amber-700 dark:text-amber-300">
              Self-referrals, misleading promotion, fake purchases, and suspicious referral activity are blocked. Active school-linked student accounts are not eligible.
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="border-b border-border bg-muted/20 px-6 py-5"><h3 className="font-heading text-xl font-black">Eligible programmes</h3></div>
            {rules.length ? (
              <div className="divide-y divide-border">
                {rules.map((rule) => (
                  <div key={rule.courseSlug} className="flex flex-col justify-between gap-3 p-6 sm:flex-row sm:items-center">
                    <div><p className="font-heading font-bold">{courseName(rule.courseSlug)}</p><p className="mt-1 text-xs text-muted-foreground">{rule.holdDays}-day review period</p></div>
                    <span className="w-fit rounded-md border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-black text-primary">{commission(rule)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="p-8 text-sm text-muted-foreground">Programme commission rules are being prepared.</p>}
          </div>
        </div>
      </section>

      <section className="bg-brand-ink py-16 text-white lg:py-20">
        <div className="site-container flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <p className="eyebrow text-sky-400">Ready to partner?</p>
            <h2 className="mt-3 font-heading text-3xl font-black">Create your account and receive your referral links.</h2>
            <p className="mt-4 text-slate-300">Registration is free. Email verification and acceptance of the partner agreement are required.</p>
          </div>
          <Link href="/affiliate/register" className="btn-primary shrink-0 px-8 py-4">Register Now <BadgeCheck className="ml-2 h-4 w-4" /></Link>
        </div>
      </section>
    </main>
  )
}
