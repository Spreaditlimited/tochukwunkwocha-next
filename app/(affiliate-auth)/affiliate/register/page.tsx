import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { AlertCircle, ArrowLeft, CheckCircle2, LockKeyhole, Mail, Phone, ShieldCheck, UserRound } from "lucide-react"

import { PasswordField } from "@/components/PasswordField"
import { SubmitButton } from "@/components/SubmitButton"
import { getStudentSession } from "@/lib/student-auth"
import { buildMetadata } from "@/lib/site-seo"
import { registerPublicAffiliateAction } from "../actions"

export const dynamic = "force-dynamic"
export const metadata: Metadata = buildMetadata({ title: "Register as an Affiliate", description: "Create your affiliate partner account.", path: "/affiliate/register", noIndex: true })

export default async function AffiliateRegisterPage({ searchParams }: { searchParams?: Promise<{ error?: string; submitted?: string; existing_student?: string }> }) {
  const session = await getStudentSession()
  if (session) redirect("/dashboard/affiliate")
  const params = searchParams ? await searchParams : {}
  const submitted = params.submitted === "1"
  const existingStudent = params.existing_student === "1"

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/20 p-5 sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]" />

      <div className="relative z-10 w-full max-w-2xl py-8">
        <div className="mb-8 text-center">
          <Link href="/affiliate" className="group mb-6 inline-flex items-center text-sm font-bold text-muted-foreground transition-colors hover:text-primary">
            <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to Affiliate Programme
          </Link>
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 shadow-sm">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">
            {existingStudent ? "You already have a student account" : submitted ? "Check your email" : "Become an Affiliate Partner"}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
            {existingStudent
              ? "You do not need to create another account to join the Affiliate Programme."
              : submitted
              ? "Use the secure link we sent to activate your account. It expires in 24 hours."
              : "Create a secure partner account. No course purchase or student enrolment is required."}
          </p>
        </div>

        {existingStudent ? (
          <section className="surface-raised bg-card p-8 text-center shadow-xl sm:p-10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <UserRound className="h-7 w-7" />
            </div>
            <p className="mx-auto mt-5 max-w-lg leading-relaxed text-muted-foreground">
              This email is already connected to a student account. Sign in with your existing student email and password, then open <strong className="text-foreground">Affiliate</strong> in your dashboard.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/dashboard/login?next=%2Fdashboard%2Faffiliate" className="btn-primary">Sign in to Student Account</Link>
              <Link href="/dashboard/reset-password" className="btn-secondary">Reset Student Password</Link>
            </div>
          </section>
        ) : submitted ? (
          <section className="surface-raised bg-card p-8 text-center shadow-xl sm:p-10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <p className="mx-auto mt-5 max-w-lg leading-relaxed text-muted-foreground">
              If this registration is eligible for activation, the next step has been sent to the email address provided. Confirming the link signs you in and opens your affiliate dashboard.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/affiliate/login" className="btn-primary">Partner Sign In</Link>
              <Link href="/affiliate" className="btn-secondary">Programme Details</Link>
            </div>
          </section>
        ) : (
          <section className="surface-raised overflow-hidden bg-card p-6 shadow-xl sm:p-10">
            <form action={registerPublicAffiliateAction} className="grid gap-6">
              {params.error ? (
                <div className="flex items-start gap-3 rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="font-medium leading-relaxed">{params.error}</p>
                </div>
              ) : null}

              <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
                <label>Company website<input name="companyWebsite" tabIndex={-1} autoComplete="off" /></label>
              </div>

              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground"><UserRound className="h-3.5 w-3.5" /> Full Name</span>
                <input name="fullName" required maxLength={180} autoComplete="name" placeholder="Your full name" className="w-full rounded-md border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary" />
              </label>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground"><Mail className="h-3.5 w-3.5" /> Email Address</span>
                  <input name="email" required type="email" maxLength={190} autoComplete="email" placeholder="you@example.com" className="w-full rounded-md border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary" />
                </label>
                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground"><Phone className="h-3.5 w-3.5" /> Nigerian Phone</span>
                  <input name="phone" required type="tel" maxLength={40} placeholder="0801 234 5678" autoComplete="tel" className="w-full rounded-md border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary" />
                </label>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5" /> Password</span>
                  <PasswordField name="password" required minLength={12} maxLength={200} autoComplete="new-password" placeholder="At least 12 characters" />
                </label>
                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5" /> Confirm Password</span>
                  <PasswordField name="passwordConfirmation" required minLength={12} maxLength={200} autoComplete="new-password" placeholder="Repeat password" />
                </label>
              </div>

              <label className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-4 text-sm leading-relaxed">
                <input type="checkbox" name="acceptedTerms" value="1" required className="mt-1 h-4 w-4 shrink-0 accent-primary" />
                <span>I am at least 18 years old and agree to the <Link href="/affiliate/terms" target="_blank" className="font-bold text-primary hover:underline">Affiliate Partner Agreement</Link> and <Link href="/privacy-policy" target="_blank" className="font-bold text-primary hover:underline">Privacy Policy</Link>.</span>
              </label>

              <SubmitButton pendingText="Preparing account..." className="btn-primary w-full px-8 py-3.5 text-base shadow-lg shadow-primary/20">
                Create Affiliate Account
              </SubmitButton>
            </form>
          </section>
        )}

        <div className="mt-8 text-center text-sm font-medium text-muted-foreground">
          <p>
            Already registered? <Link href="/affiliate/login" className="font-bold text-primary hover:underline">Sign in to your affiliate account</Link>.
          </p>
        </div>
      </div>
    </main>
  )
}
