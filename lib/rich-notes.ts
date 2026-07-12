const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
  "h3",
  "h4",
  "pre",
  "code"
])

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function decodeHtmlEntities(value: string) {
  let output = value
  for (let index = 0; index < 4; index += 1) {
    const next = output
      .replace(/&#(\d+);/g, (_match, code) => {
        const charCode = Number(code)
        return Number.isFinite(charCode) ? String.fromCharCode(charCode) : ""
      })
      .replace(/&#x([0-9a-f]+);/gi, (_match, code) => {
        const charCode = Number.parseInt(code, 16)
        return Number.isFinite(charCode) ? String.fromCharCode(charCode) : ""
      })
      .replace(/&quot;/g, "\"")
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
    if (next === output) break
    output = next
  }
  return output
}

function sanitizeHref(value: string) {
  const raw = decodeHtmlEntities(value).trim()
  if (!raw) return ""
  if (/^(https?:|mailto:|tel:)/i.test(raw)) return raw
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw
  return ""
}

function normalizeRichNoteInput(value: unknown, max: number) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim()
    .slice(0, max)
}

export function sanitizeRichNotes(value: unknown, max = 65000) {
  const input = normalizeRichNoteInput(value, max)
  if (!input) return ""
  let output = ""
  let lastIndex = 0
  const tagPattern = /<\/?([a-zA-Z0-9]+)([^>]*)>/g
  let match: RegExpExecArray | null

  while ((match = tagPattern.exec(input))) {
    output += escapeHtml(decodeHtmlEntities(input.slice(lastIndex, match.index)))
    const fullTag = match[0]
    const tagName = match[1].toLowerCase()
    const attrs = match[2] || ""
    const isClosing = fullTag.startsWith("</")

    if (ALLOWED_TAGS.has(tagName)) {
      if (isClosing) {
        if (tagName !== "br") output += `</${tagName}>`
      } else if (tagName === "a") {
        const hrefMatch = attrs.match(/\shref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i)
        const href = sanitizeHref(hrefMatch?.[2] || hrefMatch?.[3] || hrefMatch?.[4] || "")
        output += href
          ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">`
          : "<a>"
      } else if (tagName === "br") {
        output += "<br>"
      } else {
        output += `<${tagName}>`
      }
    }
    lastIndex = tagPattern.lastIndex
  }

  output += escapeHtml(decodeHtmlEntities(input.slice(lastIndex)))
  return output
}

export function plainTextToRichNotes(value: unknown) {
  const raw = String(value || "").trim()
  if (!raw) return ""
  if (/<[a-z][\s\S]*>/i.test(raw)) return sanitizeRichNotes(raw)
  return decodeHtmlEntities(raw)
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("")
}
