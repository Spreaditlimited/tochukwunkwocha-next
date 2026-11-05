import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { SELF_PACED_COHORTS } from "@/lib/self-paced-cohorts"
import { watWallDateTimeMs } from "@/lib/utils"

type Client = Pick<typeof prisma, "$queryRaw">
type ModuleReadiness = {
  moduleId: bigint
  dripEnabled: number | bigint
  dripAt: Date | null
  dripBatchKey: string | null
  dripOffsetSeconds: number | bigint | null
  hasSchedules: number | bigint
  accessMode: string | null
  batchDripAt: Date | null
  lessons: number | bigint
  unavailableVideos: number | bigint
}

export function selfPacedContentReady(input: {
  sourceBatchKey: string
  batchStartAt: Date | string | null
  batchEndAt: Date | string | null
  lastLiveSessionAt: Date | string | null
  releaseAt: Date | string | null
  published: boolean
  completedAfter: string
  minimumLessons: number
  modules: ModuleReadiness[]
  nowMs?: number
}) {
  const nowMs = input.nowMs ?? Date.now()
  const start = watWallDateTimeMs(input.batchStartAt)
  if (!input.published || !Number.isFinite(start) || start > nowMs || Date.parse(input.completedAfter) > nowMs) return false
  for (const date of [input.batchEndAt, input.lastLiveSessionAt, input.releaseAt]) {
    if (date && (!Number.isFinite(watWallDateTimeMs(date)) || watWallDateTimeMs(date) > nowMs)) return false
  }
  let totalLessons = 0
  for (const learningModule of input.modules) {
    let releaseAt = start
    if (Number(learningModule.dripEnabled) === 1) {
      if (Number(learningModule.hasSchedules) > 0) {
        if (!learningModule.accessMode) continue // A recording assigned only to a different cohort.
        if (learningModule.accessMode !== "immediate") {
          releaseAt = watWallDateTimeMs(learningModule.batchDripAt)
          if (!Number.isFinite(releaseAt)) return false
        }
      } else {
        if (learningModule.dripBatchKey && learningModule.dripBatchKey !== input.sourceBatchKey) continue
        releaseAt = learningModule.dripAt ? watWallDateTimeMs(learningModule.dripAt)
          : learningModule.dripOffsetSeconds !== null ? start + Number(learningModule.dripOffsetSeconds) * 1000 : start
      }
    }
    if (!Number.isFinite(releaseAt) || releaseAt > nowMs || Number(learningModule.lessons) < 1 || Number(learningModule.unavailableVideos) > 0) return false
    totalLessons += Number(learningModule.lessons)
  }
  return totalLessons >= input.minimumLessons
}

/** Read-only: the deployment migration creates offer rows; browsing never provisions them. */
export async function listAvailableSelfPacedBatches(courseSlug: string, client: Client = prisma) {
  const offer = SELF_PACED_COHORTS.find((cohort) => cohort.courseSlug === courseSlug)
  if (!offer) return []
  const rows = await client.$queryRaw<Array<{
    batchKey: string; batchLabel: string; batchStartAt: Date; batchEndAt: Date | null
    isPublished: number | bigint; releaseAt: Date | null; lastLiveSessionAt: Date | null
  }>>(Prisma.sql`
    SELECT offer.batch_key AS batchKey, offer.batch_label AS batchLabel,
      source.batch_start_at AS batchStartAt, source.batch_end_at AS batchEndAt,
      course.is_published AS isPublished, course.release_at AS releaseAt,
      (SELECT MAX(starts_at) FROM tochukwu_course_batch_live_sessions live_session
       WHERE live_session.course_slug = source.course_slug AND live_session.batch_key = source.batch_key
         AND live_session.is_visible = 1) AS lastLiveSessionAt
    FROM course_batches offer
    JOIN course_batches source ON source.course_slug = offer.course_slug AND source.batch_key = ${offer.sourceBatchKey}
    JOIN tochukwu_learning_courses course ON course.course_slug COLLATE utf8mb4_unicode_ci = offer.course_slug COLLATE utf8mb4_unicode_ci
    WHERE offer.course_slug = ${courseSlug} AND offer.batch_key = ${offer.batchKey} AND offer.status = 'open'
    LIMIT 1
  `)
  const batch = rows[0]
  if (!batch) return []
  const modules = await client.$queryRaw<ModuleReadiness[]>(Prisma.sql`
    SELECT cm.module_id AS moduleId, cm.drip_enabled AS dripEnabled, cm.drip_at AS dripAt,
      cm.drip_batch_key AS dripBatchKey, cm.drip_offset_seconds AS dripOffsetSeconds,
      EXISTS(SELECT 1 FROM tochukwu_learning_module_batch_drips any_schedule WHERE any_schedule.module_id = m.id) AS hasSchedules,
      schedule.access_mode AS accessMode, schedule.drip_at AS batchDripAt,
      COUNT(lesson.id) AS lessons,
      SUM(CASE WHEN lesson.id IS NOT NULL AND (asset.id IS NULL OR (COALESCE(asset.video_uid, '') = '' AND COALESCE(asset.hls_url, '') = '')) THEN 1 ELSE 0 END) AS unavailableVideos
    FROM tochukwu_learning_course_modules cm
    JOIN tochukwu_learning_modules m ON m.id = cm.module_id AND m.is_active = 1
    LEFT JOIN tochukwu_learning_module_batch_drips schedule ON schedule.module_id = m.id AND schedule.batch_key = ${offer.sourceBatchKey}
    LEFT JOIN tochukwu_learning_lessons lesson ON lesson.module_id = m.id AND lesson.is_active = 1
    LEFT JOIN tochukwu_learning_video_assets asset ON asset.id = lesson.video_asset_id AND asset.source_deleted_at IS NULL
    WHERE cm.course_slug = ${courseSlug} AND cm.is_active = 1
    GROUP BY cm.id, m.id, schedule.id
  `)
  if (!selfPacedContentReady({ ...offer, ...batch, published: Number(batch.isPublished) === 1, modules })) return []
  return [{ ...batch, courseSlug, batchLabel: offer.label, deliveryMode: "self_paced" as const, sourceBatchKey: offer.sourceBatchKey }]
}
