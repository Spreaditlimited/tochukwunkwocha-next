import type { Metadata } from "next"
import type { ReactNode } from "react"

import { StudentAuthProvider } from "@/components/student-dashboard/StudentAuthContext"
import { buildMetadata } from "@/lib/site-seo"

export const metadata: Metadata = buildMetadata({
  title: "Student Dashboard",
  description: "Protected student dashboard.",
  path: "/dashboard",
  noIndex: true
})

export default function StudentDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <StudentAuthProvider>
      <div className="min-h-screen bg-muted/30">{children}</div>
    </StudentAuthProvider>
  )
}
