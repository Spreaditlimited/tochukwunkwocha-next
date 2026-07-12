import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import {
  countCloudflareVideosForSigning,
  enforceSignedCloudflareVideosBatch
} from "@/lib/admin-video-library"
import { requireAdmin } from "@/lib/auth"

function scope(value: unknown): "all" | "recent" {
  return String(value || "").toLowerCase() === "recent" ? "recent" : "all"
}

export async function POST(request: Request) {
  const session = await requireAdmin()
  const body = await request.json().catch(() => ({}))
  const mode = String(body.mode || "batch").toLowerCase()
  const selectedScope = scope(body.scope)
  const since = body.since ? String(body.since) : null

  if (mode === "plan") {
    const totalVideos = await countCloudflareVideosForSigning({ scope: selectedScope, since })
    return NextResponse.json({ ok: true, totalVideos })
  }

  const offset = Number(body.offset || 0)
  const limit = Number(body.limit || 10)
  const result = await enforceSignedCloudflareVideosBatch(session.email || session.adminUuid || "admin", {
    scope: selectedScope,
    since,
    offset: Number.isFinite(offset) ? offset : 0,
    limit: Number.isFinite(limit) ? limit : 10,
    forceRotate: body.forceRotate === true
  })
  if (Number(body.doneAfterThisBatch || 0) === 1) {
    revalidatePath("/internal/video-library")
    revalidatePath("/internal/settings")
  }
  return NextResponse.json({ ok: true, ...result })
}
