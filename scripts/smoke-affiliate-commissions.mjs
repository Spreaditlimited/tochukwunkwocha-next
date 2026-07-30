import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import ts from "typescript"

const root = process.cwd()
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8")

const checkout = read("lib/payments/course-checkout.ts")
const manualReview = read("lib/payments/manual-payment-review.ts")
const adminEnrollment = read("lib/admin-enrollments.ts")
const adminForm = read("app/(internal)/internal/(admin)/manual-payments/AddExternalStudentForm.tsx")
const cron = read("app/api/cron/affiliate-commissions/route.ts")
const capture = read("components/AffiliateReferralCapture.tsx")
const migration = read("prisma/migrations/20260730120000_affiliate_commissions_per_seat/migration.sql")
const calculatorSource = read("lib/affiliate-commission-calculator.ts")

const calculatorModule = { exports: {} }
const calculatorJavaScript = ts.transpileModule(calculatorSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText
new Function("exports", "module", calculatorJavaScript)(calculatorModule.exports, calculatorModule)
const { buildAffiliateSeatCommissions } = calculatorModule.exports

assert.match(migration, /seat_number/)
assert.match(migration, /seat_count/)
assert.match(migration, /uniq_tochukwu_aff_commission_order_seat/)
assert.doesNotMatch(migration, /CREATE TABLE(?![\s\S]*tochukwu_)/)

assert.match(checkout, /buildAffiliateSeatCommissions/)
assert.match(checkout, /ON DUPLICATE KEY UPDATE[\s\S]*seat_count = VALUES\(seat_count\)/)
assert.match(checkout, /transferInstallmentAffiliateAttribution/)
assert.match(checkout, /await createAffiliateCommissionForOrder\(orderUuid\)/)
assert.match(checkout, /reconcileAffiliateCommissions/)
assert.match(checkout, /commission_creation_failed/)

assert.doesNotMatch(manualReview, /async function createAffiliateCommissionForOrder/)
assert.match(manualReview, /createAffiliateCommissionForOrder\(paymentUuid\)/)
assert.match(manualReview, /AFFILIATE_COMMISSION_RETRY_REQUIRED/)

assert.match(adminForm, /name="affiliateCode"/)
assert.match(adminEnrollment, /recordAffiliateAttribution/)
assert.match(adminEnrollment, /The affiliate could not be attached/)
assert.match(adminEnrollment, /DELETE FROM tochukwu_affiliate_attributions/)

assert.match(cron, /reconcileAffiliateCommissions/)
assert.match(capture, /AFFILIATE_REF_TTL_MS = 30/)
assert.match(capture, /params\.get\("affiliateCode"\)/)

const fixedGroup = buildAffiliateSeatCommissions({
  orderAmountMinor: 2_150_000,
  seatCount: 5,
  commissionType: "fixed",
  commissionValue: 150_000
})
assert.equal(fixedGroup.length, 5)
assert.equal(fixedGroup.reduce((sum, seat) => sum + seat.seatAmountMinor, 0), 2_150_000)
assert.equal(fixedGroup.reduce((sum, seat) => sum + seat.commissionAmountMinor, 0), 750_000)
assert.deepEqual(fixedGroup.map((seat) => seat.seatNumber), [1, 2, 3, 4, 5])

const single = buildAffiliateSeatCommissions({
  orderAmountMinor: 1_075_000,
  seatCount: 1,
  commissionType: "fixed",
  commissionValue: 150_000
})
assert.equal(single.length, 1)
assert.equal(single[0].commissionAmountMinor, 150_000)

const percentageGroup = buildAffiliateSeatCommissions({
  orderAmountMinor: 1_000,
  seatCount: 3,
  commissionType: "percentage",
  commissionValue: 1_000
})
assert.deepEqual(percentageGroup.map((seat) => seat.seatAmountMinor), [334, 333, 333])
assert.deepEqual(percentageGroup.map((seat) => seat.commissionAmountMinor), [33, 33, 33])

console.log("Affiliate commission smoke test passed.")
