import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { createJiti } from "jiti"

process.env.NEXT_PUBLIC_SITE_URL = "https://www.tochukwunkwocha.com"
process.env.MARKETING_EMAIL_PREFERENCES_SECRET = "newsletter-smoke-secret"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")
const jiti = createJiti(import.meta.url, { alias: { "@": root } })
const { practicalAiNewsletterContent } = await jiti.import("../lib/practical-ai-newsletter-content.ts")
const {
  practicalAiNewsletterUnsubscribeToken,
  renderPracticalAiNewsletterEmail,
  verifyPracticalAiNewsletterUnsubscribeToken
} = await jiti.import("../lib/practical-ai-newsletter.ts")

assert.equal(practicalAiNewsletterContent.length, 52)
assert.deepEqual(practicalAiNewsletterContent.map((email) => email.week), Array.from({ length: 52 }, (_, index) => index + 1))
assert.equal(new Set(practicalAiNewsletterContent.map((email) => email.key)).size, 52)
assert.ok(practicalAiNewsletterContent.every((email) => email.subject && email.preheader && email.paragraphs.length >= 3))
assert.ok(practicalAiNewsletterContent.every((email) => email.primaryLabel && email.primaryPath))

const combined = practicalAiNewsletterContent.map((email) => email.paragraphs.join(" ")).join("\n")
assert.doesNotMatch(combined, /use this prompt|copy this prompt|paste this prompt|here is the prompt/i)
assert.doesNotMatch(combined, /<script|```|CREATE TABLE|function\s*\(/i)

const youngProjects = practicalAiNewsletterContent.filter((email) => email.project?.youngLearner)
assert.ok(youngProjects.length >= 3)
assert.ok(youngProjects.some((email) => email.project?.title === "Bear & Harvest: Cozy Kitchen"))
assert.ok(youngProjects.some((email) => email.project?.title === "Wellness Garden"))
assert.ok(youngProjects.some((email) => email.project?.title === "SmartStock"))

const rendered = renderPracticalAiNewsletterEmail({
  content: practicalAiNewsletterContent[13],
  recipientName: "Ada <script>",
  recipientEmail: "ada@example.com"
})
assert.match(rendered.html, /Hello Ada,/)
assert.doesNotMatch(rendered.html, /<script>/)
assert.match(rendered.html, /Young Learner Project/)
assert.match(rendered.html, /Stop receiving these weekly notes/)
assert.match(rendered.primaryUrl, /utm_campaign=practical_ai_52_week_newsletter/)
assert.doesNotMatch(`${rendered.html}\n${rendered.text}`, /localhost|127\.0\.0\.1/)

const token = practicalAiNewsletterUnsubscribeToken("ada@example.com", new Date(Date.now() + 60_000))
assert.equal(verifyPracticalAiNewsletterUnsubscribeToken(token), "ada@example.com")
assert.equal(verifyPracticalAiNewsletterUnsubscribeToken(`${token}broken`), "")

const cron = read("app/api/cron/practical-ai-newsletter/route.ts")
const vercel = read("vercel.json")
const migration = read("prisma/migrations/20260919170000_practical_ai_newsletter/migration.sql")
assert.match(cron, /authorization.*Bearer/)
assert.match(cron, /processPracticalAiNewsletter/)
assert.match(vercel, /\/api\/cron\/practical-ai-newsletter/)
assert.match(migration, /uniq_practical_ai_newsletter_week/)
assert.match(migration, /tochukwu_practical_ai_newsletter_preferences/)

console.log("Practical AI 52-week newsletter smoke test passed.")
