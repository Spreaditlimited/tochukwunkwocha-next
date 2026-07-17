import { sendEmail } from "@/lib/email"

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
  const lastSentAt = recentAlerts.get(throttleKey) || 0
  if (Date.now() - lastSentAt < ALERT_THROTTLE_MS) return { sent: false, throttled: true }
  recentAlerts.set(throttleKey, Date.now())

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
    if (!delivery.ok) recentAlerts.delete(throttleKey)
    return { sent: delivery.ok, throttled: false }
  } catch (error) {
    recentAlerts.delete(throttleKey)
    console.error("[payment-provider] Could not send provider alert email.", {
      provider: issue.provider,
      operation: details.operation,
      error: error instanceof Error ? error.message : String(error)
    })
    return { sent: false, throttled: false }
  }
}
