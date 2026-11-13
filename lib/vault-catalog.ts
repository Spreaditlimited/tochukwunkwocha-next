export const VAULT_CATALOG_KEY = "_vault/catalog.json"
export const VAULT_ACCESS_KEY = "_vault/access.json"
export type VaultAccessRecord = { version: 1; code: string; updatedAt: string; updatedBy: string }

export function parseVaultAccess(value: unknown): VaultAccessRecord {
  const data = value as Partial<VaultAccessRecord> | null
  if (data?.version !== 1 || typeof data.code !== "string" || !/^IC-[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/.test(data.code)
    || typeof data.updatedAt !== "string" || !Number.isFinite(Date.parse(data.updatedAt))
    || typeof data.updatedBy !== "string" || !data.updatedBy.trim() || data.updatedBy.length > 255) throw new Error("The vault access configuration is invalid.")
  return { version: 1, code: data.code, updatedAt: data.updatedAt, updatedBy: data.updatedBy }
}
export const VAULT_MAX_FILE_BYTES = 100 * 1024 * 1024
export type VaultItem = {
  id: string
  title: string
  desc: string
  category: string
  file: string
  published: boolean
}
export type VaultCatalog = { version: 1; templates: VaultItem[] }
export const VAULT_FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
  zip: "application/zip",
  txt: "text/plain"
}

export function validateVaultItem(value: unknown): VaultItem {
  if (!value || typeof value !== "object") throw new Error("Invalid document details.")
  const input = value as Record<string, unknown>
  const field = (key: string, max: number) => {
    if (typeof input[key] !== "string") throw new Error(`Enter a valid ${key}.`)
    const text = input[key].trim()
    if (!text || text.length > max) throw new Error(`Enter a ${key} of 1–${max} characters.`)
    return text
  }
  const item = { id: field("id", 80), title: field("title", 200), desc: field("desc", 1000), category: field("category", 80), file: field("file", 250), published: input.published === true }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(item.id)) throw new Error("Document ID must contain lowercase letters, numbers, and hyphens.")
  if (!/^(?:documents\/[a-f0-9-]{36}\/)?[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(item.file) || !VAULT_FILE_TYPES[item.file.split(".").pop()!.toLowerCase()]) throw new Error("Choose a supported document file.")
  return item
}

export function parseVaultCatalog(value: unknown): VaultCatalog {
  const data = value as Partial<VaultCatalog> | null
  if (data?.version !== 1 || !Array.isArray(data.templates) || data.templates.length > 500) throw new Error("The vault catalog is invalid.")
  const templates = data.templates.map(validateVaultItem)
  if (new Set(templates.map(item => item.id)).size !== templates.length) throw new Error("The vault contains duplicate document IDs.")
  return { version: 1, templates }
}
