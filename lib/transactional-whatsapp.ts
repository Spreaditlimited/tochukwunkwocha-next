import { getAdminSettingValue } from "@/lib/admin-settings"
import { publicAbsoluteUrl } from "@/lib/public-site-url"
import { formatDateTimeWAT } from "@/lib/utils"

type TransactionalWhatsAppPayload = {
  event: "manual_payment_submitted" | "enrollment_confirmed" | "live_class_reminder" | "enrollment_payment_reminder"
  phone: string
  templateName: string
  templateLanguage: string
  templateVariables: string[]
  metadata?: Record<string, string>
}

function clean(value: unknown, max = 1000) {
  return String(value || "").trim().slice(0, max)
}

function firstName(value: unknown) {
  return clean(value, 120).split(/\s+/).filter(Boolean)[0] || "there"
}

function normalizePhone(value: unknown) {
  const raw = clean(value, 80).replace(/[^\d+]/g, "")
  if (!raw) return ""
  if (raw.startsWith("+")) return raw
  if (raw.startsWith("0")) return `+234${raw.slice(1)}`
  return `+${raw}`
}

function dashboardUrl(path = "/dashboard/courses") {
  return publicAbsoluteUrl(path)
}

function containsLocalUrl(value: unknown) {
  return /(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|\.local(?:\/|:|$))/i.test(String(value || ""))
}

export function transactionalCourseName(slug: unknown) {
  const courseSlug = clean(slug, 120).toLowerCase()
  const names: Record<string, string> = {
    "prompt-to-profit": "Prompt to Profit",
    "prompt-to-profit-holiday": "Prompt to Profit Holiday",
    "prompt-to-production": "Prompt to Profit Advanced",
    "ai-for-everyday-business-owners": "AI for Everyday Business Owners",
    "prompt-to-profit-schools": "Prompt to Profit for Schools"
  }
  return names[courseSlug] || courseSlug.split("-").filter(Boolean).map((part) => `${part[0]?.toUpperCase() || ""}${part.slice(1)}`).join(" ") || "your course"
}

async function sendTransactionalWhatsApp(payload: TransactionalWhatsAppPayload) {
  const phone = normalizePhone(payload.phone)
  if (!phone) return { ok: true, skipped: true, reason: "missing_phone" }

  const webhookUrl = clean(await getAdminSettingValue("N8N_TRANSACTIONAL_WHATSAPP_WEBHOOK_URL"), 1200)
  const webhookToken = clean(await getAdminSettingValue("N8N_TRANSACTIONAL_WHATSAPP_WEBHOOK_TOKEN"), 1000)
  if (!webhookUrl || !webhookToken) return { ok: true, skipped: true, reason: "missing_webhook_settings" }

  if (containsLocalUrl(JSON.stringify({ templateVariables: payload.templateVariables, metadata: payload.metadata || {} }))) {
    throw new Error("Transactional WhatsApp message contains a local URL and was blocked.")
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${webhookToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      ...payload,
      phone,
      templateName: clean(payload.templateName, 120),
      templateLanguage: clean(payload.templateLanguage, 20) || "en",
      templateVariables: payload.templateVariables.map((item) => clean(item, 500))
    }),
    signal: AbortSignal.timeout(8_000)
  })

  const responseText = await response.text().catch(() => "")
  if (!response.ok) {
    throw new Error(responseText || `Transactional WhatsApp webhook failed (${response.status})`)
  }
  const responseBody = (() => {
    try {
      return responseText ? JSON.parse(responseText) as Record<string, unknown> : null
    } catch {
      return null
    }
  })()
  const messages = Array.isArray(responseBody?.messages) ? responseBody.messages : []
  const firstMessage = messages[0] && typeof messages[0] === "object" ? messages[0] as Record<string, unknown> : null
  const messageId = clean(responseBody?.messageId || responseBody?.message_id || firstMessage?.id, 500)
  return { ok: true, messageId: messageId || null }
}

export function sendManualPaymentSubmittedWhatsApp(input: {
  phone?: string | null
  fullName?: string | null
  courseSlug?: string | null
  dashboardPath?: string | null
}) {
  return sendTransactionalWhatsApp({
    event: "manual_payment_submitted",
    phone: clean(input.phone, 80),
    templateName: "tochukwu_manual_payment_received",
    templateLanguage: "en",
    templateVariables: [
      firstName(input.fullName),
      transactionalCourseName(input.courseSlug),
      dashboardUrl(input.dashboardPath || "/dashboard/courses?manual_payment=pending")
    ],
    metadata: {
      courseSlug: clean(input.courseSlug, 120)
    }
  })
}

export function sendEnrollmentConfirmedWhatsApp(input: {
  phone?: string | null
  fullName?: string | null
  courseSlug?: string | null
  batchLabel?: string | null
  batchStartAt?: Date | string | null
  dashboardPath?: string | null
}) {
  const course = transactionalCourseName(input.courseSlug)
  const batch = clean(input.batchLabel, 120)
  const startsAt = formatDateTimeWAT(input.batchStartAt)
  const enrollment = [course, batch, startsAt ? `starts ${startsAt}` : ""].filter(Boolean).join(" — ")
  // Keep this in sync with the approved Meta WhatsApp template name.
  return sendTransactionalWhatsApp({
    event: "enrollment_confirmed",
    phone: clean(input.phone, 80),
    templateName: "tochukwu_enrollment_confirmed",
    templateLanguage: "en_GB",
    templateVariables: [
      firstName(input.fullName),
      enrollment,
      dashboardUrl(input.dashboardPath || "/dashboard/courses")
    ],
    metadata: {
      courseSlug: clean(input.courseSlug, 120)
    }
  })
}

export function sendLiveClassReminderWhatsApp(input: {
  phone?: string | null
  fullName?: string | null
  courseSlug?: string | null
  sessionTitle?: string | null
  stage: "day_before" | "access_open" | "early_access"
  sessionTime: string
  accessTime: string
}) {
  const dayBefore = input.stage === "day_before"
  return sendTransactionalWhatsApp({
    event: "live_class_reminder",
    phone: clean(input.phone, 80),
    // Keep these names and variable orders aligned with the corresponding Meta templates.
    templateName: dayBefore ? "tochukwu_live_class_day_before" : "tochukwu_live_class_reminder",
    templateLanguage: dayBefore ? "en_GB" : "en",
    templateVariables: dayBefore
      ? [
          firstName(input.fullName),
          clean(input.sessionTitle, 160) || "live class",
          transactionalCourseName(input.courseSlug),
          clean(input.sessionTime, 80),
          clean(input.accessTime, 80),
          dashboardUrl("/dashboard/courses")
        ]
      : [
          firstName(input.fullName),
          clean(input.sessionTitle, 160) || "live class",
          transactionalCourseName(input.courseSlug),
          dashboardUrl("/dashboard/courses")
        ],
    metadata: {
      courseSlug: clean(input.courseSlug, 120),
      sessionTitle: clean(input.sessionTitle, 160),
      reminderStage: input.stage,
      sessionTime: clean(input.sessionTime, 80),
      accessTime: clean(input.accessTime, 80)
    }
  })
}

export function sendEnrollmentPaymentReminderWhatsApp(input: {
  phone?: string | null
  fullName?: string | null
  courseSlug?: string | null
  batchLabel?: string | null
  checkoutUrl: string
  stopUrl: string
}) {
  return sendTransactionalWhatsApp({
    event: "enrollment_payment_reminder",
    phone: clean(input.phone, 80),
    templateName: "tochukwu_enrollment_payment_reminder",
    templateLanguage: "en_GB",
    templateVariables: [
      firstName(input.fullName),
      transactionalCourseName(input.courseSlug),
      clean(input.batchLabel, 120) || "your selected intake",
      clean(input.checkoutUrl, 500),
      clean(input.stopUrl, 500)
    ],
    metadata: {
      courseSlug: clean(input.courseSlug, 120),
      batchLabel: clean(input.batchLabel, 120)
    }
  })
}
