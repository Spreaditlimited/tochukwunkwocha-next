import crypto from "crypto"

function signingSecret() {
  return String(process.env.AUTH_SECRET || "dev-only-change-this-secret")
}

function signPayload(payload: string) {
  return crypto.createHmac("sha256", signingSecret()).update(payload).digest("base64url")
}

function timingSafeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

export function createResourceDownloadToken(input: { slug: string; email: string; expiresInSeconds?: number }) {
  const payload = Buffer.from(
    JSON.stringify({
      slug: input.slug,
      email: input.email,
      exp: Math.floor(Date.now() / 1000) + (input.expiresInSeconds || 60 * 60 * 24)
    }),
    "utf8"
  ).toString("base64url")

  return `${payload}.${signPayload(payload)}`
}

export function verifyResourceDownloadToken(token: string, slug: string) {
  const [payload, signature] = String(token || "").split(".")
  if (!payload || !signature || !timingSafeEqual(signature, signPayload(payload))) return null

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
    if (String(parsed.slug || "") !== slug) return null
    if (Number(parsed.exp || 0) < Math.floor(Date.now() / 1000)) return null
    return { email: String(parsed.email || ""), slug: String(parsed.slug || "") }
  } catch {
    return null
  }
}
