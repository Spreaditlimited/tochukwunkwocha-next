export type LinkApprovalDecision = "once" | "global" | "rejected" | "amended"

function escapeAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

const siteHosts = new Set(["tochukwunkwocha.com", "www.tochukwunkwocha.com"])

function withoutTrailingSlash(value: string) {
  return value.length > 1 ? value.replace(/\/+$/, "") : value
}

export function normalizeLinkableUrl(value: unknown): string | null {
  const raw = typeof value === "string" ? value.trim() : ""
  if (!raw || raw.startsWith("#") || /^(?:mailto|tel|javascript|data):/i.test(raw)) return null
  try {
    const parsed = new URL(raw, "https://www.tochukwunkwocha.com/")
    if (!/^https?:$/.test(parsed.protocol)) return null
    const path = withoutTrailingSlash(parsed.pathname || "/")
    if (siteHosts.has(parsed.hostname.toLowerCase())) return path
    if (parsed.hostname.toLowerCase().endsWith(".tochukwunkwocha.com")) {
      return `${parsed.protocol}//${parsed.host}${path === "/" ? "/" : path}`
    }
    return null
  } catch {
    return null
  }
}

export function extractLinkableUrls(html: string | null | undefined) {
  const urls = new Set<string>()
  for (const match of String(html || "").matchAll(/\shref\s*=\s*(["'])(.*?)\1/gi)) {
    const normalized = normalizeLinkableUrl(match[2])
    if (normalized) urls.add(normalized)
  }
  return [...urls]
}

export function findNewUnapprovedLinks(input: {
  originalHtml: string | null | undefined
  rewrittenHtml: string
  approvedUrls: Iterable<string>
  decisions?: Record<string, LinkApprovalDecision>
}) {
  const original = new Set(extractLinkableUrls(input.originalHtml))
  const approved = new Set([...input.approvedUrls].map(normalizeLinkableUrl).filter((url): url is string => Boolean(url)))
  const discovered = extractLinkableUrls(input.rewrittenHtml).filter((url) => !original.has(url))
  const pending = discovered.filter((url) => !approved.has(url) && !input.decisions?.[url])
  return { discovered, pending }
}

export function reviseInternalLinkInHtml(input: { html: string; originalUrl: string; replacementUrl?: string | null }) {
  const originalUrl = normalizeLinkableUrl(input.originalUrl)
  const replacementUrl = input.replacementUrl == null ? null : normalizeLinkableUrl(input.replacementUrl)
  if (!originalUrl) throw new Error("The original internal link is invalid.")
  if (input.replacementUrl != null && !replacementUrl) throw new Error("The replacement internal link is invalid.")

  let changed = false
  const html = String(input.html || "").replace(/<a\b([^>]*?)\bhref\s*=\s*(["'])(.*?)\2([^>]*)>([\s\S]*?)<\/a>/gi, (anchor, before, quote, href, after, label) => {
    if (normalizeLinkableUrl(href) !== originalUrl) return anchor
    changed = true
    if (!replacementUrl) return label
    return `<a${before}href=${quote}${escapeAttribute(replacementUrl)}${quote}${after}>${label}</a>`
  })
  if (!changed) throw new Error("The selected internal link was not found in the saved rewrite.")
  return html
}
