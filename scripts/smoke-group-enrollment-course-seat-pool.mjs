import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const familyEnrollment = await readFile("lib/family-enrollment.ts", "utf8")
const dashboardData = await readFile("lib/student-dashboard.ts", "utf8")
const panel = await readFile("components/student-dashboard/GroupEnrollmentPanel.tsx", "utf8")
const followups = await readFile("lib/abandoned-enrollment-followups.ts", "utf8")
const route = await readFile("app/api/student/group-enrollment/route.ts", "utf8")

assert.match(
  familyEnrollment,
  /familyCourseSeatRows\(tx, family\.id, courseSlug, undefined, true\)/,
  "Existing learner assignments must lock the whole course seat pool, not only the selected batch."
)
assert.match(familyEnrollment, /capacityCreditsByBatch/)
assert.match(familyEnrollment, /balancesForConsumption/)
assert.match(dashboardData, /'Course-level seat pool' AS batchLabel/)
assert.match(dashboardData, /GROUP BY course_slug/)
assert.match(panel, /const courseSeatPool = seats\.filter/)
assert.match(panel, /courseSeatPool\.reduce\(\(total, seat\) => total \+ seat\.seatsAvailable, 0\)/)
assert.doesNotMatch(panel, /selectedSeat\?\.seatsAvailable/)
assert.match(panel, /!hasAvailableSeat \? \(\s*<label className="block">\s*<span[^>]*>Billing Region/s)
assert.match(panel, /!hasAvailableSeat \? <div className="rounded-xl border border-primary\/20 bg-primary\/5 p-5">/)
assert.match(panel, /disabled=\{hasAvailableSeat && learners\.length >= availableSeats\}/)
assert.match(route, /availableFamilySeatsForCourse/)
assert.match(route, /Assign your available learner seats before purchasing another seat/)
assert.match(followups, /'cancelled', 'canceled', 'abandoned', 'failed', 'reversed', 'expired'/)
assert.match(followups, /order_not_payable/)

console.log("Group enrollment course-level seat-pool smoke checks passed.")
