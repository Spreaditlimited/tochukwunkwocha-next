import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")

const guard = read("lib/enrollment-guard.ts")
const migration = read("prisma/migrations/20260801120000_add_course_enrollment_claims/migration.sql")
const checkout = read("lib/payments/course-checkout.ts")
const orderRoute = read("app/api/checkout/order/route.ts")
const manualRoute = read("app/api/checkout/manual-payment/route.ts")
const manualConfig = read("app/api/checkout/manual-config/route.ts")
const installmentRoute = read("app/api/checkout/installment-plan/route.ts")
const manualReview = read("lib/payments/manual-payment-review.ts")
const adminEnrollment = read("lib/admin-enrollments.ts")
const family = read("lib/family-enrollment.ts")
const groupRoute = read("app/api/student/group-enrollment/route.ts")
const batchSwitch = read("lib/student-batch-switch.ts")
const paystackWebhook = read("app/api/webhooks/paystack/route.ts")
const stripeWebhook = read("app/api/webhooks/stripe/route.ts")
const ledger = read("app/(internal)/internal/(admin)/manual-payments/page.tsx")
const checkoutForm = read("components/checkout/CourseCheckoutForm.tsx")
const groupPanel = read("components/student-dashboard/GroupEnrollmentPanel.tsx")

assert.match(migration, /CREATE TABLE IF NOT EXISTS `tochukwu_course_enrollment_claims`/)
assert.match(migration, /UNIQUE KEY `uniq_tochukwu_enrollment_claim_email_course` \(`email_key`, `course_slug`\)/)
assert.doesNotMatch(migration, /uniq_tochukwu_enrollment_claim_email_course[^\n]*batch_key/)

assert.match(guard, /class CourseEnrollmentConflictError/)
assert.match(guard, /only when both the current batch and the target batch are still in the future/)
assert.match(guard, /INSERT IGNORE INTO tochukwu_course_enrollment_claims/)
assert.match(guard, /LIMIT 1\s+FOR UPDATE/)

for (const route of [orderRoute, manualRoute, manualConfig, installmentRoute]) {
  assert.match(route, /assertNoActiveIndividualEnrollment/)
  assert.match(route, /status: 409/)
}

assert.match(checkout, /claimIndividualCourseEnrollment\(tx/)
assert.match(checkout, /status = 'duplicate_payment_review'/)
assert.match(checkout, /buyerType === "student"[\s\S]*claimIndividualCourseEnrollment\(tx/)
assert.match(manualReview, /claimIndividualCourseEnrollment\(tx/)
assert.match(manualReview, /releaseIndividualCourseEnrollmentClaim/)

assert.match(adminEnrollment, /assertNoActiveIndividualEnrollment\(\{ email, courseSlug \}\)/)
assert.match(adminEnrollment, /assertFamilyLearnersCanEnroll\(groupLearners, courseSlug\)/)
assert.match(family, /assertFamilyLearnersCanEnroll/)
assert.match(family, /sourceType: "family_child"/)
assert.match(family, /status = 'duplicate_blocked'/)
assert.match(groupRoute, /assertFamilyLearnersCanEnroll\(children, courseSlug\)/)

assert.match(batchSwitch, /export async function switchEnrollmentBatch/)
assert.match(batchSwitch, /UPDATE tochukwu_course_enrollment_claims/)
assert.match(paystackWebhook, /duplicateReview: true/)
assert.match(stripeWebhook, /duplicateReview: true/)
assert.match(ledger, /Duplicate Payment Review/)
assert.match(checkoutForm, /paymentState === "duplicate_review"/)
assert.match(checkoutForm, /requestAction\(json\?\.action\)/)
assert.match(checkoutForm, /role="alert"/)
assert.match(checkoutForm, /errorAction\.href/)
assert.doesNotMatch(groupPanel, /learner\.email|Email \(Optional\)|type="email"/)
assert.match(groupPanel, /Age \(Optional\)/)
assert.match(groupPanel, /Class or Level \(Optional\)/)

console.log("Course enrollment guard smoke test passed.")
