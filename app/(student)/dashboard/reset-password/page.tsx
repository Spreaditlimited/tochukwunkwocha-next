import Link from "next/link"
import { ArrowLeft, ShieldCheck } from "lucide-react"

import { StudentActionToaster } from "@/components/student-dashboard/StudentActionToaster"
import { PasswordResetForm } from "@/components/student-dashboard/PasswordResetForm"

export const dynamic = "force-dynamic"

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams?: Promise<{ token?: string }>
}) {
  const params = searchParams ? await searchParams : {}
  const token = String(params.token || "").trim()

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/20 p-5 sm:p-6 lg:p-8">
      <StudentActionToaster />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/dashboard/login" className="group mb-6 inline-flex items-center text-sm font-bold text-muted-foreground transition-colors hover:text-primary">
            <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to Sign In
          </Link>
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 shadow-sm">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">
            {token ? "Create a new password" : "Reset your password"}
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            {token ? "Enter a new password for your learning account." : "Enter the email connected to your course purchase."}
          </p>
        </div>
        <PasswordResetForm token={token} />
      </div>
    </main>
  )
}
