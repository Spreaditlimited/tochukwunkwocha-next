export const PRODUCTION_SITE_URL = "https://tochukwunkwocha.com"
export const VERCEL_FALLBACK_SITE_URL = "https://tochukwunkwocha-next.vercel.app"

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

/**
 * Produces equivalent links on both public production hosts. Use this for
 * emailed account actions so a recipient can use the Vercel hostname when
 * their network cannot reach the custom domain.
 */
export function publicActionLinkVariants(path: string) {
  const rawPath = String(path || "").trim()
  const normalizedPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`
  const parsed = new URL(normalizedPath, PRODUCTION_SITE_URL)
  const route = `${parsed.pathname}${parsed.search}${parsed.hash}`
  return {
    primary: `${PRODUCTION_SITE_URL}${route}`,
    alternative: `${VERCEL_FALLBACK_SITE_URL}${route}`
  }
}
