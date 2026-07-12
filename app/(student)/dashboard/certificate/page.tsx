import Link from "next/link"
import { Award, ExternalLink, FileBadge } from "lucide-react"

import {
  EmptyStudentState,
  StudentDashboardCard,
  StudentDashboardShell
} from "@/components/student-dashboard/StudentDashboardShell"
import { CertificateActionsPanel } from "@/components/student-dashboard/CertificateActionsPanel"
import { TrademarkText } from "@/components/TrademarkText"
import { courseName, listStudentCertificates, listStudentCourses, statusLabel, statusTone } from "@/lib/student-dashboard"
import { requireStudent } from "@/lib/student-auth"
import { formatDate } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function StudentCertificatesPage() {
  const session = await requireStudent()
  const [certificates, courses] = await Promise.all([
    listStudentCertificates(session.account.id),
    listStudentCourses(session.account.email)
  ])
  const activeCourses = Array.from(
    new Map(
      courses
        .filter((course) => course.isActive)
        .map((course) => [course.courseSlug, { courseSlug: course.courseSlug, courseName: course.courseName }])
    ).values()
  )

  return (
    <StudentDashboardShell 
      account={session.account} 
      active="certificate" 
      title="Certificates"
      eyebrow="Certificates"
    >
      {/* Header Section */}
      <StudentDashboardCard className="bg-gradient-to-br from-card to-muted/30 p-0 overflow-hidden">
        <div className="p-6 sm:p-8">
          <p className="eyebrow text-primary">Issued Certificates</p>
          <h2 className="mt-2 font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Your Certificates
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Manage and download your official academy certificates. Certificates are issued upon course completion, successful identity verification, and project approval.
          </p>
        </div>
      </StudentDashboardCard>

      <div className="mt-6">
        <CertificateActionsPanel
          certificateNameConfirmedAt={session.account.certificateNameConfirmedAt?.toISOString() || null}
          courses={activeCourses}
        />
      </div>

      {/* Certificates Grid */}
      <div className="mt-8">
        {certificates.length ? (
          <div className="grid gap-6 xl:grid-cols-2">
            {certificates.map((certificate) => (
              <StudentDashboardCard 
                key={certificate.certificateNo}
                className="flex h-full flex-col overflow-hidden p-0 transition-all hover:border-primary/30 hover:shadow-md"
              >
                {/* Card Header & Body */}
                <div className="flex-1 bg-background p-6 sm:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <FileBadge className="h-5 w-5" />
                      </div>
                      <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        ID: {certificate.certificateNo}
                      </p>
                    </div>
                    <span className={`inline-flex w-fit items-center rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${statusTone(certificate.status)}`}>
                      {statusLabel(certificate.status)}
                    </span>
                  </div>

                  <div className="mt-6">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Programme</p>
                    <h2 className="mt-1 font-heading text-xl font-black leading-tight text-foreground sm:text-2xl">
                      <TrademarkText text={courseName(certificate.courseSlug)} />
                    </h2>
                  </div>

                  <div className="mt-6 grid gap-4 rounded-xl border border-border bg-muted/20 p-4 sm:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recipient</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {certificate.recipientName || session.account.fullName}
                      </p>
                    </div>
                    <div className="pt-2 sm:border-l sm:border-border sm:pl-4 sm:pt-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Issued On</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {formatDate(certificate.issuedAt)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="border-t border-border bg-muted/10 p-6 sm:p-8">
                  <Link
                    href={certificate.certificateUrl}
                    className="btn-secondary w-full sm:w-auto"
                  >
                    View & Download Certificate
                    <ExternalLink className="ml-2 h-4 w-4 text-muted-foreground" />
                  </Link>
                </div>
              </StudentDashboardCard>
            ))}
          </div>
        ) : (
          <EmptyStudentState
            icon={Award}
            title="No certificates yet"
            description="Certificates issued from completed course work and approved verification will appear here automatically."
            action={
              <Link href="/dashboard/courses" className="btn-primary shadow-sm">
                Go to Courses
              </Link>
            }
          />
        )}
      </div>
    </StudentDashboardShell>
  )
}
