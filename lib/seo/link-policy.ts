export type LinkApprovalDecision = "once" | "global"

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
