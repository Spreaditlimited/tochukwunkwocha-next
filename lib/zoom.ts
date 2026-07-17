import { applyAdminSettingsToProcessEnv } from "@/lib/admin-settings"

type ZoomResult = {
  ok: boolean
  error?: string
  data?: Record<string, unknown> | null
}

function clean(value: unknown, max = 1000) {
  return String(value || "").trim().slice(0, max)
}

async function zoomAccessToken() {
  await applyAdminSettingsToProcessEnv().catch(() => null)
  const accountId = clean(process.env.ZOOM_ACCOUNT_ID, 200)
  const clientId = clean(process.env.ZOOM_CLIENT_ID, 200)
  const clientSecret = clean(process.env.ZOOM_CLIENT_SECRET, 400)
  if (!accountId || !clientId || !clientSecret) throw new Error("Missing Zoom credentials")
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
  const response = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json" }
  })
  const json = await response.json().catch(() => null)
  if (!response.ok || !json?.access_token) throw new Error(json?.message || json?.reason || `Zoom auth failed (${response.status})`)
  return String(json.access_token)
}

export async function zoomApi(method: string, path: string, body?: Record<string, unknown>): Promise<ZoomResult> {
  const token = await zoomAccessToken()
  const response = await fetch(`https://api.zoom.us/v2${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined
  })
  if (response.status === 204) return { ok: true, data: null }
  const json = await response.json().catch(() => null)
  if (!response.ok) return { ok: false, error: json?.message || json?.reason || `Zoom API failed (${response.status})`, data: json }
  return { ok: true, data: json }
}

export async function createNoFixedTimeZoomMeeting(input: { topic: string; agenda?: string }) {
  await applyAdminSettingsToProcessEnv().catch(() => null)
  const hostId = clean(process.env.ZOOM_HOST_USER_ID, 120)
  if (!hostId) return { ok: false, error: "Missing ZOOM_HOST_USER_ID" } satisfies ZoomResult
  return zoomApi("POST", `/users/${encodeURIComponent(hostId)}/meetings`, {
    topic: clean(input.topic, 200),
    type: 3,
    agenda: clean(input.agenda, 1500),
    settings: {
      join_before_host: false,
      waiting_room: true,
      approval_type: 2,
      mute_upon_entry: true,
      registrants_email_notification: false
    }
  })
}
