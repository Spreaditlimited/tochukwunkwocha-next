// Shared by the dashboard, its API, and the Worker. Never expose this record publicly.
export const VAULT_SUBSCRIBERS_KEY = "_vault/subscribers.json"
export const VAULT_SUBSCRIBERS_MAX_BYTES = 2 * 1024 * 1024
export const VAULT_SUBSCRIBERS_MAX_COUNT = 10000
export type VaultSubscribers = { version: 1; emails: string[]; updatedAt: string; updatedBy: string; sourceName: string }

export function normalizeSubscriberEmail(value: unknown): string | null {
  if (typeof value !== "string") return null
  const email = value.trim().toLowerCase()
  return email.length <= 254 && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(email) ? email : null
}

export function parseSubscriberCsv(csv: string) {
  if (typeof csv !== "string" || new TextEncoder().encode(csv).length > VAULT_SUBSCRIBERS_MAX_BYTES) throw new Error("Choose a CSV smaller than 2 MB.")
  const text = csv.replace(/^\uFEFF/, "")
  const rows: string[][] = []
  let row: string[] = [], field = "", quoted = false, closed = false
  const pushField = () => { row.push(field); field = ""; closed = false }
  const pushRow = () => { pushField(); if (row.some(cell => cell.trim())) rows.push(row); row = []; if (rows.length > VAULT_SUBSCRIBERS_MAX_COUNT + 1) throw new Error("The CSV supports up to 10,000 subscriber rows.") }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else { quoted = false; closed = true } }
      else field += c
    } else if (c === ",") pushField()
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; pushRow() }
    else if (c === '"' && field === "" && !closed) quoted = true
    else { if (closed || c === '"') throw new Error("The CSV contains malformed quotes. Export it again from Facebook."); field += c }
  }
  if (quoted) throw new Error("The CSV contains an unfinished quoted field.")
  pushRow()
  const header = rows.shift()
  const column = header?.findIndex(cell => cell.trim().toLowerCase() === "email address") ?? -1
  if (!header || column < 0 || header.filter(cell => cell.trim().toLowerCase() === "email address").length !== 1) throw new Error('Use Facebook’s subscriber CSV with an "Email address" column.')
  const emails = new Set<string>()
  let duplicates = 0
  rows.forEach((cells, index) => {
    const email = normalizeSubscriberEmail(cells[column])
    if (cells.length !== header.length || !email) throw new Error(`Invalid email or column count on subscriber row ${index + 1}. Nothing has been imported.`)
    if (emails.has(email)) duplicates++
    emails.add(email!)
  })
  return { emails: [...emails].sort(), duplicates }
}

export function parseVaultSubscribers(value: unknown): VaultSubscribers {
  const data = value as Partial<VaultSubscribers> | null
  if (data?.version !== 1 || !Array.isArray(data.emails) || data.emails.length > VAULT_SUBSCRIBERS_MAX_COUNT
    || data.emails.some(email => !normalizeSubscriberEmail(email) || normalizeSubscriberEmail(email) !== email)
    || new Set(data.emails).size !== data.emails.length
    || typeof data.updatedAt !== "string" || !Number.isFinite(Date.parse(data.updatedAt))
    || typeof data.updatedBy !== "string" || !data.updatedBy.trim() || data.updatedBy.length > 255
    || typeof data.sourceName !== "string" || !data.sourceName || data.sourceName.length > 200) throw new Error("The subscriber list is invalid.")
  return { version: 1, emails: data.emails, updatedAt: data.updatedAt, updatedBy: data.updatedBy, sourceName: data.sourceName }
}
