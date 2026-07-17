"use server"

import { redirect } from "next/navigation"

import { clearStudentSession, loginStudent, setStudentSessionCookie } from "@/lib/student-auth"
import { setStudentToast } from "@/lib/student-toast"

export async function studentLoginAction(formData: FormData) {
  const result = await loginStudent(
    String(formData.get("email") || ""),
    String(formData.get("password") || "")
  )

  if (!result.ok) {
    const code = result.code ? `&code=${encodeURIComponent(result.code)}` : ""
    redirect(`/dashboard/login?error=${encodeURIComponent(result.error)}${code}`)
  }

  await setStudentSessionCookie(result.token)
  await setStudentToast({ title: "Signed in", message: "Welcome back to your learning dashboard." })
  redirect("/dashboard")
}

export async function studentLogoutAction() {
  await clearStudentSession()
  redirect("/dashboard/login")
}
