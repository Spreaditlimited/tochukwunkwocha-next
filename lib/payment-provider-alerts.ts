import crypto from "crypto"

import { sendEmail } from "@/lib/email"
import { prisma } from "@/lib/prisma"

type PaymentProvider = "stripe" | "paystack"

type ProviderIssue = {
  provider: PaymentProvider
  operation: string
  summary: string
  reference?: string | null
  status?: number | null
  requestId?: string | null
  errorType?: string | null
  errorCode?: string | null
  errorMessage?: string | null
}

const SUPPORT_EMAIL = "support@tochukwunkwocha.com"
const ALERT_THROTTLE_MS = 10 * 60 * 1000
const recentAlerts = new Map<string, number>()

function clean(value: unknown, max = 1000) {
  return String(value || "").trim().slice(0, max)
}

async function claimPersistentAlert(throttleKey: string) {
  const bucket = Math.floor(Date.now() / ALERT_THROTTLE_MS)
  const hash = crypto.createHash("sha256").update(`${bucket}:${throttleKey}`).digest("hex")
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS tochukwu_payment_provider_alert_claims (
        throttle_hash CHAR(64) NOT NULL,
        created_at DATETIME NOT NULL,
        PRIMARY KEY (throttle_hash),
        KEY idx_payment_provider_alert_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    const inserted = await prisma.$executeRaw`
      INSERT IGNORE INTO tochukwu_payment_provider_alert_claims (throttle_hash, created_at)
      VALUES (${hash}, UTC_TIMESTAMP())
    `
    return { claimed: Number(inserted || 0) === 1, hash, persistent: true }
  } catch {
    const lastSentAt = recentAlerts.get(throttleKey) || 0
    if (Date.now() - lastSentAt < ALERT_THROTTLE_MS) return { claimed: false, hash, persistent: false }
    recentAlerts.set(throttleKey, Date.now())
    return { claimed: true, hash, persistent: false }
  }
}

export async function reportPaymentProviderIssue(issue: ProviderIssue) {
  const details = {
    provider: issue.provider,
    operation: clean(issue.operation, 100),
    summary: clean(issue.summary, 300),
    reference: clean(issue.reference, 190) || null,
    status: Number.isFinite(Number(issue.status)) ? Number(issue.status) : null,
    requestId: clean(issue.requestId, 190) || null,
    errorType: clean(issue.errorType, 120) || null,
    errorCode: clean(issue.errorCode, 120) || null,
    errorMessage: clean(issue.errorMessage, 1500) || null,
    environment: clean(process.env.VERCEL_ENV || process.env.NODE_ENV, 40) || "unknown",
    occurredAt: new Date().toISOString()
  }
  console.error(`[payment-provider] ${issue.provider} ${details.operation} failed.`, details)

  const throttleKey = [issue.provider, details.operation, details.status, details.errorType, details.errorCode, details.errorMessage].join(":")
  const claim = await claimPersistentAlert(throttleKey)
  if (!claim.claimed) return { sent: false, throttled: true }

  try {
    const delivery = await sendEmail({
      to: SUPPORT_EMAIL,
      subject: `[Payment provider alert] ${issue.provider === "stripe" ? "Stripe" : "Paystack"} ${details.operation} failed`,
      text: [
        "A payment provider issue was detected.",
        `Provider: ${issue.provider}`,
        `Operation: ${details.operation}`,
        `Summary: ${details.summary}`,
        `Environment: ${details.environment}`,
        `Time: ${details.occurredAt}`,
        `Reference: ${details.reference || "Not available"}`,
        `HTTP status: ${details.status ?? "Not available"}`,
        `Provider request ID: ${details.requestId || "Not available"}`,
        `Error type: ${details.errorType || "Not available"}`,
        `Error code: ${details.errorCode || "Not available"}`,
        `Provider message: ${details.errorMessage || "Not available"}`,
        "No API keys or payment credentials are included in this alert."
      ].join("\n")
    })
    if (!delivery.ok) {
      recentAlerts.delete(throttleKey)
      if (claim.persistent) {
        await prisma.$executeRaw`DELETE FROM tochukwu_payment_provider_alert_claims WHERE throttle_hash = ${claim.hash}`.catch(() => 0)
      }
    }
    return { sent: delivery.ok, throttled: false }
  } catch (error) {
    recentAlerts.delete(throttleKey)
    if (claim.persistent) {
      await prisma.$executeRaw`DELETE FROM tochukwu_payment_provider_alert_claims WHERE throttle_hash = ${claim.hash}`.catch(() => 0)
    }
    console.error("[payment-provider] Could not send provider alert email.", {
      provider: issue.provider,
      operation: details.operation,
      error: error instanceof Error ? error.message : String(error)
    })
    return { sent: false, throttled: false }
  }
}
