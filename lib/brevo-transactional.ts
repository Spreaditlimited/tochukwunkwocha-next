import { applyAdminSettingsToProcessEnv } from "@/lib/admin-settings"

function clean(value: unknown, max = 1000) {
  return String(value || "").trim().slice(0, max)
}

function escapeHtml(value: unknown) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function sender() {
  const email = clean(process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER, 190)
  const name = clean(process.env.SMTP_FROM_NAME || "Tochukwu Tech and AI Academy", 120)
  if (!email) throw new Error("Missing sender email for Brevo transactional email.")
  return { email, name }
}

export function brandedBrevoEmail(input: { subject: string; html: string }) {
  const subject = escapeHtml(input.subject)
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;background:#f4f8fc;color:#06162d;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f8fc;padding:32px 14px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #dbe7f3;border-radius:18px;overflow:hidden;box-shadow:0 18px 50px rgba(6,22,45,0.08);">
            <tr>
              <td style="background:#06162d;padding:24px 28px;">
                <div style="font-size:12px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:#75c8e8;">Tochukwu Tech and AI Academy</div>
                <div style="margin-top:6px;font-size:22px;line-height:1.25;font-weight:800;color:#ffffff;">${subject}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 28px;font-size:15px;line-height:1.7;color:#26364d;">
                ${input.html}
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #e5edf6;padding:18px 28px;background:#f8fbff;">
                <div style="font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:#0d4f9a;">Learn. Build. Transform.</div>
                <div style="margin-top:6px;font-size:12px;line-height:1.5;color:#64748b;">You are receiving this email because you are enrolled in a Tochukwu Tech and AI Academy programme.</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export async function sendBrevoTransactionalEmail(input: {
  to: string
  name?: string | null
  subject: string
  html: string
  text?: string
}) {
  await applyAdminSettingsToProcessEnv().catch(() => null)
  const apiKey = clean(process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY, 1000)
  if (!apiKey) throw new Error("Missing Brevo API key.")
  const to = clean(input.to, 190).toLowerCase()
  const subject = clean(input.subject, 255)
  if (!to || !subject || !input.html) throw new Error("Recipient, subject, and HTML body are required.")

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json"
    },
    body: JSON.stringify({
      sender: sender(),
      to: [{ email: to, name: clean(input.name, 160) || undefined }],
      subject,
      htmlContent: brandedBrevoEmail({ subject, html: input.html }),
      textContent: clean(input.text, 200000) || undefined
    })
  })

  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.message || `Brevo transactional email failed (${response.status})`)
  return { ok: true, messageId: clean(body?.messageId, 500) || null }
}
