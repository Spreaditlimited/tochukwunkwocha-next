import { ensureVideoLibraryTables, PUBLIC_VIDEO_SLOTS, type PublicVideoSlotKey } from "@/lib/admin-video-library"
import { buildSignedLessonEmbedUrlFromRuntimeSettings } from "@/lib/learning-playback"
import { prisma } from "@/lib/prisma"

export type PublicVideoSlot = {
  slotKey: PublicVideoSlotKey
  slotLabel: string
  pageLabel: string
  headline: string | null
  description: string | null
  videoUid: string
  filename: string | null
  embedUrl: string
  expiresAt: string
}

export async function getPublicVideoSlot(slotKey: PublicVideoSlotKey): Promise<PublicVideoSlot | null> {
  const configuredSlot = PUBLIC_VIDEO_SLOTS.find((slot) => slot.key === slotKey)
  if (!configuredSlot) return null

  await ensureVideoLibraryTables()
  const rows = await prisma.$queryRaw<Array<{
    slotKey: PublicVideoSlotKey
    slotLabel: string
    pageLabel: string
    headline: string | null
    description: string | null
    videoUid: string | null
    filename: string | null
    hlsUrl: string | null
  }>>`
    SELECT s.slot_key AS slotKey, s.slot_label AS slotLabel, s.page_label AS pageLabel,
      s.headline, s.description, a.video_uid AS videoUid, a.filename, a.hls_url AS hlsUrl
    FROM tochukwu_public_video_slots s
    JOIN tochukwu_learning_video_assets a ON a.id = s.video_asset_id
    WHERE s.slot_key = ${slotKey}
      AND s.is_active = 1
      AND a.ready_to_stream = 1
      AND a.source_deleted_at IS NULL
      AND COALESCE(TRIM(a.video_uid), '') <> ''
    LIMIT 1
  `
  const row = rows[0]
  if (!row?.videoUid) return null

  const signed = await buildSignedLessonEmbedUrlFromRuntimeSettings({
    videoUid: row.videoUid,
    hlsUrl: row.hlsUrl
  })

  return {
    slotKey: row.slotKey,
    slotLabel: row.slotLabel || configuredSlot.label,
    pageLabel: row.pageLabel || configuredSlot.page,
    headline: row.headline,
    description: row.description,
    videoUid: row.videoUid,
    filename: row.filename,
    embedUrl: signed.embedUrl,
    expiresAt: signed.expiresAt
  }
}
