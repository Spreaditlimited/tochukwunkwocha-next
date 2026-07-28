import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8")

const component = read("app/(internal)/internal/(admin)/manual-payments/ExternalGroupAssignmentFields.tsx")
const action = read("app/(internal)/internal/(admin)/manual-payments/actions.ts")
const enrollments = read("lib/admin-enrollments.ts")
const review = read("lib/payments/manual-payment-review.ts")
const family = read("lib/family-enrollment.ts")

assert.match(component, /name="groupLearnersJson"/)
assert.match(component, /Any remaining seats stay available for the parent/)
assert.match(component, /learners\.length >= seatCount/)
assert.match(action, /groupLearnersJson/)
assert.match(action, /seatsAvailable/)
assert.match(enrollments, /familyEnrollmentEnabledForCourse/)
assert.match(enrollments, /savePendingFamilyChildren/)
assert.match(enrollments, /saved\.length !== groupLearners\.length/)
assert.match(enrollments, /review\.familyProvisioned/)
assert.match(review, /returnApprovedPaymentToPending/)
assert.match(review, /status = 'pending_verification'/)
assert.match(review, /if \(!familyProvisioned\.ok\)/)
assert.match(review, /\[ACTIVATION_EMAIL_FAILED\]/)
assert.match(family, /entry_type, quantity, source_type/)
assert.match(family, /SET seats_consumed = LEAST\(seats_purchased, seats_consumed \+/)

console.log("Admin group enrollment smoke test passed.")
