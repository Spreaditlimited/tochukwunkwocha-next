type EmailInput = {
  to: string
  subject: string
  html?: string
  text?: string
}

function clean(value: unknown, max = 1000) {
  return String(value || "").trim().slice(0, max)
}

function sender() {
  const email = clean(process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER, 190)
  const name = clean(process.env.SMTP_FROM_NAME || "Tochukwu Tech and AI Academy", 120)
  return email ? { email, name } : null
}

export async function sendEmail(input: EmailInput) {
  const to = clean(input.to, 190)
  const subject = clean(input.subject, 255)
  const htmlContent = clean(input.html, 200000)
  const textContent = clean(input.text, 200000)
  if (!to || !subject || (!htmlContent && !textContent)) {
    throw new Error("to, subject, and email body are required")
  }

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
