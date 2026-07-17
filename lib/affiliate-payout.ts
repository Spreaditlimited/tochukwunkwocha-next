import crypto, { randomUUID } from "crypto"
import { Prisma } from "@prisma/client"

import { sendEmail } from "@/lib/email"
import { prisma } from "@/lib/prisma"

const NIGERIAN_BANKS_FALLBACK = [
  { code: "044", name: "Access Bank" },
  { code: "063", name: "Access Bank (Diamond)" },
  { code: "023", name: "Citibank Nigeria" },
  { code: "050", name: "Ecobank Nigeria" },
  { code: "011", name: "First Bank of Nigeria" },
  { code: "214", name: "First City Monument Bank" },
  { code: "070", name: "Fidelity Bank" },
  { code: "058", name: "Guaranty Trust Bank" },
  { code: "030", name: "Heritage Bank" },
  { code: "082", name: "Keystone Bank" },
  { code: "076", name: "Polaris Bank" },
  { code: "221", name: "Stanbic IBTC Bank" },
  { code: "068", name: "Standard Chartered Bank Nigeria" },
  { code: "232", name: "Sterling Bank" },
  { code: "100", name: "SunTrust Bank Nigeria" },
  { code: "032", name: "Union Bank of Nigeria" },
  { code: "033", name: "United Bank For Africa" },
  { code: "215", name: "Unity Bank" },
  { code: "035", name: "Wema Bank" },
  { code: "057", name: "Zenith Bank" }
]

const PAYSTACK_BANKS_CACHE_TTL_MS = 6 * 60 * 60 * 1000
let payoutBanksCache: { expiresAt: number; banks: Array<{ name: string; code: string; slug: string }> } | null = null

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

function otpHash(value: string) {
  return sha256(`affotp:${clean(value, 24)}`)
}

function maskAccount(value: string) {
  return value ? `${value.slice(0, 2)}******${value.slice(-2)}` : ""
}

function maskEmail(value: string) {
  return clean(value, 220).replace(/(^.).*(@.*$)/, "$1***$2")
}

function paystackSecretKey() {
  return clean(process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET || process.env.PAYSTACK_SECRET_TEST_KEY, 1000)
}

async function paystackGet(path: string) {
  const secret = paystackSecretKey()
  if (!secret) throw new Error("Paystack secret key is not configured.")
  const response = await fetch(`https://api.paystack.co${path}`, {
    headers: { authorization: `Bearer ${secret}`, accept: "application/json" }
  })
  const json = await response.json().catch(() => null)
  if (!response.ok || json?.status === false) throw new Error(json?.message || `Paystack request failed (${response.status})`)
  return json
}

async function paystackPost(path: string, body: Record<string, unknown>) {
  const secret = paystackSecretKey()
  if (!secret) throw new Error("Paystack secret key is not configured.")
  const response = await fetch(`https://api.paystack.co${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify(body)
  })
  const json = await response.json().catch(() => null)
  if (!response.ok || json?.status === false) throw new Error(json?.message || `Paystack request failed (${response.status})`)
  return json
}

export async function ensureAffiliatePayoutTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_affiliate_payout_accounts (
      id BIGINT NOT NULL AUTO_INCREMENT,
      account_uuid VARCHAR(64) NOT NULL,
      affiliate_profile_id BIGINT NOT NULL,
      country_code VARCHAR(2) NOT NULL,
      currency VARCHAR(10) NOT NULL,
      payout_provider VARCHAR(40) NOT NULL,
      account_name VARCHAR(180) NULL,
      bank_code VARCHAR(40) NULL,
      bank_name VARCHAR(120) NULL,
      account_number_masked VARCHAR(40) NULL,
      account_number_hash VARCHAR(128) NULL,
      paystack_recipient_code VARCHAR(120) NULL,
      payout_email VARCHAR(220) NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'active',
      is_verified TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_aff_payout_account_uuid (account_uuid),
      KEY idx_tochukwu_aff_payout_account_profile (affiliate_profile_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_affiliate_payout_change_otps (
      id BIGINT NOT NULL AUTO_INCREMENT,
      otp_uuid VARCHAR(64) NOT NULL,
      affiliate_profile_id BIGINT NOT NULL,
      country_code VARCHAR(2) NOT NULL,
      currency VARCHAR(10) NOT NULL,
      payout_provider VARCHAR(40) NOT NULL,
      target_bank_code VARCHAR(40) NOT NULL,
      target_account_hash VARCHAR(128) NOT NULL,
      target_account_masked VARCHAR(40) NULL,
      sent_to_email VARCHAR(220) NOT NULL,
      otp_hash VARCHAR(128) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      attempts INT NOT NULL DEFAULT 0,
      max_attempts INT NOT NULL DEFAULT 5,
      expires_at DATETIME NOT NULL,
      verified_at DATETIME NULL,
      consumed_at DATETIME NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_aff_payout_otp_uuid (otp_uuid),
      KEY idx_tochukwu_aff_payout_otp_profile (affiliate_profile_id, status, expires_at),
      KEY idx_tochukwu_aff_payout_otp_target (affiliate_profile_id, target_bank_code, target_account_hash, status, expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

async function getAffiliateProfile(accountId: bigint) {
  const rows = await prisma.$queryRaw<Array<{ id: bigint; eligibilityStatus: string | null; countryCode: string | null; payoutCurrency: string | null; payoutProvider: string | null }>>(Prisma.sql`
    SELECT id, eligibility_status AS eligibilityStatus, country_code AS countryCode, payout_currency AS payoutCurrency, payout_provider AS payoutProvider
    FROM tochukwu_affiliate_profiles
    WHERE account_id = ${accountId}
    LIMIT 1
  `)
  const profile = rows[0]
  if (!profile) throw new Error("Affiliate profile not found.")
  if (clean(profile.eligibilityStatus, 40) !== "eligible") throw new Error("Affiliate profile is not eligible.")
  return profile
}

async function findActivePayoutAccount(profileId: bigint, countryCode = "NG", currency = "NGN") {
  const rows = await prisma.$queryRaw<Array<{ id: bigint; bankCode: string | null; accountNumberHash: string | null }>>(Prisma.sql`
    SELECT id, bank_code AS bankCode, account_number_hash AS accountNumberHash
    FROM tochukwu_affiliate_payout_accounts
    WHERE affiliate_profile_id = ${profileId}
      AND country_code = ${countryCode}
      AND currency = ${currency}
      AND status = 'active'
    ORDER BY id DESC
    LIMIT 1
  `)
  return rows[0] || null
}

function isPayoutAccountChange(existing: { bankCode: string | null; accountNumberHash: string | null } | null, bankCode: string, accountNumber: string) {
  if (!existing) return false
  const existingBankCode = clean(existing.bankCode, 40)
  const existingHash = clean(existing.accountNumberHash, 128)
  const targetHash = accountNumber ? sha256(`acct:${accountNumber}`) : ""
  if (!existingBankCode || !existingHash || !bankCode || !targetHash) return false
  return existingBankCode !== bankCode || existingHash !== targetHash
}

export async function listPayoutBanks() {
  if (payoutBanksCache && payoutBanksCache.expiresAt > Date.now()) return payoutBanksCache.banks
  try {
    const json = await paystackGet("/bank?country=nigeria&currency=NGN")
    const banks = Array.isArray(json?.data)
      ? json.data.map((bank: Record<string, unknown>) => ({
        name: clean(bank.name, 160),
        code: clean(bank.code, 40),
        slug: clean(bank.slug, 160)
      })).filter((bank: { name: string; code: string }) => bank.name && bank.code)
      : []
    if (banks.length) {
      payoutBanksCache = { expiresAt: Date.now() + PAYSTACK_BANKS_CACHE_TTL_MS, banks }
      return banks
    }
  } catch {
    // Try Paystack's cursor-style listing before reporting the list unavailable.
  }
  try {
    const json = await paystackGet("/bank?country=nigeria&currency=NGN&perPage=200&use_cursor=true")
    const verifiedCodes = new Set(
      (Array.isArray(json?.data) ? json.data : [])
        .map((bank: Record<string, unknown>) => clean(bank.code, 40))
        .filter(Boolean)
    )
    const fallback = NIGERIAN_BANKS_FALLBACK
      .filter((bank) => verifiedCodes.has(bank.code))
      .map((bank) => ({ ...bank, slug: "" }))
    if (fallback.length) {
      payoutBanksCache = { expiresAt: Date.now() + PAYSTACK_BANKS_CACHE_TTL_MS, banks: fallback }
      return fallback
    }
  } catch {
    // An empty list lets the UI retain an already-configured account without offering stale bank codes.
  }
  return []
}

export async function resolvePayoutAccount(input: { bankCode: string; accountNumber: string }) {
  const bankCode = clean(input.bankCode, 40)
  const accountNumber = clean(input.accountNumber, 40).replace(/\D/g, "")
  if (!bankCode) throw new Error("Bank selection is required.")
  if (accountNumber.length < 10) throw new Error("Valid account number is required.")
  const json = await paystackGet(`/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`)
  return {
    bankCode,
    accountNumber: clean(json?.data?.account_number || accountNumber, 40),
    accountName: clean(json?.data?.account_name, 180)
  }
}

export async function sendPayoutOtp(input: { accountId: bigint; email: string; fullName: string; bankCode: string; accountNumber: string }) {
  await ensureAffiliatePayoutTables()
  const profile = await getAffiliateProfile(input.accountId)
  const bankCode = clean(input.bankCode, 40)
  const accountNumber = clean(input.accountNumber, 40).replace(/\D/g, "")
  if (!bankCode || accountNumber.length < 10) throw new Error("Bank and valid account number are required.")
  const existing = await findActivePayoutAccount(profile.id)
  if (!isPayoutAccountChange(existing, bankCode, accountNumber)) {
    return {
      otpRequired: false,
      emailMasked: maskEmail(input.email),
      message: existing ? "No account change detected." : "No existing payout account yet."
    }
  }
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const now = new Date()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
  await prisma.$executeRaw(Prisma.sql`
    UPDATE tochukwu_affiliate_payout_change_otps
    SET status = 'cancelled', updated_at = ${now}
    WHERE affiliate_profile_id = ${profile.id}
      AND status IN ('pending', 'verified')
  `)
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO tochukwu_affiliate_payout_change_otps
      (otp_uuid, affiliate_profile_id, country_code, currency, payout_provider, target_bank_code, target_account_hash, target_account_masked,
       sent_to_email, otp_hash, status, attempts, max_attempts, expires_at, created_at, updated_at)
    VALUES
      (${`aotp_${randomUUID().replace(/-/g, "")}`}, ${profile.id}, 'NG', 'NGN', 'paystack', ${bankCode}, ${sha256(`acct:${accountNumber}`)}, ${maskAccount(accountNumber)},
       ${input.email.toLowerCase()}, ${otpHash(code)}, 'pending', 0, 5, ${expiresAt}, ${now}, ${now})
  `)
  await sendEmail({
    to: input.email,
    subject: "Verify payout account change",
    html: `<p>Hi ${clean(input.fullName, 80) || "there"},</p><p>Use this code to verify your payout account change:</p><p style="font-size:24px;font-weight:700;letter-spacing:2px;">${code}</p><p>This code expires in 10 minutes.</p>`,
    text: `Verify payout account change\nCode: ${code}\nExpires in 10 minutes.`
  })
  return { otpRequired: true, emailMasked: maskEmail(input.email), expiresInSeconds: 600 }
}

async function validateOtp(profileId: bigint, bankCode: string, accountNumber: string, otpCode: string) {
  const rows = await prisma.$queryRaw<Array<{ id: bigint; otpHash: string; attempts: number; maxAttempts: number }>>(Prisma.sql`
    SELECT id, otp_hash AS otpHash, attempts, max_attempts AS maxAttempts
    FROM tochukwu_affiliate_payout_change_otps
    WHERE affiliate_profile_id = ${profileId}
      AND target_bank_code = ${bankCode}
      AND target_account_hash = ${sha256(`acct:${accountNumber}`)}
      AND status IN ('pending', 'verified')
      AND expires_at > NOW()
    ORDER BY id DESC
    LIMIT 1
  `)
  const row = rows[0]
  if (!row) throw new Error("Request a new verification code to confirm this payout account change.")
  if (otpHash(otpCode) !== clean(row.otpHash, 128)) {
    const attempts = Number(row.attempts || 0) + 1
    const status = attempts >= Number(row.maxAttempts || 5) ? "expired" : "pending"
    await prisma.$executeRaw(Prisma.sql`UPDATE tochukwu_affiliate_payout_change_otps SET attempts = ${attempts}, status = ${status}, updated_at = ${new Date()} WHERE id = ${row.id} LIMIT 1`)
    throw new Error(status === "expired" ? "Verification code attempts exceeded. Request a new code." : "Invalid verification code.")
  }
  return row.id
}

export async function savePayoutAccount(input: {
  accountId: bigint
  bankCode: string
  bankName: string
  accountNumber: string
  accountName: string
  otpCode: string
  payoutEmail?: string
}) {
  await ensureAffiliatePayoutTables()
  const profile = await getAffiliateProfile(input.accountId)
  const bankCode = clean(input.bankCode, 40)
  const accountNumber = clean(input.accountNumber, 40).replace(/\D/g, "")
  const resolved = await resolvePayoutAccount({ bankCode, accountNumber })
  const existing = await findActivePayoutAccount(profile.id)
  const changingExisting = isPayoutAccountChange(existing, bankCode, accountNumber)
  const otpId = changingExisting
    ? await validateOtp(profile.id, bankCode, accountNumber, clean(input.otpCode, 12).replace(/\D/g, ""))
    : null
  const recipient = await paystackPost("/transferrecipient", {
    type: "nuban",
    name: resolved.accountName || input.accountName,
    account_number: accountNumber,
    bank_code: bankCode,
    currency: "NGN"
  })
  const now = new Date()
  const operations: Prisma.PrismaPromise<unknown>[] = [
    prisma.$executeRaw(Prisma.sql`
      UPDATE tochukwu_affiliate_payout_accounts
      SET status = 'inactive', updated_at = ${now}
      WHERE affiliate_profile_id = ${profile.id}
        AND country_code = 'NG'
        AND currency = 'NGN'
        AND status = 'active'
    `),
    prisma.$executeRaw(Prisma.sql`
      INSERT INTO tochukwu_affiliate_payout_accounts
        (account_uuid, affiliate_profile_id, country_code, currency, payout_provider, account_name, bank_code, bank_name,
         account_number_masked, account_number_hash, paystack_recipient_code, payout_email, status, is_verified, created_at, updated_at)
      VALUES
        (${`apa_${randomUUID().replace(/-/g, "")}`}, ${profile.id}, 'NG', 'NGN', 'paystack', ${resolved.accountName || input.accountName}, ${bankCode}, ${clean(input.bankName, 120)},
         ${maskAccount(accountNumber)}, ${sha256(`acct:${accountNumber}`)}, ${clean(recipient?.data?.recipient_code, 120)}, ${clean(input.payoutEmail, 220) || null}, 'active', 1, ${now}, ${now})
    `),
    prisma.$executeRaw(Prisma.sql`
      UPDATE tochukwu_affiliate_profiles
      SET country_code = 'NG', payout_currency = 'NGN', payout_provider = 'paystack', updated_at = ${now}
      WHERE id = ${profile.id}
      LIMIT 1
    `)
  ]
  if (otpId) {
    operations.splice(
      2,
      0,
      prisma.$executeRaw(Prisma.sql`
        UPDATE tochukwu_affiliate_payout_change_otps
        SET status = 'used', verified_at = COALESCE(verified_at, ${now}), consumed_at = ${now}, updated_at = ${now}
        WHERE id = ${otpId}
        LIMIT 1
      `)
    )
  }
  await prisma.$transaction(operations)
  return { bankCode, accountName: resolved.accountName || input.accountName, accountNumberMasked: maskAccount(accountNumber) }
}
