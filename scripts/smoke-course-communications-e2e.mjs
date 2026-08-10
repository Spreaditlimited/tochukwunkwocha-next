import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const baseUrl = String(process.env.SMOKE_BASE_URL || "http://localhost:3100").replace(/\/$/, "")
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")

const lifecycle = read("lib/course-lifecycle-emails.ts")
const inactivity = read("lib/learning-inactivity-followups.ts")
const live = read("lib/course-live-sessions.ts")
const cron = read("vercel.json")
const actions = read("app/(internal)/internal/(admin)/learning-progress/actions.ts")
const adminPage = read("app/(internal)/internal/(admin)/learning-progress/page.tsx")
const lifecycleCron = read("app/api/cron/course-lifecycle-emails/route.ts")

assert.match(lifecycle, /welcome_48h/)
assert.match(lifecycle, /batch_switch_24h/)
assert.match(lifecycle, /lesson_release/)
assert.match(lifecycle, /role: RecipientRole/)
assert.match(lifecycle, /student-code\.local/)
assert.match(lifecycle, /uniq_course_lifecycle_recipient_stage/)
assert.match(lifecycle, /parseLifecycleRecipientEmails/)
assert.match(lifecycle, /split\(\/\[\\s,;\]\+\//)
assert.match(lifecycle, /recipientFilters\.has\(item\.recipient\.recipientEmail\)/)
assert.match(lifecycle, /for \(const item of filteredDue\) \{\s*if \(sent \+ failed >= runLimit\) break/)
assert.match(inactivity, /buildDueCampaignSnapshots\(due, now\)/)
assert.match(inactivity, /enrollmentSource: "card" \| "manual" \| "group" \| "school"/)
assert.match(live, /role: "learner" \| "group_owner"/)
assert.match(cron, /\/api\/cron\/course-lifecycle-emails/)
assert.match(lifecycleCron, /if \(!secret\) return true/)
assert.match(cron, /\/api\/cron\/learning-inactivity-followup-reconcile/)
assert.match(actions, /sendCourseLifecycleEmailsAction/)
assert.match(actions, /sendLearningFollowupsNowAction/)
assert.match(actions, /requireSendConfirmation/)
assert.match(actions, /forceLive: true/)
assert.match(adminPage, /Preview Exact Email/)
assert.match(adminPage, /Send to Selected Batch Audience/)
assert.match(adminPage, /Blank = all eligible batch recipients/)
assert.match(adminPage, /Send Due Follow-ups Now/)
assert.match(adminPage, /Lifecycle Delivery Audit/)

if (process.env.SMOKE_STATIC_ONLY === "1") {
  console.log(JSON.stringify({ ok: true, mode: "static", emailsSent: 0 }, null, 2))
  process.exit(0)
}

async function dryRun(pathname) {
  const response = await fetch(`${baseUrl}${pathname}`, { signal: AbortSignal.timeout(290_000) })
  const body = await response.json().catch(() => null)
  assert.equal(response.status, 200, `${pathname} returned ${response.status}: ${JSON.stringify(body)}`)
  assert.equal(body?.dryRun, true, `${pathname} was not forced into dry-run mode.`)
  assert.equal(body?.sent, 0, `${pathname} unexpectedly sent email.`)
  return body
}

const lifecycleResult = await dryRun("/api/cron/course-lifecycle-emails?dryRun=1")
const lessonReleaseResult = await dryRun("/api/cron/course-lifecycle-emails?dryRun=1&at=2026-08-11T05%3A30%3A00.000Z")
const inactivityResult = await dryRun("/api/cron/learning-inactivity-followups?dryRun=1")
const selectedLifecycle = lifecycleResult.preview[0]
const lifecycleFilter = new URLSearchParams({ dryRun: "1", courseSlug: selectedLifecycle.courseSlug, batchKey: selectedLifecycle.batchKey, stage: selectedLifecycle.stage, recipientEmail: selectedLifecycle.recipientEmail, limit: "10" })
const filteredLifecycleResult = await dryRun(`/api/cron/course-lifecycle-emails?${lifecycleFilter.toString()}`)
const selectedFollowup = inactivityResult.preview[0]
const followupFilter = new URLSearchParams({ dryRun: "1", recipientEmail: selectedFollowup.recipientEmail, limit: "10" })
const filteredFollowupResult = await dryRun(`/api/cron/learning-inactivity-followups?${followupFilter.toString()}`)

assert.ok(Number(lifecycleResult.due) >= 1, "No due lifecycle communication was discovered for the imminent batch.")
assert.ok(Number(inactivityResult.dueRecipients) >= 1, "No due inactivity recipient was discovered from the repaired queue.")
assert.ok(lifecycleResult.preview.length > 1, "Lifecycle run limit incorrectly collapsed to one recipient.")
assert.ok(lifecycleResult.preview.every((item) => item.subject && item.containsLocalUrl === false), "A lifecycle preview was incomplete or contained a local URL.")
assert.ok(new Set(lifecycleResult.preview.map((item) => item.recipientRole)).has("learner"), "Direct learners were missing from the lifecycle preview.")
assert.ok(new Set(lifecycleResult.preview.map((item) => item.recipientRole)).has("group_owner"), "Group owners were missing from the lifecycle preview.")
assert.ok(lessonReleaseResult.preview.some((item) => item.stage === "lesson_release" && /Day 2 lessons/i.test(item.subject)), "The Day 2 lesson-release email was not scheduled from the real module drip.")
assert.equal(filteredLifecycleResult.due, 1, "Filtered lifecycle preview did not isolate one recipient and stage.")
assert.equal(filteredFollowupResult.dueRecipients, 1, "Filtered follow-up preview did not isolate one recipient.")

console.log(JSON.stringify({
  ok: true,
  emailsSent: 0,
  lifecycleDue: lifecycleResult.due,
  lifecyclePreview: lifecycleResult.preview.slice(0, 3),
  day2LessonEmailsDue: lessonReleaseResult.due,
  inactivityDueRecipients: inactivityResult.dueRecipients
}, null, 2))
