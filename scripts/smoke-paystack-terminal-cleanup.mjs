import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const [reconciliation, abandoned, cron] = await Promise.all([
  readFile(new URL("../lib/payments/paystack-reconciliation.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/abandoned-enrollment-followups.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/api/cron/paystack-reconciliation/route.ts", import.meta.url), "utf8")
])

assert.match(reconciliation, /SET status = 'failed'/)
assert.doesNotMatch(reconciliation, /SET status = \$\{terminalStatus\}/)
assert.match(reconciliation, /updated_at < DATE_SUB\(NOW\(\), INTERVAL \$\{minimumAgeHours\} HOUR\)/)
assert.match(reconciliation, /successful\.outcome IN \('verified', 'provisioned'\)/)
assert.match(reconciliation, /stopped_reason = 'terminal_payment_cleanup'/)
assert.match(reconciliation, /child\.status = 'pending_payment'/)
assert.match(reconciliation, /terminalOrdersDeleted/)
assert.match(reconciliation, /co\.status IN \('pending', 'initializing'\)/)
assert.match(reconciliation, /'initialization_failed'/)
assert.match(abandoned, /Paystack verification was unavailable; the reminder was deferred/)
assert.match(abandoned, /historical_retry_suppressed/)
assert.match(abandoned, /reconciliation_configuration_error/)
assert.match(cron, /reconcileCoursePaystackOrders/)
assert.match(cron, /acquireAutomationLease/)
assert.match(cron, /reconciliation_already_running/)

console.log("Paystack terminal cleanup smoke checks passed.")
