import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8")

const checkout = read("lib/payments/course-checkout.ts")
const family = read("lib/family-enrollment.ts")
const dashboard = read("lib/student-dashboard.ts")
const adminForm = read("app/(internal)/internal/(admin)/manual-payments/AddExternalStudentForm.tsx")
const publicCourseSettings = read("lib/public-course-settings.ts")
const promptToProfitPage = read("components/courses/PromptToProfitCoursePage.tsx")
const utils = read("lib/utils.ts")

assert.match(utils, /export function batchHasNotStarted\(/)
assert.match(utils, /startTimeMs > currentTimeMs/)
assert.match(checkout, /cb\.batch_start_at IS NOT NULL/)
assert.match(checkout, /cb\.batch_start_at > DATE_ADD\(UTC_TIMESTAMP\(\), INTERVAL 1 HOUR\)/)
assert.match(checkout, /function assertBatchHasNotStarted/)
assert.match(checkout, /assertBatchHasNotStarted\(input\.batch\)/)
assert.match(family, /batch_start_at AS batchStartAt/)
assert.match(family, /has already started and is no longer available for enrollment/)
assert.match(dashboard, /b\.batch_start_at > DATE_ADD\(UTC_TIMESTAMP\(\), INTERVAL 1 HOUR\)/)
assert.match(adminForm, /batchHasNotStarted\(batch\.batchStartAt\)/)
assert.match(publicCourseSettings, /const batches = await listCheckoutBatches\(course\.courseSlug\)/)
assert.match(publicCourseSettings, /status\.toLowerCase\(\) === "open"/)
assert.match(promptToProfitPage, /openBatches\.map\(\(batch\) =>/)
assert.match(promptToProfitPage, /function batchSequence\(value: string\)/)
assert.match(promptToProfitPage, /batchSequence\(left\.batchLabel \|\| left\.batchKey\) - batchSequence\(right\.batchLabel \|\| right\.batchKey\)/)
assert.match(promptToProfitPage, /sm:grid-cols-2/)
assert.match(promptToProfitPage, /formatDateTimeWAT\(batch\.batchStartAt\)/)
assert.match(promptToProfitPage, /There are no future batches available for enrollment right now\./)

console.log("Batch enrollment cutoff smoke test passed.")
