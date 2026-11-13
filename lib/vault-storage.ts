import "server-only"
import { randomBytes, randomUUID } from "node:crypto"
import { AwsClient } from "aws4fetch"
import { VAULT_ACCESS_KEY, VAULT_CATALOG_KEY, VAULT_FILE_TYPES, VAULT_MAX_FILE_BYTES, parseVaultAccess, parseVaultCatalog, validateVaultItem, type VaultCatalog } from "@/lib/vault-catalog"
import { VAULT_SUBSCRIBERS_KEY, parseSubscriberCsv, parseVaultSubscribers } from "@/lib/vault-subscribers"

function storage() {
  const account = process.env.VAULT_R2_ACCOUNT_ID
  const accessKeyId = process.env.VAULT_R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.VAULT_R2_SECRET_ACCESS_KEY
  if (!account || !/^[a-f0-9]{32}$/i.test(account) || !accessKeyId || !secretAccessKey) throw new Error("Vault storage is not configured. Add the vault R2 credentials to the website environment.")
  const client = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto", retries: 0 })
  const url = (key: string) => `https://${account}.r2.cloudflarestorage.com/inner-circle-vault/${key.split("/").map(encodeURIComponent).join("/")}`
  return { client, url }
}

export async function readVaultCatalog() {
  const { client, url } = storage()
  // Compression can strip Content-Length and weaken ETags. Catalog writes need
  // the original strong ETag for R2's atomic If-Match precondition.
  const res = await client.fetch(url(VAULT_CATALOG_KEY), { headers: { "Accept-Encoding": "identity" }, cache: "no-store", signal: AbortSignal.timeout(15000) })
  if (res.status === 404) return { catalog: { version: 1, templates: [] } as VaultCatalog, etag: null }
  if (!res.ok) throw new Error("Could not read vault storage. Check the R2 credentials and bucket permissions.")
  return { catalog: parseVaultCatalog(await res.json()), etag: res.headers.get("etag") }
}

export function generateVaultAccessCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  // 15 independent base-32 characters = 75 random bits. Skip ambiguous I/O/0/1.
  const symbols = [...randomBytes(15)].map(byte => alphabet[byte & 31]).join("")
  return `IC-${symbols.slice(0, 5)}-${symbols.slice(5, 10)}-${symbols.slice(10)}`
}

export async function readVaultAccess() {
  const { client, url } = storage()
  const res = await client.fetch(url(VAULT_ACCESS_KEY), { headers: { "Accept-Encoding": "identity" }, cache: "no-store", signal: AbortSignal.timeout(15000) })
  if (res.status === 404) return { record: null, etag: null }
  if (!res.ok) throw new Error("Could not read the monthly access code. Please try again.")
  const record = parseVaultAccess(await res.json())
  const etag = res.headers.get("etag")
  if (!etag) throw new Error("Could not verify the current access code. Please refresh and try again.")
  return { record, etag }
}

export async function readVaultSubscribers() {
  const { client, url } = storage()
  const res = await client.fetch(url(VAULT_SUBSCRIBERS_KEY), { headers: { "Accept-Encoding": "identity" }, cache: "no-store", signal: AbortSignal.timeout(15000) })
  if (res.status === 404) return { record: null, etag: null }
  if (!res.ok) throw new Error("Could not read the subscriber list. Please try again.")
  const record = parseVaultSubscribers(await res.json())
  const etag = res.headers.get("etag")
  if (!etag) throw new Error("Could not verify the subscriber list. Refresh and try again.")
  return { record, etag }
}

export async function replaceVaultSubscribers(csv: unknown, sourceName: unknown, expectedEtag: unknown, actor: string) {
  if (typeof csv !== "string" || typeof sourceName !== "string") throw new Error("Choose a Facebook subscriber CSV.")
  const parsed = parseSubscriberCsv(csv)
  const record = parseVaultSubscribers({ version: 1, emails: parsed.emails, updatedAt: new Date().toISOString(), updatedBy: actor, sourceName: sourceName.trim().slice(0, 200) })
  const current = await readVaultSubscribers()
  if (current.etag !== expectedEtag) throw new Error("The subscriber list changed in another window. Refresh and review your upload again.")
  const { client, url } = storage()
  const body = JSON.stringify(record)
  const res = await client.fetch(url(VAULT_SUBSCRIBERS_KEY), {
    method: "PUT", headers: { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(body)), ...(current.etag ? { "If-Match": current.etag } : { "If-None-Match": "*" }) },
    body, signal: AbortSignal.timeout(15000)
  })
  if (res.status === 409 || res.status === 412) throw new Error("The subscriber list changed in another window. Refresh and review your upload again.")
  if (!res.ok) throw new Error("Could not save the subscriber list. Refresh to check its status before retrying.")
  return readVaultSubscribers()
}

export async function activateVaultAccessCode(code: unknown, expectedEtag: unknown, actor: string) {
  const record = parseVaultAccess({ version: 1, code, updatedAt: new Date().toISOString(), updatedBy: actor })
  const current = await readVaultAccess()
  if (current.etag !== expectedEtag) throw new Error("The access code changed in another window. Refresh before activating a new code.")
  if (current.record?.code === record.code) throw new Error("Generate a different code before activating it.")
  const { client, url } = storage()
  const body = JSON.stringify(record)
  const res = await client.fetch(url(VAULT_ACCESS_KEY), {
    method: "PUT", headers: { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(body)), ...(current.etag ? { "If-Match": current.etag } : { "If-None-Match": "*" }) },
    body, signal: AbortSignal.timeout(15000)
  })
  if (res.status === 409 || res.status === 412) throw new Error("The access code changed in another window. Refresh before activating a new code.")
  if (!res.ok) throw new Error("Could not activate the new code. Refresh to check the active code before retrying.")
  return readVaultAccess()
}

export async function prepareVaultUpload(filename: unknown, size: unknown) {
  if (typeof filename !== "string" || typeof size !== "number" || !Number.isInteger(size) || size <= 0 || size > VAULT_MAX_FILE_BYTES) throw new Error("Choose a document between 1 byte and 100 MB.")
  const extension = filename.split(".").pop()!.toLowerCase()
  const type = VAULT_FILE_TYPES[extension]
  if (!type) throw new Error("Supported files: PDF, Excel, Word, PowerPoint, CSV, ZIP, and TXT.")
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-150).replace(/^[^a-zA-Z0-9]+/, "") || `document.${extension}`
  const key = `documents/${randomUUID()}/${safeName}`
  const { client, url } = storage()
  const target = new URL(url(key))
  target.searchParams.set("X-Amz-Expires", "300")
  // Signing size and content type prevents reuse for a larger/different upload.
  const headers = { "Content-Type": type, "Content-Length": String(size), "If-None-Match": "*" }
  const signed = await client.sign(target.toString(), { method: "PUT", headers, aws: { signQuery: true, allHeaders: true } })
  return { key, url: signed.url, headers: { "Content-Type": type, "If-None-Match": "*" } }
}

export async function saveVaultDocument(value: unknown, expectedEtag: unknown, editingId: unknown) {
  const item = validateVaultItem(value)
  const { catalog, etag } = await readVaultCatalog()
  if (expectedEtag !== etag) throw new Error("The vault changed in another window. Reload before saving.")
  const { client, url } = storage()
  // Never publish or replace metadata with a missing/unfinished object.
  const head = await client.fetch(url(item.file), { method: "HEAD", headers: { "Accept-Encoding": "identity" }, signal: AbortSignal.timeout(15000) })
  if (!head.ok || Number(head.headers.get("content-length")) <= 0 || Number(head.headers.get("content-length")) > VAULT_MAX_FILE_BYTES) throw new Error("The uploaded file could not be verified. Please upload it again.")
  const index = catalog.templates.findIndex(entry => entry.id === item.id)
  if (editingId && (editingId !== item.id || index < 0)) throw new Error("This document no longer exists. Refresh the vault.")
  if (!editingId && index >= 0) throw new Error("That document ID is already used. Choose another ID or edit the existing document.")
  if (index < 0) catalog.templates.push(item)
  else catalog.templates[index] = item
  parseVaultCatalog(catalog)
  const body = JSON.stringify(catalog)
  const result = await client.fetch(url(VAULT_CATALOG_KEY), {
    method: "PUT",
    // Next.js wraps fetch requests as streams; R2 requires an explicit length.
    headers: { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(body)), ...(etag ? { "If-Match": etag } : { "If-None-Match": "*" }) },
    body, signal: AbortSignal.timeout(15000)
  })
  if (result.status === 412 || result.status === 409) throw new Error("The vault changed in another window. Reload before saving.")
  if (!result.ok) {
    const code = (await result.text()).match(/<Code>([A-Za-z0-9]+)<\/Code>/)?.[1] || "Unknown"
    console.error("Vault catalog write rejected", result.status, code)
    throw new Error("Could not save the document catalog. Your file remains private; please retry.")
  }
}
