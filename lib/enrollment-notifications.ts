import { applyAdminSettingsToProcessEnv } from "@/lib/admin-settings"
import { sendEmail } from "@/lib/email"
import { prisma } from "@/lib/prisma"

function clean(value: unknown, max = 1000) {
  return String(value || "").trim().slice(0, max)
}

function normalizeEmail(value: unknown) {
  return clean(value, 190).toLowerCase()
}

function siteBaseUrl() {
  return clean(process.env.SITE_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000", 500).replace(/\/$/, "")
}

export async function resolveEnrollmentBrevoListId(input: {
  courseSlug?: string | null
  batchKey?: string | null
  fallbackListId?: number | string | null
}) {
  const fallback = Number(input.fallbackListId || 0) || 0
  const courseSlug = clean(input.courseSlug, 120)
  const batchKey = clean(input.batchKey, 64)
  if (!courseSlug || !batchKey) return fallback
  const rows = await prisma.$queryRaw<Array<{ brevoListId: string | null }>>`
    SELECT brevo_list_id AS brevoListId
    FROM course_batches
    WHERE course_slug = ${courseSlug}
      AND batch_key = ${batchKey}
    LIMIT 1
  `.catch(() => [])
  return Number(rows[0]?.brevoListId || fallback || 0) || 0
}

export async function syncEnrollmentToBrevo(input: {
  fullName?: string | null
  email: string
  phone?: string | null
  courseSlug?: string | null
  batchKey?: string | null
  batchLabel?: string | null
  source: string
  listId?: number | string | null
}) {
  await applyAdminSettingsToProcessEnv().catch(() => null)
  const apiKey = clean(process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY, 1000)
  const email = normalizeEmail(input.email)
  const listId = Number(input.listId || await resolveEnrollmentBrevoListId(input) || 0) || 0
  if (!apiKey || !email || !listId) return { ok: true, skipped: true }

  const response = await fetch("https://api.brevo.com/v3/contacts", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json"
    },
    body: JSON.stringify({
      email,
      attributes: {
        FIRSTNAME: clean(input.fullName, 120),
        PHONE: clean(input.phone, 80),
        COURSE_SLUG: clean(input.courseSlug, 120),
        BATCH_KEY: clean(input.batchKey, 64),
        BATCH_LABEL: clean(input.batchLabel, 120),
        ENROLLMENT_SOURCE: clean(input.source, 100),
        LAST_ENROLLED_AT: new Date().toISOString()
      },
      listIds: [listId],
      updateEnabled: true
    })
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    return { ok: false, error: body || `Brevo enrollment sync failed (${response.status})` }
  }
  return { ok: true }
}

export async function sendStudentAccountReadyEmail(input: {
  email: string
  fullName?: string | null
  courseSlug?: string | null
  resetToken?: string | null
}) {
  const email = normalizeEmail(input.email)
  if (!email) return { ok: false, skipped: true }
  const dashboardUrl = `${siteBaseUrl()}/dashboard`
  const setupUrl = input.resetToken
    ? `${siteBaseUrl()}/dashboard/reset-password?token=${encodeURIComponent(input.resetToken)}`
    : dashboardUrl
  const subject = "Your Tochukwu Tech learning account is ready"
  await sendEmail({
    to: email,
    subject,
    text: [
      `Hello ${clean(input.fullName, 120) || "there"},`,
      "",
      `Your enrollment${input.courseSlug ? ` for ${clean(input.courseSlug, 120)}` : ""} is confirmed and your learning account is ready.`,
      input.resetToken ? `Set your password here: ${setupUrl}` : `Open your dashboard here: ${dashboardUrl}`,
      "",
      "Tochukwu Tech and AI Academy"
    ].join("\n"),
    html: `
      <p>Hello ${clean(input.fullName, 120) || "there"},</p>
      <p>Your enrollment${input.courseSlug ? ` for <strong>${clean(input.courseSlug, 120)}</strong>` : ""} is confirmed and your learning account is ready.</p>
      <p><a href="${setupUrl}">${input.resetToken ? "Set your password and open your dashboard" : "Open your dashboard"}</a></p>
      <p>Tochukwu Tech and AI Academy</p>
    `
  })
  return { ok: true }
}

export async function sendInstallmentStartedEmail(input: {
  email: string
  fullName?: string | null
  courseSlug?: string | null
}) {
  const email = normalizeEmail(input.email)
  if (!email) return { ok: false, skipped: true }
  await sendEmail({
    to: email,
    subject: "Your installment plan has started",
    text: [
      `Hello ${clean(input.fullName, 120) || "there"},`,
      "",
      `Your installment plan${input.courseSlug ? ` for ${clean(input.courseSlug, 120)}` : ""} has been created.`,
      `You can manage your plan from your dashboard: ${siteBaseUrl()}/dashboard/installments`,
      "",
      "Tochukwu Tech and AI Academy"
    ].join("\n"),
    html: `
      <p>Hello ${clean(input.fullName, 120) || "there"},</p>
      <p>Your installment plan${input.courseSlug ? ` for <strong>${clean(input.courseSlug, 120)}</strong>` : ""} has been created.</p>
      <p><a href="${siteBaseUrl()}/dashboard/installments">Open your installment dashboard</a></p>
      <p>Tochukwu Tech and AI Academy</p>
    `
  })
  return { ok: true }
}
