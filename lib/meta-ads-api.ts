import { getAdminSettingValue } from "@/lib/admin-settings"

const DEFAULT_API_VERSION = "v25.0"

type MetaErrorResponse = {
  error?: {
    message?: string
    type?: string
    code?: number
    error_subcode?: number
    fbtrace_id?: string
  }
}

export class MetaAdsApiError extends Error {
  code: number | null
  subcode: number | null
  traceId: string | null

  constructor(payload: MetaErrorResponse["error"], status: number) {
    super(payload?.message || `Meta Marketing API request failed with status ${status}.`)
    this.name = "MetaAdsApiError"
    this.code = Number.isFinite(payload?.code) ? Number(payload?.code) : null
    this.subcode = Number.isFinite(payload?.error_subcode) ? Number(payload?.error_subcode) : null
    this.traceId = payload?.fbtrace_id || null
  }
}

export async function getMetaAdsApiConfiguration() {
  const [tokenValue, accountValue, versionValue] = await Promise.all([
    getAdminSettingValue("META_MARKETING_ACCESS_TOKEN"),
    getAdminSettingValue("META_AD_ACCOUNT_ID"),
    getAdminSettingValue("META_GRAPH_API_VERSION")
  ])
  const accessToken = String(tokenValue || "").trim()
  const accountId = String(accountValue || "").trim().replace(/^act_/, "")
  const rawVersion = String(versionValue || DEFAULT_API_VERSION).trim()
  const apiVersion = rawVersion.startsWith("v") ? rawVersion : `v${rawVersion}`
  if (!accessToken) throw new Error("META_MARKETING_ACCESS_TOKEN is not configured.")
  if (!/^\d+$/.test(accountId)) throw new Error("META_AD_ACCOUNT_ID is not configured correctly.")
  if (!/^v\d+\.\d+$/.test(apiVersion)) throw new Error("META_GRAPH_API_VERSION is not configured correctly.")
  return { accessToken, accountId, apiVersion }
}

export async function metaAdsRequest<T>(
  path: string,
  options: { method?: "GET" | "POST"; params?: Record<string, string | number | boolean | null | undefined> } = {}
) {
  const { accessToken, apiVersion } = await getMetaAdsApiConfiguration()
  const method = options.method || "GET"
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(options.params || {})) {
    if (value === null || value === undefined || value === "") continue
    params.set(key, String(value))
  }
  const normalizedPath = path.replace(/^\/+/, "")
  const url = new URL(`https://graph.facebook.com/${apiVersion}/${normalizedPath}`)
  const init: RequestInit = {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000)
  }
  if (method === "GET") {
    url.search = params.toString()
  } else {
    init.headers = { ...init.headers, "Content-Type": "application/x-www-form-urlencoded" }
    init.body = params.toString()
  }
  const response = await fetch(url, init)
  const payload = await response.json().catch(() => null) as (T & MetaErrorResponse) | null
  if (!response.ok || payload?.error) throw new MetaAdsApiError(payload?.error, response.status)
  if (!payload) throw new Error("Meta Marketing API returned an invalid response.")
  return payload as T
}

export function safeMetaAdsError(error: unknown) {
  if (error instanceof MetaAdsApiError) {
    if (error.code === 190) return "The Meta access token is invalid or expired."
    if (error.code === 10 || error.code === 200) return "Meta denied the requested advertising operation. Review the assigned permissions."
    if (error.code === 2635) return "The configured Meta Marketing API version is no longer supported."
    return `Meta rejected the advertising operation${error.code ? ` (code ${error.code})` : ""}.`
  }
  return error instanceof Error ? error.message : "The Meta advertising operation failed."
}
