export const PRODUCTION_SITE_URL = "https://tochukwunkwocha.com"

function isLocalHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "")
  return normalized === "localhost"
    || normalized.endsWith(".localhost")
    || normalized === "127.0.0.1"
    || normalized.startsWith("127.")
    || normalized === "0.0.0.0"
    || normalized === "::1"
    || normalized.endsWith(".local")
}

/**
 * Resolves links that leave the application (email, WhatsApp, webhooks, etc.).
 * Local and malformed environment URLs must never be exposed to recipients.
 */
export function publicSiteUrl() {
  const configured = String(process.env.SITE_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim()
  if (!configured) return PRODUCTION_SITE_URL

  try {
    const url = new URL(configured)
    if (!/^https?:$/.test(url.protocol) || isLocalHostname(url.hostname) || url.username || url.password) {
      return PRODUCTION_SITE_URL
    }
    url.protocol = "https:"
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`
  } catch {
    return PRODUCTION_SITE_URL
  }
}

export function publicAbsoluteUrl(path: string) {
  const normalizedPath = String(path || "").trim()
  return `${publicSiteUrl()}${normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`}`
}
