import { randomUUID } from "crypto"

import { ensureBuildServiceTables } from "@/lib/admin-build-service"
import { getAdminSettingValue } from "@/lib/admin-settings"
import { prisma } from "@/lib/prisma"
import {
  initializePaystack,
  initializeStripe,
  isNigeriaCountry,
  siteBaseUrl,
  stripeCurrencyForCountry,
  type CheckoutProvider
} from "@/lib/payments/course-checkout"

export type ServiceCheckoutSlug = "build-discovery" | "private-ai-coaching-discovery"

export type ServiceCheckoutDetails = {
  slug: ServiceCheckoutSlug
  title: string
  description: string
  sourcePath: string
  leadUuid: string
  fullName: string
  email: string
  phone: string
  country: string
}

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function normalizeEmail(value: unknown) {
  const email = clean(value, 220).toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ""
}

function toMinor(value: unknown) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue > 0 ? Math.round(numberValue) : 0
}

export function serviceCheckoutSlugs(): ServiceCheckoutSlug[] {
  return ["build-discovery", "private-ai-coaching-discovery"]
}

export function isServiceCheckoutSlug(value: string): value is ServiceCheckoutSlug {
  return serviceCheckoutSlugs().includes(value as ServiceCheckoutSlug)
}

export function formatMinorAmount(minor: number, currency: string) {
  const locale = currency === "NGN" ? "en-NG" : currency === "GBP" ? "en-GB" : currency === "EUR" ? "en-IE" : "en-US"
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "NGN" ? 0 : 2
  }).format(minor / 100)
}

async function settingMinor(key: string) {
  const value = toMinor(await getAdminSettingValue(key))
  if (!value) throw new Error(`Missing required pricing setting: ${key}`)
  return value
}

async function vatPercent(provider: CheckoutProvider) {
  const key = provider === "stripe" ? "INTL_VAT_PERCENT" : "SITE_VAT_PERCENT"
  const raw = Number(await getAdminSettingValue(key))
  return Number.isFinite(raw) && raw >= 0 ? raw : provider === "stripe" ? 0 : 7.5
}

function providerForCountry(country: string): CheckoutProvider {
  return isNigeriaCountry(country) ? "paystack" : "stripe"
}

async function baseServiceAmount(slug: ServiceCheckoutSlug, currency: string) {
  if (slug === "build-discovery") {
    return settingMinor(`BUILD_DISCOVERY_FEE_${currency}_MINOR`)
  }

  return settingMinor(`PRIVATE_AI_COACHING_DISCOVERY_FEE_${currency}_MINOR`)
}

export async function serviceCheckoutPricing(input: { slug: ServiceCheckoutSlug; country: string; provider?: CheckoutProvider }) {
  const provider = input.provider || providerForCountry(input.country)
  const currency = provider === "paystack" ? "NGN" : stripeCurrencyForCountry(input.country)
  const baseAmountMinor = await baseServiceAmount(input.slug, currency)
  const vatAmountMinor = Math.round((baseAmountMinor * (await vatPercent(provider))) / 100)
  const finalAmountMinor = baseAmountMinor + vatAmountMinor
  return {
    provider,
    currency,
    baseAmountMinor,
    vatAmountMinor,
    finalAmountMinor,
    label: formatMinorAmount(finalAmountMinor, currency),
    baseLabel: formatMinorAmount(baseAmountMinor, currency)
  }
}

export async function ensurePrivateCoachingServiceTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_private_ai_coaching_leads (
      id BIGINT NOT NULL AUTO_INCREMENT,
      lead_uuid VARCHAR(80) NOT NULL,
      full_name VARCHAR(180) NOT NULL,
      work_email VARCHAR(220) NOT NULL,
      phone VARCHAR(80) NULL,
      country VARCHAR(80) NULL,
      goal_text LONGTEXT NULL,
      experience_level VARCHAR(80) NULL,
      availability VARCHAR(120) NULL,
      source_path VARCHAR(255) NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_private_ai_coaching_lead_uuid (lead_uuid),
      KEY idx_private_ai_coaching_email (work_email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_private_ai_coaching_payments (
      id BIGINT NOT NULL AUTO_INCREMENT,
      payment_uuid VARCHAR(80) NOT NULL,
      lead_uuid VARCHAR(80) NULL,
      work_email VARCHAR(220) NOT NULL,
      full_name VARCHAR(180) NOT NULL,
      payment_type VARCHAR(40) NOT NULL DEFAULT 'discovery',
      plan_key VARCHAR(80) NULL,
      amount_minor INT NOT NULL DEFAULT 0,
      currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
      payment_provider VARCHAR(40) NOT NULL DEFAULT 'paystack',
      payment_reference VARCHAR(180) NOT NULL,
      checkout_url VARCHAR(1200) NULL,
      payment_order_id VARCHAR(180) NULL,
      payment_status VARCHAR(40) NOT NULL DEFAULT 'initiated',
      paid_at DATETIME NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_private_ai_coaching_payment_uuid (payment_uuid),
      UNIQUE KEY uniq_private_ai_coaching_reference (payment_reference)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

export async function createBuildScorecardLead(input: Record<string, unknown>) {
  await ensureBuildServiceTables()
  const fullName = clean(input.fullName, 180)
  const email = normalizeEmail(input.email)
  const phone = clean(input.phone, 80)
  const companyName = clean(input.companyName, 220)
  const country = clean(input.country, 80)
  if (!fullName || !email || !companyName || !phone || !country) throw new Error("Full name, company, email, phone, and country are required.")

  const answers = {
    website: clean(input.website, 500),
    buildDesc: clean(input.buildDesc, 4000),
    problemDesc: clean(input.problemDesc, 4000),
    systemUsers: clean(input.systemUsers, 1000),
    currentProcess: clean(input.currentProcess, 200),
    complexity: clean(input.complexity, 200),
    budget: clean(input.budget, 200),
    decision: clean(input.decision, 200),
    timeline: clean(input.timeline, 200),
    country
  }
  const leadUuid = `build_${randomUUID().replace(/-/g, "")}`
  await prisma.$executeRaw`
    INSERT INTO tochukwu_build_scorecard_leads
      (lead_uuid, full_name, business_name, work_email, phone, role_title, company_size, score, band_key, headline, next_step, follow_up_required, answers_json, source_path, created_at, updated_at)
    VALUES
      (${leadUuid}, ${fullName}, ${companyName}, ${email}, ${phone}, ${country}, ${clean(input.systemUsers, 80)}, 100, 'checkout_ready',
       'Build discovery checkout ready', 'Complete the paid discovery call checkout.', 1, ${JSON.stringify(answers)}, '/build-scorecard', UTC_TIMESTAMP(), UTC_TIMESTAMP())
  `
  return { leadUuid }
}

export async function createPrivateCoachingLead(input: Record<string, unknown>) {
  await ensurePrivateCoachingServiceTables()
  const fullName = clean(input.fullName, 180)
  const email = normalizeEmail(input.email)
  const phone = clean(input.phone, 80)
  const country = clean(input.country, 80)
  if (!fullName || !email || !phone || !country) throw new Error("Full name, email, phone, and country are required.")
  const leadUuid = `paic_${randomUUID().replace(/-/g, "")}`
  await prisma.$executeRaw`
    INSERT INTO tochukwu_private_ai_coaching_leads
      (lead_uuid, full_name, work_email, phone, country, goal_text, experience_level, availability, source_path, created_at, updated_at)
    VALUES
      (${leadUuid}, ${fullName}, ${email}, ${phone}, ${country}, ${clean(input.goalText, 4000)}, ${clean(input.experienceLevel, 80)}, ${clean(input.availability, 120)}, '/private-ai-build-coaching/apply', UTC_TIMESTAMP(), UTC_TIMESTAMP())
  `
  return { leadUuid }
}

export async function getServiceCheckoutDetails(slug: ServiceCheckoutSlug, leadUuid: string): Promise<ServiceCheckoutDetails | null> {
  const safeLeadUuid = clean(leadUuid, 80)
  if (!safeLeadUuid) return null
  if (slug === "build-discovery") {
    await ensureBuildServiceTables()
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT lead_uuid, full_name, business_name, work_email, phone, role_title
      FROM tochukwu_build_scorecard_leads
      WHERE lead_uuid = ${safeLeadUuid}
      LIMIT 1
    `
    const row = rows[0]
    if (!row) return null
    return {
      slug,
      title: "Build Discovery Call",
      description: "Paid discovery call for your 30-day Build service application.",
      sourcePath: "/build-scorecard",
      leadUuid: clean(row.lead_uuid, 80),
      fullName: clean(row.full_name, 180),
      email: normalizeEmail(row.work_email),
      phone: clean(row.phone, 80),
      country: clean(row.role_title, 80) || "NG"
    }
  }

  await ensurePrivateCoachingServiceTables()
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT lead_uuid, full_name, work_email, phone, country
    FROM tochukwu_private_ai_coaching_leads
    WHERE lead_uuid = ${safeLeadUuid}
    LIMIT 1
  `
  const row = rows[0]
  if (!row) return null
  return {
    slug,
    title: "Private Coaching Discovery Call",
    description: "Paid consultation before private AI build coaching begins.",
    sourcePath: "/private-ai-build-coaching/apply",
    leadUuid: clean(row.lead_uuid, 80),
    fullName: clean(row.full_name, 180),
    email: normalizeEmail(row.work_email),
    phone: clean(row.phone, 80),
    country: clean(row.country, 80) || "NG"
  }
}

export async function createServiceCheckout(input: { slug: ServiceCheckoutSlug; leadUuid: string; country: string }) {
  const details = await getServiceCheckoutDetails(input.slug, input.leadUuid)
  if (!details) throw new Error("Checkout record not found.")
  const pricing = await serviceCheckoutPricing({ slug: input.slug, country: input.country })
  const referencePrefix = input.slug === "build-discovery" ? "BLD" : "PAIC"
  const reference = `${referencePrefix}_${details.leadUuid.replace(/[^a-z0-9]/gi, "").slice(0, 34).toUpperCase()}_${Date.now().toString().slice(-6)}`
  const metadata = {
    service_slug: input.slug,
    lead_uuid: details.leadUuid,
    full_name: details.fullName,
    country: input.country
  }

  const payment = pricing.provider === "stripe"
    ? await initializeStripe({
        email: details.email,
        amountMinor: pricing.finalAmountMinor,
        currency: pricing.currency,
        courseName: details.title,
        orderUuid: reference,
        courseSlug: input.slug,
        successUrl: `${siteBaseUrl()}/api/${input.slug === "build-discovery" ? "build-discovery" : "private-ai-coaching"}/stripe/return?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${siteBaseUrl()}/checkout/${input.slug}?lead=${encodeURIComponent(details.leadUuid)}&payment=cancelled`,
        metadata
      })
    : await initializePaystack({
        email: details.email,
        amountMinor: pricing.finalAmountMinor,
        reference,
        callbackUrl: `${siteBaseUrl()}/api/${input.slug === "build-discovery" ? "build-discovery" : "private-ai-coaching"}/paystack/return`,
        metadata
      })

  if (input.slug === "build-discovery") {
    await ensureBuildServiceTables()
    await prisma.$executeRaw`
      INSERT INTO tochukwu_build_discovery_payments
        (payment_uuid, lead_uuid, work_email, full_name, amount_minor, payment_provider, payment_reference, checkout_url, payment_status, created_at, updated_at)
      VALUES
        (${`buildpay_${Date.now()}_${randomUUID().slice(0, 8)}`}, ${details.leadUuid}, ${details.email}, ${details.fullName},
         ${pricing.finalAmountMinor}, ${pricing.provider}, ${payment.providerReference || reference}, ${payment.checkoutUrl}, 'initiated', UTC_TIMESTAMP(), UTC_TIMESTAMP())
    `
  } else {
    await ensurePrivateCoachingServiceTables()
    await prisma.$executeRaw`
      INSERT INTO tochukwu_private_ai_coaching_payments
        (payment_uuid, lead_uuid, work_email, full_name, payment_type, plan_key, amount_minor, currency, payment_provider, payment_reference, checkout_url, payment_status, created_at, updated_at)
      VALUES
        (${`paicpay_${Date.now()}_${randomUUID().slice(0, 8)}`}, ${details.leadUuid}, ${details.email}, ${details.fullName}, 'discovery', NULL,
         ${pricing.finalAmountMinor}, ${pricing.currency}, ${pricing.provider}, ${payment.providerReference || reference}, ${payment.checkoutUrl}, 'initiated', UTC_TIMESTAMP(), UTC_TIMESTAMP())
    `
  }

  return { checkoutUrl: payment.checkoutUrl, pricing }
}
