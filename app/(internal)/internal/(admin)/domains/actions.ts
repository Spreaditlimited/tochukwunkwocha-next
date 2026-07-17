"use server"

import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/auth"
import { setInternalToast } from "@/lib/internal-toast"
import { saveDnsUpdateRequest } from "@/lib/student-domain-actions"

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function normalizeDomain(value: unknown) {
  const domain = clean(value, 190).toLowerCase()
  return /^[a-z0-9][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)+$/.test(domain) ? domain : ""
}

export async function updateDomainNetlifyStatusAction(formData: FormData) {
  await requireAdmin("/internal/domains")
  const accountId = BigInt(String(formData.get("accountId") || "0"))
  const domainName = normalizeDomain(formData.get("domainName"))
  const status = clean(formData.get("status"), 40) || "submitted"
  if (!accountId || !domainName) throw new Error("Domain record is required.")
  await prisma.$executeRaw`
    UPDATE tochukwu_user_domain_netlify_access
    SET status = ${status}, updated_at = ${new Date()}
    WHERE account_id = ${accountId}
      AND domain_name = ${domainName}
    LIMIT 1
  `
  await setInternalToast({ title: "Netlify status updated", message: `${domainName} has been marked as ${status}.` })
  revalidatePath("/internal/domains")
}

export async function updateDomainDnsAction(formData: FormData) {
  const session = await requireAdmin("/internal/domains")
  const accountId = BigInt(String(formData.get("accountId") || "0"))
  const domainName = normalizeDomain(formData.get("domainName"))
  const type = clean(formData.get("type"), 20).toUpperCase() || "A"
  const host = clean(formData.get("host"), 120) || "@"
  const value = clean(formData.get("value"), 500)
  const ttl = Math.max(300, Math.min(Number(formData.get("ttl") || 3600), 86400))
  if (!accountId || !domainName || !value) throw new Error("Domain, host, and value are required.")
  const records = [{ type, host, value, ttl }]
  await saveDnsUpdateRequest({ accountId, email: session.email, domainName, records })
  await setInternalToast({ title: "DNS update saved", message: `A DNS update request was recorded for ${domainName}.` })
  revalidatePath("/internal/domains")
}
