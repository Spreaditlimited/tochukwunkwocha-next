import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8")
const migration = read("prisma/migrations/20260922120000_add_2027_course_cohorts/migration.sql")
const checkout = read("lib/payments/course-checkout.ts")
const advancedPage = read("components/courses/PromptToProfitAdvancedCoursePage.tsx")
const courseRoute = read("app/(public)/courses/[slug]/page.tsx")

const expected = [
  ["ptp-2027-easter", "2027-04-19", "2027-04-23"],
  ["ptp-2027-august-1", "2027-08-02", "2027-08-06"],
  ["ptp-2027-august-2", "2027-08-09", "2027-08-13"],
  ["ptp-2027-august-3", "2027-08-16", "2027-08-20"],
  ["ptp-2027-august-4", "2027-08-23", "2027-08-27"],
  ["ptprod-2027-february", "2027-02-06", "2027-02-27"],
  ["ptprod-2027-may", "2027-05-01", "2027-05-22"],
  ["ptprod-2027-july", "2027-07-03", "2027-07-24"],
  ["ptprod-2027-november", "2027-11-06", "2027-11-27"]
]

for (const [batchKey, start, end] of expected) {
  assert.ok(migration.includes(`'${batchKey}'`), `Missing cohort ${batchKey}.`)
  assert.ok(migration.includes(`TIMESTAMP('${start}', '19:00:00')`), `Wrong 7 p.m. WAT start for ${batchKey}.`)
  assert.ok(migration.includes(`TIMESTAMP('${end}', '23:59:59')`), `Wrong end date for ${batchKey}.`)
}

assert.match(migration, /ADD COLUMN `batch_end_at` DATETIME NULL/)
assert.match(migration, /source_drip\.batch_key = 'ptp-batch-4'/)
assert.match(migration, /source_drip\.batch_key = 'ptprod-batch-1'/)
assert.match(migration, /`reminder_enabled`[\s\S]*NULL, NULL, NULL, 1, 0, 30/)
assert.match(checkout, /cb\.status = 'open'/)
assert.match(checkout, /ORDER BY cb\.batch_start_at ASC/)
assert.match(checkout, /LIMIT 1/)
assert.match(checkout, /batchEndAt/)
assert.doesNotMatch(advancedPage, /October Cohort Enrolling/)
assert.match(advancedPage, /cohortEnrollmentLabel/)
assert.match(advancedPage, /formatCohortDateRange/)
assert.match(courseRoute, /courseSettings=\{courseSettings\}/)

console.log("2027 cohort schedule smoke test passed.")
