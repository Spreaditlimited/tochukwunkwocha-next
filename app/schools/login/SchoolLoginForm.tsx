"use client"

import Link from "next/link"
import { useState, type FormEvent } from "react"
import { AlertCircle, ArrowLeft, Loader2, LockKeyhole, Mail, ShieldCheck } from "lucide-react"

import { PasswordField } from "@/components/PasswordField"

export function SchoolLoginForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setLoading(true)
    setError("")
    
    try {
      const response = await fetch("/api/schools/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: String(form.get("email") || ""),
          password: String(form.get("password") || "")
        })
      })
      const json = await response.json().catch(() => null)
      
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Invalid email or password.")
      }
      
      window.location.href = "/schools/dashboard"
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-muted/20 p-5 sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]" />

      <div className="relative z-10 w-full max-w-md">
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
            Sign in to manage your school workspace.
          </p>
        </div>

        <div className="surface-raised overflow-hidden bg-card p-6 shadow-xl sm:p-10">
          <form onSubmit={submit} className="grid gap-6">
            {error ? (
              <div className="flex items-start gap-3 rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="font-medium leading-relaxed">{error}</p>
              </div>
            ) : null}

            <div className="grid gap-5">
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                <Mail className="h-3.5 w-3.5" /> Email Address
              </span>
              <input
                name="email"
                type="email"
                required
                placeholder="admin@school.com"
                autoComplete="email"
                className="w-full rounded-md border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </label>
            
            <label className="block">
              <span className="mb-2 flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                <span className="flex items-center gap-2"><LockKeyhole className="h-3.5 w-3.5" /> Password</span>
                <Link href="/schools/reset-password-request" className="tracking-normal text-primary hover:text-primary/80">
                  Forgot?
                </Link>
              </span>
              <PasswordField
                name="password"
                required
                placeholder="••••••••"
                autoComplete="current-password"
                inputClassName="w-full rounded-md border border-input bg-background px-4 py-3 pr-12 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </label>
          </div>

            <div className="mt-2">
              <button
                className="btn-primary w-full px-8 py-3.5 text-base shadow-lg shadow-primary/20 disabled:pointer-events-none disabled:opacity-60"
                disabled={loading}
                type="submit"
              >
                {loading ? <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" /> : null}
                {loading ? "Signing in..." : "Sign In Securely"}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-8 text-center text-sm font-medium text-muted-foreground">
          <p>Use the email and password connected to your school account.</p>
          <Link href="/courses/prompt-to-profit-schools" className="mt-3 inline-flex font-bold text-primary hover:text-primary/80">
            View schools programme
          </Link>
        </div>
      </div>
    </main>
  )
}
