import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react"

import { sendEmail } from "@/lib/email"
import { siteBaseUrl } from "@/lib/payments/course-checkout"
import { createSchoolAdminPasswordResetToken } from "@/lib/school-auth"
import { buildMetadata } from "@/lib/site-seo"

export const dynamic = "force-dynamic"

export const metadata: Metadata = buildMetadata({
  title: "Request School Password Reset",
  description: "Request a school dashboard password reset link.",
  path: "/schools/reset-password-request",
  noIndex: true
})

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

async function requestSchoolPasswordReset(formData: FormData) {
  "use server"
  const email = clean(formData.get("email"), 220).toLowerCase()
  if (!email) return
  const reset = await createSchoolAdminPasswordResetToken(email)
  if (!reset?.token) return
  const link = `${siteBaseUrl()}/schools/reset-password?token=${encodeURIComponent(reset.token)}`
  const name = clean(reset.fullName, 120) || "School Admin"
  const text = [`Hello ${name},`, "", "Use the link below to reset your school dashboard password:", link].join("\n")
  await sendEmail({
    to: email,
    subject: "Reset Your School Dashboard Password",
    text,
    html: text.replace(/\n/g, "<br/>")
  }).catch(() => null)
}

export default function SchoolResetPasswordRequestPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/20 p-5 sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/schools/login" className="group mb-6 inline-flex items-center text-sm font-bold text-muted-foreground transition-colors hover:text-primary">
            <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to Sign In
          </Link>
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 shadow-sm">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">Reset your password</h1>
          <p className="mt-3 text-base text-muted-foreground">
            Enter the school admin email. If an account exists, a reset link will be sent.
          </p>
        </div>

        <section className="surface-raised overflow-hidden bg-card p-6 shadow-xl sm:p-10">
          <form action={requestSchoolPasswordReset} className="mt-6 grid gap-4">
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                <Mail className="h-3.5 w-3.5" /> Email Address
              </span>
              <input name="email" type="email" required placeholder="admin@school.com" autoComplete="email" className="w-full rounded-md border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary" />
            </label>
            <button className="btn-primary mt-2 w-full px-8 py-3.5 text-base shadow-lg shadow-primary/20" type="submit">Send reset link</button>
          </form>
        </section>
      </div>
    </main>
  )
}
