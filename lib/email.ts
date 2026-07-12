type EmailInput = {
  to: string
  subject: string
  html?: string
  text?: string
}

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
  return email ? { email, name } : null
}

function textToHtml(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br/>")}</p>`)
    .join("")
}

function brandedEmailTemplate(input: { subject: string; html: string }) {
  const subject = escapeHtml(input.subject)
  const html = input.html
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
                <div class="email-content">${html}</div>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #e5edf6;padding:18px 28px;background:#f8fbff;">
                <div style="font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:#0d4f9a;">Learn. Build. Transform.</div>
                <div style="margin-top:6px;font-size:12px;line-height:1.5;color:#64748b;">You are receiving this email because you interacted with Tochukwu Tech and AI Academy.</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function shouldDecorateHtml(html: string) {
  const content = html.trim().toLowerCase()
  if (!content) return false
  return !(content.includes("<html") || content.includes("<!doctype"))
}

export async function sendEmail(input: EmailInput) {
  const to = clean(input.to, 190)
  const subject = clean(input.subject, 255)
  const rawHtmlContent = clean(input.html, 200000)
  const textContent = clean(input.text, 200000)
  if (!to || !subject || (!rawHtmlContent && !textContent)) {
    throw new Error("to, subject, and email body are required")
  }
  const htmlContent = rawHtmlContent
    ? shouldDecorateHtml(rawHtmlContent)
      ? brandedEmailTemplate({ subject, html: rawHtmlContent })
      : rawHtmlContent
    : brandedEmailTemplate({ subject, html: textToHtml(textContent) })

  const brevoKey = clean(process.env.BREVO_API_KEY, 1000)
  const from = sender()
  if (brevoKey && from) {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoKey,
        "content-type": "application/json",
        accept: "application/json"
      },
      body: JSON.stringify({
        sender: from,
        to: [{ email: to }],
        subject,
        htmlContent: htmlContent || undefined,
        textContent: textContent || undefined
      })
    })
    if (!response.ok) {
      const body = await response.text().catch(() => "")
      throw new Error(body || `Email send failed (${response.status})`)
    }
    return { ok: true }
  }

  console.warn("student_email_not_sent_provider_missing", { to, subject })
  return { ok: false, skipped: true }
}
