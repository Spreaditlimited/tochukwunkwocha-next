import { NextResponse } from "next/server"
import { consumeAskRateLimit, submitAsk } from "@/lib/ask"
import { askId, askText, AskInputError } from "@/lib/ask-validation"
import { clientIpFromRequest, recaptchaEnabled, verifyRecaptchaToken } from "@/lib/recaptcha"

export const runtime = "nodejs"

function reply(body: object, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } })
}

async function readBody(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new AskInputError("Please submit the form as JSON.")
  const reader = request.body?.getReader()
  if (!reader) throw new AskInputError("Please complete the form.")
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > 16384) {
        await reader.cancel()
        throw new AskInputError("This submission is too large.")
      }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  try {
    const result: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"))
    if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error()
    return result as Record<string, unknown>
  } catch { throw new AskInputError("Please complete the form and try again.") }
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin")
    if (origin) {
      const target = new URL(request.url)
      let source: URL
      try { source = new URL(origin) } catch { return reply({ error: "Please submit from this website." }, 403) }
      // Next can expose its internal hostname in request.url behind a proxy.
      // The HTTP Host still identifies the site the browser actually requested.
      const host = request.headers.get("host") || target.host
      if (!["http:", "https:"].includes(source.protocol) || source.host !== host || source.username || source.password) {
        return reply({ error: "Please submit from this website." }, 403)
      }
    }
    if (request.headers.get("sec-fetch-site") === "cross-site") return reply({ error: "Please submit from this website." }, 403)
    const input = await readBody(request)
    const success = { ok: true, message: "Thank you. Your submission is private until reviewed and approved." }
    if (input.website) return reply(success)
    askText(input.body)
    if (input.questionId !== undefined && input.questionId !== null && input.questionId !== "") askId(input.questionId)
    // Fail closed in production, without changing the other forms' CAPTCHA behaviour.
    if (process.env.NODE_ENV === "production" && !recaptchaEnabled()) {
      return reply({ error: "Submissions are temporarily unavailable. Please try again later." }, 503)
    }
    const limit = await consumeAskRateLimit(clientIpFromRequest(request))
    if (!limit.allowed) return reply({ error: "You have reached the submission limit. Please try again later." }, 429, { "Retry-After": String(limit.retryAfter) })
    const captcha = await verifyRecaptchaToken({ token: input.recaptchaToken, expectedAction: "ask_submit" })
    if (!captcha.ok) return reply({ error: "We could not verify this submission. Please try again." }, 400)
    await submitAsk({ body: input.body, questionId: input.questionId })
    return reply(success, 201)
  } catch (error) {
    if (error instanceof AskInputError) return reply({ error: error.message }, 400)
    // Never log the question, request body, or identifying request headers.
    return reply({ error: "We could not save your submission. Please try again later." }, 503)
  }
}
