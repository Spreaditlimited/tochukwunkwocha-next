import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")

const gitignore = read(".gitignore")
const admin = read("lib/admin-enrollments.ts")
const actions = read("app/(internal)/internal/(admin)/manual-payments/actions.ts")
const page = read("app/(internal)/internal/(admin)/manual-payments/page.tsx")
const paystackReturn = read("app/api/payments/paystack/return/route.ts")
const paystackWebhook = read("app/api/webhooks/paystack/route.ts")
const stripeReturn = read("app/api/payments/stripe/return/route.ts")
const stripeWebhook = read("app/api/webhooks/stripe/route.ts")
const provisioning = read("lib/payments/post-payment-student.ts")

assert.match(gitignore, /^deliverables\/proposals\/$/m)
assert.match(admin, /export async function resendPaidEnrollmentActivationEmail/)
assert.match(admin, /export async function provisionAllMissingPaidEnrollmentAccounts/)
assert.match(admin, /co\.email COLLATE utf8mb4_0900_ai_ci/)
assert.match(admin, /IN \('paystack', 'stripe'\)/)
assert.match(admin, /index \+= 2/)
assert.match(actions, /provisionMissingPaidEnrollmentAccountsAction/)
assert.match(actions, /provisionAllMissingPaidEnrollmentAccounts\(\{ limit: 8 \}\)/)
assert.match(page, /Provision Missing Accounts/)
assert.match(page, /Processes up to 8 missing accounts per run/)
assert.match(page, /Provision & Send Activation/)
assert.match(page, /Account missing/)

for (const source of [paystackReturn, paystackWebhook, stripeReturn, stripeWebhook]) {
  const provisionIndex = source.indexOf("await provisionStudentForPaidOrder")
  const commissionCallIndex = source.indexOf("createAffiliateCommissionForOrder(", provisionIndex)
  assert.ok(provisionIndex >= 0, "Provider completion must provision the student account")
  assert.ok(commissionCallIndex > provisionIndex, "Affiliate processing must happen after account provisioning")
}
assert.match(paystackWebhook, /createSession: false/)
assert.match(stripeWebhook, /createSession: false/)
assert.ok(
  provisioning.indexOf("sendStudentAccountReadyEmail({") < provisioning.indexOf("await createStudentSessionForAccount(account)"),
  "Activation delivery must not depend on automatic session creation"
)
assert.match(provisioning, /automatic sign-in session failed/)

console.log("Paid enrollment account provisioning smoke test passed.")
