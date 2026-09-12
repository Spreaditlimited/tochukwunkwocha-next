import { randomUUID } from "crypto"
import { Prisma } from "@prisma/client"

import {
  initializePaystack,
  siteBaseUrl
} from "@/lib/payments/course-checkout"
import { prisma } from "@/lib/prisma"
import { assertStudentDomain, ensureDomainRequestTables } from "@/lib/student-domain-actions"
import { completeLegacyDomainRenewal } from '@/lib/domain/legacy-renewal'
import { confirmedRenewalQuote } from '@/lib/domain/platform-renewals'

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function renewalYears(value: unknown) {
  return Math.max(1, Math.min(10, Math.trunc(Number(value || 1))))
}

async function ensureDomainRenewalTable() {
  await ensureDomainRequestTables()
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_domain_renewal_checkouts (
      id BIGINT NOT NULL AUTO_INCREMENT,
      renewal_uuid VARCHAR(72) NOT NULL,
      account_id BIGINT NOT NULL,
      email VARCHAR(190) NOT NULL,
      domain_name VARCHAR(190) NOT NULL,
      years INT NOT NULL DEFAULT 1,
      status VARCHAR(40) NOT NULL DEFAULT 'payment_pending',
      payment_provider VARCHAR(40) NOT NULL DEFAULT 'paystack',
      payment_reference VARCHAR(120) NULL,
      payment_currency VARCHAR(16) NULL,
      payment_amount_minor BIGINT NULL,
      payment_paid_at DATETIME NULL,
      auto_renew_enabled TINYINT(1) NOT NULL DEFAULT 1,
      notes VARCHAR(500) NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_domain_renewal_uuid (renewal_uuid),
      UNIQUE KEY uniq_tochukwu_domain_renewal_ref (payment_reference),
      KEY idx_tochukwu_domain_renewal_account (account_id, created_at),
      KEY idx_tochukwu_domain_renewal_domain (domain_name),
      KEY idx_tochukwu_domain_renewal_status (status, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

export async function createPaidDomainRenewal(input: {
  accountId: bigint
  email: string
  domainName: unknown
  years?: unknown
}) {
  await ensureDomainRenewalTable()
  const domain = await assertStudentDomain(input.accountId, input.domainName)
  if (domain.status.toLowerCase() !== "registered") throw new Error("Only registered domains can be renewed.")

  const years = renewalYears(input.years)
  const quote = await confirmedRenewalQuote(domain.domainName, years)
  if (quote.provider !== "paystack" || quote.currency !== "NGN") {
    throw new Error("Domain renewal pricing is temporarily unavailable.")
  }

  const accountRows = await prisma.$queryRaw<Array<{ autoRenewEnabled: bigint | number | boolean }>>(Prisma.sql`
    SELECT COALESCE(auto_renew_enabled, 0) AS autoRenewEnabled
    FROM user_domains
    WHERE account_id = ${input.accountId}
      AND domain_name COLLATE utf8mb4_unicode_ci = ${domain.domainName} COLLATE utf8mb4_unicode_ci
    LIMIT 1
  `)
  const renewalUuid = `drn_${randomUUID().replace(/-/g, "")}`
  const reference = `DRN_${randomUUID().replace(/-/g, "").slice(0, 24)}`
  const now = new Date()

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO tochukwu_domain_renewal_checkouts
      (renewal_uuid, account_id, email, domain_name, years, status, payment_provider, payment_reference,
       payment_currency, payment_amount_minor, auto_renew_enabled, notes, created_at, updated_at)
    VALUES
      (${renewalUuid}, ${input.accountId}, ${input.email.toLowerCase()}, ${domain.domainName}, ${years}, 'payment_pending',
       'paystack', ${reference}, ${quote.currency}, ${quote.totalAmountMinor}, ${accountRows[0]?.autoRenewEnabled ? 1 : 0},
       'Awaiting Paystack renewal payment.', ${now}, ${now})
  `)

  try {
    const payment = await initializePaystack({
      email: input.email.toLowerCase(),
      amountMinor: quote.totalAmountMinor,
      reference,
      callbackUrl: `${siteBaseUrl()}/api/domains/renew/paystack/return`,
      metadata: {
        payment_scope: "domain_renewal",
        domain_renewal_uuid: renewalUuid,
        domain_name: domain.domainName,
        account_id: input.accountId.toString(),
        years
      },
      currency: quote.currency
    })
    return {
      renewalUuid,
      domainName: domain.domainName,
      years,
      provider: "paystack" as const,
      checkoutUrl: payment.checkoutUrl,
      quote
    }
  } catch (error) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE tochukwu_domain_renewal_checkouts
      SET status = 'payment_initialization_failed', notes = ${clean(error instanceof Error ? error.message : "Payment initialization failed")}, updated_at = ${new Date()}
      WHERE renewal_uuid = ${renewalUuid}
      LIMIT 1
    `).catch(() => null)
    throw error
  }
}

export async function completePaidDomainRenewal(referenceInput: unknown) {
  const reference = clean(referenceInput, 120)
  if (!reference) throw new Error("Payment reference is required.")
  return completeLegacyDomainRenewal(reference)
}
