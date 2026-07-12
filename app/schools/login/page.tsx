import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { getSchoolAdminSession } from "@/lib/school-auth"
import { buildMetadata } from "@/lib/site-seo"
import { SchoolLoginForm } from "./SchoolLoginForm"

export const metadata: Metadata = buildMetadata({
  title: "School Login | Tochukwu Tech and AI Academy",
  description: "School administrator login for Prompt to Profit for Schools.",
  path: "/schools/login",
  noIndex: true
})

/**
 * Server Component: School Admin Login Route
 * 
 * Handles session validation for institutional users. Redirects authenticated
 * school administrators directly to their secure dashboard, preventing 
 * unnecessary rendering of the login interface.
 */
export default async function SchoolLoginPage() {
  // Validate current active session for B2B/School Admins
  const session = await getSchoolAdminSession()
  
  if (session) {
    redirect("/schools/dashboard")
  }
  
  // Render the interactive client-side login form
  return <SchoolLoginForm />
}