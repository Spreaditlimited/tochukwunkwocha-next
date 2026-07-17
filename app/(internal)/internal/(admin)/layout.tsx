import type { ReactNode } from "react"

import { InternalDashboardShell } from "@/components/internal/InternalDashboardShell"
import { requireAdmin } from "@/lib/auth"

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await requireAdmin()

  const initials = session.fullName
    ?.split(" ")
    .map((name) => name[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "AD"

  return (
    <InternalDashboardShell session={session} initials={initials}>
      {children}
    </InternalDashboardShell>
  )
}
