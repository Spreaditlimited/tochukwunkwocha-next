import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const liveSessions = fs.readFileSync(path.join(root, "lib/course-live-sessions.ts"), "utf8")
const whatsapp = fs.readFileSync(path.join(root, "lib/transactional-whatsapp.ts"), "utf8")
const publicSiteUrl = fs.readFileSync(path.join(root, "lib/public-site-url.ts"), "utf8")
const coursesPage = fs.readFileSync(path.join(root, "app/(student)/dashboard/courses/page.tsx"), "utf8")
const adminPage = fs.readFileSync(path.join(root, "app/(internal)/internal/(admin)/video-library/page.tsx"), "utf8")
const migration = fs.readFileSync(path.join(root, "prisma/migrations/20260802150000_live_session_access_window/migration.sql"), "utf8")

assert.match(
  liveSessions,
  /type LiveReminderStage = "day_before" \| "access_open"/
)
assert.match(
  liveSessions,
  /const whatsappResult = shouldSendWhatsAppReminder\(stage\)[\s\S]*sendLiveClassReminderWhatsApp/
)
assert.match(
  liveSessions,
  /function reminderStageMatchesWatDate\(session: CourseLiveSessionRow, stage: LiveReminderStage, timestampMs: number\)/
)
assert.match(
  liveSessions,
  /!reminderStageMatchesWatDate\(session, stage, now\)/
)
assert.match(
  liveSessions,
  /const LIVE_SESSION_ACCESS_MINUTES_BEFORE = 30/
)
assert.match(liveSessions, /Your live-class access link will become available in your dashboard 30 minutes before the session/)
assert.match(liveSessions, /Your live-class access link is now available/)
assert.match(whatsapp, /templateName: dayBefore \? "tochukwu_live_class_day_before" : "tochukwu_live_class_reminder"/)
assert.match(whatsapp, /templateName: dayBefore \? "tochukwu_live_class_day_before" : "tochukwu_live_class_reminder",\s*templateLanguage: dayBefore \? "en_GB" : "en"/)
assert.match(whatsapp, /templateVariables: dayBefore[\s\S]*clean\(input\.sessionTime, 80\),[\s\S]*clean\(input\.accessTime, 80\),[\s\S]*dashboardUrl/)
assert.match(whatsapp, /: \[[\s\S]*firstName\(input\.fullName\),[\s\S]*clean\(input\.sessionTitle, 160\)[\s\S]*transactionalCourseName\(input\.courseSlug\),[\s\S]*dashboardUrl\("\/dashboard\/courses"\)[\s\S]*\]/)
assert.match(whatsapp, /reminderStage: input\.stage/)
assert.match(whatsapp, /return publicAbsoluteUrl\(path\)/)
assert.match(publicSiteUrl, /isLocalHostname\(url\.hostname\)/)
assert.match(publicSiteUrl, /return PRODUCTION_SITE_URL/)
assert.doesNotMatch(whatsapp, /localhost/)
assert.doesNotMatch(liveSessions, /localhost/)
assert.match(coursesPage, /const accessOpensMs = sessionStartMs - 30 \* 60 \* 1000/)
assert.match(coursesPage, /Unlocks 30 minutes before the session/)
assert.match(adminPage, /Access opens 30 minutes before/)
assert.match(adminPage, /Day-before and 30-minute reminders enabled/)
assert.match(migration, /reminder_minutes_before` SET DEFAULT 30/)
assert.match(migration, /DATE_SUB\(`starts_at`, INTERVAL 30 MINUTE\)/)
assert.match(migration, /TIMESTAMP\(DATE\(`starts_at`\), '19:00:00'\)/)
assert.match(migration, /TIMESTAMP\(DATE\(`starts_at`\), '18:30:00'\)/)
assert.match(migration, /WHERE `course_slug` = 'prompt-to-profit-holiday'/)

console.log("Live class reminder smoke test passed.")
