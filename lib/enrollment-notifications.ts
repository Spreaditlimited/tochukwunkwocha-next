import { applyAdminSettingsToProcessEnv } from "@/lib/admin-settings"
import { sendEmail } from "@/lib/email"
import { normalizeDeliverableEmail } from "@/lib/email-address"
import { prisma } from "@/lib/prisma"
import { publicActionLinkVariants, publicSiteUrl } from "@/lib/public-site-url"

function clean(value: unknown, max = 1000) {
  return String(value || "").trim().slice(0, max)
}

function siteBaseUrl() {
  return publicSiteUrl()
}

function learningCourseName(value: unknown) {
  const slug = clean(value, 120).toLowerCase()
  const names: Record<string, string> = {
    "prompt-to-profit": "Prompt to Profit",
    "prompt-to-profit-holiday": "Prompt to Profit Holiday",
    "prompt-to-production": "Prompt to Profit Advanced",
    "ai-for-everyday-business-owners": "AI for Everyday Business Owners"
  }
  return names[slug] || clean(value, 120)
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
  const email = normalizeDeliverableEmail(input.email, 190)
  const listId = Number(input.listId || await resolveEnrollmentBrevoListId(input) || 0) || 0
  if (!apiKey) return { ok: true, skipped: true, reason: "missing_api_key" }
  if (!email) return { ok: true, skipped: true, reason: "invalid_email" }
  if (!listId) return { ok: true, skipped: true, reason: "missing_list_id" }

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
    }),
    signal: AbortSignal.timeout(8_000)
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
  const email = normalizeDeliverableEmail(input.email, 190)
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

  const removed = oldListId && oldListId !== newListId
    ? await removeEnrollmentFromBrevoList({ email: input.email, listId: oldListId })
    : { ok: true, skipped: true }

  const added = await syncEnrollmentToBrevo({
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    courseSlug: input.courseSlug,
    batchKey: input.newBatchKey,
    batchLabel: input.newBatchLabel,
    source: input.source,
    listId: newListId
  })
  return {
    ok: Boolean((removed.ok || removed.skipped) && added.ok),
    error: removed.ok || removed.skipped ? added.error : removed.error,
    removed,
    added
  }
}

export async function reconcileFamilyOwnerBrevoLists(input: {
  familyId: bigint | number
  fullName?: string | null
  email: string
  phone?: string | null
  courseSlug: string
  previousListIds?: Array<number | string | null | undefined>
  source: string
}) {
  const email = normalizeDeliverableEmail(input.email, 190)
  const courseSlug = clean(input.courseSlug, 120).toLowerCase()
  let familyId: bigint
  try {
    familyId = BigInt(input.familyId)
  } catch (_error) {
    return { ok: false, error: "Invalid family enrollment ID", added: [], removed: [] }
  }
  if (familyId <= BigInt(0) || !email || !courseSlug) {
    return { ok: false, error: "Family Brevo reconciliation details are incomplete", added: [], removed: [] }
  }

  const rows = await prisma.$queryRaw<Array<{
    batchKey: string
    batchLabel: string | null
    brevoListId: string | null
  }>>`
    SELECT desired.batch_key AS batchKey, COALESCE(MAX(desired.batch_label), desired.batch_key) AS batchLabel,
           b.brevo_list_id AS brevoListId
    FROM (
      SELECT e.course_slug, e.batch_key, e.batch_label
      FROM family_child_enrollments e
      JOIN family_children c ON c.id = e.child_id AND c.family_id = e.family_id AND c.status = 'active'
      WHERE e.family_id = ${familyId}
        AND e.course_slug = ${courseSlug}
        AND e.status = 'active'
      UNION ALL
      SELECT balances.course_slug, balances.batch_key, balances.batch_label
      FROM family_seat_balances balances
      WHERE balances.family_id = ${familyId}
        AND balances.course_slug = ${courseSlug}
        AND balances.seats_purchased > balances.seats_consumed
    ) desired
    JOIN course_batches b ON b.course_slug = desired.course_slug AND b.batch_key = desired.batch_key
    WHERE 1 = 1
      AND COALESCE(TRIM(b.brevo_list_id), '') <> ''
    GROUP BY desired.batch_key, b.brevo_list_id
    ORDER BY desired.batch_key ASC
  `

  const desiredLists = new Map<number, { batchKeys: string[]; batchLabels: string[] }>()
  for (const row of rows) {
    const listId = Number(row.brevoListId || 0) || 0
    if (!listId) continue
    const existing = desiredLists.get(listId) || { batchKeys: [], batchLabels: [] }
    const batchKey = clean(row.batchKey, 64)
    const batchLabel = clean(row.batchLabel || row.batchKey, 120)
    if (batchKey && !existing.batchKeys.includes(batchKey)) existing.batchKeys.push(batchKey)
    if (batchLabel && !existing.batchLabels.includes(batchLabel)) existing.batchLabels.push(batchLabel)
    desiredLists.set(listId, existing)
  }

  const added = []
  for (const [listId, batches] of desiredLists) {
    const result = await syncEnrollmentToBrevo({
      fullName: input.fullName,
      email,
      phone: input.phone,
      courseSlug,
      batchKey: batches.batchKeys.join(", "),
      batchLabel: batches.batchLabels.join(", "),
      source: input.source,
      listId
    })
    added.push({ listId, result })
  }

  const previousListIds = Array.from(new Set(
    (input.previousListIds || []).map((value) => Number(value || 0) || 0).filter(Boolean)
  ))
  const removed = []
  for (const listId of previousListIds) {
    if (desiredLists.has(listId)) continue
    const result = await removeEnrollmentFromBrevoList({ email, listId })
    removed.push({ listId, result })
  }

  const failed = [...added, ...removed].find((entry) => entry.result?.ok === false)
  return {
    ok: !failed,
    error: failed?.result?.error,
    desiredListIds: Array.from(desiredLists.keys()),
    added,
    removed
  }
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
  const email = normalizeDeliverableEmail(input.email, 190)
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
  temporaryPassword?: string | null
  resetToken?: string | null
}) {
  const email = normalizeDeliverableEmail(input.email, 190)
  if (!email) return { ok: false, skipped: true }
  const course = learningCourseName(input.courseSlug)
  const dashboardLinks = publicActionLinkVariants("/dashboard")
  const loginLinks = publicActionLinkVariants("/dashboard/login")
  const setupLinks = input.resetToken
    ? publicActionLinkVariants(`/dashboard/reset-password?token=${encodeURIComponent(input.resetToken)}`)
    : dashboardLinks
  const subject = "Your Tochukwu Tech learning account is ready"
  return sendEmail({
    to: email,
    subject,
    text: [
      `Hello ${clean(input.fullName, 120) || "there"},`,
      "",
      `Your enrollment${course ? ` for ${course}` : ""} is confirmed and your learning account is ready.`,
      input.temporaryPassword ? `Sign-in email: ${email}` : "",
      input.temporaryPassword ? `Temporary password: ${input.temporaryPassword}` : "",
      input.temporaryPassword ? `Primary sign-in link: ${loginLinks.primary}` : input.resetToken ? `Primary password setup link: ${setupLinks.primary}` : `Primary dashboard link: ${dashboardLinks.primary}`,
      input.temporaryPassword ? `Alternative sign-in link (if the primary website does not open): ${loginLinks.alternative}` : input.resetToken ? `Alternative password setup link (if the primary website does not open): ${setupLinks.alternative}` : `Alternative dashboard link (if the primary website does not open): ${dashboardLinks.alternative}`,
      input.temporaryPassword ? "This temporary password has no time limit. It stops working immediately after your first successful use, when you will create your private password." : "",
      input.temporaryPassword ? "Keep these details private." : "",
      "",
      "Tochukwu Tech and AI Academy"
    ].filter(Boolean).join("\n"),
    html: `
      <p>Hello ${clean(input.fullName, 120) || "there"},</p>
      <p>Your enrollment${course ? ` for <strong>${course}</strong>` : ""} is confirmed and your learning account is ready.</p>
      ${input.temporaryPassword ? `
        <div style="margin:20px 0;padding:16px;border:1px solid #dbe7f3;border-radius:10px;background:#f8fbff;">
          <p style="margin:0 0 8px;"><strong>Sign-in email:</strong> ${email}</p>
          <p style="margin:0;"><strong>Temporary password:</strong> <span style="font-family:monospace;font-size:16px;">${input.temporaryPassword}</span></p>
        </div>
        <p><strong>Primary sign-in link:</strong><br/><a href="${loginLinks.primary}">Sign in to your learning dashboard</a></p>
        <p><strong>Alternative sign-in link:</strong> Use this if the primary website does not open.<br/><a href="${loginLinks.alternative}">Sign in through the alternative website</a></p>
        <p>This temporary password has no time limit. It stops working immediately after your first successful use, when you will create your private password.</p>
        <p>Keep these details private.</p>
      ` : `<p><strong>Primary link:</strong><br/><a href="${setupLinks.primary}">${input.resetToken ? "Set your password and open your dashboard" : "Open your dashboard"}</a></p><p><strong>Alternative link:</strong> Use this if the primary website does not open.<br/><a href="${setupLinks.alternative}">${input.resetToken ? "Set your password through the alternative website" : "Open the alternative website"}</a></p>`}
      <p>Tochukwu Tech and AI Academy</p>
    `
  })
}

export async function sendStudentPendingManualPaymentEmail(input: {
  email: string
  fullName?: string | null
  courseSlug?: string | null
  temporaryPassword?: string | null
  resetToken?: string | null
  dashboardPath?: string | null
}) {
  const email = normalizeDeliverableEmail(input.email, 190)
  if (!email) return { ok: false, skipped: true }
  const course = learningCourseName(input.courseSlug)
  const dashboardPath = clean(input.dashboardPath || "/dashboard/courses?manual_payment=pending", 180)
  const normalizedDashboardPath = dashboardPath.startsWith("/") ? dashboardPath : "/dashboard/courses?manual_payment=pending"
  const dashboardLinks = publicActionLinkVariants(normalizedDashboardPath)
  const loginLinks = publicActionLinkVariants("/dashboard/login")
  const setupLinks = input.resetToken
    ? publicActionLinkVariants(`/dashboard/reset-password?token=${encodeURIComponent(input.resetToken)}`)
    : dashboardLinks
  const subject = "Your manual payment is awaiting verification"
  return sendEmail({
    to: email,
    subject,
    text: [
      `Hello ${clean(input.fullName, 120) || "there"},`,
      "",
      `Your manual payment${course ? ` for ${course}` : ""} has been submitted and is awaiting verification.`,
      "Your student account has been created so you can track the enrollment status from your dashboard.",
      input.temporaryPassword ? `Sign-in email: ${email}` : "",
      input.temporaryPassword ? `Temporary password: ${input.temporaryPassword}` : "",
      input.temporaryPassword ? `Primary sign-in link: ${loginLinks.primary}` : input.resetToken ? `Primary password setup link: ${setupLinks.primary}` : `Primary dashboard link: ${dashboardLinks.primary}`,
      input.temporaryPassword ? `Alternative sign-in link (if the primary website does not open): ${loginLinks.alternative}` : input.resetToken ? `Alternative password setup link (if the primary website does not open): ${setupLinks.alternative}` : `Alternative dashboard link (if the primary website does not open): ${dashboardLinks.alternative}`,
      input.temporaryPassword ? "This temporary password has no time limit. It stops working immediately after your first successful use, when you will create your private password." : "",
      "",
      "Course access will open after your payment has been approved.",
      "",
      "Tochukwu Tech and AI Academy"
    ].filter(Boolean).join("\n"),
    html: `
      <p>Hello ${clean(input.fullName, 120) || "there"},</p>
      <p>Your manual payment${course ? ` for <strong>${course}</strong>` : ""} has been submitted and is awaiting verification.</p>
      <p>Your student account has been created so you can track the enrollment status from your dashboard.</p>
      ${input.temporaryPassword ? `
        <div style="margin:20px 0;padding:16px;border:1px solid #dbe7f3;border-radius:10px;background:#f8fbff;">
          <p style="margin:0 0 8px;"><strong>Sign-in email:</strong> ${email}</p>
          <p style="margin:0;"><strong>Temporary password:</strong> <span style="font-family:monospace;font-size:16px;">${input.temporaryPassword}</span></p>
        </div>
        <p><strong>Primary sign-in link:</strong><br/><a href="${loginLinks.primary}">Sign in to your learning dashboard</a></p>
        <p><strong>Alternative sign-in link:</strong> Use this if the primary website does not open.<br/><a href="${loginLinks.alternative}">Sign in through the alternative website</a></p>
        <p>This temporary password has no time limit. It stops working immediately after your first successful use, when you will create your private password.</p>
      ` : `<p><strong>Primary link:</strong><br/><a href="${setupLinks.primary}">${input.resetToken ? "Set your password and open your dashboard" : "Open your dashboard"}</a></p><p><strong>Alternative link:</strong> Use this if the primary website does not open.<br/><a href="${setupLinks.alternative}">${input.resetToken ? "Set your password through the alternative website" : "Open the alternative website"}</a></p>`}
      <p>Course access will open after your payment has been approved.</p>
      <p>Tochukwu Tech and AI Academy</p>
    `
  })
}

export async function sendInstallmentStartedEmail(input: {
  email: string
  fullName?: string | null
  courseSlug?: string | null
}) {
  const email = normalizeDeliverableEmail(input.email, 190)
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

export async function sendAbandonedEnrollmentReminderEmail(input: {
  email: string
  fullName?: string | null
  courseSlug?: string | null
  batchLabel?: string | null
  checkoutUrl: string
  stopUrl: string
  reminderNumber: number
}) {
  const email = normalizeDeliverableEmail(input.email, 190)
  if (!email) return { ok: false, skipped: true }
  const name = clean(input.fullName, 120) || "there"
  const course = learningCourseName(input.courseSlug) || "your selected course"
  const batch = clean(input.batchLabel, 120)
  const selection = batch ? `${course} — ${batch}` : course
  const checkoutUrl = clean(input.checkoutUrl, 1000)
  const stopUrl = clean(input.stopUrl, 1000)
  const initial = input.reminderNumber <= 1
  const subject = initial
    ? `Need help completing your ${course} enrollment?`
    : `A gentle reminder about your ${course} enrollment`
  const opening = initial
    ? `It looks like you started enrolling for ${selection}, but we have not yet confirmed your payment.`
    : `This is a gentle reminder that your enrollment for ${selection} has not yet been completed.`

  await sendEmail({
    to: email,
    subject,
    text: [
      `Hello ${name},`,
      "",
      opening,
      "",
      "If you experienced an error or had difficulty completing the payment, you can continue securely here:",
      checkoutUrl,
      "",
      "If your account was charged already, please do not attempt another payment. Reply to this email with your payment reference and we will check it for you.",
      "",
      "We will automatically stop these reminders once your payment is confirmed or enrollment closes.",
      "",
      `Stop payment reminders: ${stopUrl}`,
      "",
      "Warm regards,",
      "Tochukwu Tech and AI Academy"
    ].join("\n"),
    html: `
      <p>Hello ${name},</p>
      <p>${opening}</p>
      <p>If you experienced an error or had difficulty completing the payment, you can continue securely using the button below.</p>
      <p style="margin:24px 0;"><a href="${checkoutUrl}" style="display:inline-block;border-radius:10px;background:#0d4f9a;color:#ffffff;padding:12px 20px;font-weight:800;text-decoration:none;">Complete My Enrollment</a></p>
      <p>If your account was charged already, <strong>please do not attempt another payment</strong>. Reply to this email with your payment reference and we will check it for you.</p>
      <p>We will automatically stop these reminders once your payment is confirmed or enrollment closes.</p>
      <p style="margin-top:24px;font-size:12px;color:#64748b;"><a href="${stopUrl}" style="color:#64748b;">Stop payment reminders</a></p>
      <p>Warm regards,<br/>Tochukwu Tech and AI Academy</p>
    `
  })
  return { ok: true }
}
