"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { upsertAdminSettings } from "@/lib/admin-settings"
import { requireAdmin } from "@/lib/auth"
import {
  configureBrevoLearningFollowupWebhook,
  processLearningInactivityFollowups,
  retryLearningFollowupCampaign,
  setLearningFollowupCampaignPaused
} from "@/lib/learning-inactivity-followups"
import { setInternalToast } from "@/lib/internal-toast"

const PATH = "/internal/learning-progress"

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

export async function previewLearningFollowupsAction() {
  await requireAdmin(PATH)
  let destination = `${PATH}?previewState=error`
  try {
    const result = await processLearningInactivityFollowups({ forceDryRun: true })
    const message = `${result.dueRecipients} recipient${result.dueRecipients === 1 ? " is" : "s are"} currently due. No email was sent.`
    await setInternalToast({ title: "Safe preview completed", message })
    destination = `${PATH}?previewState=success&previewDue=${encodeURIComponent(String(result.dueRecipients))}&previewAt=${encodeURIComponent(new Date().toISOString())}#learning-followup-email-preview`
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
