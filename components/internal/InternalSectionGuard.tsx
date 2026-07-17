import type { ReactNode } from "react"

import { requireAdmin } from "@/lib/auth"

export async function InternalSectionGuard({ path, children }: { path: string; children: ReactNode }) {
  await requireAdmin(path)
  return children
}
