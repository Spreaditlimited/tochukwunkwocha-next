import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, BadgeCheck, ExternalLink, FileBadge } from "lucide-react"

import { CertificateShareActions } from "@/components/certificates/CertificateShareActions"
import {
  EmptyStudentState,
  StudentDashboardCard,
  StudentDashboardShell
} from "@/components/student-dashboard/StudentDashboardShell"
import { CertificateActionsPanel } from "@/components/student-dashboard/CertificateActionsPanel"
import { StudentProjectLinksPanel } from "@/components/student-dashboard/StudentProjectLinksPanel"
import { PrintCertificateButton } from "@/components/schools/PrintCertificateButton"
import { TrademarkText } from "@/components/TrademarkText"
import { brand } from "@/lib/brand"
import { certificateProjectNote } from "@/lib/certificate-verification"
import { absoluteUrl } from "@/lib/site-seo"
import { hasVerifiedStudentProjectProfile, listStudentProjectLinks } from "@/lib/student-project-links"
import { courseName, getStudentCertificatePublic, listStudentCertificates, listStudentCourses, statusLabel, statusTone } from "@/lib/student-dashboard"
import { requireStudent } from "@/lib/student-auth"
import { formatDate } from "@/lib/utils"

export const dynamic = "force-dynamic"

function formatIssuedDate(value: string | Date | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "-"
  return new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "long", day: "numeric" }).format(date)
}

function CertificateDocumentView({
  certificateNo,
  certificate
}: {
  certificateNo: string
  certificate: Awaited<ReturnType<typeof getStudentCertificatePublic>>
}) {
  const verificationPath = certificate ? `/certificates/verify/${encodeURIComponent(certificate.certificateNo)}` : ""
  const shareImagePath = certificate ? `/api/certificates/${encodeURIComponent(certificate.certificateNo)}/image` : ""
  const verificationUrl = verificationPath ? absoluteUrl(verificationPath) : ""
  return (
    <main className="min-h-screen bg-[#071426] px-5 py-8 text-slate-900">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page { size: landscape; margin: 0; }
              body { background: #ffffff !important; }
              .no-print { display: none !important; }
              #studentCertificateCard { box-shadow: none !important; border: 0 !important; margin: 0 auto !important; max-width: 100% !important; min-height: 100vh !important; }
            }
          `
        }}
      />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(117,200,232,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(117,200,232,0.08)_1px,transparent_1px)] bg-[size:46px_46px]" />
      <div className="relative mx-auto max-w-6xl">
        <div className="no-print mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/dashboard/courses" className="btn-secondary bg-white/95 text-slate-900 hover:bg-white">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to My Courses
          </Link>
          {certificate ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <PrintCertificateButton />
              <CertificateShareActions
                verificationUrl={verificationPath}
                shareImageUrl={shareImagePath}
                certificateNo={certificate.certificateNo}
              />
            </div>
          ) : null}
        </div>

        <p className={`no-print mb-3 text-sm ${certificate ? "text-slate-200" : "text-red-200"}`}>
          {!certificateNo ? "Missing certificate number." : certificate ? "Certificate ready. Use Print / Save PDF to download." : "Certificate not found."}
        </p>

        {certificate ? (
          <section
            id="studentCertificateCard"
            className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-8 shadow-2xl sm:p-12 lg:p-16"
          >
            <div className="absolute inset-4 rounded-lg border-2 border-[#0d4f9a]/20" />
            <div className="absolute left-8 top-8 h-24 w-24 rounded-full bg-sky-100 blur-2xl" />
            <div className="absolute bottom-8 right-8 h-32 w-32 rounded-full bg-blue-100 blur-2xl" />

            <div className="relative">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="relative h-16 w-72 max-w-full">
                  <Image src={brand.assets.logo} alt={brand.name} fill sizes="288px" className="object-contain object-left" priority />
                </div>
                <div className="inline-flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#0d4f9a]/20 bg-[#0d4f9a]/5 text-[#0d4f9a]">
                  <BadgeCheck className="h-10 w-10" />
                </div>
              </div>

              <div className="mx-auto mt-14 max-w-3xl text-center">
                <p className="text-sm font-black uppercase tracking-[0.35em] text-[#0d4f9a]">{brand.name}</p>
                <h1 className="mt-5 font-heading text-4xl font-black tracking-tight text-[#06162d] sm:text-6xl">
                  Certificate of Completion
                </h1>
                <p className="mt-8 text-sm font-bold uppercase tracking-[0.25em] text-slate-500">This certifies that</p>
                <p className="mt-4 font-heading text-4xl font-black text-[#06162d] sm:text-5xl">{certificate.studentName}</p>
                <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600">
                  has successfully completed <span className="font-bold text-[#06162d]">{certificate.courseName}</span>
                </p>
              </div>

              <div className="mt-16 grid gap-5 border-t border-slate-200 pt-8 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Certificate No</p>
                  <p className="mt-2 font-mono text-lg font-black text-[#06162d]">{certificate.certificateNo}</p>
                  <p className="mt-2 text-xs text-slate-500">Verify: {verificationUrl}</p>
                </div>
                <div className="sm:text-right">
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Date Issued</p>
                  <p className="mt-2 text-lg font-black text-[#06162d]">{formatIssuedDate(certificate.issuedAt)}</p>
                </div>
              </div>
              {certificate.projectUrl ? (
                <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Verified Project</p>
                  <a href={certificate.projectUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex max-w-full items-center break-all text-sm font-bold text-[#0d4f9a]">
                    {certificate.projectUrl}
                    <ExternalLink className="ml-2 h-4 w-4 shrink-0" />
                  </a>
                  <p className="mt-3 text-xs leading-6 text-slate-500">{certificateProjectNote()}</p>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  )
}

export default async function StudentCertificatesPage({
  searchParams
}: {
  searchParams?: Promise<{ certificate_no?: string; certificateNo?: string }>
}) {
  const params = searchParams ? await searchParams : {}
  const requestedCertificateNo = String(params.certificate_no || params.certificateNo || "").trim().toUpperCase()
  if (requestedCertificateNo) {
    const certificate = await getStudentCertificatePublic(requestedCertificateNo)
    return <CertificateDocumentView certificateNo={requestedCertificateNo} certificate={certificate} />
  }

  const session = await requireStudent()
  const certificates = await listStudentCertificates(session.account.id)
  const courses = await listStudentCourses(session.account.email, session.account.id)
  const [projectLinks, canAddProjectLinks] = await Promise.all([
    listStudentProjectLinks(session.account.id),
    hasVerifiedStudentProjectProfile(session.account.id)
  ])
  const activeCourses = Array.from(
    new Map(
      courses
        .filter((course) => course.isActive)
        .map((course) => [course.courseSlug, { courseSlug: course.courseSlug, courseName: course.courseName }])
    ).values()
  )
  const certificateOptions = certificates.map((certificate) => ({
    certificateNo: certificate.certificateNo,
    courseSlug: certificate.courseSlug,
    label: `${courseName(certificate.courseSlug)} · ${certificate.certificateNo}`
  }))
  const certificateContent = certificates.length ? (
    <div className="grid gap-5">
      {certificates.map((certificate) => (
        <StudentDashboardCard 
          key={certificate.certificateNo}
          className="flex h-full flex-col overflow-hidden p-0 transition-all hover:border-primary/30 hover:shadow-md"
        >
          <div className="flex-1 bg-background p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileBadge className="h-5 w-5" />
                </div>
                <p className="min-w-0 break-all font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
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

            <div className="mt-6 grid gap-4 rounded-lg border border-border bg-muted/20 p-4 sm:grid-cols-2">
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

          <div className="border-t border-border bg-muted/10 p-6 sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href={certificate.certificateUrl}
                target="_blank"
                className="btn-secondary w-full sm:w-auto"
              >
                View & Download Certificate
                <ExternalLink className="ml-2 h-4 w-4 text-muted-foreground" />
              </Link>
            </div>
          </div>
        </StudentDashboardCard>
      ))}
    </div>
  ) : (
    <EmptyStudentState
      icon="award"
      title="No certificates yet"
      description="Certificates issued from completed course work and approved verification will appear here automatically."
      action={
        <Link href="/dashboard/courses" className="btn-primary shadow-sm">
          Go to Courses
        </Link>
      }
    />
  )

  return (
    <StudentDashboardShell 
      account={session.account} 
      active="certificate" 
      title="Certificates"
      eyebrow="Certificates"
    >
      <StudentDashboardCard className="overflow-hidden bg-gradient-to-br from-card to-muted/30 p-0">
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
          certificateContent={certificateContent}
        />
      </div>

      <div className="mt-6">
        <StudentProjectLinksPanel
          initialLinks={projectLinks}
          courses={activeCourses}
          certificates={certificateOptions}
          canAddLinks={canAddProjectLinks}
        />
      </div>
    </StudentDashboardShell>
  )
}
