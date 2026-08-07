import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createJiti } from "jiti"

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")
const engineSource = read("lib/learning-inactivity-followups.ts")
const snapshotSource = read("lib/learning-progress-snapshots.ts")
const playerSource = read("components/student-dashboard/player/CoursePlayer.tsx")
const cronSource = read("app/api/cron/learning-inactivity-followups/route.ts")
const pauseSource = read("app/api/learning-follow-up/pause/route.ts")
const clickSource = read("app/api/learning-follow-up/click/route.ts")
const webhookSource = read("app/api/webhooks/brevo/learning-followups/route.ts")
const migration = read("prisma/migrations/20260806100000_add_learning_inactivity_followups/migration.sql")
const vercel = read("vercel.json")

assert.match(snapshotSource, /FROM course_orders o/)
assert.match(snapshotSource, /FROM course_manual_payments m/)
assert.match(snapshotSource, /FROM family_child_enrollments e/)
assert.match(snapshotSource, /b\.batch_start_at IS NOT NULL/)
assert.match(snapshotSource, /batchStartMs > nowMs/)
assert.match(snapshotSource, /tochukwu_learning_module_batch_drips/)
assert.match(engineSource, /inactivityDays: boundedLearningFollowupNumber[\s\S]*7/)
assert.match(engineSource, /campaignMonths: boundedLearningFollowupNumber[\s\S]*3/)
assert.match(engineSource, /maxReminders: boundedLearningFollowupNumber[\s\S]*13/)
assert.match(engineSource, /recipientRecentlyContacted/)
assert.match(engineSource, /delivery_group_uuid/)
assert.match(engineSource, /learning-inactivity-followup/)
assert.match(engineSource, /Pause .* progress reminders/)
assert.match(playerSource, /embed\.cloudflarestream\.com\/embed\/sdk\.latest\.js/)
assert.match(playerSource, /playbackActiveRef\.current/)
assert.match(playerSource, /addEventListener\("playing"/)
assert.match(cronSource, /CRON_SECRET/)
assert.match(cronSource, /Learning follow-up processing failed\./)
assert.match(pauseSource, /Course reminders paused/)
assert.match(clickSource, /recordLearningFollowupClick/)
assert.match(webhookSource, /x-learning-followup-secret/)
assert.match(engineSource, /recipient_suppressed/)
assert.match(engineSource, /configureBrevoLearningFollowupWebhook/)
assert.match(engineSource, /hardBounce/)
assert.match(migration, /UNIQUE KEY `uniq_learning_followup_campaign_cycle`/)
assert.match(vercel, /\/api\/cron\/learning-inactivity-followups/)

process.env.AUTH_SECRET ||= "learning-followup-smoke-secret"
const jiti = createJiti(path.join(root, "scripts", "smoke-learning-inactivity-followups.mjs"), { alias: { "@": root } })
const { boundedLearningFollowupNumber, learningFollowupDecision, renderLearningFollowupEmail } = await jiti.import("../lib/learning-inactivity-followups.ts")
assert.equal(boundedLearningFollowupNumber("", 7, 1, 30), 7)
assert.equal(boundedLearningFollowupNumber("0", 7, 1, 30), 1)
assert.equal(boundedLearningFollowupNumber("90", 7, 1, 30), 30)

const baseline = new Date("2026-08-03T19:00:00.000Z")
const baseInput = {
  now: new Date("2026-08-10T18:59:59.000Z"),
  batchStartAt: baseline,
  enrolledAt: new Date("2026-08-01T12:00:00.000Z"),
  lastActivityAt: null,
  lastReminderAt: null,
  totalLessons: 14,
  remainingLessons: 14,
  resumeLessonId: 1,
  certificateIssued: false,
  recipientPaused: false,
  adminPaused: false,
  inactivityDays: 7,
  campaignMonths: 3
}
const first = learningFollowupDecision(baseInput)
assert.equal(first.status, "active")
assert.equal(first.nextReminderAt.toISOString(), "2026-08-10T19:00:00.000Z")
assert.equal(first.endsAt.toISOString(), "2026-11-03T19:00:00.000Z")

const recentlyActive = learningFollowupDecision({ ...baseInput, lastActivityAt: new Date("2026-08-09T10:00:00.000Z") })
assert.equal(recentlyActive.nextReminderAt.toISOString(), "2026-08-16T10:00:00.000Z")
assert.equal(learningFollowupDecision({ ...baseInput, remainingLessons: 0 }).status, "completed")
assert.equal(learningFollowupDecision({ ...baseInput, resumeLessonId: null }).status, "waiting")
assert.equal(learningFollowupDecision({ ...baseInput, recipientPaused: true }).status, "paused")
assert.equal(learningFollowupDecision({ ...baseInput, now: new Date("2026-11-03T19:00:00.000Z") }).status, "expired")

const snapshot = {
  accountId: 1n,
  learnerName: "Olamiposi <script>",
  recipientName: "Oluwakemi",
  recipientEmail: "parent@example.com",
  courseSlug: "prompt-to-profit-holiday",
  courseName: "Prompt to Profit Holiday",
  batchKey: "ptph-batch-1",
  batchLabel: "Batch 1",
  batchStartAt: baseline,
  enrolledAt: baseline,
  enrollmentSource: "group",
  totalLessons: 14,
  releasedLessons: 14,
  completedLessons: 8,
  remainingLessons: 6,
  completionPercent: 57,
  lastActivityAt: new Date("2026-08-03T20:00:00.000Z"),
  lastLessonId: 2,
  lastLessonTitle: "Website Structure",
  resumeLessonId: 3,
  resumeLessonTitle: "Website Styling",
  proofStatus: "",
  certificateIssued: false
}
const rendered = renderLearningFollowupEmail({ snapshots: [snapshot], reminderNumber: 2, deliveryGroupUuid: "lfg_smoke" })
assert.match(rendered.html, /Continue Your Course/)
assert.match(rendered.html, /8 of 14 lessons/)
assert.match(rendered.html, /Olamiposi &lt;script&gt;/)
assert.doesNotMatch(rendered.html, /localhost/)
assert.match(rendered.text, /Pause prompt-to-profit-holiday progress reminders/)
assert.match(rendered.text, /certificate is backed by what you built/)

console.log("Learning inactivity follow-up smoke test passed.")
