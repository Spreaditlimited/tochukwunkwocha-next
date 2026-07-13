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
      <section className="bg-[linear-gradient(rgba(13,79,154,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(13,79,154,0.08)_1px,transparent_1px)] bg-[size:44px_44px] py-16 sm:py-20">
        <div className="site-container">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.82fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-black text-primary ring-1 ring-primary/20">
                <ShieldCheck className="h-4 w-4" />
                Certificate Verification
              </div>
              <h1 className="mt-6 max-w-4xl font-heading text-4xl font-black tracking-tight text-foreground sm:text-6xl">
                Verify a certificate issued by Tochukwu Tech and AI Academy.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
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
