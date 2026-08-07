import fs from "node:fs"
import { PrismaClient } from "@prisma/client"

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (!match || process.env[match[1]]) continue
      let value = match[2] || ""
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
      process.env[match[1]] = value
    }
  }
}

function clean(value, max = 1000) {
  return String(value || "").trim().slice(0, max)
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function safeZoomUrl(value) {
  const url = new URL(clean(value, 1200))
  const hostname = url.hostname.toLowerCase()
  if (url.protocol !== "https:" || (hostname !== "zoom.us" && !hostname.endsWith(".zoom.us"))) {
    throw new Error("Stored join link is not a valid HTTPS Zoom URL.")
  }
  return url.toString()
}

function brandedEmail(subject, content) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head><body style="margin:0;background:#f4f8fc;color:#06162d;font-family:Arial,Helvetica,sans-serif;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f8fc;padding:32px 14px;"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff;border:1px solid #dbe7f3;border-radius:18px;overflow:hidden;"><tr><td style="background:#06162d;padding:24px 28px;"><div style="font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#75c8e8;">Tochukwu Tech and AI Academy</div><div style="margin-top:6px;font-size:22px;line-height:1.25;font-weight:800;color:#fff;">${escapeHtml(subject)}</div></td></tr><tr><td style="padding:30px 28px;font-size:15px;line-height:1.7;color:#26364d;">${content}</td></tr><tr><td style="border-top:1px solid #e5edf6;padding:18px 28px;background:#f8fbff;"><div style="font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#0d4f9a;">Learn. Build. Transform.</div><div style="margin-top:6px;font-size:12px;line-height:1.5;color:#64748b;">You are receiving this email because you are enrolled in a Tochukwu Tech and AI Academy programme.</div></td></tr></table></td></tr></table></body></html>`
}

loadEnv()
const sessionUuid = clean(process.argv[2], 64)
if (!sessionUuid.startsWith("live_")) throw new Error("A live-session UUID is required.")

const prisma = new PrismaClient()
try {
  const settings = await prisma.$queryRawUnsafe(
    "SELECT setting_key AS settingKey, setting_value AS settingValue FROM tochukwu_admin_settings WHERE setting_key IN ('BREVO_API_KEY','SENDINBLUE_API_KEY','SMTP_FROM_EMAIL','SMTP_USER','SMTP_FROM_NAME')"
  )
  for (const row of settings) if (row.settingValue) process.env[row.settingKey] = row.settingValue

  const sessions = await prisma.$queryRawUnsafe(
    "SELECT session_uuid AS sessionUuid, session_title AS sessionTitle, zoom_join_url AS zoomJoinUrl FROM tochukwu_course_batch_live_sessions WHERE session_uuid = ? LIMIT 1",
    sessionUuid
  )
  const session = sessions[0]
  if (!session) throw new Error("Live session not found.")
  const zoomUrl = safeZoomUrl(session.zoomJoinUrl)
  const dashboardUrl = "https://tochukwunkwocha.com/dashboard/courses"
  const subject = "Prompt to Profit Holiday: Day 5 live class access is open"
  const content = `<p>Hello,</p><p>Your <strong>${escapeHtml(session.sessionTitle)}</strong> for <strong>Prompt to Profit Holiday</strong> is starting now.</p><p>Join the class directly using the Zoom button below.</p><p><a href="${escapeHtml(zoomUrl)}" style="display:inline-block;background:#0a54dc;color:#fff;text-decoration:none;font-weight:800;padding:12px 18px;border-radius:10px;">Join the live class on Zoom</a></p><p>If needed, you can also access the class from your student dashboard.</p><p><a href="${dashboardUrl}" style="display:inline-block;background:#0d4f9a;color:#fff;text-decoration:none;font-weight:800;padding:12px 18px;border-radius:10px;">Open student dashboard</a></p><p>Tochukwu Tech and AI Academy</p>`
  const text = `Hello,\n\nYour ${session.sessionTitle} for Prompt to Profit Holiday is starting now.\n\nJoin Zoom: ${zoomUrl}\n\nStudent dashboard: ${dashboardUrl}\n\nTochukwu Tech and AI Academy`
  const renderedHtml = brandedEmail(subject, content)
  if (/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|\.local(?:\/|:|$))/i.test(`${renderedHtml}\n${text}`)) {
    throw new Error("Email contains a local URL and was blocked.")
  }

  const apiKey = clean(process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY, 1000)
  const senderEmail = clean(process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER, 190)
  const senderName = clean(process.env.SMTP_FROM_NAME || "Tochukwu Tech and AI Academy", 120)
  if (!apiKey || !senderEmail) throw new Error("Brevo sender configuration is incomplete.")

  const recipients = await prisma.$queryRawUnsafe(
    "SELECT recipient_key AS recipientKey, destination FROM tochukwu_course_live_session_reminder_deliveries WHERE session_uuid = ? AND reminder_stage = 'access_open' AND channel = 'email' AND status IN ('failed','failed_permanent') ORDER BY id",
    sessionUuid
  )
  let sent = 0
  const errors = []

  async function sendOne(recipient) {
    const email = clean(recipient.destination || recipient.recipientKey, 190).toLowerCase()
    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          sender: { email: senderEmail, name: senderName },
          to: [{ email }],
          subject,
          htmlContent: renderedHtml,
          textContent: text,
          tags: ["live-class-reminder", "access-open-resend"]
        }),
        signal: AbortSignal.timeout(12_000)
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.message || `Brevo failed (${response.status})`)
      await prisma.$executeRawUnsafe(
        "UPDATE tochukwu_course_live_session_reminder_deliveries SET status='sent', provider_message_id=?, last_error=NULL, sent_at=NOW(), updated_at=NOW() WHERE session_uuid=? AND reminder_stage='access_open' AND recipient_key=? AND channel='email'",
        clean(body?.messageId, 500) || null,
        sessionUuid,
        recipient.recipientKey
      )
      sent += 1
    } catch (error) {
      const message = clean(error instanceof Error ? error.message : error, 500)
      errors.push({ email, message })
      await prisma.$executeRawUnsafe(
        "UPDATE tochukwu_course_live_session_reminder_deliveries SET status='failed', last_error=?, last_attempt_at=NOW(), updated_at=NOW() WHERE session_uuid=? AND reminder_stage='access_open' AND recipient_key=? AND channel='email'",
        message,
        sessionUuid,
        recipient.recipientKey
      )
    }
  }

  for (let index = 0; index < recipients.length; index += 5) {
    await Promise.all(recipients.slice(index, index + 5).map(sendOne))
  }

  if (!errors.length) {
    await prisma.$executeRawUnsafe(
      "UPDATE tochukwu_course_live_session_reminder_log SET sent_count=?, last_error=NULL, sent_at=NOW() WHERE session_uuid=? AND reminder_stage='access_open'",
      sent,
      sessionUuid
    )
  }
  console.log(JSON.stringify({ selected: recipients.length, sent, failed: errors.length, errors: errors.slice(0, 10) }, null, 2))
  if (errors.length) process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
