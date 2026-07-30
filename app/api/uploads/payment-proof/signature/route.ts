import { NextResponse } from "next/server"

import { createPaymentProofUploadAuthorization } from "@/lib/payment-proof-upload"

export const dynamic = "force-dynamic"

const WINDOW_MS = 10 * 60 * 1000
const MAX_SIGNATURES_PER_WINDOW = 12
const recentSignatures = new Map<string, { count: number; resetAt: number }>()

export async function POST(request: Request) {
  try {
    const forwarded = String(request.headers.get("x-forwarded-for") || request.headers.get("client-ip") || "")
    const clientKey = forwarded.split(",")[0].trim() || "unknown"
    const currentTime = Date.now()
    if (recentSignatures.size > 1000) {
      for (const [key, value] of recentSignatures) {
        if (value.resetAt <= currentTime) recentSignatures.delete(key)
      }
    }
    const current = recentSignatures.get(clientKey)
    if (current && current.resetAt > currentTime && current.count >= MAX_SIGNATURES_PER_WINDOW) {
      return NextResponse.json(
        { ok: false, error: "Too many upload attempts. Please wait a few minutes and try again." },
        { status: 429, headers: { "Cache-Control": "no-store" } }
      )
    }
    recentSignatures.set(clientKey, current && current.resetAt > currentTime
      ? { ...current, count: current.count + 1 }
      : { count: 1, resetAt: currentTime + WINDOW_MS })
    const body = await request.json()
    const authorization = createPaymentProofUploadAuthorization({
      type: body.type,
      size: body.size
    })
    return NextResponse.json(
      { ok: true, ...authorization },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not prepare payment proof upload." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    )
  }
}
