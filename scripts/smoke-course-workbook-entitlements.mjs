import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const entitlementSource = await readFile("lib/course-workbooks.ts", "utf8")
const downloadRouteSource = await readFile("app/api/student/course-workbooks/[sku]/route.ts", "utf8")
const dashboardSource = await readFile("app/(student)/dashboard/courses/page.tsx", "utf8")

for (const number of ["01", "02", "03", "04", "05"]) {
  assert.match(entitlementSource, new RegExp(`PTP-WB${number}-DIG`))
}
assert.doesNotMatch(entitlementSource, /PTP-WB06-DIG/)
assert.match(entitlementSource, /prompt-to-profit-holiday/)
assert.match(entitlementSource, /"prompt-to-profit"/)
assert.match(entitlementSource, /batch_start_at AS batchStartAt/)
assert.match(entitlementSource, /access\.batchStarted && downloadableSkus/)
assert.match(entitlementSource, /watWallDateTimeMs/)
assert.doesNotMatch(entitlementSource, /installment/i)
assert.match(downloadRouteSource, /getStudentSession/)
assert.match(downloadRouteSource, /getIncludedPromptToProfitWorkbook/)
assert.match(downloadRouteSource, /setStudentToast/)
assert.match(downloadRouteSource, /Your workbooks will unlock when your assigned batch starts/)
assert.match(downloadRouteSource, /Cache-Control.*private, no-store/s)
assert.match(dashboardSource, /Included with your enrollment/)
assert.match(dashboardSource, /Your 5 Software Workbooks/)
assert.match(dashboardSource, /Available when batch starts/)

console.log("Course workbook entitlement smoke checks passed.")
