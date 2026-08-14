"use server"

import { redirect } from "next/navigation"

import { clearStudentSession, loginStudent, setStudentSessionCookie } from "@/lib/student-auth"
import { setStudentToast } from "@/lib/student-toast"
import { studentSafeErrorMessage } from "@/lib/student-error-feedback"

function safeDashboardPath(value: unknown) {
  const path = String(value || "").trim()
  return path.startsWith("/dashboard/") && !path.startsWith("//") ? path.slice(0, 1000) : "/dashboard"
}

export async function studentLoginAction(formData: FormData) {
  const nextPath = safeDashboardPath(formData.get("next"))
  const result = await loginStudent(
    String(formData.get("email") || ""),
    String(formData.get("password") || "")
  )

  if (!result.ok) {
    if (result.code === "PASSWORD_RESET_REQUIRED" && result.passwordSetupToken) {
      redirect(`/dashboard/reset-password?token=${encodeURIComponent(result.passwordSetupToken)}&first_use=1`)
    }
    const code = result.code ? `&code=${encodeURIComponent(result.code)}` : ""
    const message = studentSafeErrorMessage(result.error, "Could not sign in. Check your details and try again.")
    redirect(`/dashboard/login?error=${encodeURIComponent(message)}${code}&next=${encodeURIComponent(nextPath)}`)
  }

  await setStudentSessionCookie(result.token)
  await setStudentToast({ title: "Signed in", message: "Welcome back to your learning dashboard." })
  redirect(nextPath)
}

export async function studentLogoutAction() {
  await clearStudentSession()
  redirect("/dashboard/login")
}
