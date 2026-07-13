import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, BadgeCheck, ExternalLink } from "lucide-react"

import { CertificateShareActions } from "@/components/certificates/CertificateShareActions"
import { PrintCertificateButton } from "@/components/schools/PrintCertificateButton"
import { brand } from "@/lib/brand"
import { certificateProjectNote } from "@/lib/certificate-verification"
import { getSchoolCertificatePublic } from "@/lib/school-dashboard"
import { absoluteUrl, buildMetadata } from "@/lib/site-seo"

export const metadata: Metadata = buildMetadata({
  title: "School Certificate | Tochukwu Tech and AI Academy",
  description: "View and download an issued school student certificate.",
  path: "/schools/certificate",
  noIndex: true
})

function formatIssuedDate(value: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "-"
  return new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "long", day: "numeric" }).format(date)
}

export default async function SchoolCertificatePage({
  searchParams
}: {
  searchParams?: Promise<{ certificate_no?: string; certificateNo?: string }>
}) {
  const params = searchParams ? await searchParams : {}
  const certificateNo = params.certificate_no || params.certificateNo || ""
  const certificate = certificateNo ? await getSchoolCertificatePublic(certificateNo) : null
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
              #schoolCertificateCard { box-shadow: none !important; border: 0 !important; margin: 0 auto !important; max-width: 100% !important; min-height: 100vh !important; }
            }
          `
        }}
      />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(117,200,232,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(117,200,232,0.08)_1px,transparent_1px)] bg-[size:46px_46px]" />
      <div className="relative mx-auto max-w-6xl">
        <div className="no-print mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/schools/dashboard" className="btn-secondary bg-white/95 text-slate-900 hover:bg-white">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to School Dashboard
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
          {!certificateNo ? "Missing certificate number." : certificate ? "Certificate verified." : "Certificate not found."}
        </p>

        {certificate ? (
          <section
            id="schoolCertificateCard"
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
                <p className="mt-6 text-sm font-bold uppercase tracking-[0.25em] text-slate-500">Under the instruction of</p>
                <p className="mt-3 font-heading text-2xl font-black text-[#06162d]">{certificate.schoolName}</p>
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
