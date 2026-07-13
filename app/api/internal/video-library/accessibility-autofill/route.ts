import { NextResponse } from "next/server"

import { requireAdmin } from "@/lib/auth"
import { autofillModuleAccessibility } from "@/lib/admin-video-library"

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function toInt(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback
}

export async function POST(request: Request) {
  try {
    await requireAdmin()
    const body = await request.json().catch(() => ({}))
    const result = await autofillModuleAccessibility({
      moduleId: clean(body.moduleId || body.module_id, 80),
      courseSlug: clean(body.courseSlug || body.course_slug, 120),
      dryRun: body.dryRun === true || body.dry_run === true,
      includeAudioDescription: body.includeAudioDescription === true || body.include_audio_description === true,
      limit: Math.max(1, Math.min(toInt(body.limit, 4), 8)),
      offset: Math.max(0, toInt(body.offset, 0))
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not generate accessibility fields." },
      { status: 400 }
    )
  }
}
