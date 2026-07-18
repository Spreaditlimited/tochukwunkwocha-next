import { prisma } from "@/lib/prisma"

export type AdminSettingDefinition = {
  key: string
  category: string
  secret?: boolean
  restartSensitive?: boolean
}

export const ADMIN_SETTING_DEFINITIONS: AdminSettingDefinition[] = [
  { key: "NODE_ENV", category: "Core" },
  { key: "SITE_BASE_URL", category: "Core" },
  { key: "AUTH_SECRET", category: "Core", secret: true, restartSensitive: true },
  { key: "DATABASE_URL", category: "Database", secret: true, restartSensitive: true },
  { key: "DB_HOST", category: "Database", restartSensitive: true },
  { key: "DB_USER", category: "Database", restartSensitive: true },
  { key: "DB_PASSWORD", category: "Database", secret: true, restartSensitive: true },
  { key: "DB_NAME", category: "Database", restartSensitive: true },
  { key: "ADMIN_DASHBOARD_PASSWORD", category: "Admin Auth", secret: true, restartSensitive: true },
  { key: "ADMIN_SESSION_SECRET", category: "Admin Auth", secret: true, restartSensitive: true },
  { key: "PAYSTACK_SECRET_KEY", category: "Payments", secret: true },
  { key: "PAYSTACK_PUBLIC_KEY", category: "Payments" },
  { key: "PAYPAL_ENV", category: "Payments" },
  { key: "PAYPAL_CLIENT_ID", category: "Payments", secret: true },
  { key: "PAYPAL_CLIENT_SECRET", category: "Payments", secret: true },
  { key: "PAYPAL_WEBHOOK_ID", category: "Payments", secret: true },
  { key: "STRIPE_SECRET_KEY", category: "Payments", secret: true },
  { key: "STRIPE_WEBHOOK_SECRET", category: "Payments", secret: true },
  { key: "STRIPE_FEE_BPS", category: "Pricing" },
  { key: "STRIPE_FEE_FIXED_GBP_MINOR", category: "Pricing" },
  { key: "STRIPE_FEE_FIXED_USD_MINOR", category: "Pricing" },
  { key: "STRIPE_FEE_FIXED_EUR_MINOR", category: "Pricing" },
  { key: "SITE_VAT_PERCENT", category: "Pricing" },
  { key: "INTL_VAT_PERCENT", category: "Pricing" },
  { key: "INSTALLMENT_SURCHARGE_PERCENT", category: "Pricing" },
  { key: "PROMPT_TO_PROFIT_PRICE_NGN_MINOR", category: "Pricing" },
  { key: "PROMPT_TO_PROFIT_PRICE_GBP", category: "Pricing" },
  { key: "PROMPT_TO_PRODUCTION_PRICE_NGN_MINOR", category: "Pricing" },
  { key: "PROMPT_TO_PRODUCTION_PRICE_GBP", category: "Pricing" },
  { key: "LEADPAGE_PRICE_NGN_MINOR", category: "Pricing" },
  { key: "BUSINESS_PLAN_PRICE_NGN_MINOR", category: "Pricing" },
  { key: "BUILD_DISCOVERY_FEE_NGN_MINOR", category: "Pricing" },
  { key: "BUILD_DISCOVERY_FEE_GBP_MINOR", category: "Pricing" },
  { key: "BUILD_DISCOVERY_FEE_USD_MINOR", category: "Pricing" },
  { key: "BUILD_DISCOVERY_FEE_EUR_MINOR", category: "Pricing" },
  { key: "PRIVATE_AI_COACHING_DISCOVERY_FEE_NGN_MINOR", category: "Pricing" },
  { key: "PRIVATE_AI_COACHING_DISCOVERY_FEE_GBP_MINOR", category: "Pricing" },
  { key: "PRIVATE_AI_COACHING_DISCOVERY_FEE_USD_MINOR", category: "Pricing" },
  { key: "PRIVATE_AI_COACHING_DISCOVERY_FEE_EUR_MINOR", category: "Pricing" },
  { key: "PRIVATE_AI_COACHING_HOURLY_RATE_NGN_MINOR", category: "Pricing" },
  { key: "PRIVATE_AI_COACHING_HOURLY_RATE_GBP_MINOR", category: "Pricing" },
  { key: "PRIVATE_AI_COACHING_HOURLY_RATE_USD_MINOR", category: "Pricing" },
  { key: "PRIVATE_AI_COACHING_HOURLY_RATE_EUR_MINOR", category: "Pricing" },
  { key: "PRIVATE_AI_COACHING_FOUNDATION_MONTHLY_HOURS", category: "Pricing" },
  { key: "PRIVATE_AI_COACHING_BUILD_MONTHLY_HOURS", category: "Pricing" },
  { key: "PRIVATE_AI_COACHING_INTENSIVE_MONTHLY_HOURS", category: "Pricing" },
  { key: "PRIVATE_AI_COACHING_FOUNDATION_PAYSTACK_PLAN_CODE", category: "Pricing" },
  { key: "PRIVATE_AI_COACHING_BUILD_PAYSTACK_PLAN_CODE", category: "Pricing" },
  { key: "PRIVATE_AI_COACHING_INTENSIVE_PAYSTACK_PLAN_CODE", category: "Pricing" },
  { key: "MANUAL_BANK_NAME", category: "Manual Transfer" },
  { key: "MANUAL_BANK_ACCOUNT_NAME", category: "Manual Transfer" },
  { key: "MANUAL_BANK_ACCOUNT_NUMBER", category: "Manual Transfer" },
  { key: "MANUAL_BANK_NOTE", category: "Manual Transfer" },
  { key: "CLOUDINARY_CLOUD_NAME", category: "Media Upload" },
  { key: "CLOUDINARY_API_KEY", category: "Media Upload", secret: true },
  { key: "CLOUDINARY_API_SECRET", category: "Media Upload", secret: true },
  { key: "CLOUDFLARE_ACCOUNT_ID", category: "Cloudflare Stream" },
  { key: "CLOUDFLARE_STREAM_API_TOKEN", category: "Cloudflare Stream", secret: true },
  { key: "CLOUDFLARE_STREAM_SIGNING_KEY_ID", category: "Cloudflare Stream" },
  { key: "CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY", category: "Cloudflare Stream", secret: true },
  { key: "CLOUDFLARE_STREAM_TOKEN_TTL_SECONDS", category: "Cloudflare Stream" },
  { key: "OPENAI_API_KEY", category: "AI/SEO", secret: true },
  { key: "OPENAI_MODEL", category: "AI/SEO" },
  { key: "OPENAI_IMAGE_MODEL", category: "AI/SEO" },
  { key: "OPENAI_IMAGE_SIZE", category: "AI/SEO" },
  { key: "OPENAI_IMAGE_QUALITY", category: "AI/SEO" },
  { key: "OPENAI_IMAGE_TIMEOUT_MS", category: "AI/SEO" },
  { key: "GEMINI_API_KEY", category: "AI/SEO", secret: true },
  { key: "GOOGLE_AI_API_KEY", category: "AI/SEO", secret: true },
  { key: "GEMINI_MODEL", category: "AI/SEO" },
  { key: "BREVO_API_KEY", category: "Email/CRM", secret: true },
  { key: "SENDINBLUE_API_KEY", category: "Email/CRM", secret: true },
  { key: "SMTP_HOST", category: "Email/CRM" },
  { key: "SMTP_PORT", category: "Email/CRM" },
  { key: "SMTP_SECURE", category: "Email/CRM" },
  { key: "SMTP_USER", category: "Email/CRM" },
  { key: "SMTP_PASS", category: "Email/CRM", secret: true },
  { key: "SMTP_FROM_EMAIL", category: "Email/CRM" },
  { key: "SMTP_FROM_NAME", category: "Email/CRM" },
  { key: "FLODESK_API_KEY", category: "Email/CRM", secret: true },
  { key: "FLODESK_ENROL_SEGMENT_ID", category: "Email/CRM" },
  { key: "FLODESK_ENROL_PROD_SEGMENT_ID", category: "Email/CRM" },
  { key: "FLODESK_PRE_ENROL_SEGMENT_ID", category: "Email/CRM" },
  { key: "LEADPAGE_BREVO_ENABLED", category: "Email/CRM" },
  { key: "LEADPAGE_BREVO_ALLOW_MOCK", category: "Email/CRM" },
  { key: "BREVO_LEADPAGE_LIST_ID", category: "Email/CRM" },
  { key: "BREVO_LEADPAGE_FOLLOWUP_EMAIL_COUNT", category: "Email/CRM" },
  { key: "BREVO_FREE_TIER_DAILY_SEND_LIMIT", category: "Email/CRM" },
  { key: "SCHOOL_NOTIFICATION_EMAILS", category: "Schools Notifications" },
  { key: "SCHOOLS_MIN_SEATS", category: "Schools Pricing" },
  { key: "SCHOOLS_ADVANCED_MIN_SEATS", category: "Schools Pricing" },
  { key: "SCHOOLS_PRICE_PER_STUDENT_NGN_MINOR", category: "Schools Pricing" },
  { key: "SCHOOLS_TRUST_TRAINED_VALUE", category: "Schools Landing" },
  { key: "SCHOOLS_TRUST_TRAINED_LABEL", category: "Schools Landing" },
  { key: "SCHOOLS_TRUST_REVIEWS_VALUE", category: "Schools Landing" },
  { key: "SCHOOLS_TRUST_REVIEWS_LABEL", category: "Schools Landing" },
  { key: "SCHOOLS_TRUST_OUTPUT_VALUE", category: "Schools Landing" },
  { key: "SCHOOLS_TRUST_OUTPUT_LABEL", category: "Schools Landing" },
  { key: "NAMECHEAP_API_USER", category: "Registrar (Namecheap)" },
  { key: "NAMECHEAP_API_KEY", category: "Registrar (Namecheap)", secret: true },
  { key: "NAMECHEAP_USERNAME", category: "Registrar (Namecheap)" },
  { key: "NAMECHEAP_CLIENT_IP", category: "Registrar (Namecheap)" },
  { key: "NAMECHEAP_USE_SANDBOX", category: "Registrar (Namecheap)" },
  { key: "NAMECHEAP_CONTACT_FIRST_NAME", category: "Registrar (Namecheap)" },
  { key: "NAMECHEAP_CONTACT_LAST_NAME", category: "Registrar (Namecheap)" },
  { key: "NAMECHEAP_CONTACT_ADDRESS1", category: "Registrar (Namecheap)" },
  { key: "NAMECHEAP_CONTACT_CITY", category: "Registrar (Namecheap)" },
  { key: "NAMECHEAP_CONTACT_STATE", category: "Registrar (Namecheap)" },
  { key: "NAMECHEAP_CONTACT_POSTAL_CODE", category: "Registrar (Namecheap)" },
  { key: "NAMECHEAP_CONTACT_COUNTRY", category: "Registrar (Namecheap)" },
  { key: "NAMECHEAP_CONTACT_PHONE", category: "Registrar (Namecheap)" },
  { key: "NAMECHEAP_CONTACT_EMAIL", category: "Registrar (Namecheap)" },
  { key: "RESCLUB_AUTH_USERID", category: "Registrar (ResellerClub)", secret: true },
  { key: "RESCLUB_API_KEY", category: "Registrar (ResellerClub)", secret: true },
  { key: "RESCLUB_PRICE_SOURCE", category: "Registrar (ResellerClub)" },
  { key: "RESCLUB_DOMAIN_PRODUCT_KEYS_JSON", category: "Registrar (ResellerClub)" },
  { key: "RESCLUB_SERVICE_PRODUCT_KEYS_JSON", category: "Registrar (ResellerClub)" },
  { key: "DOMAIN_REGISTRAR_PROVIDER", category: "Domain Automation" },
  { key: "DOMAIN_WORST_FX_NGN_PER_USD", category: "Domain Automation" },
  { key: "DOMAIN_FX_NGN_PER_GBP", category: "Domain Automation" },
  { key: "DOMAIN_FX_NGN_PER_USD", category: "Domain Automation" },
  { key: "DOMAIN_FX_NGN_PER_EUR", category: "Domain Automation" },
  { key: "DOMAIN_FX_BUFFER_PERCENT", category: "Domain Automation" },
  { key: "LEADPAGE_DOMAIN_AUTOMATION_ENABLED", category: "Domain Automation" },
  { key: "LEADPAGE_DOMAIN_PROVIDER", category: "Domain Automation" },
  { key: "LEADPAGE_DOMAIN_ALLOW_MOCK", category: "Domain Automation" },
  { key: "LEADPAGE_DOMAIN_TLDS", category: "Domain Automation" },
  { key: "LEADPAGE_DOMAIN_SUGGEST_WINDOW_SECONDS", category: "Domain Automation" },
  { key: "LEADPAGE_DOMAIN_SUGGEST_LIMIT_PER_WINDOW", category: "Domain Automation" },
  { key: "LEADPAGE_DOMAIN_CHECK_WINDOW_SECONDS", category: "Domain Automation" },
  { key: "LEADPAGE_DOMAIN_CHECK_LIMIT_PER_WINDOW", category: "Domain Automation" },
  { key: "LEADPAGE_DOMAIN_REGISTER_WINDOW_SECONDS", category: "Domain Automation" },
  { key: "LEADPAGE_DOMAIN_REGISTER_LIMIT_PER_WINDOW", category: "Domain Automation" },
  { key: "NETLIFY_API_TOKEN", category: "Netlify", secret: true },
  { key: "NETLIFY_SITE_ID", category: "Netlify" },
  { key: "NETLIFY_MONTHLY_CREDIT_LIMIT", category: "Netlify" },
  { key: "NETLIFY_ESTIMATED_CREDITS_PER_PUBLISH", category: "Netlify" },
  { key: "NETLIFY_CREDIT_WARNING_REMAINING", category: "Netlify" },
  { key: "AFFILIATE_ENABLED", category: "Affiliates" },
  { key: "AFFILIATE_LINK_BASE_URL", category: "Affiliates" },
  { key: "AFFILIATE_DEFAULT_HOLD_DAYS", category: "Affiliates" },
  { key: "AFFILIATE_MIN_PAYOUT_NGN_MINOR", category: "Affiliates" },
  { key: "AFFILIATE_MIN_PAYOUT_USD_MINOR", category: "Affiliates" },
  { key: "AFFILIATE_COUNTRY_CURRENCY_MAP_JSON", category: "Affiliates" },
  { key: "META_PIXEL_ID", category: "Marketing" },
  { key: "META_PIXEL_ACCESS_TOKEN", category: "Marketing", secret: true },
  { key: "META_MARKETING_ACCESS_TOKEN", category: "Meta Ads", secret: true },
  { key: "META_AD_ACCOUNT_ID", category: "Meta Ads" },
  { key: "META_GRAPH_API_VERSION", category: "Meta Ads" },
  { key: "META_ADS_MAX_DAILY_BUDGET_NGN_MINOR", category: "Meta Ads" },
  { key: "HOLIDAY_WAITLIST_WHATSAPP_WORKFLOW", category: "WhatsApp" },
  { key: "N8N_HOLIDAY_WAITLIST_WEBHOOK_URL", category: "WhatsApp" },
  { key: "N8N_HOLIDAY_WAITLIST_WEBHOOK_SECRET", category: "WhatsApp", secret: true },
  { key: "N8N_TRANSACTIONAL_WHATSAPP_WEBHOOK_URL", category: "WhatsApp" },
  { key: "N8N_TRANSACTIONAL_WHATSAPP_WEBHOOK_TOKEN", category: "WhatsApp", secret: true },
]

const KNOWN_KEYS = new Set(ADMIN_SETTING_DEFINITIONS.map((item) => item.key))

function clean(value: unknown, max = 5000) {
  return String(value || "").trim().slice(0, max)
}

export async function ensureAdminSettingsTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_admin_settings (
      id BIGINT NOT NULL AUTO_INCREMENT,
      setting_key VARCHAR(120) NOT NULL,
      setting_value LONGTEXT NULL,
      updated_by VARCHAR(80) NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_admin_setting_key (setting_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_admin_settings_audit (
      id BIGINT NOT NULL AUTO_INCREMENT,
      setting_key VARCHAR(120) NOT NULL,
      action_type VARCHAR(20) NOT NULL,
      old_is_set TINYINT(1) NOT NULL DEFAULT 0,
      new_is_set TINYINT(1) NOT NULL DEFAULT 0,
      updated_by VARCHAR(80) NULL,
      created_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      KEY idx_setting_audit_key_created (setting_key, created_at),
      KEY idx_setting_audit_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

export async function listAdminSettings() {
  await ensureAdminSettingsTables()
  const rows = await prisma.$queryRaw<Array<{ settingKey: string; settingValue: string | null; updatedBy: string | null; updatedAt: Date | null }>>`
    SELECT setting_key AS settingKey, setting_value AS settingValue, updated_by AS updatedBy, updated_at AS updatedAt
    FROM tochukwu_admin_settings
  `
  const rowMap = new Map(rows.map((row) => [row.settingKey, row]))
  return ADMIN_SETTING_DEFINITIONS.map((definition) => {
    const row = rowMap.get(definition.key)
    const overrideValue = clean(row?.settingValue)
    const envValue = clean(process.env[definition.key])
    const value = overrideValue || envValue
    return {
      ...definition,
      value: definition.secret ? "" : value,
      isSet: Boolean(value),
      source: overrideValue ? "override" : envValue ? "env" : "empty",
      updatedBy: row?.updatedBy || null,
      updatedAt: row?.updatedAt || null
    }
  })
}

export async function listAdminSettingsAudit(limit = 80) {
  await ensureAdminSettingsTables()
  return prisma.$queryRaw<Array<{ settingKey: string; actionType: string; oldIsSet: number; newIsSet: number; updatedBy: string | null; createdAt: Date }>>`
    SELECT setting_key AS settingKey, action_type AS actionType, old_is_set AS oldIsSet, new_is_set AS newIsSet, updated_by AS updatedBy, created_at AS createdAt
    FROM tochukwu_admin_settings_audit
    ORDER BY created_at DESC, id DESC
    LIMIT ${Math.max(1, Math.min(limit, 300))}
  `
}

export async function upsertAdminSettings(entries: Array<{ key: string; value: string }>, updatedBy: string) {
  await ensureAdminSettingsTables()
  const existingRows = await prisma.$queryRaw<Array<{ settingKey: string; settingValue: string | null }>>`
    SELECT setting_key AS settingKey, setting_value AS settingValue
    FROM tochukwu_admin_settings
  `
  const existing = new Map(existingRows.map((row) => [row.settingKey, clean(row.settingValue)]))
  const now = new Date()

  for (const entry of entries.slice(0, 500)) {
    const key = clean(entry.key, 120)
    if (!key || !KNOWN_KEYS.has(key)) continue
    const value = clean(entry.value, 5000)
    const oldValue = existing.get(key) || ""
    if (!value) {
      await prisma.$executeRaw`DELETE FROM tochukwu_admin_settings WHERE setting_key = ${key}`
      if (oldValue) {
        await prisma.$executeRaw`
          INSERT INTO tochukwu_admin_settings_audit (setting_key, action_type, old_is_set, new_is_set, updated_by, created_at)
          VALUES (${key}, 'deleted', 1, 0, ${updatedBy}, ${now})
        `
      }
      delete process.env[key]
      continue
    }

    await prisma.$executeRaw`
      INSERT INTO tochukwu_admin_settings (setting_key, setting_value, updated_by, created_at, updated_at)
      VALUES (${key}, ${value}, ${updatedBy}, ${now}, ${now})
      ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by), updated_at = VALUES(updated_at)
    `
    if (oldValue !== value) {
      await prisma.$executeRaw`
        INSERT INTO tochukwu_admin_settings_audit (setting_key, action_type, old_is_set, new_is_set, updated_by, created_at)
        VALUES (${key}, ${oldValue ? "updated" : "created"}, ${oldValue ? 1 : 0}, 1, ${updatedBy}, ${now})
      `
    }
    process.env[key] = value
  }
}

export async function applyAdminSettingsToProcessEnv() {
  await ensureAdminSettingsTables()
  const rows = await prisma.$queryRaw<Array<{ settingKey: string; settingValue: string | null }>>`
    SELECT setting_key AS settingKey, setting_value AS settingValue
    FROM tochukwu_admin_settings
  `
  for (const row of rows) {
    if (KNOWN_KEYS.has(row.settingKey) && row.settingValue) {
      process.env[row.settingKey] = row.settingValue
    }
  }
}

export async function getAdminSettingValue(key: string) {
  const safeKey = clean(key, 120)
  if (!safeKey || !KNOWN_KEYS.has(safeKey)) return ""
  try {
    await ensureAdminSettingsTables()
    const rows = await prisma.$queryRaw<Array<{ settingValue: string | null }>>`
      SELECT setting_value AS settingValue
      FROM tochukwu_admin_settings
      WHERE setting_key = ${safeKey}
      LIMIT 1
    `
    const overrideValue = clean(rows[0]?.settingValue)
    return overrideValue || clean(process.env[safeKey])
  } catch {
    return clean(process.env[safeKey])
  }
}
