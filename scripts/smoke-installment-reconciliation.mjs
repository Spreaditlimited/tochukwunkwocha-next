import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8")

const checkout = read("lib/payments/course-checkout.ts")
const route = read("app/api/checkout/installment-plan/route.ts")
const paymentRoute = read("app/api/checkout/installment-payment/route.ts")
const panel = read("components/student-dashboard/InstallmentsPanel.tsx")
const listing = read("lib/student-installments.ts")
const reconciliation = read("scripts/reconcile-installment-student.mjs")

assert.match(checkout, /FOR UPDATE[\s\S]*if \(!account\.length\)/)
assert.match(checkout, /reconcileMatchingOpenInstallmentPlans/)
assert.match(checkout, /SET plan_id = \$\{canonical\.id\}/)
assert.match(checkout, /status = 'merged'/)
assert.match(checkout, /SELECT COALESCE\(SUM\(amount_minor\), 0\)/)
assert.match(checkout, /quoteInstallmentPayment/)
assert.match(checkout, /This installment plan does not belong to this account/)
assert.match(checkout, /Math\.min\(Math\.max\(100, Math\.round\(input\.amountMinor\)\), remainingMinor\)/)
assert.doesNotMatch(checkout, /autoEnrollInstallmentPlanIfEligible\(.*\)\.catch\(\(\) => null\)/)
assert.match(checkout, /status = 'enrolling'/)
assert.match(checkout, /const orderUuid = plan\.enrolled_order_uuid \|\| randomUUID\(\)/)
assert.match(checkout, /ON DUPLICATE KEY UPDATE[\s\S]*status = 'paid'/)
assert.match(route, /reusedExistingPlan: !plan\.created/)
assert.match(route, /finalAmountMinor: plan\.targetAmountMinor/)
assert.match(route, /if \(plan\.created\)[\s\S]*sendInstallmentStartedEmail/)
assert.match(paymentRoute, /const quote = await quoteInstallmentPayment/)
assert.match(paymentRoute, /amountMinor: quote\.amountMinor/)
assert.match(panel, /Existing plan found/)
assert.match(listing, /pl\.status <> 'merged'/)
assert.match(reconciliation, /if \(!apply\) return/)
assert.match(reconciliation, /Expected exactly one fully paid matching installment group/)
assert.match(reconciliation, /Automatic reconciliation refuses overpayments/)
assert.match(reconciliation, /idempotencyKey = `course_order:\$\{orderUuid\}:purchase`/)

console.log("Installment reconciliation smoke test passed.")
