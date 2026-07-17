import type { Metadata } from "next"

import { DomainRegistrationService } from "@/components/domains/DomainRegistrationService"
import { getStudentSession } from "@/lib/student-auth"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Domain Registration",
  description: "Search, register, and manage your domain name from your student dashboard."
}

export default async function DomainRegistrationPage() {
  const session = await getStudentSession()
  return <DomainRegistrationService account={session ? { fullName: session.account.fullName, email: session.account.email, autoRenew: session.account.domainsAutoRenewEnabled } : null} />
}
