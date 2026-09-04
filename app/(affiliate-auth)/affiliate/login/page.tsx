import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { AlertCircle, ArrowLeft, LockKeyhole, Mail, ShieldCheck } from "lucide-react"

import { PasswordField } from "@/components/PasswordField"
import { SubmitButton } from "@/components/SubmitButton"
import { getStudentSession } from "@/lib/student-auth"
import { buildMetadata } from "@/lib/site-seo"
import { affiliateLoginAction } from "../actions"

export const dynamic = "force-dynamic"
export const metadata: Metadata = buildMetadata({ title: "Affiliate Partner Sign In", description: "Sign in to your affiliate partner dashboard.", path: "/affiliate/login", noIndex: true })

export default async function AffiliateLoginPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const session = await getStudentSession()
  if (session) redirect("/dashboard/affiliate")
  const params = searchParams ? await searchParams : {}
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/20 p-5 sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/affiliate" className="group mb-6 inline-flex items-center text-sm font-bold text-muted-foreground transition-colors hover:text-primary">
            <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to Affiliate Programme
          </Link>
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 shadow-sm">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">Partner sign in</h1>
          <p className="mt-3 text-base text-muted-foreground">Access your referral links, earnings, and payout details.</p>
        </div>

        <section className="surface-raised overflow-hidden bg-card p-6 shadow-xl sm:p-10">
          <form action={affiliateLoginAction} className="grid gap-6">
            {params.error ? (
              <div className="flex items-start gap-3 rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="font-medium leading-relaxed">{params.error}</p>
              </div>
            ) : null}

            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                <Mail className="h-3.5 w-3.5" /> Email Address
              </span>
              <input name="email" type="email" required autoComplete="email" placeholder="you@example.com" className="w-full rounded-md border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary" />
            </label>

            <label className="block">
              <span className="mb-2 flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                <span className="flex items-center gap-2"><LockKeyhole className="h-3.5 w-3.5" /> Password</span>
                <Link href="/affiliate/reset-password" className="tracking-normal text-primary hover:text-primary/80">Forgot?</Link>
              </span>
              <PasswordField name="password" required autoComplete="current-password" placeholder="••••••••" />
            </label>

            <SubmitButton pendingText="Signing in..." className="btn-primary mt-2 w-full px-8 py-3.5 text-base shadow-lg shadow-primary/20">
              Sign In Securely
            </SubmitButton>
          </form>
        </section>

        <div className="mt-8 text-center text-sm font-medium text-muted-foreground">
          <p>Use the email and password created during affiliate registration.</p>
          <p className="mt-2">New partner? <Link href="/affiliate/register" className="font-bold text-primary hover:underline">Create an affiliate account</Link>.</p>
        </div>
      </div>
    </main>
  )
}
