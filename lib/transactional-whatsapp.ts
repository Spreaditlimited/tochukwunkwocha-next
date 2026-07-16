import { getAdminSettingValue } from "@/lib/admin-settings"

type TransactionalWhatsAppPayload = {
  event: "manual_payment_submitted" | "enrollment_confirmed" | "live_class_reminder"
  phone: string
  templateName: string
  languageCode: string
  parameters: string[]
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
  const base = clean(process.env.SITE_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://tochukwunkwocha.com", 500).replace(/\/$/, "")
  return `${base}${path.startsWith("/") ? path : `/${path}`}`
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

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${webhookToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      ...payload,
      phone,
      parameters: payload.parameters.map((item) => clean(item, 500))
    })
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(body || `Transactional WhatsApp webhook failed (${response.status})`)
  }

  return { ok: true }
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
    languageCode: "en",
    parameters: [
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
  dashboardPath?: string | null
}) {
  // Keep this in sync with the approved Meta WhatsApp template name.
  return sendTransactionalWhatsApp({
    event: "enrollment_confirmed",
    phone: clean(input.phone, 80),
    templateName: "tochukwu_enrollment_confirmed",
    languageCode: "en_GB",
    parameters: [
      firstName(input.fullName),
      transactionalCourseName(input.courseSlug),
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
}) {
  return sendTransactionalWhatsApp({
    event: "live_class_reminder",
    phone: clean(input.phone, 80),
    templateName: "tochukwu_live_class_reminder",
    languageCode: "en",
    parameters: [
      firstName(input.fullName),
      clean(input.sessionTitle, 160) || "live class",
      transactionalCourseName(input.courseSlug),
      dashboardUrl("/dashboard/courses")
    ],
    metadata: {
      courseSlug: clean(input.courseSlug, 120),
      sessionTitle: clean(input.sessionTitle, 160)
    }
  })
}
