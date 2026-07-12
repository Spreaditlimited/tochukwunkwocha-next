import type { Metadata } from "next"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, LockKeyhole, ShieldCheck } from "lucide-react"

import { consumeSchoolAdminPasswordResetToken, createSchoolAdminSession } from "@/lib/school-auth"
import { buildMetadata } from "@/lib/site-seo"

export const dynamic = "force-dynamic"

export const metadata: Metadata = buildMetadata({
  title: "Reset School Password",
  description: "Reset school dashboard password.",
  path: "/schools/reset-password",
  noIndex: true
})

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

async function completeSchoolPasswordReset(formData: FormData) {
  "use server"
  const token = clean(formData.get("token"), 1000)
  const password = String(formData.get("password") || "")
  const admin = await consumeSchoolAdminPasswordResetToken({ token, password })
  await createSchoolAdminSession(admin.id)
  redirect("/schools/dashboard")
}

export default async function SchoolResetPasswordPage({
  searchParams
}: {
  searchParams?: Promise<{ token?: string }>
}) {
  const params = searchParams ? await searchParams : {}
  const token = clean(params.token, 1000)

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
          <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">Create a new password</h1>
          <p className="mt-3 text-base text-muted-foreground">Enter a new password for your school account.</p>
        </div>

        <section className="surface-raised overflow-hidden bg-card p-6 shadow-xl sm:p-10">
          <form action={completeSchoolPasswordReset} className="mt-6 grid gap-4">
            <input type="hidden" name="token" value={token} />
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                <LockKeyhole className="h-3.5 w-3.5" /> New Password
              </span>
              <input name="password" type="password" required minLength={8} placeholder="••••••••" autoComplete="new-password" className="w-full rounded-md border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary" />
            </label>
            <button className="btn-primary mt-2 w-full px-8 py-3.5 text-base shadow-lg shadow-primary/20 disabled:pointer-events-none disabled:opacity-60" type="submit" disabled={!token}>Reset and sign in</button>
          </form>
          {!token ? <p className="mt-4 text-sm font-semibold text-destructive">Reset token is missing.</p> : null}
        </section>
      </div>
    </main>
  )
}
