import { randomUUID } from "crypto"
import { createRequire } from "module"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { addColumnIfMissing } from "@/lib/schema-guards"

const requireCjs = createRequire(import.meta.url)
const domainClient = requireCjs("./domain-client.cjs") as {
  selectedDomainProviderName: () => string
  checkAvailability: (input: { domainName: string; strict?: boolean }) => Promise<{ available: boolean; domainName?: string; provider?: string; reason?: string }>
  registerDomain: (input: {
    domainName: string
    years?: number
    fullName?: string
    email?: string
    registrantAddress1?: string
    registrantCity?: string
    registrantState?: string
    registrantCountry?: string
    registrantPostalCode?: string
    registrantPhone?: string
    registrantPhoneCc?: string
  }) => Promise<{ success: boolean; domainName?: string; provider?: string; currency?: string; amountMinor?: number; orderId?: string; reason?: string }>
  getDnsZone?: (input: { domainName: string }) => Promise<unknown>
  updateNameservers?: (input: { domainName: string; nameservers: string[] }) => Promise<{ success?: boolean; nameservers?: string[]; provider?: string; reason?: string }>
  updateDnsRecords?: (input: { domainName: string; records: unknown[] }) => Promise<{ success?: boolean; records?: unknown[]; provider?: string; reason?: string }>
}

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

export function normalizeDomain(value: unknown) {
  const domain = clean(value, 190).toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]
  return /^[a-z0-9][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)+$/.test(domain) ? domain : ""
}

export async function assertStudentDomain(accountId: bigint, domainNameInput: unknown) {
  const domainName = normalizeDomain(domainNameInput)
  if (!domainName) throw new Error("domainName is required")
  const rows = await prisma.$queryRaw<Array<{ domainName: string; provider: string; status: string }>>(Prisma.sql`
    SELECT domain_name AS domainName, COALESCE(provider, '') AS provider, COALESCE(status, '') AS status
    FROM user_domains
    WHERE account_id = ${accountId}
      AND domain_name COLLATE utf8mb4_unicode_ci = ${domainName} COLLATE utf8mb4_unicode_ci
    LIMIT 1
  `)
  const domain = rows[0]
  if (!domain) throw new Error("Domain not found in your account.")
  return { ...domain, domainName }
}

export async function ensureDomainRequestTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS domain_orders (
      id BIGINT NOT NULL AUTO_INCREMENT,
      order_uuid VARCHAR(72) NOT NULL,
      account_id BIGINT NOT NULL,
      email VARCHAR(190) NOT NULL,
      domain_name VARCHAR(190) NOT NULL,
      years INT NOT NULL DEFAULT 1,
      provider VARCHAR(40) NOT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'registration_in_progress',
      payment_provider VARCHAR(40) NOT NULL DEFAULT 'direct',
      payment_status VARCHAR(40) NOT NULL DEFAULT 'paid',
      purchase_currency VARCHAR(16) NULL,
      purchase_amount_minor BIGINT NULL,
      provider_order_id VARCHAR(120) NULL,
      registrant_profile_json TEXT NULL,
      selected_services_json TEXT NULL,
      auto_renew_enabled TINYINT(1) NOT NULL DEFAULT 1,
      notes VARCHAR(500) NULL,
      registered_at DATETIME NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_domain_order_uuid (order_uuid),
      KEY idx_domain_orders_account (account_id, created_at),
      KEY idx_domain_orders_email (email),
      KEY idx_domain_orders_domain (domain_name),
      KEY idx_domain_orders_status (status, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS user_domains (
      id BIGINT NOT NULL AUTO_INCREMENT,
      account_id BIGINT NOT NULL,
      email VARCHAR(190) NOT NULL,
      domain_name VARCHAR(190) NOT NULL,
      provider VARCHAR(40) NOT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'registered',
      years INT NOT NULL DEFAULT 1,
      purchase_currency VARCHAR(16) NULL,
      purchase_amount_minor BIGINT NULL,
      provider_order_id VARCHAR(120) NULL,
      selected_services_json TEXT NULL,
      auto_renew_enabled TINYINT(1) NOT NULL DEFAULT 1,
      registered_at DATETIME NULL,
      renewal_due_at DATETIME NULL,
      last_synced_at DATETIME NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_user_domain_account_name (account_id, domain_name),
      KEY idx_user_domains_email (email),
      KEY idx_user_domains_due (renewal_due_at),
      KEY idx_user_domains_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await addColumnIfMissing("domain_orders", "registrant_profile_json", "TEXT NULL")
  await addColumnIfMissing("domain_orders", "selected_services_json", "TEXT NULL")
  await addColumnIfMissing("domain_orders", "auto_renew_enabled", "TINYINT(1) NOT NULL DEFAULT 1")
  await addColumnIfMissing("user_domains", "selected_services_json", "TEXT NULL")
  await addColumnIfMissing("user_domains", "auto_renew_enabled", "TINYINT(1) NOT NULL DEFAULT 1")
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_user_domain_dns_requests (
      id BIGINT NOT NULL AUTO_INCREMENT,
      request_uuid VARCHAR(64) NOT NULL,
      account_id BIGINT NOT NULL,
      email VARCHAR(190) NOT NULL,
      domain_name VARCHAR(190) NOT NULL,
      request_type VARCHAR(40) NOT NULL,
      payload_json LONGTEXT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'submitted',
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_domain_dns_request_uuid (request_uuid),
      KEY idx_tochukwu_domain_dns_request_account (account_id, domain_name, created_at),
      KEY idx_tochukwu_domain_dns_request_status (status, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_user_domain_netlify_access (
      id BIGINT NOT NULL AUTO_INCREMENT,
      account_id BIGINT NOT NULL,
      email VARCHAR(190) NOT NULL,
      domain_name VARCHAR(190) NOT NULL,
      netlify_email VARCHAR(190) NULL,
      netlify_workspace VARCHAR(190) NULL,
      netlify_site_name VARCHAR(190) NULL,
      connection_method VARCHAR(40) NOT NULL DEFAULT 'collaborator_invite',
      access_details TEXT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'submitted',
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_domain_netlify (account_id, domain_name),
      KEY idx_tochukwu_domain_netlify_email (email),
      KEY idx_tochukwu_domain_netlify_status (status, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

export async function checkStudentDomainAvailability(domainNameInput: unknown) {
  const domainName = normalizeDomain(domainNameInput)
  if (!domainName) throw new Error("domainName is required")
  await ensureDomainRequestTables()
  const rows = await prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
    SELECT (
      (SELECT COUNT(*) FROM user_domains WHERE domain_name COLLATE utf8mb4_unicode_ci = ${domainName} COLLATE utf8mb4_unicode_ci)
      +
      (SELECT COUNT(*) FROM domain_orders WHERE domain_name COLLATE utf8mb4_unicode_ci = ${domainName} COLLATE utf8mb4_unicode_ci AND status NOT IN ('failed', 'cancelled'))
    ) AS total
  `)
  if (Number(rows[0]?.total || 0) > 0) {
    return {
      domainName,
      available: false,
      provider: "existing_database",
      reason: "already_exists_in_existing_records"
    }
  }

  const live = await domainClient.checkAvailability({ domainName, strict: true })
  return {
    domainName,
    available: live.available === true,
    provider: live.provider || domainClient.selectedDomainProviderName(),
    reason: live.reason || (live.available ? "available" : "unavailable")
  }
}

export async function createDomainRegistrationRequest(input: { accountId: bigint; email: string; domainName: string; years?: number; autoRenewEnabled?: boolean }) {
  const domainName = normalizeDomain(input.domainName)
  if (!domainName) throw new Error("domainName is required")
  const years = Math.max(1, Math.min(10, Math.trunc(Number(input.years || 1))))
  const now = new Date()
  const orderUuid = `dor_${randomUUID().replace(/-/g, "")}`
  await ensureDomainRequestTables()
  const existing = await prisma.$queryRaw<Array<{ id: bigint; status: string }>>(Prisma.sql`
    SELECT id, COALESCE(status, '') AS status
    FROM user_domains
    WHERE account_id = ${input.accountId}
      AND domain_name COLLATE utf8mb4_unicode_ci = ${domainName} COLLATE utf8mb4_unicode_ci
    LIMIT 1
  `)
  if (existing[0] && existing[0].status.toLowerCase() === "registered") {
    return { orderUuid: "", domainName, years, status: "already_registered", alreadyOwned: true }
  }

  const availability = await domainClient.checkAvailability({ domainName, strict: true })
  if (!availability.available) throw new Error(`${domainName} is not available.`)
  const provider = availability.provider || domainClient.selectedDomainProviderName()
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO domain_orders
      (order_uuid, account_id, email, domain_name, years, provider, status, payment_provider, payment_status,
       selected_services_json, auto_renew_enabled, purchase_currency, purchase_amount_minor, notes, created_at, updated_at)
    VALUES
      (${orderUuid}, ${input.accountId}, ${input.email.toLowerCase()}, ${domainName}, ${years}, ${provider}, 'registration_in_progress', 'direct', 'paid',
       '[]', ${input.autoRenewEnabled ? 1 : 0}, NULL, NULL, 'Domain registration started from Next student dashboard.', ${now}, ${now})
  `)
  const result = await domainClient.registerDomain({
    domainName,
    years,
    email: input.email.toLowerCase()
  })
  if (!result.success) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE domain_orders
      SET status = 'registration_failed',
          provider = ${result.provider || provider},
          purchase_currency = ${result.currency || null},
          purchase_amount_minor = ${Number.isFinite(Number(result.amountMinor)) ? Math.round(Number(result.amountMinor)) : null},
          provider_order_id = ${result.orderId || null},
          notes = ${clean(result.reason || "registration_failed", 500)},
          updated_at = ${new Date()}
      WHERE order_uuid = ${orderUuid}
      LIMIT 1
    `)
    throw new Error(result.reason || "Domain registration failed. Please try another name.")
  }

  const registeredAt = new Date()
  const renewalDueAt = new Date(registeredAt)
  renewalDueAt.setFullYear(renewalDueAt.getFullYear() + years)
  await prisma.$executeRaw(Prisma.sql`
    UPDATE domain_orders
    SET status = 'registered',
        provider = ${result.provider || provider},
        purchase_currency = ${result.currency || null},
        purchase_amount_minor = ${Number.isFinite(Number(result.amountMinor)) ? Math.round(Number(result.amountMinor)) : null},
        provider_order_id = ${result.orderId || null},
        registered_at = ${registeredAt},
        updated_at = ${registeredAt}
    WHERE order_uuid = ${orderUuid}
    LIMIT 1
  `)
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO user_domains
      (account_id, email, domain_name, provider, status, years, purchase_currency, purchase_amount_minor,
       provider_order_id, selected_services_json, auto_renew_enabled, registered_at, renewal_due_at, last_synced_at, created_at, updated_at)
    VALUES
      (${input.accountId}, ${input.email.toLowerCase()}, ${result.domainName || domainName}, ${result.provider || provider}, 'registered', ${years},
       ${result.currency || null}, ${Number.isFinite(Number(result.amountMinor)) ? Math.round(Number(result.amountMinor)) : null},
       ${result.orderId || null}, '[]', ${input.autoRenewEnabled ? 1 : 0}, ${registeredAt}, ${renewalDueAt}, ${registeredAt}, ${registeredAt}, ${registeredAt})
    ON DUPLICATE KEY UPDATE
      email = VALUES(email),
      provider = VALUES(provider),
      status = VALUES(status),
      years = VALUES(years),
      purchase_currency = VALUES(purchase_currency),
      purchase_amount_minor = VALUES(purchase_amount_minor),
      provider_order_id = VALUES(provider_order_id),
      selected_services_json = VALUES(selected_services_json),
      auto_renew_enabled = VALUES(auto_renew_enabled),
      registered_at = VALUES(registered_at),
      renewal_due_at = VALUES(renewal_due_at),
      last_synced_at = VALUES(last_synced_at),
      updated_at = VALUES(updated_at)
  `)
  return { orderUuid, domainName: result.domainName || domainName, years, status: "registered" }
}

export async function createDomainRenewalRequest(input: { accountId: bigint; email: string; domainName: string; years?: number }) {
  const domain = await assertStudentDomain(input.accountId, input.domainName)
  if (domain.status.toLowerCase() !== "registered") throw new Error("Only registered domains can be renewed.")
  const years = Math.max(1, Math.min(10, Math.trunc(Number(input.years || 1))))
  const now = new Date()
  await ensureDomainRequestTables()
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO tochukwu_user_domain_dns_requests
      (request_uuid, account_id, email, domain_name, request_type, payload_json, status, created_at, updated_at)
    VALUES
      (${`ddr_${randomUUID().replace(/-/g, "")}`}, ${input.accountId}, ${input.email.toLowerCase()}, ${domain.domainName}, 'renewal', ${JSON.stringify({ years })}, 'submitted', ${now}, ${now})
  `)
  return { domainName: domain.domainName, years, status: "submitted" }
}

export async function saveDnsUpdateRequest(input: { accountId: bigint; email: string; domainName: string; records: unknown[] }) {
  const domain = await assertStudentDomain(input.accountId, input.domainName)
  const now = new Date()
  await ensureDomainRequestTables()
  let providerStatus = "submitted"
  let providerPayload: unknown = null
  if (typeof domainClient.updateDnsRecords === "function") {
    const result = await domainClient.updateDnsRecords({ domainName: domain.domainName, records: input.records || [] })
    providerStatus = result.success === false ? "provider_failed" : "completed"
    providerPayload = result
  }
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO tochukwu_user_domain_dns_requests
      (request_uuid, account_id, email, domain_name, request_type, payload_json, status, created_at, updated_at)
    VALUES
      (${`ddr_${randomUUID().replace(/-/g, "")}`}, ${input.accountId}, ${input.email.toLowerCase()}, ${domain.domainName}, 'dns_records', ${JSON.stringify({ records: input.records || [], providerResult: providerPayload })}, ${providerStatus}, ${now}, ${now})
  `)
  return { domainName: domain.domainName, status: providerStatus }
}

export async function saveNameserverUpdateRequest(input: { accountId: bigint; email: string; domainName: string; nameservers: string[] }) {
  const domain = await assertStudentDomain(input.accountId, input.domainName)
  const nameservers = input.nameservers.map((item) => clean(item, 190).toLowerCase()).filter(Boolean).slice(0, 8)
  if (nameservers.length < 2) throw new Error("At least two nameservers are required.")
  const now = new Date()
  await ensureDomainRequestTables()
  let providerStatus = "submitted"
  let providerPayload: unknown = null
  if (typeof domainClient.updateNameservers === "function") {
    const result = await domainClient.updateNameservers({ domainName: domain.domainName, nameservers })
    providerStatus = result.success === false ? "provider_failed" : "completed"
    providerPayload = result
  }
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO tochukwu_user_domain_dns_requests
      (request_uuid, account_id, email, domain_name, request_type, payload_json, status, created_at, updated_at)
    VALUES
      (${`ddr_${randomUUID().replace(/-/g, "")}`}, ${input.accountId}, ${input.email.toLowerCase()}, ${domain.domainName}, 'nameservers', ${JSON.stringify({ nameservers, providerResult: providerPayload })}, ${providerStatus}, ${now}, ${now})
  `)
  return { domainName: domain.domainName, status: providerStatus }
}

export async function saveNetlifyAccess(input: {
  accountId: bigint
  email: string
  domainName: string
  netlifyEmail: string
  netlifyWorkspace: string
  netlifySiteName: string
  accessDetails: string
}) {
  const domain = await assertStudentDomain(input.accountId, input.domainName)
  const netlifyEmail = clean(input.netlifyEmail, 190).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(netlifyEmail)) throw new Error("Enter a valid login email.")
  const netlifyWorkspace = clean(input.netlifyWorkspace, 190)
  const netlifySiteName = clean(input.netlifySiteName, 190)
  const accessDetails = clean(input.accessDetails, 3000)
  if (!netlifyWorkspace) throw new Error("Enter temporary Netlify domain.")
  if (!netlifySiteName) throw new Error("Enter project name.")
  if (!accessDetails) throw new Error("Enter temporary password.")
  const now = new Date()
  await ensureDomainRequestTables()
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO tochukwu_user_domain_netlify_access
      (account_id, email, domain_name, netlify_email, netlify_workspace, netlify_site_name, connection_method, access_details, status, created_at, updated_at)
    VALUES
      (${input.accountId}, ${input.email.toLowerCase()}, ${domain.domainName}, ${netlifyEmail}, ${netlifyWorkspace}, ${netlifySiteName}, 'temporary_login', ${accessDetails}, 'submitted', ${now}, ${now})
    ON DUPLICATE KEY UPDATE
      email = VALUES(email),
      netlify_email = VALUES(netlify_email),
      netlify_workspace = VALUES(netlify_workspace),
      netlify_site_name = VALUES(netlify_site_name),
      connection_method = VALUES(connection_method),
      access_details = VALUES(access_details),
      status = 'submitted',
      updated_at = VALUES(updated_at)
  `)
  return { domainName: domain.domainName, status: "submitted" }
}
