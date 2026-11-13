import { NextResponse } from "next/server"
import { getAdminSession, canAccessDashboardPath } from "@/lib/auth"
import { activateVaultAccessCode, generateVaultAccessCode, prepareVaultUpload, readVaultAccess, readVaultCatalog, readVaultSubscribers, replaceVaultSubscribers, saveVaultDocument } from "@/lib/vault-storage"
import { VAULT_SUBSCRIBERS_MAX_BYTES } from "@/lib/vault-subscribers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } })

export async function POST(request: Request) {
  const session = await getAdminSession()
  if (!session) return json({ error: "Please sign in to the internal dashboard." }, 401)
  if (!canAccessDashboardPath(session, "/internal/vault")) return json({ error: "You do not have access to manage the vault." }, 403)
  // Compare browser origin with Host; production proxies may rewrite request.url.
  const origin = request.headers.get("origin")
  const host = request.headers.get("host")
  let originHost = ""
  try { originHost = origin ? new URL(origin).host : "" } catch { /* Invalid origins are rejected below. */ }
  if (!originHost || originHost !== host || request.headers.get("sec-fetch-site") === "cross-site") return json({ error: "Invalid request origin." }, 403)
  if (!request.headers.get("content-type")?.startsWith("application/json")) return json({ error: "Expected JSON." }, 415)
  const reader = request.body?.getReader()
  if (!reader) return json({ error: "Missing request body." }, 400)
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > VAULT_SUBSCRIBERS_MAX_BYTES * 2 + 16384) { await reader.cancel(); return json({ error: "Request too large." }, 413) }
    chunks.push(value)
  }
  const text = Buffer.concat(chunks).toString("utf8")
  try {
    const body = JSON.parse(text)
    if (["subscribers-reload", "subscribers-replace"].includes(body.action)) {
      if (!session.isOwner) return json({ error: "Only the account owner can manage subscriber access." }, 403)
      if (body.action === "subscribers-replace") return json(await replaceVaultSubscribers(body.csv, body.filename, body.etag, session.email || session.adminUuid))
      return json(await readVaultSubscribers())
    }
    if (size > 16384) return json({ error: "Request too large." }, 413)
    if (["access-reveal", "access-generate", "access-activate"].includes(body.action)) {
      if (!session.isOwner) return json({ error: "Only the account owner can manage the monthly access code." }, 403)
      if (body.action === "access-activate") return json(await activateVaultAccessCode(body.code, body.etag, session.email || session.adminUuid))
      const state = await readVaultAccess()
      if (body.action === "access-generate") return json({ code: generateVaultAccessCode(), etag: state.etag })
      return json(state)
    }
    if (body.action === "upload") return json(await prepareVaultUpload(body.filename, body.size))
    if (body.action === "save") {
      await saveVaultDocument(body.item, body.etag, body.editingId)
      return json(await readVaultCatalog())
    }
    if (body.action === "reload") return json(await readVaultCatalog())
    return json({ error: "Unknown operation." }, 400)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "The vault could not be updated." }, 400)
  }
}
