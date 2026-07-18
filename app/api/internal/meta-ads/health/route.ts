import { NextResponse } from "next/server"

import { requireAdmin } from "@/lib/auth"

export const dynamic = "force-dynamic"

const DEFAULT_META_GRAPH_API_VERSION = "v25.0"

type MetaErrorPayload = {
  error?: {
    code?: number
    type?: string
    fbtrace_id?: string
  }
}

function configuration() {
  const accessToken = String(process.env.META_MARKETING_ACCESS_TOKEN || "").trim()
  const accountId = String(process.env.META_AD_ACCOUNT_ID || "").trim().replace(/^act_/, "")
  const configuredVersion = String(process.env.META_GRAPH_API_VERSION || DEFAULT_META_GRAPH_API_VERSION).trim()
  const apiVersion = configuredVersion.startsWith("v") ? configuredVersion : `v${configuredVersion}`

  if (!accessToken) throw new Error("META_MARKETING_ACCESS_TOKEN is not configured.")
  if (!/^\d+$/.test(accountId)) throw new Error("META_AD_ACCOUNT_ID is not configured correctly.")
  if (!/^v\d+\.\d+$/.test(apiVersion)) throw new Error("META_GRAPH_API_VERSION is not configured correctly.")

  return { accessToken, accountId, apiVersion }
}

function safeProviderMessage(code?: number) {
  if (code === 190) return "The Meta access token is invalid or expired. Rotate the system-user token."
  if (code === 10 || code === 200) return "Meta denied access to this ad account. Review the system-user asset permissions."
  if (code === 2635) return "The configured Meta Marketing API version is no longer supported."
  return "Meta Ads is currently unreachable. No advertising data was changed."
}

export async function GET() {
  await requireAdmin("/internal/marketing")

  try {
    const { accessToken, accountId, apiVersion } = configuration()
    const fields = "id,name,account_status,currency,timezone_name,business_name"
    const response = await fetch(`https://graph.facebook.com/${apiVersion}/act_${accountId}?fields=${encodeURIComponent(fields)}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000)
    })
    const payload = await response.json().catch(() => null) as (MetaErrorPayload & Record<string, unknown>) | null

    if (!response.ok || payload?.error) {
      const providerError = payload?.error
      console.error("[meta-ads-health] Provider request failed", {
        status: response.status,
        code: providerError?.code,
        type: providerError?.type,
        traceId: providerError?.fbtrace_id
      })
      return NextResponse.json(
        { ok: false, error: safeProviderMessage(providerError?.code) },
        { status: response.status === 401 || response.status === 403 ? response.status : 502, headers: { "Cache-Control": "no-store" } }
      )
    }

    return NextResponse.json({
      ok: true,
      account: {
        id: String(payload?.id || `act_${accountId}`),
        name: String(payload?.name || "Meta ad account"),
        businessName: String(payload?.business_name || ""),
        status: Number(payload?.account_status || 0),
        currency: String(payload?.currency || ""),
        timezone: String(payload?.timezone_name || "")
      },
      apiVersion: response.headers.get("facebook-api-version") || apiVersion
    }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meta Ads connection check failed."
    const configurationError = message.startsWith("META_")
    if (!configurationError) console.error("[meta-ads-health] Connection check failed", { name: error instanceof Error ? error.name : "UnknownError" })
    return NextResponse.json(
      { ok: false, error: configurationError ? message : "Meta Ads is currently unreachable. No advertising data was changed." },
      { status: configurationError ? 503 : 502, headers: { "Cache-Control": "no-store" } }
    )
  }
}
