import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")
const [checkout, webhook, installment, school, services, alerts, cron, reconciliation, followups, fees] = await Promise.all([
  read("lib/payments/course-checkout.ts"),
  read("app/api/webhooks/paystack/route.ts"),
  read("app/api/payments/installments/paystack/return/route.ts"),
  read("lib/payments/school-advanced.ts"),
  read("lib/discovery-booking-access.ts"),
  read("lib/payment-provider-alerts.ts"),
  read("app/api/cron/paystack-reconciliation/route.ts"),
  read("lib/payments/paystack-reconciliation.ts"),
  read("lib/abandoned-enrollment-followups.ts"),
  read("lib/payments/processing-fees.ts")
])

assert.match(checkout, /validatePaymentEmail\(input\.email\)/)
assert.match(checkout, /currency !== "NGN"/)
assert.match(checkout, /source: "initialization"/)
assert.match(checkout, /class PaystackInitializationError/)
assert.match(installment, /amountMinor: tx\.amountMinor/)
assert.match(installment, /planUuid:/)
for (const scope of ["shop_order", "domain_registration", "domain_renewal", "school_advanced", "build-discovery", "private-ai-coaching-discovery", "installment"]) {
  assert.match(webhook, new RegExp(scope.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
}
assert.match(webhook, /markInstallmentPaymentPaid\([\s\S]*amountMinor:/)
assert.match(school, /Paid amount does not match this advanced school order/)
assert.match(school, /initialization_failed/)
assert.match(services, /Paid amount does not match this build discovery payment/)
assert.match(services, /Paid amount does not match this private coaching payment/)
assert.match(alerts, /tochukwu_payment_provider_alert_claims/)
assert.match(cron, /process\.env\.NODE_ENV !== "production"/)
assert.match(reconciliation, /initialization_failed/)
assert.match(followups, /COALESCE\(TRIM\(co\.provider_reference\), ''\) <> ''/)
assert.match(fees, /PAYSTACK_FEES_PASSED_BY_DASHBOARD/)
assert.match(fees, /PAYSTACK_FEE_CAP_NGN_MINOR/)

console.log("Paystack hardening smoke checks passed.")
