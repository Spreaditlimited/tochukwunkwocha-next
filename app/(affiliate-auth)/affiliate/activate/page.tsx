import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, BadgeCheck, CircleAlert, ShieldCheck } from "lucide-react"

import { SubmitButton } from "@/components/SubmitButton"
import { getPublicAffiliateActivation } from "@/lib/affiliate-onboarding"
import { buildMetadata } from "@/lib/site-seo"
import { activatePublicAffiliateAction } from "../actions"

export const dynamic = "force-dynamic"
export const metadata: Metadata = buildMetadata({ title: "Activate Affiliate Account", description: "Secure affiliate account activation.", path: "/affiliate/activate", noIndex: true })

export default async function AffiliateActivatePage({ searchParams }: { searchParams?: Promise<{ token?: string; error?: string }> }) {
  const params = searchParams ? await searchParams : {}
  const token = String(params.token || "").trim()
  const activation = token ? await getPublicAffiliateActivation(token) : null

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/20 p-5 sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]" />

      <div className="relative z-10 w-full max-w-xl">
        <div className="mb-8 text-center">
          <Link href="/affiliate" className="group mb-6 inline-flex items-center text-sm font-bold text-muted-foreground transition-colors hover:text-primary">
            <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to Affiliate Programme
          </Link>
          <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border shadow-sm ${activation ? "border-primary/20 bg-primary/10 text-primary" : "border-destructive/20 bg-destructive/10 text-destructive"}`}>
            {activation ? <ShieldCheck className="h-8 w-8" /> : <CircleAlert className="h-8 w-8" />}
          </div>
        </div>

        <section className="surface-raised bg-card p-8 text-center shadow-xl sm:p-10">
          {activation ? (
            <>
              <p className="eyebrow text-primary">Email confirmed</p>
              <h1 className="mt-2 font-heading text-3xl font-black">Activate your partner account</h1>
              <p className="mt-4 leading-relaxed text-muted-foreground">Hello {activation.fullName}. Complete activation to sign in and open your affiliate dashboard and referral links.</p>
              <form action={activatePublicAffiliateAction} className="mt-8">
                <input type="hidden" name="token" value={token} />
                <SubmitButton pendingText="Activating..." className="btn-primary w-full px-8 py-3.5 text-base shadow-lg shadow-primary/20">
                  Activate Account <BadgeCheck className="ml-2 h-4 w-4" />
                </SubmitButton>
              </form>
            </>
          ) : (
            <>
              <h1 className="font-heading text-3xl font-black">Activation link unavailable</h1>
              <p className="mt-4 leading-relaxed text-muted-foreground">{params.error || "This link is invalid, expired, or has already been used."}</p>
              <Link href="/affiliate/register" className="btn-primary mt-8">Register or Request a New Link</Link>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
