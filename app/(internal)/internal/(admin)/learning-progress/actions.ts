"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { upsertAdminSettings } from "@/lib/admin-settings"
import { requireAdmin } from "@/lib/auth"
import { parseLifecycleRecipientEmails, processCourseLifecycleEmails, type LifecycleStage } from "@/lib/course-lifecycle-emails"
import {
  configureBrevoLearningFollowupWebhook,
  processLearningInactivityFollowups,
  retryLearningFollowupCampaign,
  setLearningFollowupCampaignPaused
} from "@/lib/learning-inactivity-followups"
import { setInternalToast } from "@/lib/internal-toast"

const PATH = "/internal/learning-progress"

export async function saveCourseLifecycleSettingsAction(formData: FormData) {
  const session = await requireAdmin(PATH)
  if (!session.isOwner) throw new Error("Only the owner can change automated email settings.")
  await upsertAdminSettings([
    { key: "COURSE_LIFECYCLE_EMAILS_ENABLED", value: formData.get("enabled") === "on" ? "true" : "false" },
    { key: "COURSE_LIFECYCLE_EMAILS_DRY_RUN", value: formData.get("dryRun") === "on" ? "true" : "false" },
    { key: "COURSE_LIFECYCLE_EMAILS_RUN_LIMIT", value: String(formData.get("runLimit") || "100") },
    { key: "COURSE_COMMUNITY_WHATSAPP_URLS_JSON", value: String(formData.get("communityUrls") || "") }
  ], session.email)
  await setInternalToast({ title: "Course email settings saved", message: "Pre-course and lesson-release automation has been updated." })
  revalidatePath(PATH)
}

function lifecycleStage(value: FormDataEntryValue | null): LifecycleStage | "all" {
  const stage = String(value || "all")
  return ["welcome_48h", "batch_switch_24h", "lesson_release"].includes(stage) ? stage as LifecycleStage : "all"
}

function requireSendConfirmation(formData: FormData) {
  if (String(formData.get("confirmation") || "").trim().toUpperCase() !== "SEND") {
    throw new Error("Type SEND to confirm manual email delivery.")
  }
}

export async function previewCourseLifecycleEmailsAction(formData: FormData) {
  await requireAdmin(PATH)
  const courseSlug = String(formData.get("courseSlug") || "")
  const batchKey = String(formData.get("batchKey") || "")
  const stage = lifecycleStage(formData.get("stage"))
  let destination = `${PATH}?lifecyclePreviewState=error`
  try {
    const recipientEmail = parseLifecycleRecipientEmails(formData.get("recipientEmail")).join(",")
    const result = await processCourseLifecycleEmails({ forceDryRun: true, courseSlug, batchKey, stage, recipientEmail, limit: 10 })
    await setInternalToast({ title: "Lifecycle preview ready", message: `${result.due} due email${result.due === 1 ? "" : "s"} found. Nothing was sent.` })
    const query = new URLSearchParams({ lifecyclePreviewState: "success", lifecyclePreviewDue: String(result.due), lifecycleCourse: courseSlug, lifecycleBatch: batchKey, lifecycleStage: stage, lifecycleRecipient: recipientEmail })
    destination = `${PATH}?${query.toString()}#course-lifecycle-emails`
  } catch (error) {
    console.error("course_lifecycle_preview_failed", error)
    await setInternalToast({ type: "error", title: "Lifecycle preview failed", message: `${error instanceof Error ? error.message : "Check the selected filters."} Nothing was sent.` })
  }
  revalidatePath(PATH)
  redirect(destination)
}

export async function sendCourseLifecycleEmailsAction(formData: FormData) {
  const session = await requireAdmin(PATH)
  if (!session.isOwner) throw new Error("Only the owner can trigger manual email delivery.")
  requireSendConfirmation(formData)
  const courseSlug = String(formData.get("courseSlug") || "").trim()
  const batchKey = String(formData.get("batchKey") || "").trim()
  if (!courseSlug || !batchKey) {
    await setInternalToast({ type: "error", title: "Select a course and batch", message: "Manual lifecycle delivery must target one specific batch." })
    revalidatePath(PATH)
    return
  }
  try {
    const recipientEmail = parseLifecycleRecipientEmails(formData.get("recipientEmail")).join(",")
    const result = await processCourseLifecycleEmails({
      forceLive: true,
      courseSlug,
      batchKey,
      stage: lifecycleStage(formData.get("stage")),
      recipientEmail,
      limit: Math.max(1, Math.min(Number(formData.get("limit") || 300), 300))
    })
    const remaining = Math.max(0, result.due - result.sent - result.failed)
    await setInternalToast({
      type: result.failed ? "error" : "success",
      title: result.sent ? `${result.sent} lifecycle email${result.sent === 1 ? "" : "s"} sent` : "No lifecycle email sent",
      message: `${result.failed} failed, ${remaining} already sent, outside the run limit, or not claimed.${remaining ? " Run the same send again to process any eligible recipients left by the run limit." : ""}`
    })
  } catch (error) {
    await setInternalToast({
      type: "error",
      title: "Lifecycle emails were not sent",
      message: error instanceof Error ? error.message : "Check the recipient selection and try again."
    })
  }
  revalidatePath(PATH)
}

export async function sendLearningFollowupsNowAction(formData: FormData) {
  const session = await requireAdmin(PATH)
  if (!session.isOwner) throw new Error("Only the owner can trigger manual email delivery.")
  requireSendConfirmation(formData)
  const result = await processLearningInactivityFollowups({
    forceLive: true,
    recipientEmail: String(formData.get("recipientEmail") || ""),
    courseSlug: String(formData.get("courseSlug") || ""),
    limit: Math.max(1, Math.min(Number(formData.get("limit") || 80), 300))
  })
  await setInternalToast({
    type: result.failed ? "error" : "success",
    title: result.failed ? "Manual follow-up send completed with failures" : "Manual follow-up send completed",
    message: `${result.sent} sent, ${result.failed} failed and ${result.deferred} deferred.`
  })
  revalidatePath(PATH)
}

export async function saveLearningFollowupSettingsAction(formData: FormData) {
  const session = await requireAdmin(PATH)
  if (!session.isOwner) throw new Error("Only the owner can change automated email settings.")
  const entries = [
    { key: "LEARNING_FOLLOWUPS_ENABLED", value: formData.get("enabled") === "on" ? "true" : "false" },
    { key: "LEARNING_FOLLOWUPS_DRY_RUN", value: formData.get("dryRun") === "on" ? "true" : "false" },
    { key: "LEARNING_FOLLOWUPS_INACTIVITY_DAYS", value: String(formData.get("inactivityDays") || "7") },
    { key: "LEARNING_FOLLOWUPS_CAMPAIGN_MONTHS", value: String(formData.get("campaignMonths") || "3") },
    { key: "LEARNING_FOLLOWUPS_MAX_REMINDERS", value: String(formData.get("maxReminders") || "13") },
    { key: "LEARNING_FOLLOWUPS_RUN_LIMIT", value: String(formData.get("runLimit") || "80") },
    { key: "LEARNING_FOLLOWUPS_COURSE_ALLOWLIST", value: String(formData.get("courseAllowlist") || "") }
  ]
  await upsertAdminSettings(entries, session.email)
  await setInternalToast({ title: "Follow-up settings saved", message: "The learning reminder controls have been updated." })
  revalidatePath(PATH)
}

export async function configureLearningFollowupWebhookAction() {
  const session = await requireAdmin(PATH)
  if (!session.isOwner) {
    await setInternalToast({ type: "error", title: "Owner access required", message: "Only the owner can configure Brevo delivery events." })
    return
  }
  let destination = `${PATH}?brevoState=error`
  try {
    const requestHeaders = await headers()
    const host = String(requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "").trim()
    const hostname = host.replace(/^\[|\]$/g, "").split(":")[0].toLowerCase()
    const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname.endsWith(".localhost") || hostname.endsWith(".local")
    const protocol = String(requestHeaders.get("x-forwarded-proto") || (isLocal ? "http" : "https")).split(",")[0].trim()
    const result = await configureBrevoLearningFollowupWebhook(session.email, {
      localValidationBaseUrl: isLocal && host ? `${protocol}://${host}` : undefined
    })
    await setInternalToast({
      title: result.localValidation ? "Local Brevo self-test passed" : result.created ? "Brevo events connected" : "Brevo events refreshed",
      message: result.localValidation
        ? "Credentials, authentication, payload handling, and the local webhook route are working. No email was sent."
        : "Delivery, engagement, bounce, complaint, and unsubscribe events now report to this dashboard."
    })
    destination = `${PATH}?brevoState=${result.localValidation ? "local-ready" : "connected"}`
  } catch (error) {
    console.error("learning_followup_brevo_configuration_failed", error)
    await setInternalToast({
      type: "error",
      title: "Brevo events were not connected",
      message: "The dashboard is still available. Check the Brevo API configuration and try again."
    })
  }
  revalidatePath(PATH)
  redirect(destination)
}

export async function retryLearningFollowupCampaignAction(formData: FormData) {
  await requireAdmin(PATH)
  await retryLearningFollowupCampaign(String(formData.get("campaignUuid") || ""))
  await setInternalToast({ title: "Delivery queued for retry", message: "The failed campaign will be reconsidered by the next eligibility run." })
  revalidatePath(PATH)
}

export async function previewLearningFollowupsAction(formData?: FormData) {
  await requireAdmin(PATH)
  const courseSlug = String(formData?.get("courseSlug") || "")
  const recipientEmail = String(formData?.get("recipientEmail") || "")
  let destination = `${PATH}?previewState=error`
  try {
    const result = await processLearningInactivityFollowups({ forceDryRun: true, courseSlug, recipientEmail, limit: 10 })
    const message = `${result.dueRecipients} recipient${result.dueRecipients === 1 ? " is" : "s are"} currently due. No email was sent.`
    await setInternalToast({ title: "Safe preview completed", message })
    const query = new URLSearchParams({ previewState: "success", previewDue: String(result.dueRecipients), previewAt: new Date().toISOString(), followupCourse: courseSlug || "all", followupSearch: recipientEmail })
    destination = `${PATH}?${query.toString()}#learning-followup-email-preview`
  } catch (error) {
    console.error("learning_followup_safe_preview_failed", error)
    await setInternalToast({
      type: "error",
      title: "Safe preview could not finish",
      message: "No email was sent. Please try again or check the server log for the internal error."
    })
  }
  revalidatePath(PATH)
  redirect(destination)
}

export async function setLearningFollowupCampaignPausedAction(formData: FormData) {
  await requireAdmin(PATH)
  const paused = formData.get("paused") === "true"
  await setLearningFollowupCampaignPaused(String(formData.get("campaignUuid") || ""), paused)
  await setInternalToast({
    title: paused ? "Learner reminders paused" : "Learner reminders resumed",
    message: paused ? "This campaign will not send until it is resumed." : "Weekly eligibility checks are active again."
  })
  revalidatePath(PATH)
}
