import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")

const reconciliation = read("lib/payments/group-order-reconciliation.ts")
const paystackReconciliation = read("lib/payments/paystack-reconciliation.ts")
const provisioning = read("lib/payments/post-payment-student.ts")
const cron = read("app/api/cron/paystack-reconciliation/route.ts")
const readiness = read("app/api/internal/system/readiness/route.ts")
const migration = read("prisma/migrations/20260802170000_add_group_order_provisioning_state/migration.sql")
const vercel = read("vercel.json")

assert.match(reconciliation, /export async function reconcilePaidGroupOrders/)
assert.match(reconciliation, /co\.status = 'paid'/)
assert.match(reconciliation, /COALESCE\(co\.buyer_type, 'student'\) = 'family'/)
assert.doesNotMatch(
  reconciliation.match(/const candidates[\s\S]*?LIMIT \$\{limit\}/)?.[0] || "",
  /co\.provider\s*=/
)
assert.match(reconciliation, /ledger\.entry_type = 'purchase'/)
assert.match(reconciliation, /ledger\.source_uuid COLLATE utf8mb4_unicode_ci = co\.order_uuid COLLATE utf8mb4_unicode_ci/)
assert.match(reconciliation, /child\.status = 'pending_payment' OR enrollment\.status = 'pending_payment'/)
assert.match(reconciliation, /sendNotifications: false/)
assert.match(reconciliation, /orderStillIncomplete\(candidateUuid\)/)
assert.match(reconciliation, /status = 'processing'/)
assert.match(reconciliation, /status = 'completed'/)
assert.match(reconciliation, /status = 'failed'/)
assert.match(reconciliation, /attempts = attempts \+ 1/)
assert.match(reconciliation, /locked_at < \$\{new Date\(timestamp\.getTime\(\) - 10 \* 60_000\)\}/)

const familyProvisionIndex = provisioning.indexOf("await provisionFamilyOrder({")
const whatsappIndex = provisioning.indexOf("await sendEnrollmentConfirmedWhatsApp({")
const activationIndex = provisioning.indexOf("await sendStudentAccountReadyEmail({")
assert.ok(familyProvisionIndex >= 0, "Group seats must be provisioned")
assert.ok(familyProvisionIndex < whatsappIndex, "Group seats must be provisioned before WhatsApp")
assert.ok(familyProvisionIndex < activationIndex, "Group seats must be provisioned before activation email")
assert.match(provisioning, /sendNotifications\?: boolean/)
assert.match(provisioning, /options\?\.sendNotifications !== false \|\| !existing/)

assert.match(paystackReconciliation, /ledger\.source_uuid COLLATE utf8mb4_unicode_ci = co\.order_uuid COLLATE utf8mb4_unicode_ci/)
assert.match(paystackReconciliation, /child\.status = 'pending_payment' OR enrollment\.status = 'pending_payment'/)
assert.match(cron, /reconcileCoursePaystackOrders/)
assert.match(cron, /reconcilePaidGroupOrders\(\{ limit: 120, minimumAgeMinutes: 5 \}\)/)
assert.match(readiness, /countIncompletePaidGroupOrders\(5\)/)
assert.match(readiness, /incompletePaidOrders/)
assert.match(migration, /CREATE TABLE IF NOT EXISTS `tochukwu_group_order_provisioning_state`/)
assert.match(migration, /attempts/)
assert.match(vercel, /"path": "\/api\/cron\/paystack-reconciliation"[\s\S]*?"schedule": "\*\/10 \* \* \* \*"/)

console.log("Paid group-order reconciliation smoke test passed.")
