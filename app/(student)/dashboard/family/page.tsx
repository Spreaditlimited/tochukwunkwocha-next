import Link from "next/link"
import { KeyRound, ShieldCheck, Ticket, UserRound, Users, UsersRound } from "lucide-react"

import {
  EmptyStudentState,
  StudentDashboardCard,
  StudentDashboardShell
} from "@/components/student-dashboard/StudentDashboardShell"
import { BatchSwitchPanel, type BatchSwitchEnrollment } from "@/components/student-dashboard/BatchSwitchPanel"
import { GroupEnrollmentPanel } from "@/components/student-dashboard/GroupEnrollmentPanel"
import { TrademarkText } from "@/components/TrademarkText"
import { getBatchSwitchOptions } from "@/lib/student-batch-switch"
import { courseName, getFamilyDashboard, listActiveLearningCourseOptions, statusLabel, statusTone } from "@/lib/student-dashboard"
import { requireStudent } from "@/lib/student-auth"
import { formatDate } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function StudentFamilyPage() {
  const session = await requireStudent()
  const [data, courses, batchSwitchOptions] = await Promise.all([
    getFamilyDashboard(session.account.id),
    listActiveLearningCourseOptions(),
    getBatchSwitchOptions(session.account)
  ])
  const batchSwitchEnrollments: BatchSwitchEnrollment[] = batchSwitchOptions.map((item) => ({
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    courseSlug: item.courseSlug,
    batchKey: item.batchKey,
    batchLabel: item.batchLabel,
    batchStartText: item.batchStartText,
    currentBatchIsFuture: item.currentBatchIsFuture,
    seatCount: item.seatCount,
    canSwitch: item.canSwitch,
    lockedReason: item.lockedReason,
    options: item.options.map((option) => ({
      batchKey: option.batchKey,
      batchLabel: option.batchLabel,
      batchStartText: option.batchStartText,
      remainingSeats: option.remainingSeats
    }))
  }))
  
  const totalPurchased = data.seats.reduce((sum, seat) => sum + seat.seatsPurchased, 0)
  const totalAvailable = data.seats.reduce((sum, seat) => sum + seat.seatsAvailable, 0)

  return (
    <StudentDashboardShell 
      account={session.account} 
      active="family" 
      title="Group Workspace"
      eyebrow="Group Management"
    >
      <GroupEnrollmentPanel seats={data.seats} courses={courses} />

      {/* 1. High-Level Metrics */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StudentDashboardCard className="flex flex-col justify-between p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Group Account</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-6 font-heading text-2xl font-black text-foreground capitalize">
            {data.family ? statusLabel(data.family.status) : "Not created"}
          </p>
        </StudentDashboardCard>
        
        <StudentDashboardCard className="flex flex-col justify-between p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Purchased Seats</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Ticket className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-6 font-heading text-3xl font-black text-foreground">{totalPurchased}</p>
        </StudentDashboardCard>
        
        <StudentDashboardCard className="flex flex-col justify-between p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Available Seats</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-6 font-heading text-3xl font-black text-foreground">{totalAvailable}</p>
        </StudentDashboardCard>
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[0.8fr_1.2fr] lg:items-start">
        
        {/* 2. Seat Balances Column */}
        <StudentDashboardCard className="p-0 overflow-hidden">
          <div className="border-b border-border bg-muted/20 p-6 sm:p-8">
            <p className="eyebrow text-primary">Seat Balances</p>
            <h2 className="mt-1 font-heading text-xl font-bold text-foreground">Group Learning Seats</h2>
          </div>

          <div className="p-6 sm:p-8">
            {data.seats.length ? (
              <div className="grid gap-4">
                {data.seats.map((seat) => (
                  <div 
                    key={`${seat.courseSlug}-${seat.batchKey || ""}`} 
                    className="rounded-xl border border-border bg-background p-5 shadow-sm transition-colors hover:border-primary/20"
                  >
                    <div className="border-b border-border pb-4">
                      <p className="font-heading text-base font-bold text-foreground">
                        <TrademarkText text={courseName(seat.courseSlug)} />
                      </p>
                      <p className="mt-1.5 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/50"></span>
                        {seat.batchLabel || seat.batchKey || "General access"}
                      </p>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Purchased</p>
                        <p className="mt-1 font-heading text-lg font-black text-foreground">{seat.seatsPurchased}</p>
                      </div>
                      <div className="border-l border-border">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Used</p>
                        <p className="mt-1 font-heading text-lg font-black text-foreground">{seat.seatsUsed}</p>
                      </div>
                      <div className="border-l border-border">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Open</p>
                        <p className="mt-1 font-heading text-lg font-black text-primary">{seat.seatsAvailable}</p>
                      </div>
                    </div>
                    <BatchSwitchPanel
                      enrollments={batchSwitchEnrollments}
                      sourceType="family"
                      courseSlug={seat.courseSlug}
                      batchKey={seat.batchKey}
                      compact
                      showUnavailable
                    />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyStudentState
                icon={UsersRound}
                title="No group seats"
                description="Group seat purchases connected to this account will appear here."
                action={<Link href="/courses/prompt-to-profit" className="btn-primary shadow-sm">Explore Programmes</Link>}
              />
            )}
          </div>
        </StudentDashboardCard>

        {/* 3. Assigned Learners Column */}
        <StudentDashboardCard className="p-0 overflow-hidden">
          <div className="border-b border-border bg-muted/20 p-6 sm:p-8">
            <p className="eyebrow text-primary">Learners</p>
            <h2 className="mt-1 font-heading text-xl font-bold text-foreground">Assigned Children</h2>
          </div>

          <div className="p-6 sm:p-8">
            {data.children.length ? (
              <div className="grid gap-5">
                {data.children.map((child) => (
                  <div 
                    key={`${child.childUuid}-${child.courseSlug}-${child.batchKey || ""}`} 
                    className="group relative overflow-hidden rounded-xl border border-border bg-background p-5 transition-shadow hover:shadow-sm"
                  >
                    {/* Header: User Info & Status */}
                    <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-start">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <UserRound className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="font-heading text-lg font-bold text-foreground">{child.fullName}</p>
                          <p className="text-sm font-medium text-muted-foreground">
                            {child.email || child.classLevel || child.age}
                          </p>
                        </div>
                      </div>
                      <span className={`inline-flex w-fit items-center rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${statusTone(child.enrollmentStatus || child.status)}`}>
                        {statusLabel(child.enrollmentStatus || child.status)}
                      </span>
                    </div>
                    
                    {/* Body: Course Data */}
                    <div className="mt-5 grid gap-4 sm:grid-cols-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Course</p>
                        <p className="mt-1 text-sm font-semibold text-foreground truncate" title={child.courseSlug ? courseName(child.courseSlug) : "Not assigned"}>
                          <TrademarkText text={child.courseSlug ? courseName(child.courseSlug) : "Not assigned"} />
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Batch</p>
                        <p className="mt-1 text-sm font-semibold text-foreground truncate">
                          {child.batchLabel || child.batchKey || "Not assigned"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Paid Date</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {formatDate(child.paidAt)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Footer: Access Code */}
                    {child.accessCode ? (
                      <div className="mt-5 inline-flex w-full items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm font-bold text-primary sm:w-auto">
                        <KeyRound className="h-4 w-4 shrink-0" />
                        <span>Access code: <span className="font-mono tracking-widest">{child.accessCode}</span></span>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyStudentState
                icon={UserRound}
                title="No learners assigned"
                description="Learners assigned to group seats will appear here with their course, batch, status, and access code."
              />
            )}
          </div>
        </StudentDashboardCard>
        
      </div>
    </StudentDashboardShell>
  )
}
