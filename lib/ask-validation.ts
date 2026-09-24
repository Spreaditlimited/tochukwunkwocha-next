export const ASK_MAX_LENGTH = 1500
export const ASK_STATUSES = ["pending", "draft", "published", "archived"] as const
export type AskStatus = typeof ASK_STATUSES[number]
export const ASK_QUESTION_STATUSES = ["pending", "draft", "unlisted", "published", "archived"] as const
export function isQuestionPublished(status: string) {
  return status === "published" || status === "unlisted"
}
export function askQuestionStatus(value: unknown) {
  if (value === "unlisted") return value
  return askStatus(value)
}
export function questionStatusLabel(status: string) {
  if (status === "unlisted") return "Published — hidden from public"
  if (status === "published") return "Published — visible on /ask"
  return `${status[0].toUpperCase()}${status.slice(1)} — private`
}

export class AskInputError extends Error {}

export function askText(value: unknown) {
  if (typeof value !== "string") throw new AskInputError("Please enter your question or answer.")
  const text = value.replace(/\r\n?/g, "\n").trim()
  if (text.length < 5 || text.length > ASK_MAX_LENGTH) {
    throw new AskInputError(`Please use between 5 and ${ASK_MAX_LENGTH} characters.`)
  }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) {
    throw new AskInputError("Please remove unsupported characters.")
  }
  return text
}

export function askId(value: unknown) {
  if (typeof value !== "string" || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value)) {
    throw new AskInputError("This question or answer could not be found.")
  }
  return value
}

export function askStatus(value: unknown): AskStatus {
  if (!ASK_STATUSES.includes(value as AskStatus)) throw new AskInputError("Choose a valid publication status.")
  return value as AskStatus
}

export function askFacebookUrl(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  if (typeof value !== "string" || value.length > 1000) throw new AskInputError("Enter a valid Facebook post link.")
  const raw = value.trim()
  if (!raw) return null
  let url: URL
  try { url = new URL(raw) } catch { throw new AskInputError("Enter the full Facebook post URL, beginning with https://.") }
  const hosts = ["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com", "mbasic.facebook.com", "fb.watch"]
  if (url.protocol !== "https:" || !hosts.includes(url.hostname) || url.username || url.password || url.port || url.pathname === "/") {
    throw new AskInputError("Use a direct HTTPS link to a Facebook post or video.")
  }
  if (/^\/(?:l\.php|sharer(?:\.php)?|dialog|login|logout|recover|plugins)(?:\/|$)/i.test(url.pathname)) {
    throw new AskInputError("Use the post link, rather than a Facebook redirect or sharing link.")
  }
  return url.toString()
}

export function askPage(value: unknown) {
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? Math.min(number, 10000) : 1
}

export function askAnswerPath(id: string) {
  return `/ask/${askId(id)}/answer`
}
