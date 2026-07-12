"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, CheckCircle2, Loader2, LockKeyhole, Mail } from "lucide-react"

import { showStudentToast } from "@/components/student-dashboard/StudentActionToaster"

type Props = {
  token?: string
}

async function postJson<T>(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Request failed")
  return payload as T
}

export function PasswordResetForm({ token = "" }: Props) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setMessage("")
    setLoading(true)
    try {
      if (token) {
        if (password !== confirmPassword) throw new Error("Passwords do not match")
        await postJson("/api/student/password-reset/complete", { token, password })
        showStudentToast({ type: "success", title: "Password reset complete", message: "Your new password has been saved." })
        router.replace("/dashboard")
        router.refresh()
        return
      }
      const result = await postJson<{ message: string }>("/api/student/password-reset/request", { email })
      setMessage(result.message)
      showStudentToast({ type: "success", title: "Reset link requested", message: result.message })
    } catch (requestError) {
      const errorMessage = requestError instanceof Error ? requestError.message : "Request failed"
      setError(errorMessage)
      showStudentToast({ type: "error", title: "Password reset failed", message: errorMessage })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="surface-raised grid gap-6 bg-card p-6 shadow-xl sm:p-10">
      
      {/* Header Context */}
      <div className="text-center mb-2">
        <h2 className="font-heading text-2xl font-black text-foreground">
          {token ? "Create New Password" : "Reset Password"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {token 
            ? "Enter your new password below to regain access." 
            : "Enter the email associated with your account to receive a reset link."}
        </p>
      </div>

      <div className="grid gap-5">
        {token ? (
          <>
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <LockKeyhole className="h-3.5 w-3.5" /> New Password
              </span>
              <input
                className="w-full rounded-md border border-input bg-background px-4 py-3 text-sm font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary"
                type="password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                placeholder="•••••••• (min 8 characters)"
                autoComplete="new-password"
              />
            </label>
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <LockKeyhole className="h-3.5 w-3.5" /> Confirm Password
              </span>
              <input
                className="w-full rounded-md border border-input bg-background px-4 py-3 text-sm font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary"
                type="password"
                minLength={8}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                placeholder="Confirm your new password"
                autoComplete="new-password"
              />
            </label>
          </>
        ) : (
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <Mail className="h-3.5 w-3.5" /> Email Address
            </span>
            <input
              className="w-full rounded-md border border-input bg-background px-4 py-3 text-sm font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>
        )}
      </div>

      {/* Alerts */}
      {error ? (
        <div className="flex items-start gap-3 rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="font-medium leading-relaxed">{error}</p>
        </div>
      ) : null}

      {message ? (
        <div className="flex items-start gap-3 rounded-md border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="font-medium leading-relaxed">{message}</p>
        </div>
      ) : null}

      {/* Submit Button */}
      <button 
        className="inline-flex w-full items-center justify-center rounded-md bg-primary px-6 py-3.5 text-base font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-70" 
        type="submit" 
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Please wait...
          </>
        ) : token ? (
          "Reset Password"
        ) : (
          "Send Reset Link"
        )}
      </button>
    </form>
  )
}
