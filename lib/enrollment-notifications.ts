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

export async function removeEnrollmentFromBrevoList(input: {
  email: string
  listId?: number | string | null
}) {
  await applyAdminSettingsToProcessEnv().catch(() => null)
  const apiKey = clean(process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY, 1000)
  const email = normalizeEmail(input.email)
  const listId = Number(input.listId || 0) || 0
  if (!apiKey || !email || !listId) return { ok: true, skipped: true }

  const response = await fetch(`https://api.brevo.com/v3/contacts/lists/${encodeURIComponent(String(listId))}/contacts/remove`, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json"
    },
    body: JSON.stringify({ emails: [email] })
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    return { ok: false, error: body || `Brevo list removal failed (${response.status})` }
  }
  return { ok: true }
}

export async function moveEnrollmentBrevoList(input: {
  fullName?: string | null
  email: string
  phone?: string | null
  courseSlug?: string | null
  oldBatchKey?: string | null
  oldBatchLabel?: string | null
  oldListId?: number | string | null
  newBatchKey?: string | null
  newBatchLabel?: string | null
  newListId?: number | string | null
  source: string
}) {
  const oldListId = Number(input.oldListId || 0) || 0
  const newListId = Number(input.newListId || 0) || 0

  if (oldListId && newListId && oldListId !== newListId) {
    await removeEnrollmentFromBrevoList({ email: input.email, listId: oldListId })
  }

  return syncEnrollmentToBrevo({
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    courseSlug: input.courseSlug,
    batchKey: input.newBatchKey,
    batchLabel: input.newBatchLabel,
    source: input.source,
    listId: newListId
  })
}

export async function sendBatchSwitchConfirmationEmail(input: {
  email: string
  fullName?: string | null
  courseName?: string | null
  oldBatchLabel?: string | null
  oldBatchStartText?: string | null
  newBatchLabel?: string | null
  newBatchStartText?: string | null
}) {
  const email = normalizeEmail(input.email)
  if (!email) return { ok: false, skipped: true }
  const name = clean(input.fullName, 120) || "there"
  const course = clean(input.courseName, 160) || "your course"
  const oldBatch = clean(input.oldBatchLabel, 120) || "your previous batch"
  const newBatch = clean(input.newBatchLabel, 120) || "your new batch"
  const oldDate = clean(input.oldBatchStartText, 120)
  const newDate = clean(input.newBatchStartText, 120)
  const dashboardUrl = `${siteBaseUrl()}/dashboard/courses`

  await sendEmail({
    to: email,
    subject: "Your course batch has been changed",
    text: [
      `Hello ${name},`,
      "",
      `Your batch for ${course} has been changed successfully.`,
      "",
      `Previous batch: ${oldBatch}${oldDate ? ` (${oldDate})` : ""}`,
      `New batch: ${newBatch}${newDate ? ` (${newDate})` : ""}`,
      "",
      `You can open your learning dashboard here: ${dashboardUrl}`,
      "",
      "Tochukwu Tech and AI Academy"
    ].join("\n"),
    html: `
      <p>Hello ${name},</p>
      <p>Your batch for <strong>${course}</strong> has been changed successfully.</p>
      <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;margin:20px 0;border:1px solid #dbe7f3;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:12px 14px;background:#f8fbff;border-bottom:1px solid #dbe7f3;font-size:13px;color:#64748b;">Previous batch</td>
          <td style="padding:12px 14px;border-bottom:1px solid #dbe7f3;font-weight:700;color:#06162d;">${oldBatch}${oldDate ? ` <span style="font-weight:400;color:#64748b;">(${oldDate})</span>` : ""}</td>
        </tr>
        <tr>
          <td style="padding:12px 14px;background:#f8fbff;font-size:13px;color:#64748b;">New batch</td>
          <td style="padding:12px 14px;font-weight:700;color:#06162d;">${newBatch}${newDate ? ` <span style="font-weight:400;color:#64748b;">(${newDate})</span>` : ""}</td>
        </tr>
      </table>
      <p><a href="${dashboardUrl}">Open your learning dashboard</a></p>
      <p>Tochukwu Tech and AI Academy</p>
    `
  })
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

export async function sendStudentPendingManualPaymentEmail(input: {
  email: string
  fullName?: string | null
  courseSlug?: string | null
  resetToken?: string | null
}) {
  const email = normalizeEmail(input.email)
  if (!email) return { ok: false, skipped: true }
  const dashboardUrl = `${siteBaseUrl()}/dashboard/courses?manual_payment=pending`
  const setupUrl = input.resetToken
    ? `${siteBaseUrl()}/dashboard/reset-password?token=${encodeURIComponent(input.resetToken)}`
    : dashboardUrl
  const subject = "Your manual payment is awaiting verification"
  await sendEmail({
    to: email,
    subject,
    text: [
      `Hello ${clean(input.fullName, 120) || "there"},`,
      "",
      `Your manual payment${input.courseSlug ? ` for ${clean(input.courseSlug, 120)}` : ""} has been submitted and is awaiting verification.`,
      "Your student account has been created so you can track the enrollment status from your dashboard.",
      input.resetToken ? `Set your password here: ${setupUrl}` : `Open your dashboard here: ${dashboardUrl}`,
      "",
      "Course access will open after your payment has been approved.",
      "",
      "Tochukwu Tech and AI Academy"
    ].join("\n"),
    html: `
      <p>Hello ${clean(input.fullName, 120) || "there"},</p>
      <p>Your manual payment${input.courseSlug ? ` for <strong>${clean(input.courseSlug, 120)}</strong>` : ""} has been submitted and is awaiting verification.</p>
      <p>Your student account has been created so you can track the enrollment status from your dashboard.</p>
      <p><a href="${setupUrl}">${input.resetToken ? "Set your password and open your dashboard" : "Open your dashboard"}</a></p>
      <p>Course access will open after your payment has been approved.</p>
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
