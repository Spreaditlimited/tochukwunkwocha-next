"use server"

import { redirect } from "next/navigation"

import { activatePublicAffiliate, registerPublicAffiliate } from "@/lib/affiliate-onboarding"
import {
  allowPublicAffiliateRegistrationRequest,
  createStudentSessionForAccount,
  loginStudent,
  setStudentSessionCookie
} from "@/lib/student-auth"
import { setStudentToast } from "@/lib/student-toast"

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function safeError(error: unknown, fallback: string) {
  return clean(error instanceof Error ? error.message : fallback, 240) || fallback
}

export async function registerPublicAffiliateAction(formData: FormData) {
  const email = clean(formData.get("email"), 190).toLowerCase()
  let errorMessage = ""
  if (clean(formData.get("companyWebsite"), 300)) {
    errorMessage = "The registration could not be processed. Please try again."
  } else {
    const allowed = await allowPublicAffiliateRegistrationRequest(email)
    if (!allowed) {
      errorMessage = "Too many registration attempts. Please wait 15 minutes and try again."
    } else {
      try {
        const password = String(formData.get("password") || "")
        const passwordConfirmation = String(formData.get("passwordConfirmation") || "")
        if (password !== passwordConfirmation) throw new Error("The passwords do not match.")
        await registerPublicAffiliate({
          fullName: clean(formData.get("fullName"), 180),
          email,
          phone: clean(formData.get("phone"), 40),
          password,
          acceptedTerms: formData.get("acceptedTerms") === "1"
        })
      } catch (error) {
        errorMessage = safeError(error, "Your affiliate registration could not be completed.")
      }
    }
  }
  if (errorMessage) redirect(`/affiliate/register?error=${encodeURIComponent(errorMessage)}`)
  redirect("/affiliate/register?submitted=1")
}

export async function activatePublicAffiliateAction(formData: FormData) {
  const token = clean(formData.get("token"), 500)
  let account: Awaited<ReturnType<typeof activatePublicAffiliate>> | null = null
  let errorMessage = ""
  try {
    account = await activatePublicAffiliate(token)
    const session = await createStudentSessionForAccount(account)
    await setStudentSessionCookie(session.token)
    await setStudentToast({ title: "Affiliate account activated", message: "Your referral links are ready to share." })
  } catch (error) {
    errorMessage = safeError(error, "Your affiliate account could not be activated.")
  }
  if (!account || errorMessage) redirect(`/affiliate/activate?error=${encodeURIComponent(errorMessage || "The activation link is invalid.")}`)
  redirect("/dashboard/affiliate")
}

export async function affiliateLoginAction(formData: FormData) {
  const result = await loginStudent(clean(formData.get("email"), 190), String(formData.get("password") || ""))
  if (!result.ok) {
    if (result.code === "PASSWORD_RESET_REQUIRED" && result.passwordSetupToken) {
      redirect(`/affiliate/reset-password?token=${encodeURIComponent(result.passwordSetupToken)}&first_use=1`)
    }
    redirect(`/affiliate/login?error=${encodeURIComponent(result.error || "Could not sign in.")}`)
  }
  await setStudentSessionCookie(result.token)
  redirect("/dashboard/affiliate")
}
