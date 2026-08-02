import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")

const migration = read("prisma/migrations/20260731131000_add_paystack_payment_audit/migration.sql")
const audit = read("lib/payments/paystack-audit.ts")
const reconciliation = read("lib/payments/paystack-reconciliation.ts")
const webhook = read("app/api/webhooks/paystack/route.ts")
const paystackReturn = read("app/api/payments/paystack/return/route.ts")
const adminPayments = read("lib/admin-enrollments.ts")
const enrollmentPage = read("app/(internal)/internal/(admin)/manual-payments/page.tsx")
const actions = read("app/(internal)/internal/(admin)/manual-payments/actions.ts")
const checkout = read("lib/payments/course-checkout.ts")
const adminSettings = read("lib/admin-settings.ts")

assert.match(migration, /CREATE TABLE IF NOT EXISTS `tochukwu_paystack_payment_events`/)
assert.match(migration, /expected_amount_minor/)
assert.match(migration, /received_amount_minor/)

assert.match(audit, /validateCourseOrderPaystackPayment/)
assert.match(audit, /receivedAmountMinor !== expected\.expectedAmountMinor/)
assert.match(audit, /receivedCurrency !== expected\.expectedCurrency/)
assert.match(audit, /receivedReference !== expected\.providerReference/)
assert.match(audit, /payment event/)

assert.match(reconciliation, /stillProcessing/)
assert.match(reconciliation, /mismatched/)
assert.match(reconciliation, /inspectPaystackTransaction/)
assert.match(reconciliation, /recordPaystackAuditEvent/)
assert.match(reconciliation, /MISSING_PAYSTACK_REFERENCE_GRACE_MS = 24 \* 60 \* 60 \* 1000/)
assert.match(reconciliation, /TERMINAL_PAYSTACK_STATUSES = new Set\(\["abandoned", "failed", "reversed"\]\)/)
assert.match(reconciliation, /isPaystackTransactionNotFound\(error\)/)
assert.match(reconciliation, /markOrderTerminal\(orderUuid, "abandoned"\)/)
assert.match(reconciliation, /NOT IN \('duplicate_payment_review', 'abandoned', 'failed', 'reversed', 'expired', 'cancelled'\)/)
assert.match(checkout, /class PaystackVerificationRequestError extends Error/)
assert.match(checkout, /error\.code === "transaction_not_found"/)
assert.match(checkout, /if \(isPaystackTransactionNotFound\(requestError\)\) throw requestError/)
assert.match(checkout, /getAdminSettingValues\(\["PAYSTACK_SECRET_KEY"\]\)/)
assert.match(checkout, /const secrets = Array\.from\(new Set/)
assert.match(checkout, /missingReference && index < secrets\.length - 1/)
assert.match(checkout, /signal: AbortSignal\.timeout\(10_000\)/)
assert.match(adminSettings, /\["PAYSTACK_SECRET_KEY", "PAYSTACK_PUBLIC_KEY"\]\.includes\(row\.settingKey\)/)

assert.match(webhook, /event === "charge\.success" \? "received" : "ignored"/)
assert.match(webhook, /validateCourseOrderPaystackPayment/)
assert.match(paystackReturn, /validateCourseOrderPaystackPayment/)

assert.match(adminPayments, /provider_processing/)
assert.match(adminPayments, /tochukwu_paystack_payment_events/)
assert.match(enrollmentPage, /Awaiting Paystack/)
assert.match(enrollmentPage, /Paystack is still processing/)
assert.match(enrollmentPage, /Reconcile Paystack/)
assert.match(actions, /still processing/)
assert.match(actions, /amount or currency mismatch/)

console.log("Paystack observability smoke test passed.")
