import crypto from "crypto"

import { getAdminSettingValue } from "@/lib/admin-settings"

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function b64url(input: string) {
  return Buffer.from(input, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function normalizePrivateKeyPem(rawValue: string) {
  let value = String(rawValue || "").trim()
  if (!value) return ""
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1).trim()
  }
  if (!value.includes("BEGIN ") && /^[A-Za-z0-9+/_=\-\s]+$/.test(value)) {
    const compact = value.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/")
    const padded = compact.padEnd(Math.ceil(compact.length / 4) * 4, "=")
    try {
      const decoded = Buffer.from(padded, "base64").toString("utf8").trim()
      if (decoded.includes("BEGIN ") && decoded.includes("PRIVATE KEY")) value = decoded
    } catch {
      // Keep the original value so crypto can report a precise key parsing error.
    }
  }
  return value
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/-----BEGIN ([A-Z0-9 ]+)-----\s*/g, "-----BEGIN $1-----\n")
    .replace(/\s*-----END ([A-Z0-9 ]+)-----/g, "\n-----END $1-----")
    .trim()
}

function signRs256(message: string, privateKeyPem: string) {
  const signature = crypto.sign("RSA-SHA256", Buffer.from(message, "utf8"), {
    key: crypto.createPrivateKey({ key: privateKeyPem, format: "pem" })
  })
  return signature.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function streamEmbedBase(videoUid: string, hlsUrl: string | null) {
  const uid = clean(videoUid, 140)
  if (!uid) return ""
  const hls = clean(hlsUrl, 1200)
  if (hls && hls.includes("cloudflarestream.com")) {
    try {
      const parsed = new URL(hls)
      return `https://${parsed.hostname}/${encodeURIComponent(uid)}/iframe`
    } catch {
      return ""
    }
  }
  return `https://iframe.videodelivery.net/${encodeURIComponent(uid)}`
}

function replaceVideoUidWithToken(baseUrl: string, videoUid: string, token: string) {
  const parsed = new URL(baseUrl)
  const parts = parsed.pathname.split("/")
  const idx = parts.findIndex((part) => {
    try {
      return part === videoUid || decodeURIComponent(part) === videoUid
    } catch {
      return part === videoUid
    }
  })
  if (idx === -1) throw new Error("Could not build signed playback URL")
  parts[idx] = token
  parsed.pathname = parts.join("/")
  return parsed.toString()
}

const MIN_LESSON_TOKEN_TTL_SECONDS = 60 * 60 * 6
const DEFAULT_LESSON_TOKEN_TTL_SECONDS = 60 * 60 * 12

type SigningConfig = {
  keyId: string
  privateKey: string
  ttlSeconds: number
}

function resolveTtlSeconds(value: unknown) {
  const ttlInput = Number(value || DEFAULT_LESSON_TOKEN_TTL_SECONDS)
  return Math.max(
    MIN_LESSON_TOKEN_TTL_SECONDS,
    Math.min(Number.isFinite(ttlInput) ? ttlInput : DEFAULT_LESSON_TOKEN_TTL_SECONDS, DEFAULT_LESSON_TOKEN_TTL_SECONDS)
  )
}

function buildSignedLessonEmbedUrlWithConfig(input: { videoUid: string; hlsUrl?: string | null }, config: SigningConfig) {
  const keyId = clean(config.keyId, 120)
  const privateKey = normalizePrivateKeyPem(config.privateKey)
  const uid = clean(input.videoUid, 140)
  if (!keyId) throw new Error("Missing CLOUDFLARE_STREAM_SIGNING_KEY_ID")
  if (!privateKey) throw new Error("Missing CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY")
  if (!uid) throw new Error("video_uid is required")

  const ttlSeconds = resolveTtlSeconds(config.ttlSeconds)
  const nowSec = Math.floor(Date.now() / 1000)
  const exp = nowSec + ttlSeconds
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: keyId }))
  const payload = b64url(JSON.stringify({ sub: uid, kid: keyId, iat: nowSec, nbf: nowSec - 10, exp }))
  const signingInput = `${header}.${payload}`
  const token = `${signingInput}.${signRs256(signingInput, privateKey)}`
  const base = streamEmbedBase(uid, input.hlsUrl || null)
  if (!base) throw new Error("Could not build playback URL")

  return {
    embedUrl: replaceVideoUidWithToken(base, uid, token),
    expiresAt: new Date(exp * 1000).toISOString(),
    ttlSeconds,
    refreshAfterSeconds: Math.max(90, ttlSeconds - 300)
  }
}

export function buildSignedLessonEmbedUrl(input: { videoUid: string; hlsUrl?: string | null }) {
  return buildSignedLessonEmbedUrlWithConfig(input, {
    keyId: process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID || "",
    privateKey: process.env.CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY || "",
    ttlSeconds: resolveTtlSeconds(process.env.CLOUDFLARE_STREAM_TOKEN_TTL_SECONDS)
  })
}

export async function buildSignedLessonEmbedUrlFromRuntimeSettings(input: { videoUid: string; hlsUrl?: string | null }) {
  const [keyId, privateKey, ttlSeconds] = await Promise.all([
    getAdminSettingValue("CLOUDFLARE_STREAM_SIGNING_KEY_ID"),
    getAdminSettingValue("CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY"),
    getAdminSettingValue("CLOUDFLARE_STREAM_TOKEN_TTL_SECONDS")
  ])
  return buildSignedLessonEmbedUrlWithConfig(input, {
    keyId,
    privateKey,
    ttlSeconds: resolveTtlSeconds(ttlSeconds)
  })
}
