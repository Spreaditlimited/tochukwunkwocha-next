import type { ReactNode } from "react"
import { InternalSectionGuard } from "@/components/internal/InternalSectionGuard"
export default function Layout({ children }: { children: ReactNode }) { return <InternalSectionGuard path="/internal/build-scorecards">{children}</InternalSectionGuard> }
