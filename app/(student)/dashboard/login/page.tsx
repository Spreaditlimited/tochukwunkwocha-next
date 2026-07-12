import Link from "next/link"
import { redirect } from "next/navigation"
import { 
  AlertCircle, 
  ArrowLeft, 
  LockKeyhole, 
  Mail, 
  ShieldCheck 
} from "lucide-react"

import { getStudentSession } from "@/lib/student-auth"
import { GroupCodeLoginForm } from "@/components/student-dashboard/GroupCodeLoginForm"
import { StudentActionToaster } from "@/components/student-dashboard/StudentActionToaster"
import { studentLoginAction } from "../actions"

export const dynamic = "force-dynamic"

export default async function StudentLoginPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string; code?: string }>
}) {
  const session = await getStudentSession()
  if (session) redirect("/dashboard")
  
  const params = searchParams ? await searchParams : {}

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-muted/20 p-5 sm:p-6 lg:p-8">
      <StudentActionToaster />
      {/* Deep Space Background Effects */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
      <div className="absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px] pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-md">
        
        {/* Navigation / Header Area */}
        <div className="mb-8 text-center">
          <Link 
            href="/" 
            className="group mb-6 inline-flex items-center text-sm font-bold text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to Academy
          </Link>
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 shadow-sm">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">
            Welcome back
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            Sign in to access your learning workspace.
          </p>
        </div>

        {/* Login Card */}
        <div className="surface-raised overflow-hidden bg-card p-6 shadow-xl sm:p-10">
          <form action={studentLoginAction} className="grid gap-6">
            
            {/* Error Callout */}
            {params.error ? (
              <div className="flex items-start gap-3 rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="font-medium leading-relaxed">{params.error}</p>
              </div>
            ) : null}

            {/* Form Fields */}
            <div className="grid gap-5">
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" /> Email Address
                </span>
                <input 
                  className="w-full rounded-md border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary" 
                  name="email" 
                  type="email" 
                  placeholder="you@example.com"
                  required 
                  autoComplete="email" 
                />
              </label>
              
              <label className="block">
                <span className="mb-2 flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  <span className="flex items-center gap-2"><LockKeyhole className="h-3.5 w-3.5" /> Password</span>
                  <Link href="/dashboard/reset-password" className="tracking-normal text-primary hover:text-primary/80">
                    Forgot?
                  </Link>
                </span>
                <input 
                  className="w-full rounded-md border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary" 
                  name="password" 
                  type="password" 
                  placeholder="••••••••"
                  required 
                  autoComplete="current-password" 
                />
              </label>
            </div>

            {/* Submit CTA */}
            <div className="mt-2">
              <button 
                className="btn-primary w-full px-8 py-3.5 text-base shadow-lg shadow-primary/20" 
                type="submit"
              >
                Sign In Securely
              </button>
            </div>
            
          </form>
          <GroupCodeLoginForm />
        </div>

        {/* Footer Links */}
        <div className="mt-8 text-center text-sm font-medium text-muted-foreground">
          <p>
            Use the email and password connected to your course purchase.
          </p>
        </div>
      </div>
    </main>
  )
}
