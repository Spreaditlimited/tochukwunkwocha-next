import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { BadgeCheck, ExternalLink, ShieldCheck } from "lucide-react"

import { certificateProjectNote, getVerifiedCertificate } from "@/lib/certificate-verification"
import { buildMetadata } from "@/lib/site-seo"

export const dynamic = "force-dynamic"

function formatIssuedDate(value: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "-"
  return new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "long", day: "numeric" }).format(date)
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ certificateNo: string }>
}): Promise<Metadata> {
  const { certificateNo } = await params
  const certificate = await getVerifiedCertificate(certificateNo)
  if (!certificate) {
    return buildMetadata({
      title: "Certificate Not Found | Tochukwu Tech and AI Academy",
      description: "This certificate could not be verified.",
      path: `/certificates/verify/${encodeURIComponent(certificateNo)}`,
      noIndex: true
    })
  }
  return buildMetadata({
    title: `Verified Certificate | ${certificate.recipientName}`,
    description: `Verify ${certificate.recipientName}'s ${certificate.courseName} certificate from Tochukwu Tech and AI Academy.`,
    path: `/certificates/verify/${encodeURIComponent(certificate.certificateNo)}`,
    image: certificate.shareImageUrl,
    noIndex: true
  })
}

export default async function CertificateVerificationPage({
  params
}: {
  params: Promise<{ certificateNo: string }>
}) {
  const { certificateNo } = await params
  const certificate = await getVerifiedCertificate(certificateNo)
  if (!certificate) notFound()

  return (
    <main className="bg-background text-foreground">
      <section className="bg-[linear-gradient(rgba(13,79,154,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(13,79,154,0.08)_1px,transparent_1px)] bg-[size:44px_44px] py-10 sm:py-14">
        <div className="site-container">
          <div className="mb-6">
            <Link href="/certificates/verify" className="btn-secondary">
              Verify Another Certificate
            </Link>
          </div>

          <section className="overflow-hidden rounded-lg bg-white shadow-xl ring-1 ring-slate-200 dark:bg-[#091527] dark:ring-white/10">
            <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="p-6 sm:p-10">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-200 dark:ring-emerald-400/25">
                  <BadgeCheck className="h-4 w-4" />
                  Verified Certificate
                </div>
                <h1 className="mt-8 font-heading text-4xl font-black tracking-tight text-[#06162d] dark:text-white sm:text-6xl">
                  {certificate.recipientName}
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                  This certificate was issued by <span className="font-bold text-[#06162d] dark:text-white">{certificate.issuerName}</span> for completing{" "}
                  <span className="font-bold text-[#06162d] dark:text-white">{certificate.courseName}</span>.
                </p>

                <div className="mt-10 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Certificate No</p>
                    <p className="mt-2 break-all font-mono text-sm font-black text-[#06162d] dark:text-white">{certificate.certificateNo}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Date Issued</p>
                    <p className="mt-2 text-base font-black text-[#06162d] dark:text-white">{formatIssuedDate(certificate.issuedAt)}</p>
                  </div>
                  {certificate.schoolName ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5 sm:col-span-2">
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">School</p>
                      <p className="mt-2 text-base font-black text-[#06162d] dark:text-white">{certificate.schoolName}</p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="bg-[#06162d] p-6 text-white sm:p-10">
                <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-sky-300 text-[#06162d]">
                  <ShieldCheck className="h-8 w-8" />
                </div>
                <h2 className="mt-8 font-heading text-2xl font-black">Verification Details</h2>
                <p className="mt-4 text-sm leading-7 text-slate-300">
                  This page confirms that the certificate number above exists in the academy records and is currently marked as issued.
                </p>

                {certificate.projectUrl ? (
                  <div className="mt-8 rounded-lg border border-white/10 bg-white/5 p-5">
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-200">Student Project</p>
                    <a
                      href={certificate.projectUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex max-w-full items-center break-all text-sm font-bold text-white underline decoration-sky-300 underline-offset-4"
                    >
                      {certificate.projectUrl}
                      <ExternalLink className="ml-2 h-4 w-4 shrink-0" />
                    </a>
                    <p className="mt-4 text-xs leading-6 text-slate-300">{certificateProjectNote()}</p>
                  </div>
                ) : (
                  <div className="mt-8 rounded-lg border border-white/10 bg-white/5 p-5">
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-200">Student Project</p>
                    <p className="mt-3 text-sm leading-7 text-slate-300">
                      No public project link is attached to this certificate record.
                    </p>
                  </div>
                )}

                <Link href="/" className="btn-secondary mt-8 bg-white text-[#06162d] hover:bg-slate-100">
                  Visit Academy Website
                </Link>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}
