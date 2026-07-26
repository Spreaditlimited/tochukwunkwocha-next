import crypto from "crypto"

function secret() {
  return String(process.env.AUTH_SECRET || "dev-only-change-this-secret")
}

function signature(payload: string) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url")
}

function equal(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export function createShopDownloadToken(input: {
  entitlementUuid: string
  email: string
  expiresInSeconds?: number
}) {
  const payload = Buffer.from(
    JSON.stringify({
      entitlementUuid: input.entitlementUuid,
      email: input.email.trim().toLowerCase(),
      exp: Math.floor(Date.now() / 1000) + (input.expiresInSeconds || 60 * 60 * 24 * 7)
    }),
    "utf8"
  ).toString("base64url")
  return `${payload}.${signature(payload)}`
}

export function verifyShopDownloadToken(token: string, entitlementUuid: string) {
  const [payload, providedSignature] = String(token || "").split(".")
  if (!payload || !providedSignature || !equal(providedSignature, signature(payload))) return null
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
    if (String(parsed.entitlementUuid || "") !== entitlementUuid) return null
    if (Number(parsed.exp || 0) < Math.floor(Date.now() / 1000)) return null
    const email = String(parsed.email || "").trim().toLowerCase()
    return email ? { entitlementUuid, email } : null
  } catch {
    return null
  }
}
