import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const [service, actions, page, financials, migration] = await Promise.all([
  readFile(new URL("../lib/payment-refunds.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/(internal)/internal/(admin)/manual-payments/actions.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/(internal)/internal/(admin)/manual-payments/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/admin-financials.ts", import.meta.url), "utf8"),
  readFile(new URL("../prisma/migrations/20260812120000_course_payment_refunds/migration.sql", import.meta.url), "utf8")
])

assert.match(service, /UNIQUE KEY uniq_tochukwu_course_refund_payment \(source_type, payment_uuid\)/)
assert.doesNotMatch(service, /Group-payment refunds require a seat-ledger reversal/)
assert.match(service, /ledger\.entry_type = 'purchase'/)
assert.match(service, /SET status = 'refunded', updated_at/)
assert.match(service, /'refund',[\s\S]*revoked_child_ids/)
assert.match(service, /seats_purchased = GREATEST\(0, seats_purchased -/)
assert.match(service, /source_type = 'family_child'[\s\S]*source_uuid IN/)
assert.match(service, /source: "group_payment_refund"/)
assert.match(service, /studentSession\.deleteMany/)
assert.match(service, /status = 'refunded'/)
assert.match(actions, /recordCoursePaymentRefundAction/)
assert.match(page, /Record Full Refund/)
assert.match(page, /value: "refunded", label: "Refunded"/)
assert.match(service, /payment_uuid VARCHAR\(100\) NOT NULL/)
assert.match(page, /Refund recorded/)
assert.match(await readFile(new URL("../lib/admin-enrollments.ts", import.meta.url), "utf8"), /r\.payment_uuid COLLATE utf8mb4_unicode_ci = course_manual_payments\.payment_uuid COLLATE utf8mb4_unicode_ci/)
assert.match(financials, /'course_refund'/)
assert.match(financials, /-r\.amount_minor/)
assert.match(migration, /tochukwu_course_payment_refunds/)

console.log("Course refund workflow smoke checks passed.")
