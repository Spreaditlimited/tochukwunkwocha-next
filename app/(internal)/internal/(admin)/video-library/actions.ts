"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth"
import { deleteCourseLiveSession, saveCourseLiveSession } from "@/lib/course-live-sessions"
import { setInternalToast } from "@/lib/internal-toast"
import {
  activateCourseBatch,
  autofillModuleAccessibility,
  cloneVideoLibraryModule,
  deleteCourseBatch,
  deleteVideoLibraryLesson,
  detachVideoLibraryModule,
  enforceSignedCloudflareVideos,
  importVideoLibraryCsv,
  saveCourseBatch,
  savePublicVideoSlot,
  saveVideoLibraryCourse,
  saveVideoLibraryLesson,
  saveVideoLibraryLessons,
  saveVideoLibraryModule,
  syncCloudflareVideos
} from "@/lib/admin-video-library"

const PATH = "/internal/video-library"
const PUBLIC_VIDEO_PATHS = ["/", "/about", "/courses/prompt-to-profit", "/courses/prompt-to-production"]

function moduleToast(input: { intent: string; isActive: boolean }) {
  if (input.intent === "move") {
    return {
      title: "Module moved",
      message: "The module is now attached to the selected course."
    }
  }
  if (input.intent === "status") {
    return input.isActive
      ? { title: "Module published", message: "Learners can now see this module when their course and batch access allow it." }
      : { title: "Module unpublished", message: "Learners will no longer see this module." }
  }
  return {
    title: "Module saved",
    message: "Your module title, notes, status, and batch access rules are saved."
  }
}

export async function saveVideoLibraryCourseAction(formData: FormData) {
  await requireAdmin("/internal/video-library")
  await saveVideoLibraryCourse({
    courseSlug: String(formData.get("courseSlug") || ""),
    courseTitle: String(formData.get("courseTitle") || ""),
    courseDescription: String(formData.get("courseDescription") || ""),
    enrollmentMode: String(formData.get("enrollmentMode") || ""),
    priceNgn: String(formData.get("priceNgn") || ""),
    priceGbp: String(formData.get("priceGbp") || ""),
    priceUsd: String(formData.get("priceUsd") || ""),
    priceEur: String(formData.get("priceEur") || ""),
    schoolAdvancedDiscountNgn: String(formData.get("schoolAdvancedDiscountNgn") || ""),
    schoolAdvancedDiscountGbp: String(formData.get("schoolAdvancedDiscountGbp") || ""),
    schoolAdvancedDiscountUsd: String(formData.get("schoolAdvancedDiscountUsd") || ""),
    schoolAdvancedDiscountEur: String(formData.get("schoolAdvancedDiscountEur") || ""),
    paymentMethods: formData.getAll("paymentMethods").map(String),
    isPublished: formData.get("isPublished") === "on",
    isEnrollmentLocked: formData.get("isEnrollmentLocked") === "on",
    releaseAt: String(formData.get("releaseAt") || "")
  })
  await setInternalToast({ title: "Course saved", message: "Your course details, prices, payment options, and release settings are saved." })
  revalidatePath(PATH)
  revalidatePath("/internal/learning")
}

export async function savePublicVideoSlotAction(formData: FormData) {
  await requireAdmin("/internal/video-library")
  await savePublicVideoSlot({
    slotKey: String(formData.get("slotKey") || ""),
    videoAssetId: String(formData.get("videoAssetId") || ""),
    headline: String(formData.get("headline") || ""),
    description: String(formData.get("description") || ""),
    isActive: formData.get("isActive") === "on"
  })
  await setInternalToast({ title: "Public video slot saved", message: "The selected public page video is now linked to the Cloudflare video library." })
  revalidatePath(PATH)
  for (const publicPath of PUBLIC_VIDEO_PATHS) revalidatePath(publicPath)
}

export async function saveVideoLibraryModuleAction(formData: FormData) {
  await requireAdmin("/internal/video-library")
  const batchKeys = formData.getAll("dripBatchKey").map(String)
  const accessModes = formData.getAll("dripAccessMode").map(String)
  const dripDates = formData.getAll("dripAt").map(String)
  const dripSchedules = batchKeys.map((batchKey, index) => ({
    batchKey,
    accessMode: accessModes[index] || "drip",
    dripAt: dripDates[index] || ""
  }))
  const isActive = formData.get("isActive") === "on"
  await saveVideoLibraryModule({
    moduleId: String(formData.get("moduleId") || ""),
    courseSlug: String(formData.get("courseSlug") || ""),
    moduleSlug: String(formData.get("moduleSlug") || ""),
    moduleTitle: String(formData.get("moduleTitle") || ""),
    moduleDescription: String(formData.get("moduleDescription") || ""),
    sortOrder: String(formData.get("sortOrder") || ""),
    isActive,
    dripEnabled: formData.get("dripEnabled") === "on",
    dripSchedules
  })
  await setInternalToast(moduleToast({ intent: String(formData.get("actionIntent") || ""), isActive }))
  revalidatePath(PATH)
  revalidatePath("/internal/learning")
}

export async function saveVideoLibraryLessonAction(formData: FormData) {
  await requireAdmin("/internal/video-library")
  await saveVideoLibraryLesson({
    lessonId: String(formData.get("lessonId") || ""),
    moduleId: String(formData.get("moduleId") || ""),
    lessonSlug: String(formData.get("lessonSlug") || ""),
    lessonTitle: String(formData.get("lessonTitle") || ""),
    lessonOrder: String(formData.get("lessonOrder") || ""),
    videoAssetId: String(formData.get("videoAssetId") || ""),
    lessonNotes: String(formData.get("lessonNotes") || ""),
    transcriptText: String(formData.get("transcriptText") || ""),
    captionsVttUrl: String(formData.get("captionsVttUrl") || ""),
    captionsLanguagesJson: String(formData.get("captionsLanguagesJson") || ""),
    audioDescriptionText: String(formData.get("audioDescriptionText") || ""),
    signLanguageVideoUrl: String(formData.get("signLanguageVideoUrl") || ""),
    accessibilityStatus: String(formData.get("accessibilityStatus") || ""),
    isActive: formData.get("isActive") === "on"
  })
  await setInternalToast({ title: "Lesson saved", message: "The lesson title, video, notes, transcript, captions, and accessibility fields are saved." })
  revalidatePath(PATH)
  revalidatePath("/internal/learning")
}

export async function saveVideoLibraryLessonsAction(formData: FormData) {
  await requireAdmin("/internal/video-library")
  const rows = JSON.parse(String(formData.get("lessonsJson") || "[]"))
  if (!Array.isArray(rows)) throw new Error("Lesson rows are invalid.")
  await saveVideoLibraryLessons({
    moduleId: String(formData.get("moduleId") || ""),
    replaceAll: formData.get("replaceAll") !== "false",
    lessons: rows.map((row) => {
      const item = row && typeof row === "object" ? row as Record<string, unknown> : {}
      return {
        id: String(item.id || ""),
        lessonSlug: String(item.lessonSlug || ""),
        lessonTitle: String(item.lessonTitle || ""),
        lessonOrder: String(item.lessonOrder || ""),
        videoAssetId: String(item.videoAssetId || ""),
        lessonNotes: String(item.lessonNotes || ""),
        captionsVttUrl: String(item.captionsVttUrl || ""),
        captionsLanguagesJson: String(item.captionsLanguagesJson || ""),
        transcriptText: String(item.transcriptText || ""),
        audioDescriptionText: String(item.audioDescriptionText || ""),
        signLanguageVideoUrl: String(item.signLanguageVideoUrl || ""),
        accessibilityStatus: String(item.accessibilityStatus || ""),
        isActive: item.isActive !== false && Number(item.isActive) !== 0
      }
    })
  })
  await setInternalToast({ title: "Mapping saved", message: "Your lesson rows, order, video choices, and notes are saved." })
  revalidatePath(PATH)
  revalidatePath("/internal/learning")
}

export async function deleteVideoLibraryLessonAction(formData: FormData) {
  await requireAdmin("/internal/video-library")
  await deleteVideoLibraryLesson({
    lessonId: String(formData.get("lessonId") || ""),
    moduleId: String(formData.get("moduleId") || "")
  })
  await setInternalToast({ title: "Lesson removed", message: "That lesson row has been removed from this module." })
  revalidatePath(PATH)
  revalidatePath("/internal/learning")
}

export async function cloneVideoLibraryModuleAction(formData: FormData) {
  await requireAdmin("/internal/video-library")
  await cloneVideoLibraryModule({
    sourceModuleId: String(formData.get("sourceModuleId") || ""),
    targetCourseSlug: String(formData.get("targetCourseSlug") || ""),
    forceDuplicate: formData.get("forceDuplicate") === "on"
  })
  await setInternalToast({ title: "Module added to course", message: "The selected module is now available in the target course." })
  revalidatePath(PATH)
  revalidatePath("/internal/learning")
}

export async function detachVideoLibraryModuleAction(formData: FormData) {
  await requireAdmin("/internal/video-library")
  await detachVideoLibraryModule({
    moduleId: String(formData.get("moduleId") || ""),
    courseSlug: String(formData.get("courseSlug") || "")
  })
  await setInternalToast({ title: "Module detached", message: "The module has been removed from this course. Its lessons and video assets were not deleted." })
  revalidatePath(PATH)
  revalidatePath("/internal/learning")
}

export async function autofillModuleAccessibilityAction(formData: FormData) {
  await requireAdmin("/internal/video-library")
  await autofillModuleAccessibility({
    moduleId: String(formData.get("moduleId") || ""),
    includeAudioDescription: formData.get("includeAudioDescription") === "on"
  })
  await setInternalToast({ title: "Accessibility check finished", message: "I filled missing transcript and caption fields where the source data was available." })
  revalidatePath(PATH)
  revalidatePath("/internal/learning")
}

export async function saveCourseBatchAction(formData: FormData) {
  await requireAdmin("/internal/video-library")
  await saveCourseBatch({
    courseSlug: String(formData.get("courseSlug") || ""),
    originalBatchKey: String(formData.get("originalBatchKey") || ""),
    batchKey: String(formData.get("batchKey") || ""),
    batchLabel: String(formData.get("batchLabel") || ""),
    status: String(formData.get("status") || ""),
    paystackReferencePrefix: String(formData.get("paystackReferencePrefix") || ""),
    brevoListId: String(formData.get("brevoListId") || ""),
    seatLimit: String(formData.get("seatLimit") || ""),
    batchStartAt: String(formData.get("batchStartAt") || ""),
    activate: formData.get("activate") === "on"
  })
  await setInternalToast({ title: "Batch saved", message: "The batch name, start date, Brevo list, and active status are saved." })
  revalidatePath(PATH)
}

export async function activateCourseBatchAction(formData: FormData) {
  await requireAdmin("/internal/video-library")
  await activateCourseBatch(String(formData.get("courseSlug") || ""), String(formData.get("batchKey") || ""))
  await setInternalToast({ title: "Batch set active", message: "New learners for this course will use this batch where the course flow requires an active batch." })
  revalidatePath(PATH)
}

export async function deleteCourseBatchAction(formData: FormData) {
  await requireAdmin("/internal/video-library")
  await deleteCourseBatch(String(formData.get("courseSlug") || ""), String(formData.get("batchKey") || ""))
  await setInternalToast({ title: "Batch deleted", message: "That batch has been removed because it was not active or referenced by module access rules." })
  revalidatePath(PATH)
}

export async function saveCourseLiveSessionAction(formData: FormData) {
  await requireAdmin("/internal/video-library")
  await saveCourseLiveSession({
    sessionUuid: String(formData.get("sessionUuid") || ""),
    courseSlug: String(formData.get("courseSlug") || ""),
    batchKey: String(formData.get("batchKey") || ""),
    sessionTitle: String(formData.get("sessionTitle") || ""),
    dayOffset: String(formData.get("dayOffset") || "0"),
    timeOfDay: String(formData.get("timeOfDay") || "19:00"),
    startsAt: String(formData.get("startsAt") || ""),
    zoomJoinUrl: String(formData.get("zoomJoinUrl") || ""),
    reminderMinutesBefore: String(formData.get("reminderMinutesBefore") || "720"),
    isVisible: formData.get("isVisible") === "on",
    reminderEnabled: formData.get("reminderEnabled") === "on",
    useSharedZoom: formData.get("useSharedZoom") === "on"
  })
  await setInternalToast({ title: "Live session saved", message: "The Zoom link and reminder settings are now attached to this batch." })
  revalidatePath(PATH)
}

export async function deleteCourseLiveSessionAction(formData: FormData) {
  await requireAdmin("/internal/video-library")
  await deleteCourseLiveSession(String(formData.get("sessionUuid") || ""))
  await setInternalToast({ title: "Live session deleted", message: "The live class entry has been removed from this batch." })
  revalidatePath(PATH)
}

export async function syncCloudflareVideosAction(formData: FormData) {
  await requireAdmin("/internal/video-library")
  const pages = Number(formData.get("maxPages") || 20)
  const result = await syncCloudflareVideos(Number.isFinite(pages) ? pages : 20)
  await setInternalToast({
    title: "Cloudflare sync finished",
    message: `Checked ${result.scannedPages} page${result.scannedPages === 1 ? "" : "s"}, found ${result.fetched} video${result.fetched === 1 ? "" : "s"}, and refreshed ${result.upserted} library record${result.upserted === 1 ? "" : "s"}.`
  })
  revalidatePath(PATH)
}

export async function enforceSignedCloudflareVideosAction(formData: FormData) {
  const session = await requireAdmin("/internal/video-library")
  const result = await enforceSignedCloudflareVideos(session.email || session.adminUuid || "admin", formData.get("forceRotate") === "on")
  const failed = Number(result.failedVideos || 0)
  await setInternalToast({
    type: failed > 0 ? "error" : "success",
    title: failed > 0 ? "Signing finished with errors" : "Signed playback enabled",
    message: failed > 0
      ? `Protected ${result.protectedVideos} of ${result.totalVideos} video${result.totalVideos === 1 ? "" : "s"}. ${failed} video${failed === 1 ? "" : "s"} could not be updated.`
      : `Protected ${result.protectedVideos} video${result.protectedVideos === 1 ? "" : "s"}. Signing key was ${result.keySource}.`
  })
  revalidatePath(PATH)
  revalidatePath("/internal/settings")
}

export async function importVideoLibraryCsvAction(formData: FormData) {
  await requireAdmin("/internal/video-library")
  const apply = formData.get("apply") === "on"
  const result = await importVideoLibraryCsv(String(formData.get("csvText") || ""), apply)
  await setInternalToast(apply
    ? { title: "CSV import applied", message: `Imported ${result.rowsProcessed || 0} row${result.rowsProcessed === 1 ? "" : "s"} into ${result.modulesWritten || 0} module${result.modulesWritten === 1 ? "" : "s"} and ${result.lessonsWritten || 0} lesson${result.lessonsWritten === 1 ? "" : "s"}.` }
    : { title: "CSV preview ready", message: `Checked ${result.totalRows || 0} row${result.totalRows === 1 ? "" : "s"}. ${result.errorCount || 0} issue${result.errorCount === 1 ? "" : "s"} found.` }
  )
  revalidatePath(PATH)
}
