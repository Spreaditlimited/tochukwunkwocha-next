import type { Metadata } from "next"
import Link from "next/link"
import { Award, BadgeCheck, ExternalLink, ShieldCheck } from "lucide-react"

import { CertificateLookupForm } from "@/components/certificates/CertificateLookupForm"
import { buildMetadata } from "@/lib/site-seo"

export const metadata: Metadata = buildMetadata({
  title: "Verify Certificate | Tochukwu Tech and AI Academy",
  description: "Verify a Tochukwu Tech and AI Academy certificate number and view the linked student project where available.",
  path: "/certificates/verify",
  noIndex: true
})

export default function CertificateLookupPage() {
  return (
    <main className="bg-background text-foreground">
      <section className="relative overflow-hidden bg-brand-ink py-16 text-white sm:py-20">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]"></div>
        <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-sky/15 blur-[150px]"></div>
        <div className="site-container relative z-10">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.82fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-brand-sky/10 px-4 py-2 text-sm font-black text-brand-sky ring-1 ring-brand-sky/20">
                <ShieldCheck className="h-4 w-4" />
                Certificate Verification
              </div>
              <h1 className="mt-6 max-w-4xl font-heading text-4xl font-black tracking-tight text-white sm:text-6xl">
                Verify a certificate issued by Tochukwu Tech and AI Academy.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
                Enter the certificate number exactly as shown on the certificate. If the record is valid, you will see the recipient, programme, issue date, and linked project where available.
              </p>

              <CertificateLookupForm />
            </div>

            <div className="rounded-lg bg-[#06162d] p-6 text-white shadow-xl sm:p-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-sky-300 text-[#06162d]">
                <BadgeCheck className="h-7 w-7" />
              </div>
              <h2 className="mt-8 font-heading text-2xl font-black">What verification shows</h2>
              <div className="mt-6 grid gap-4">
                {[
                  "Whether the certificate exists in academy records.",
                  "The name and programme attached to the certificate.",
                  "The issue date and certificate number.",
                  "The student project link where one was reviewed at issuance."
                ].map((item) => (
                  <div key={item} className="flex gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
                    <Award className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" />
                    <p className="text-sm leading-6 text-slate-200">{item}</p>
                  </div>
                ))}
              </div>
              <Link href="/projects" className="btn-secondary mt-8 bg-white text-[#06162d] hover:bg-slate-100">
                View Student Projects
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
