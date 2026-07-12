const VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify"

export function recaptchaLocalBypassEnabled() {
  const explicit = String(process.env.RECAPTCHA_DISABLE_LOCAL || "").trim().toLowerCase()
  if (explicit === "1" || explicit === "true" || explicit === "yes") return true
  const base = String(process.env.SITE_BASE_URL || "").trim().toLowerCase()
  return base.includes("localhost") || base.includes("127.0.0.1") || base.includes("[::1]")
}

function requestLooksLocal(request?: Request) {
  if (!request) return false
  const host = String(request.headers.get("host") || request.headers.get("x-forwarded-host") || "").toLowerCase()
  const origin = String(request.headers.get("origin") || request.headers.get("referer") || "").toLowerCase()
  const raw = `${host} ${origin}`
  return raw.includes("localhost") || raw.includes("127.0.0.1") || raw.includes("[::1]")
}

export function recaptchaEnabled() {
  if (recaptchaLocalBypassEnabled()) return false
  return Boolean(String(process.env.RECAPTCHA_SITE_KEY || "").trim() && String(process.env.RECAPTCHA_SECRET_KEY || "").trim())
}

function minScore() {
  const raw = Number(process.env.RECAPTCHA_MIN_SCORE || 0.5)
  if (!Number.isFinite(raw)) return 0.5
  return Math.min(0.99, Math.max(0.1, raw))
}

export function clientIpFromRequest(request: Request) {
  const forwarded = String(request.headers.get("x-forwarded-for") || "").trim()
  if (forwarded) return forwarded.split(",")[0].trim()
  return String(request.headers.get("x-nf-client-connection-ip") || request.headers.get("client-ip") || "").trim()
}

export async function verifyRecaptchaToken(input: {
  token: unknown
  expectedAction?: string
  remoteip?: string
  request?: Request
}) {
  const token = String(input.token || "").trim()
  const expectedAction = String(input.expectedAction || "").trim()
  if (recaptchaLocalBypassEnabled() || requestLooksLocal(input.request)) {
    return { ok: true, skipped: true, reason: "local_development" }
  }
  if (!recaptchaEnabled()) {
    return { ok: true, skipped: true, reason: "recaptcha_not_configured" }
  }
  if (!token) return { ok: false, reason: "missing_token", score: 0 }

  const params = new URLSearchParams()
  params.set("secret", String(process.env.RECAPTCHA_SECRET_KEY || "").trim())
  params.set("response", token)
  if (input.remoteip) params.set("remoteip", input.remoteip)

  let result: Record<string, unknown> | null = null
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      signal: controller.signal
    })
    clearTimeout(timeout)
    result = await response.json().catch(() => null)
  } catch {
    return { ok: false, reason: "verify_unreachable", score: 0 }
  }

  const success = Boolean(result?.success)
  const action = String(result?.action || "").trim()
  const score = Number(result?.score)
  const numericScore = Number.isFinite(score) ? score : 0
  if (!success) return { ok: false, reason: "verify_failed", action, score: numericScore }
  if (expectedAction && action !== expectedAction) return { ok: false, reason: "action_mismatch", action, score: numericScore }
  if (numericScore < minScore()) return { ok: false, reason: "score_too_low", action, score: numericScore }
  return { ok: true, action, score: numericScore }
}
