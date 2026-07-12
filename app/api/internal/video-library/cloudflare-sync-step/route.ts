import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import { syncCloudflareVideosPage } from "@/lib/admin-video-library"
import { requireAdmin } from "@/lib/auth"

export async function POST(request: Request) {
  await requireAdmin()
  const body = await request.json().catch(() => ({}))
  const page = Number(body.page || 1)
  const maxPages = Number(body.maxPages || 20)
  const result = await syncCloudflareVideosPage(Number.isFinite(page) ? page : 1, Number.isFinite(maxPages) ? maxPages : 20)
  if (result.done) revalidatePath("/internal/video-library")
  return NextResponse.json({ ok: true, ...result })
}
