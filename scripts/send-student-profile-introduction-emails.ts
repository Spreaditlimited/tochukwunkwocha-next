import { prisma } from "../lib/prisma"
import {
  claimStudentProfileIntroductionDelivery,
  finishStudentProfileIntroductionDelivery,
  listStudentProfileIntroductionRecipients,
  sendStudentProfileIntroductionEmail,
  STUDENT_PROFILE_INTRODUCTION_CAMPAIGN_KEY,
  STUDENT_PROFILE_INTRODUCTION_SUBJECT,
  type ProfileIntroductionRecipient
} from "../lib/student-profile-introduction-email"

const args = new Set(process.argv.slice(2))
const shouldSend = args.has("--send")
const approvedCopy = args.has(`--approved-copy=${STUDENT_PROFILE_INTRODUCTION_CAMPAIGN_KEY}`)
const concurrency = 3

async function deliver(recipient: ProfileIntroductionRecipient) {
  if (!await claimStudentProfileIntroductionDelivery(recipient)) return { status: "skipped" as const }
  try {
    const result = await sendStudentProfileIntroductionEmail(recipient)
    await finishStudentProfileIntroductionDelivery({ accountId: recipient.accountId, status: "sent", messageId: result.messageId })
    return { status: "sent" as const }
  } catch (error) {
    await finishStudentProfileIntroductionDelivery({ accountId: recipient.accountId, status: "failed", error })
    return { status: "failed" as const, email: recipient.email, error: error instanceof Error ? error.message : String(error) }
  }
}

async function main() {
  if (shouldSend && !approvedCopy) {
    throw new Error(`Sending is locked. Include --approved-copy=${STUDENT_PROFILE_INTRODUCTION_CAMPAIGN_KEY} only after the copy is approved.`)
  }

  const recipients = await listStudentProfileIntroductionRecipients()
  const pending = recipients.filter((recipient) => recipient.deliveryStatus !== "sent" && recipient.attempts < 5)
  console.log(JSON.stringify({
    mode: shouldSend ? "approved-brevo-send" : "dry-run",
    provider: "brevo",
    campaignKey: STUDENT_PROFILE_INTRODUCTION_CAMPAIGN_KEY,
    subject: STUDENT_PROFILE_INTRODUCTION_SUBJECT,
    eligibility: "completed course enrolments and active family/school learner enrolments only; incomplete instalment plans excluded",
    eligibleRecipients: recipients.length,
    alreadySent: recipients.length - pending.length,
    pending: pending.length,
    youngOrManagedPending: pending.filter((recipient) => recipient.isYoungOrManaged).length,
    adultOrUnclassifiedPending: pending.filter((recipient) => !recipient.isYoungOrManaged).length
  }, null, 2))

  if (!shouldSend) return

  const results: Awaited<ReturnType<typeof deliver>>[] = []
  let cursor = 0
  async function worker() {
    while (cursor < pending.length) {
      const recipient = pending[cursor]
      cursor += 1
      results.push(await deliver(recipient))
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  const failures = results.filter((result): result is Extract<typeof result, { status: "failed" }> => result.status === "failed")
  console.log(JSON.stringify({
    attempted: pending.length,
    sent: results.filter((result) => result.status === "sent").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    failed: failures.length,
    failures
  }, null, 2))
  if (failures.length) process.exitCode = 1
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
