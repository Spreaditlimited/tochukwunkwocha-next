import Link from "next/link"
import {
  ArrowRight,
  CalendarClock,
  CreditCard,
  GraduationCap,
  Hammer,
  Megaphone,
  MonitorPlay,
  School,
  Search,
  ShieldAlert,
  Smartphone,
  Users,
  WalletCards
} from "lucide-react"

import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/auth"
import {
  DashboardStatsVisibility,
  DashboardStatToggle,
  DashboardStatValue
} from "@/components/dashboard/DashboardStatsVisibility"

export const dynamic = "force-dynamic"

type OperationsOverviewRow = {
  pendingEnrollments: number | bigint | null
  approvedEnrollments: number | bigint | null
  students: number | bigint | null
  affiliates: number | bigint | null
  individualCertificatesIssued: number | bigint | null
  schoolCertificatesIssued: number | bigint | null
  onboardedSchools: number | bigint | null
  schoolStudents: number | bigint | null
  demographicProfiles: number | bigint | null
  installmentPlans: number | bigint | null
  learningReviews: number | bigint | null
  transcriptRequests: number | bigint | null
  marketingLeads30d: number | bigint | null
  schoolLeads: number | bigint | null
  buildLeads: number | bigint | null
  coachingLeads: number | bigint | null
  seoOpportunities: number | bigint | null
  videoLessons: number | bigint | null
  trustedDevices: number | bigint | null
  securityAlerts: number | bigint | null
}

function toInt(value: unknown) {
  const numberValue = Number(value || 0)
  return Number.isFinite(numberValue) ? Math.round(numberValue) : 0
}

async function getOperationsOverview() {
  // One statement keeps this page to one connection and one round trip. The old
  // Promise.all issued 19 concurrent queries against a production pool of two.
  const rows = await prisma.$queryRaw<OperationsOverviewRow[]>`
    SELECT
      (SELECT COALESCE(SUM(CASE WHEN seat_count IS NULL OR seat_count < 1 THEN 1 ELSE seat_count END), 0)
       FROM course_manual_payments
       WHERE status IN ('pending_verification', 'pending', 'submitted')) AS pendingEnrollments,
      ((SELECT COALESCE(SUM(CASE WHEN seat_count IS NULL OR seat_count < 1 THEN 1 ELSE seat_count END), 0)
        FROM course_orders WHERE status = 'paid')
       +
       (SELECT COALESCE(SUM(CASE WHEN seat_count IS NULL OR seat_count < 1 THEN 1 ELSE seat_count END), 0)
        FROM course_manual_payments WHERE status = 'approved')) AS approvedEnrollments,
      (SELECT COUNT(*)
       FROM student_accounts sa
       WHERE EXISTS (
         SELECT 1 FROM course_orders co
         WHERE LOWER(co.email) COLLATE utf8mb4_unicode_ci = LOWER(sa.email) COLLATE utf8mb4_unicode_ci
           AND co.status = 'paid'
       ) OR EXISTS (
         SELECT 1 FROM course_manual_payments cmp
         WHERE LOWER(cmp.email) COLLATE utf8mb4_unicode_ci = LOWER(sa.email) COLLATE utf8mb4_unicode_ci
           AND cmp.status IN ('approved', 'paid')
       ) OR EXISTS (
         SELECT 1 FROM school_students ss
         WHERE ss.account_id = sa.id AND COALESCE(ss.status, 'active') = 'active'
       ) OR EXISTS (
         SELECT 1 FROM family_children fc
         WHERE fc.account_id = sa.id AND COALESCE(fc.status, 'active') = 'active'
       )) AS students,
      (SELECT COUNT(*) FROM tochukwu_affiliate_profiles) AS affiliates,
      (SELECT COUNT(*) FROM student_certificates WHERE status = 'issued') AS individualCertificatesIssued,
      (SELECT COUNT(*) FROM school_certificates WHERE status = 'issued') AS schoolCertificatesIssued,
      (SELECT COUNT(*)
       FROM school_accounts sc
       WHERE COALESCE(sc.status, 'active') = 'active'
         AND EXISTS (
           SELECT 1 FROM school_students ss
           WHERE ss.school_id = sc.id AND COALESCE(ss.status, 'active') = 'active'
         )) AS onboardedSchools,
      (SELECT COUNT(*)
       FROM school_students ss
       JOIN school_accounts sc ON sc.id = ss.school_id
       WHERE COALESCE(ss.status, 'active') = 'active'
         AND COALESCE(sc.status, 'active') = 'active') AS schoolStudents,
      (SELECT COUNT(*)
       FROM student_accounts
       WHERE COALESCE(demographic_country, '') <> ''
         AND COALESCE(age_band, '') <> ''
         AND COALESCE(learner_category, '') <> '') AS demographicProfiles,
      (SELECT COUNT(*) FROM student_installment_plans WHERE status <> 'merged') AS installmentPlans,
      (SELECT COUNT(*) FROM tochukwu_learning_assignments WHERE status IN ('submitted', 'in_review')) AS learningReviews,
      (SELECT COUNT(*) FROM tochukwu_transcript_access WHERE status = 'pending') AS transcriptRequests,
      (SELECT COUNT(*) FROM tochukwu_marketing_leads WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS marketingLeads30d,
      (SELECT COUNT(*) FROM tochukwu_school_scorecard_leads) AS schoolLeads,
      (SELECT COUNT(*) FROM tochukwu_build_scorecard_leads) AS buildLeads,
      (SELECT COUNT(*) FROM tochukwu_private_ai_coaching_leads) AS coachingLeads,
      (SELECT COUNT(*) FROM tochukwu_seo_opportunities WHERE status NOT IN ('applied', 'dismissed')) AS seoOpportunities,
      (SELECT COUNT(*) FROM tochukwu_learning_lessons) AS videoLessons,
      (SELECT COUNT(*) FROM student_account_devices) AS trustedDevices,
      (SELECT COUNT(*) FROM student_security_alerts WHERE status = 'open') AS securityAlerts
  `
  const row = rows[0]

  return {
    pendingEnrollments: toInt(row?.pendingEnrollments),
    approvedEnrollments: toInt(row?.approvedEnrollments),
    students: toInt(row?.students),
    affiliates: toInt(row?.affiliates),
    certificatesIssued: toInt(row?.individualCertificatesIssued) + toInt(row?.schoolCertificatesIssued),
    onboardedSchools: toInt(row?.onboardedSchools),
    schoolStudents: toInt(row?.schoolStudents),
    demographicProfiles: toInt(row?.demographicProfiles),
    installmentPlans: toInt(row?.installmentPlans),
    learningReviews: toInt(row?.learningReviews),
    transcriptRequests: toInt(row?.transcriptRequests),
    marketingLeads30d: toInt(row?.marketingLeads30d),
    schoolLeads: toInt(row?.schoolLeads),
    buildLeads: toInt(row?.buildLeads),
    coachingLeads: toInt(row?.coachingLeads),
    seoOpportunities: toInt(row?.seoOpportunities),
    videoLessons: toInt(row?.videoLessons),
    trustedDevices: toInt(row?.trustedDevices),
    securityAlerts: toInt(row?.securityAlerts)
  }
}

export default async function DashboardPage() {
  await requireAdmin("/internal")
  const stats = await getOperationsOverview()
  
  const primaryCards = [
    { label: "Pending Enrollments", value: stats.pendingEnrollments, href: "/internal/manual-payments", icon: CreditCard, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", border: "hover:border-amber-500/40" },
    { label: "Student Accounts", value: stats.students, href: "/internal/learning-progress", icon: Users, color: "text-primary", bg: "bg-primary/10", border: "hover:border-primary/40" },
    { label: "Affiliate Partners", value: stats.affiliates, href: "/internal/affiliates", icon: Users, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10", border: "hover:border-sky-500/40" },
    { label: "Certificates Issued", value: stats.certificatesIssued, href: "/internal/learning", icon: GraduationCap, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", border: "hover:border-emerald-500/40" },
    { label: "Onboarded Schools", value: stats.onboardedSchools, href: "/internal/schools", icon: School, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10", border: "hover:border-sky-500/40" },
    { label: "School Students", value: stats.schoolStudents, href: "/internal/schools", icon: Users, color: "text-primary", bg: "bg-primary/10", border: "hover:border-primary/40" },
    { label: "Demographic Profiles", value: stats.demographicProfiles, href: "/internal/learning-progress", icon: Users, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10", border: "hover:border-sky-500/40" },
    { label: "Trusted Devices", value: stats.trustedDevices, href: "/internal/security", icon: Smartphone, color: "text-muted-foreground", bg: "bg-muted", border: "hover:border-border" },
    { label: "Learning Reviews", value: stats.learningReviews, href: "/internal/learning", icon: GraduationCap, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", border: "hover:border-emerald-500/40" },
    { label: "Marketing Leads (30d)", value: stats.marketingLeads30d, href: "/internal/marketing", icon: Megaphone, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10", border: "hover:border-sky-500/40" }
  ]
  
  const secondaryCards = [
    { label: "Paid Course Seats", value: stats.approvedEnrollments, href: "/internal/manual-payments", icon: CreditCard, color: "text-emerald-600 dark:text-emerald-400" },
    { label: "Installment Plans", value: stats.installmentPlans, href: "/internal/installments", icon: WalletCards, color: "text-amber-600 dark:text-amber-400" },
    { label: "Open Security Alerts", value: stats.securityAlerts, href: "/internal/security", icon: ShieldAlert, color: "text-destructive" },
    { label: "Transcript Requests", value: stats.transcriptRequests, href: "/internal/learning", icon: GraduationCap, color: "text-primary" },
    { label: "Video Lessons", value: stats.videoLessons, href: "/internal/video-library", icon: MonitorPlay, color: "text-primary" },
    { label: "School Leads", value: stats.schoolLeads, href: "/internal/school-scorecards", icon: School, color: "text-primary" },
    { label: "Build Leads", value: stats.buildLeads, href: "/internal/build-scorecards", icon: Hammer, color: "text-primary" },
    { label: "Coaching Leads", value: stats.coachingLeads, href: "/internal/private-coaching", icon: CalendarClock, color: "text-primary" },
    { label: "SEO Opportunities", value: stats.seoOpportunities, href: "/internal/seo", icon: Search, color: "text-amber-600 dark:text-amber-400" }
  ]
  
  const quickActions = [
    { label: "Review Enrollments", href: "/internal/manual-payments" },
    { label: "Manage Courses", href: "/internal/video-library" },
    { label: "Open Learning Support", href: "/internal/learning" },
    { label: "View Marketing", href: "/internal/marketing" },
    { label: "Run SEO Queue", href: "/internal/seo" }
  ]

  return (
    <main className="space-y-10">
      
      {/* Header & Main Actions */}
      <div className="flex flex-col gap-6 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Dashboard</p>
          <h1 className="mt-1 font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Operations Overview
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            A cross-functional pulse check of enrollment, learning progression, marketing acquisition, service leads, and SEO trajectory.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          {quickActions.slice(0, 2).map((action) => (
            <Link 
              key={action.href} 
              href={action.href} 
              className="btn-primary shadow-sm"
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>

      <DashboardStatsVisibility storageKey="tochukwu-internal-dashboard-stats-visibility">
        {/* Primary Pulse Metrics */}
        <section>
          <h2 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Primary Pulse</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {primaryCards.map((card) => {
              const Icon = card.icon
              return (
                <article
                  className={`group relative flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5 ${card.border}`}
                  key={card.label}
                >
                  <Link
                    href={card.href}
                    aria-label={`Open ${card.label}`}
                    className="absolute inset-0 z-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  />
                  <div className="pointer-events-none relative z-10 flex items-center justify-between gap-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {card.label}
                    </p>
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${card.bg} ${card.color} transition-transform group-hover:scale-110`}>
                      <Icon className="h-5 w-5" />
                    </span>
                  </div>
                  <p className="pointer-events-none relative z-10 mt-6 pr-12 font-heading text-4xl font-black text-foreground">
                    <DashboardStatValue statKey={`primary:${card.label}`}>{card.value}</DashboardStatValue>
                  </p>
                  <div className="absolute bottom-5 right-5 z-20">
                    <DashboardStatToggle statKey={`primary:${card.label}`} />
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        {/* Secondary Metrics */}
        <section>
          <h2 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Secondary Metrics</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {secondaryCards.map((card) => {
              const Icon = card.icon
              return (
                <article
                  className="group relative flex min-h-32 items-center justify-between gap-4 rounded-xl border border-border bg-background p-5 pr-20 transition-all hover:border-primary/40 hover:bg-muted/30"
                  key={card.label}
                >
                  <Link
                    href={card.href}
                    aria-label={`Open ${card.label}`}
                    className="absolute inset-0 z-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  />
                  <div className="pointer-events-none relative z-10 min-w-0">
                    <p className="truncate text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition-colors group-hover:text-foreground">
                      {card.label}
                    </p>
                    <p className="mt-1 font-heading text-2xl font-black text-foreground">
                      <DashboardStatValue statKey={`secondary:${card.label}`}>{card.value}</DashboardStatValue>
                    </p>
                  </div>
                  <div className={`pointer-events-none absolute right-5 top-4 z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/50 transition-colors group-hover:bg-background ${card.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="absolute bottom-4 right-5 z-20">
                    <DashboardStatToggle statKey={`secondary:${card.label}`} />
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      </DashboardStatsVisibility>

      {/* Operational Shortcuts */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-muted/20 p-6 sm:p-8">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Quick Navigation</p>
          <h2 className="mt-1 font-heading text-xl font-bold text-foreground">Operational Shortcuts</h2>
        </div>
        <div className="p-6 sm:p-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {quickActions.map((action) => (
              <Link 
                key={action.href} 
                href={action.href} 
                className="group flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3.5 text-sm font-bold text-foreground transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary hover:shadow-sm"
              >
                <span className="truncate">{action.label}</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
              </Link>
            ))}
          </div>
        </div>
      </section>
      
    </main>
  )
}
