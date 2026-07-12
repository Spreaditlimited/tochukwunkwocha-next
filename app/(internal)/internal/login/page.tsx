import { redirect } from "next/navigation"
import { AlertTriangle, LockKeyhole, Mail, ShieldCheck } from "lucide-react"

import { getAdminSession, loginAdmin, setAdminSession } from "@/lib/auth"

async function loginAction(formData: FormData) {
  "use server"

  const session = await loginAdmin(
    String(formData.get("email") || ""),
    String(formData.get("password") || "")
  )

  if (!session) redirect("/internal/login?error=invalid")

  await setAdminSession(session)
  redirect("/internal")
}

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string }>
}) {
  const session = await getAdminSession()
  if (session) redirect("/internal")
  const params = searchParams ? await searchParams : {}

  return (
    <main className="relative grid min-h-screen place-items-center bg-background px-4 py-10 selection:bg-primary/30">
      
      {/* Subtle background ambient glow for a premium feel */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[120px]"></div>

      <div className="relative w-full max-w-md">
        
        {/* Brand / Context Header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-inner">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="font-heading text-3xl font-black tracking-tight text-foreground">
            Admin Authentication
          </h1>
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            Secure internal dashboard access.
          </p>
        </div>

        {/* Login Form Card */}
        <form 
          action={loginAction} 
          className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        >
          <div className="p-6 sm:p-8">
            
            {params.error ? (
              <div className="mb-6 flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive animate-in fade-in slide-in-from-top-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="font-semibold leading-relaxed">
                  Invalid email or password. Please try again.
                </p>
              </div>
            ) : null}

            <div className="grid gap-5">
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" /> Email Address
                </span>
                <input 
                  className="w-full rounded-lg border border-input bg-background/50 px-4 py-3.5 text-sm font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary" 
                  name="email" 
                  type="email" 
                  autoComplete="email" 
                  placeholder="admin@example.com"
                />
              </label>
              
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <LockKeyhole className="h-3.5 w-3.5" /> Password
                </span>
                <input 
                  className="w-full rounded-lg border border-input bg-background/50 px-4 py-3.5 text-sm font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary" 
                  name="password" 
                  type="password" 
                  required 
                  autoComplete="current-password" 
                  placeholder="••••••••••••"
                />
              </label>
            </div>
          </div>

          <div className="border-t border-border bg-muted/10 p-6 sm:p-8">
            <button 
              className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:-translate-y-0.5 active:translate-y-0" 
              type="submit"
            >
              Secure Sign In
            </button>
          </div>
        </form>

      </div>
    </main>
  )
}