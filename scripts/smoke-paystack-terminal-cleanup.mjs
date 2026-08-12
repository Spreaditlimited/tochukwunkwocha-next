import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const [reconciliation, abandoned, cron] = await Promise.all([
  readFile(new URL("../lib/payments/paystack-reconciliation.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/abandoned-enrollment-followups.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/api/cron/paystack-reconciliation/route.ts", import.meta.url), "utf8")
])

assert.match(reconciliation, /status IN \('failed', 'abandoned', 'reversed'\)/)
assert.match(reconciliation, /updated_at < DATE_SUB\(NOW\(\), INTERVAL \$\{minimumAgeHours\} HOUR\)/)
assert.match(reconciliation, /successful\.outcome IN \('verified', 'provisioned'\)/)
assert.match(reconciliation, /stopped_reason = 'terminal_payment_cleanup'/)
assert.match(reconciliation, /child\.status = 'pending_payment'/)
assert.match(reconciliation, /terminalOrdersDeleted/)
assert.doesNotMatch(reconciliation, /co\.status IN \('pending'/)
assert.match(abandoned, /Paystack verification was unavailable; the reminder was deferred/)
assert.match(cron, /reconcileCoursePaystackOrders/)

console.log("Paystack terminal cleanup smoke checks passed.")
