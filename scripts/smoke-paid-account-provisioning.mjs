import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")

const gitignore = read(".gitignore")
const admin = read("lib/admin-enrollments.ts")
const actions = read("app/(internal)/internal/(admin)/manual-payments/actions.ts")
const page = read("app/(internal)/internal/(admin)/manual-payments/page.tsx")
const provisionForm = read("app/(internal)/internal/(admin)/manual-payments/ProvisionMissingAccountsForm.tsx")
const activationForm = read("app/(internal)/internal/(admin)/manual-payments/ActivationEmailForm.tsx")
const paystackReturn = read("app/api/payments/paystack/return/route.ts")
const paystackWebhook = read("app/api/webhooks/paystack/route.ts")
const stripeReturn = read("app/api/payments/stripe/return/route.ts")
const stripeWebhook = read("app/api/webhooks/stripe/route.ts")
const provisioning = read("lib/payments/post-payment-student.ts")
const internalToaster = read("components/internal/InternalActionToaster.tsx")
const internalToast = read("lib/internal-toast.ts")

assert.match(gitignore, /^deliverables\/proposals\/$/m)
assert.match(admin, /export async function resendPaidEnrollmentActivationEmail/)
assert.match(admin, /export async function provisionAllMissingPaidEnrollmentAccounts/)
assert.match(admin, /co\.email COLLATE utf8mb4_0900_ai_ci/)
assert.match(admin, /IN \('paystack', 'stripe'\)/)
assert.match(admin, /index \+= 2/)
assert.match(actions, /provisionMissingPaidEnrollmentAccountsAction/)
assert.match(actions, /provisionAllMissingPaidEnrollmentAccounts\(\{ limit: 8 \}\)/)
assert.match(page, /ProvisionMissingAccountsForm/)
assert.match(page, /ActivationEmailForm/)
assert.match(page, /Account missing/)
assert.match(provisionForm, /Provision Missing Accounts/)
assert.match(provisionForm, /data-toast-managed="true"/)
assert.match(provisionForm, /pending \? "Creating account\.\.\."/)
assert.match(activationForm, /Provision & Send Activation/)
assert.match(activationForm, /pending \? "Sending\.\.\."/)
assert.match(activationForm, /data-toast-managed="true"/)
assert.match(actions, /Account created and Activation Email sent\./)

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
assert.match(internalToaster, /setTimeout\(\(\) => setToast\(null\), 5000\)/)
assert.match(internalToaster, /data-toast-managed/)
assert.doesNotMatch(internalToaster, /Completion report not received/)
assert.match(internalToast, /maxAge: 60/)

console.log("Paid enrollment account provisioning smoke test passed.")
