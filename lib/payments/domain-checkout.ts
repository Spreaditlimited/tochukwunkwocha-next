import { randomUUID } from "crypto"
import { Prisma } from "@prisma/client"

import { applyAdminSettingsToProcessEnv, getAdminSettingValue } from "@/lib/admin-settings"
import {
  initializePaystack,
  initializeStripe,
  isNigeriaCountry,
  retrieveStripeSession,
  siteBaseUrl,
  stripeCurrencyForCountry,
  verifyPaystackTransaction,
  type CheckoutProvider
} from "@/lib/payments/course-checkout"
import { prisma } from "@/lib/prisma"
import { getConfiguredStripeFee, grossUpStripeAmount } from "@/lib/payments/processing-fees"
import {
  checkStudentDomainAvailability,
  domainProvider,
  ensureDomainRequestTables,
  getDomainRegistrationPrice,
  normalizeDomain
} from "@/lib/student-domain-actions"

export type DomainQuote = {
  currency: string
  provider: CheckoutProvider
  years: number
  nairaSubtotalMinor: number
  exchangeRateNgnPerUnit: number | null
  fxBufferPercent: number
  baseAmountMinor: number
  subtotalMinor: number
  vatPercent: number
  vatAmountMinor: number
  processingFeeMinor: number
  totalAmountMinor: number
  addOns: []
}

type RegistrantProfile = {
  address1: string
  city: string
  state: string
  country: string
  postalCode: string
  phone: string
  phoneCc: string
}

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

export function supportedCheckoutDomain(value: unknown) {
  const domainName = normalizeDomain(value)
  if (!domainName) throw new Error("Enter a valid domain name.")
  if (domainName.endsWith(".ng")) throw new Error(".ng extensions are currently not supported.")
  return domainName
}

function yearsInt(value: unknown) {
  return Math.max(1, Math.min(10, Math.trunc(Number(value || 1))))
}

function nairaVatPercent() {
  const raw = Number(process.env.DOMAIN_VAT_PERCENT || process.env.SITE_VAT_PERCENT)
  return Number.isFinite(raw) && raw >= 0 ? Math.min(raw, 100) : 7.5
}

async function internationalVatPercent() {
  const raw = Number(await getAdminSettingValue("INTL_VAT_PERCENT"))
  return Number.isFinite(raw) && raw >= 0 ? Math.min(raw, 100) : 20
}

async function settingOrEnvNumber(key: string) {
  const setting = Number(await getAdminSettingValue(key))
  if (Number.isFinite(setting) && setting > 0) return setting
  const env = Number(process.env[key])
  return Number.isFinite(env) && env > 0 ? env : 0
}

async function fxBufferPercent() {
  const settingText = await getAdminSettingValue("DOMAIN_FX_BUFFER_PERCENT")
  const setting = settingText === "" ? Number.NaN : Number(settingText)
  const envText = process.env.DOMAIN_FX_BUFFER_PERCENT
  const env = envText === undefined || envText === "" ? Number.NaN : Number(envText)
  const settingValid = Number.isFinite(setting) && setting >= 0
  const envValid = Number.isFinite(env) && env >= 0
  if (!settingValid && !envValid) throw new Error("Missing international domain FX buffer setting: DOMAIN_FX_BUFFER_PERCENT")
  const value = settingValid ? setting : env
  return Math.min(value, 25)
}

async function exchangeRate(currency: string) {
  const rate = await settingOrEnvNumber(`DOMAIN_FX_NGN_PER_${currency}`)
  if (!(rate > 0)) throw new Error(`Missing international domain exchange rate: DOMAIN_FX_NGN_PER_${currency}`)
  return rate
}

async function grossUpForStripe(netMinor: number, currency: string) {
  const { bps, fixedMinor } = await getConfiguredStripeFee(currency)
  const total = grossUpStripeAmount(netMinor, bps, fixedMinor)
  return { total, fee: Math.max(0, total - netMinor) }
}

function pct(value: unknown, fallback: number) {
  const raw = Number(value)
  return (Number.isFinite(raw) && raw >= 0 ? raw : fallback) / 100
}

function profitFloor(years: number, vat: number) {
  const fx = Number(process.env.DOMAIN_WORST_FX_NGN_PER_USD || process.env.DOMAIN_PRICING_WORST_FX_NGN_PER_USD || 0)
  const usd = Number(process.env.DOMAIN_REGISTRAR_COST_USD_PER_YEAR || 17.99)
  if (!(fx > 0) || !(usd > 0)) return 0
  const cost = Math.round(usd * years * fx * 100)
  const margin = pct(process.env.DOMAIN_TARGET_MARGIN_PERCENT, 20)
  const paystack = pct(process.env.DOMAIN_PAYSTACK_PERCENT, 1.5)
  const feeVat = pct(process.env.DOMAIN_PAYSTACK_FEE_VAT_PERCENT, 7.5)
  const fixed = Math.max(0, Math.round(Number(process.env.DOMAIN_PAYSTACK_FIXED_FEE_NGN || 100) * 100))
  const denominator = 1 - paystack * (1 + vat / 100) * (1 + feeVat)
  return denominator > 0 ? Math.max(0, Math.ceil(((1 + margin) * cost + fixed * (1 + feeVat)) / denominator)) : 0
}

export async function buildDomainQuote(domainNameInput: unknown, yearsInput: unknown, countryInput: unknown = "NG"): Promise<DomainQuote> {
  const domainName = supportedCheckoutDomain(domainNameInput)
  const years = yearsInt(yearsInput)
  const pricing = await getDomainRegistrationPrice(domainName, years)
  const currency = clean(pricing.currency, 10).toUpperCase()
  const rawBase = Math.round(Number(pricing.amountMinor || 0))
  if (currency !== "NGN") throw new Error(`Registrar currency is ${currency || "unknown"}. Set the selling/display currency to NGN.`)
  if (!(rawBase > 0)) throw new Error("The registrar returned an invalid registration amount.")
  const provider: CheckoutProvider = isNigeriaCountry(countryInput) ? "paystack" : "stripe"
  const nairaVat = nairaVatPercent()
  const nairaSubtotalMinor = Math.max(rawBase, profitFloor(years, nairaVat))
  if (provider === "paystack") {
    const vatAmountMinor = Math.round(nairaSubtotalMinor * nairaVat / 100)
    return {
      currency,
      provider,
      years,
      nairaSubtotalMinor,
      exchangeRateNgnPerUnit: null,
      fxBufferPercent: 0,
      baseAmountMinor: nairaSubtotalMinor,
      subtotalMinor: nairaSubtotalMinor,
      vatPercent: nairaVat,
      vatAmountMinor,
      processingFeeMinor: 0,
      totalAmountMinor: nairaSubtotalMinor + vatAmountMinor,
      addOns: []
    }
  }

  const internationalCurrency = stripeCurrencyForCountry(countryInput)
  const rate = await exchangeRate(internationalCurrency)
  const buffer = await fxBufferPercent()
  const baseAmountMinor = Math.ceil((nairaSubtotalMinor / rate) * (1 + buffer / 100))
  const vat = await internationalVatPercent()
  const vatAmountMinor = Math.round(baseAmountMinor * vat / 100)
  const taxedMinor = baseAmountMinor + vatAmountMinor
  const stripe = await grossUpForStripe(taxedMinor, internationalCurrency)
  return {
    currency: internationalCurrency,
    provider,
    years,
    nairaSubtotalMinor,
    exchangeRateNgnPerUnit: rate,
    fxBufferPercent: buffer,
    baseAmountMinor,
    subtotalMinor: baseAmountMinor,
    vatPercent: vat,
    vatAmountMinor,
    processingFeeMinor: stripe.fee,
    totalAmountMinor: stripe.total,
    addOns: []
  }
}

function registrantProfile(input: Record<string, unknown>): RegistrantProfile {
  const profile = {
    address1: clean(input.registrantAddress1, 240),
    city: clean(input.registrantCity, 120),
    state: clean(input.registrantState, 120),
    country: clean(input.registrantCountry, 120),
    postalCode: clean(input.registrantPostalCode, 40),
    phone: clean(input.registrantPhone, 50),
    phoneCc: clean(input.registrantPhoneCc, 10)
  }
  if (Object.values(profile).some((value) => !value)) {
    throw new Error("Address, city, state, country, postal code, phone, and phone country code are required.")
  }
  return profile
}

export async function createDomainCheckout(input: {
  accountId: bigint
  email: string
  fullName: string
  body: Record<string, unknown>
}) {
  const domainName = supportedCheckoutDomain(input.body.domainName)
  const availability = await checkStudentDomainAvailability(domainName)
  if (!availability.available) throw new Error(`${domainName} is not available.`)
  const years = yearsInt(input.body.years)
  const profile = registrantProfile(input.body)
  const quote = await buildDomainQuote(domainName, years, profile.country)
  const orderUuid = `dor_${randomUUID().replace(/-/g, "")}`
  const reference = `DMN_${randomUUID().replace(/-/g, "").slice(0, 24)}`
  const provider = availability.provider || domainProvider()
  const autoRenew = input.body.autoRenewEnabled !== false
  await ensureDomainRequestTables()
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO domain_orders
      (order_uuid, account_id, email, domain_name, years, provider, status, payment_provider, payment_status,
       purchase_currency, purchase_amount_minor, payment_reference, provider_order_id, registrant_profile_json, selected_services_json,
       auto_renew_enabled, notes, created_at, updated_at)
    VALUES
      (${orderUuid}, ${input.accountId}, ${input.email.toLowerCase()}, ${domainName}, ${years}, ${provider}, 'payment_pending',
       ${quote.provider}, 'pending', ${quote.currency}, ${quote.totalAmountMinor}, ${reference}, NULL, ${JSON.stringify(profile)}, '[]',
       ${autoRenew ? 1 : 0}, ${`Awaiting ${quote.provider === "stripe" ? "Stripe" : "Paystack"} payment.`}, UTC_TIMESTAMP(), UTC_TIMESTAMP())
  `)
  try {
    const metadata = { payment_scope: "domain_registration", order_uuid: orderUuid, domain_name: domainName, account_id: input.accountId.toString(), full_name: input.fullName }
    const payment = quote.provider === "stripe"
      ? await initializeStripe({
          email: input.email,
          amountMinor: quote.totalAmountMinor,
          currency: quote.currency,
          courseName: `${domainName} domain registration (${years} year${years === 1 ? "" : "s"})`,
          orderUuid,
          courseSlug: "domain-registration",
          successUrl: `${siteBaseUrl()}/api/domains/stripe/return?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${siteBaseUrl()}/dashboard/domains?domain=${encodeURIComponent(domainName)}&payment=cancelled#domainRegisterSection`,
          metadata
        })
      : await initializePaystack({
          email: input.email,
          amountMinor: quote.totalAmountMinor,
          reference,
          callbackUrl: `${siteBaseUrl()}/api/domains/paystack/return`,
          metadata
        })
    const paymentReference = payment.providerReference || reference
    await prisma.$executeRaw(Prisma.sql`
      UPDATE domain_orders SET checkout_url = ${payment.checkoutUrl}, payment_reference = ${paymentReference}, updated_at = UTC_TIMESTAMP()
      WHERE order_uuid = ${orderUuid} LIMIT 1
    `)
    return { checkoutUrl: payment.checkoutUrl, orderUuid, quote }
  } catch (error) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE domain_orders SET status = 'payment_initialization_failed', payment_status = 'failed', notes = ${clean(error instanceof Error ? error.message : "Payment initialization failed", 500)}, updated_at = UTC_TIMESTAMP()
      WHERE order_uuid = ${orderUuid} LIMIT 1
    `).catch(() => null)
    throw error
  }
}

type DomainOrder = {
  orderUuid: string
  accountId: bigint
  email: string
  domainName: string
  years: number
  provider: string
  status: string
  paymentStatus: string
  paymentProvider: string
  currency: string | null
  amountMinor: bigint | number | null
  registrantJson: string | null
  autoRenew: bigint | number | boolean
}

export async function completePaidDomainCheckout(referenceInput: unknown) {
  const reference = clean(referenceInput, 180)
  if (!reference) throw new Error("Payment reference is required.")
  await ensureDomainRequestTables()
  const rows = await prisma.$queryRaw<DomainOrder[]>(Prisma.sql`
    SELECT order_uuid AS orderUuid, account_id AS accountId, email, domain_name AS domainName, years, provider, status,
           payment_status AS paymentStatus, payment_provider AS paymentProvider, purchase_currency AS currency, purchase_amount_minor AS amountMinor,
           registrant_profile_json AS registrantJson, auto_renew_enabled AS autoRenew
    FROM domain_orders WHERE payment_reference = ${reference} OR provider_order_id = ${reference}
    ORDER BY CASE WHEN payment_reference = ${reference} THEN 0 ELSE 1 END LIMIT 1
  `)
  const order = rows[0]
  if (!order) throw new Error("Domain order not found.")
  if (order.status === "registered") return { orderUuid: order.orderUuid }
  if (order.status === "registration_in_progress" && order.paymentStatus === "paid") return { orderUuid: order.orderUuid }
  if (order.paymentStatus !== "paid") {
    let amountMinor: number | null
    let currency: string
    if (order.paymentProvider === "stripe") {
      const stripeSession = await retrieveStripeSession(reference)
      if (stripeSession.orderUuid !== order.orderUuid) throw new Error("Stripe session does not match this domain order.")
      amountMinor = stripeSession.amountMinor
      currency = stripeSession.currency
    } else {
      const paystackTransaction = await verifyPaystackTransaction(reference)
      amountMinor = paystackTransaction.amountMinor
      currency = paystackTransaction.currency
    }
    if (amountMinor !== null && Number(order.amountMinor || 0) !== amountMinor) throw new Error("Paid amount does not match this domain order.")
    if (currency && clean(order.currency, 10).toUpperCase() !== currency) throw new Error("Paid currency does not match this domain order.")
    await prisma.$executeRaw(Prisma.sql`
      UPDATE domain_orders SET status = 'registration_in_progress', payment_status = 'paid', notes = 'Payment confirmed. Domain registration is being processed.', updated_at = UTC_TIMESTAMP()
      WHERE order_uuid = ${order.orderUuid} LIMIT 1
    `)
  }

  // Registration happens only after the payment has been verified server-side.
  const profile = JSON.parse(order.registrantJson || "{}") as RegistrantProfile
  await applyAdminSettingsToProcessEnv()
  const { createRequire } = await import("module")
  const client = createRequire(import.meta.url)("../domain-client.cjs") as { registerDomain: (value: Record<string, unknown>) => Promise<Record<string, unknown>> }
  const result = await client.registerDomain({
    domainName: order.domainName,
    years: order.years,
    email: order.email,
    registrantAddress1: profile.address1,
    registrantCity: profile.city,
    registrantState: profile.state,
    registrantCountry: profile.country,
    registrantPostalCode: profile.postalCode,
    registrantPhone: profile.phone,
    registrantPhoneCc: profile.phoneCc
  })
  if (result.success !== true) {
    const reason = clean(result.reason || "Domain registration failed after payment.", 500)
    await prisma.$executeRaw(Prisma.sql`UPDATE domain_orders SET status = 'registration_failed', notes = ${reason}, updated_at = UTC_TIMESTAMP() WHERE order_uuid = ${order.orderUuid} LIMIT 1`)
    throw new Error(reason)
  }
  const registeredAt = new Date()
  const renewalDueAt = new Date(registeredAt)
  renewalDueAt.setFullYear(renewalDueAt.getFullYear() + order.years)
  const registrarOrderId = clean(result.orderId, 120) || reference
  await prisma.$transaction([
    prisma.$executeRaw(Prisma.sql`
      UPDATE domain_orders SET status = 'registered', provider = ${clean(result.provider, 40) || order.provider}, provider_order_id = ${registrarOrderId}, registered_at = ${registeredAt}, notes = 'Registration completed.', updated_at = ${registeredAt}
      WHERE order_uuid = ${order.orderUuid} LIMIT 1
    `),
    prisma.$executeRaw(Prisma.sql`
      INSERT INTO user_domains
        (account_id, email, domain_name, provider, status, years, purchase_currency, purchase_amount_minor, provider_order_id,
         selected_services_json, auto_renew_enabled, registered_at, renewal_due_at, last_synced_at, created_at, updated_at)
      VALUES
        (${order.accountId}, ${order.email}, ${order.domainName}, ${clean(result.provider, 40) || order.provider}, 'registered', ${order.years},
         ${order.currency}, ${Number(order.amountMinor || 0)}, ${registrarOrderId}, '[]', ${order.autoRenew ? 1 : 0},
         ${registeredAt}, ${renewalDueAt}, ${registeredAt}, ${registeredAt}, ${registeredAt})
      ON DUPLICATE KEY UPDATE status = 'registered', provider = VALUES(provider), years = VALUES(years),
        purchase_currency = VALUES(purchase_currency), purchase_amount_minor = VALUES(purchase_amount_minor),
        provider_order_id = VALUES(provider_order_id), auto_renew_enabled = VALUES(auto_renew_enabled),
        registered_at = VALUES(registered_at), renewal_due_at = VALUES(renewal_due_at), updated_at = VALUES(updated_at)
    `)
  ])
  return { orderUuid: order.orderUuid }
}

export async function retryPaidDomainCheckout(accountId: bigint, orderUuidInput: unknown) {
  const orderUuid = clean(orderUuidInput, 72)
  if (!orderUuid) throw new Error("Order reference is required.")
  await ensureDomainRequestTables()
  const rows = await prisma.$queryRaw<Array<{ paymentReference: string | null; paymentStatus: string }>>(Prisma.sql`
    SELECT payment_reference AS paymentReference, payment_status AS paymentStatus
    FROM domain_orders WHERE order_uuid = ${orderUuid} AND account_id = ${accountId} LIMIT 1
  `)
  const order = rows[0]
  if (!order) throw new Error("Domain order not found.")
  if (order.paymentStatus !== "paid") throw new Error("Only a paid domain order can be retried.")
  if (!order.paymentReference) throw new Error("This order has no payment reference.")
  return completePaidDomainCheckout(order.paymentReference)
}
