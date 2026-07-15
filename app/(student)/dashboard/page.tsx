import Link from "next/link"
import { 
  Award, 
  BookOpen, 
  CreditCard, 
  Globe, 
  UsersRound,
  ArrowRight
} from "lucide-react"

import {
  EmptyStudentState,
  StudentDashboardCard,
  StudentDashboardShell
} from "@/components/student-dashboard/StudentDashboardShell"
import { TrademarkText } from "@/components/TrademarkText"
import {
  formatMinorCurrency,
  getStudentOverview,
  statusLabel,
  statusTone
} from "@/lib/student-dashboard"
import { requireStudent } from "@/lib/student-auth"
import { formatDate } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function StudentDashboardPage() {
  const session = await requireStudent()
  const overview = await getStudentOverview(session.account.id, session.account.email)
  
  const paidCourses = overview.courses.filter((item) => item.isActive)
  const payments = overview.paymentRecords
  const availableSeats = overview.family.seats.reduce((sum, seat) => sum + seat.seatsAvailable, 0)

  const stats = [
    { label: "Active courses", value: paidCourses.length, icon: BookOpen, href: "/dashboard/courses" },
    { label: "Payment records", value: payments.length, icon: CreditCard, href: "/dashboard/courses" },
    { label: "Group seats", value: availableSeats, icon: UsersRound, href: "/dashboard/family" },
    { label: "Domains", value: overview.domains.length, icon: Globe, href: "/dashboard/domains" }
  ]

  return (
    <StudentDashboardShell 
      account={session.account} 
      active="overview" 
      title={`Welcome, ${session.account.fullName.split(' ')[0]}`}
      eyebrow="Dashboard Overview"
    >
      {/* Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.label} href={item.href} className="group no-underline">
              <StudentDashboardCard className="flex h-full flex-col justify-between p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{item.label}</p>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-6 font-heading text-3xl font-black text-foreground">{item.value}</p>
              </StudentDashboardCard>
            </Link>
          )
        })}
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[1.4fr_0.6fr]">
        
        {/* Main Column: Ledger & Courses */}
        <div className="grid gap-8">
          <StudentDashboardCard className="p-0 overflow-hidden">
            <div className="flex flex-col justify-between gap-4 border-b border-border bg-muted/20 p-6 sm:flex-row sm:items-center sm:p-8">
              <div>
                <p className="eyebrow text-primary">Learning access</p>
                <h2 className="mt-1 font-heading text-xl font-bold text-foreground">Recent Courses & Payments</h2>
              </div>
              <Link href="/dashboard/courses" className="btn-secondary whitespace-nowrap text-xs">
                View All
              </Link>
            </div>

            <div className="p-6 sm:p-8">
              {payments.length ? (
                <div className="grid gap-4">
                  {payments.slice(0, 5).map((item) => (
                    <div
                      key={`${item.source}-${item.uuid}`}
                      className="group flex flex-col justify-between gap-4 rounded-xl border border-border bg-background p-5 transition-colors hover:border-primary/20 hover:shadow-sm sm:flex-row sm:items-center"
                    >
                      <div>
                        <p className="font-heading text-base font-bold text-foreground">
                          <TrademarkText text={item.courseName} />
                        </p>
                        <p className="mt-1.5 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/50"></span>
                          {item.batchLabel || item.batchKey || "General access"} 
                          <span className="opacity-50">|</span> 
                          {formatMinorCurrency(item.currency, item.amountMinor)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                        <span className={`rounded-md border px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${statusTone(item.status)}`}>
                          {statusLabel(item.status)}
                        </span>
                        <span className="text-sm font-medium text-muted-foreground/80">{formatDate(item.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyStudentState
                  icon="book"
                  title="No course access yet"
                  description="Your paid courses and pending manual verifications will appear here once they are connected to this email address."
                  action={<Link href="/courses" className="btn-primary">Explore Courses</Link>}
                />
              )}
            </div>
          </StudentDashboardCard>
        </div>

        {/* Right Column: Widgets */}
        <div className="grid gap-8 self-start">
          
          {/* Action Card */}
          <StudentDashboardCard className="bg-gradient-to-br from-card to-muted/30">
            <p className="eyebrow text-primary">Next action</p>
            <h2 className="mt-2 font-heading text-xl font-black text-foreground">Continue Learning</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Open your course workspace to review your learning access, pending verification, and batch details.
            </p>
            <Link href="/dashboard/courses" className="btn-primary mt-6 w-full shadow-sm">
              Open Course Workspace
            </Link>
          </StudentDashboardCard>

          {/* Certificate Credential Widget */}
          <StudentDashboardCard className="relative overflow-hidden">
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-primary/5 blur-2xl pointer-events-none"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-4 border-b border-border pb-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Award className="h-6 w-6" />
                </div>
                <div>
                  <p className="eyebrow text-primary">Credential Profile</p>
                  <h2 className="mt-1 font-heading text-lg font-bold text-foreground">Certificate Settings</h2>
                </div>
              </div>
              
              <div className="mt-5 space-y-4">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Certificate records are automatically issued based on course completion and verification data.
                </p>
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Name Confirmation</p>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">
                      {session.account.certificateNameConfirmedAt ? "Confirmed" : "Not confirmed"}
                    </p>
                    <p className="text-xs font-medium text-muted-foreground">
                      {session.account.certificateNameConfirmedAt ? formatDate(session.account.certificateNameConfirmedAt) : "Action required"}
                    </p>
                  </div>
                </div>
                
                {!session.account.certificateNameConfirmedAt && (
                  <Link href="/dashboard/certificate" className="group mt-2 inline-flex items-center text-sm font-bold text-primary transition-colors hover:text-primary/80">
                    Verify name <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                )}
              </div>
            </div>
          </StudentDashboardCard>
          
        </div>
      </div>
    </StudentDashboardShell>
  )
}
