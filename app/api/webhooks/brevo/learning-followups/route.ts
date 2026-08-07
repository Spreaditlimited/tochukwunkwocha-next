import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"

import {
  learningFollowupWebhookSecret,
  recordLearningFollowupBrevoEvent
} from "@/lib/learning-inactivity-followups"

export const dynamic = "force-dynamic"

function matchesSecret(received: string, expected: string) {
  const left = Buffer.from(received)
  const right = Buffer.from(expected)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

export async function POST(request: NextRequest) {
  const expected = await learningFollowupWebhookSecret()
  if (!expected) return NextResponse.json({ ok: false, error: "Webhook is not configured." }, { status: 503 })
  const received = String(
    request.headers.get("x-learning-followup-secret") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    request.nextUrl.searchParams.get("secret") || ""
  ).trim()
  if (!received || !matchesSecret(received, expected)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }
  try {
    const body = await request.json() as Record<string, unknown> | Array<Record<string, unknown>>
    const events = Array.isArray(body) ? body : [body]
    const results = await Promise.all(events.slice(0, 100).map(recordLearningFollowupBrevoEvent))
    return NextResponse.json({ ok: true, accepted: results.length, matched: results.filter((item) => item.matched).length })
  } catch (error) {
    console.error("learning_followup_brevo_webhook_failed", error)
    return NextResponse.json({ ok: false, error: "Webhook processing failed." }, { status: 500 })
  }
}
