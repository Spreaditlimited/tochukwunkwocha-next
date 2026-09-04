import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")

const onboarding = read("lib/affiliate-onboarding.ts")
const migration = read("prisma/migrations/20260904120000_public_affiliate_onboarding/migration.sql")
const registrationAction = read("app/(affiliate-auth)/affiliate/actions.ts")
const registrationPage = read("app/(affiliate-auth)/affiliate/register/page.tsx")
const activationPage = read("app/(affiliate-auth)/affiliate/activate/page.tsx")
const resetPage = read("app/(affiliate-auth)/affiliate/reset-password/page.tsx")
const resetForm = read("components/student-dashboard/PasswordResetForm.tsx")
const resetRequest = read("app/api/student/password-reset/request/route.ts")
const partnerPage = read("app/(public)/affiliate/page.tsx")
const dashboard = read("lib/student-dashboard.ts")
const dashboardPage = read("app/(student)/dashboard/affiliate/page.tsx")
const dashboardShell = read("components/student-dashboard/StudentDashboardShell.tsx")
const dashboardActions = read("app/(student)/dashboard/actions.ts")
const payouts = read("lib/admin-affiliates.ts")
const payoutAccount = read("lib/affiliate-payout.ts")
const affiliateAlignment = read("lib/affiliate-alignment.ts")
const courseCheckout = read("lib/payments/course-checkout.ts")
const studentAuth = read("lib/student-auth.ts")
const completeAffiliateMigration = read("prisma/migrations/20260904160000_complete_affiliate_schema/migration.sql")
const adminPage = read("app/(internal)/internal/(admin)/affiliates/page.tsx")
const adminActions = read("app/(internal)/internal/(admin)/affiliates/actions.ts")

for (const column of [
  "onboarding_source", "email_verified_at", "terms_accepted_at", "terms_version",
  "activated_at", "verification_token_hash", "verification_expires_at"
]) assert.match(migration, new RegExp(column))

assert.match(onboarding, /status, eligibility_status[\s\S]*'pending_verification'/)
assert.match(onboarding, /crypto\.randomBytes\(48\)/)
assert.match(onboarding, /verification_token_hash = \$\{hash\}/)
assert.match(onboarding, /SET status = 'active'/)
assert.match(onboarding, /function missingOnboardingColumn/)
assert.match(onboarding, /PUBLIC_AFFILIATE_TERMS_VERSION/)
assert.match(onboarding, /createAccountIfMissing/)
assert.match(onboarding, /if \(!created\)[\s\S]*existingAccount: true/)
assert.match(onboarding, /LOWER\(sa\.email\) COLLATE utf8mb4_unicode_ci = LOWER\(co\.email\) COLLATE utf8mb4_unicode_ci/)
assert.match(onboarding, /LOWER\(sa\.email\) COLLATE utf8mb4_unicode_ci = LOWER\(cmp\.email\) COLLATE utf8mb4_unicode_ci/)
assert.doesNotMatch(onboarding, /course_orders[\s\S]*INSERT INTO course_orders/)
assert.doesNotMatch(onboarding, /course_manual_payments[\s\S]*INSERT INTO course_manual_payments/)

assert.match(registrationAction, /allowPublicAffiliateRegistrationRequest/)
assert.match(registrationAction, /password !== passwordConfirmation/)
assert.match(registrationAction, /affiliate\/register\?existing_student=1/)
assert.match(registrationPage, /acceptedTerms/)
assert.match(registrationPage, /at least 18 years old/)
assert.match(registrationPage, /You already have a student account/)
assert.match(registrationPage, /Sign in to Student Account/)
assert.match(registrationPage, /dashboard\/login\?next=%2Fdashboard%2Faffiliate/)
assert.match(activationPage, /activatePublicAffiliateAction/)
assert.match(resetPage, /accountContext="affiliate" successPath="\/dashboard\/affiliate"/)
assert.match(resetForm, /context: accountContext/)
assert.match(resetRequest, /affiliate\/reset-password/)
assert.match(partnerPage, /Join without buying a course/)

assert.match(dashboard, /canRefer = profile\.status === "active" && profile\.eligibilityStatus === "eligible"/)
assert.match(dashboard, /loadAffiliateProfiles/)
assert.match(dashboardPage, /Referral links unavailable/)
assert.match(dashboardShell, /workspaceMode === "affiliate"/)
assert.match(dashboardShell, /workspaceMode === "affiliate" \? "\/affiliate\/login" : "\/dashboard\/login"/)
assert.match(dashboardShell, /name="returnTo" value=\{logoutReturnTo\}/)
assert.match(dashboardActions, /formData\.get\("returnTo"\) === "\/affiliate\/login"/)
assert.match(dashboardActions, /redirect\(returnTo\)/)

assert.match(payoutAccount, /profile\.status[\s\S]*Affiliate profile is not active/)
assert.match(payouts, /p\.status = 'active' AND p\.eligibility_status = 'eligible'/)
assert.doesNotMatch(payouts, /HAVING totalCount > 0/)
assert.match(adminPage, /Waiting for the partner to confirm their email/)
assert.match(adminActions, /updateAffiliateProfileAccessAction/)

const affiliateRuntimeSources = [onboarding, payouts, payoutAccount, affiliateAlignment, courseCheckout]
for (const source of affiliateRuntimeSources) {
  assert.doesNotMatch(source, /CREATE TABLE/i)
  assert.doesNotMatch(source, /ALTER TABLE/i)
  assert.doesNotMatch(source, /addColumnIfMissing/)
  assert.doesNotMatch(source, /ensureAffiliate(?:AdminTables|Alignment|PayoutTables)|ensurePublicAffiliateOnboardingSchema/)
}

const affiliateRegistrationLimiter = studentAuth.match(
  /export async function allowPublicAffiliateRegistrationRequest[\s\S]*?\n}/
)?.[0] || ""
assert.ok(affiliateRegistrationLimiter)
assert.doesNotMatch(affiliateRegistrationLimiter, /ensureStudentSecurityTables/)
assert.match(affiliateRegistrationLimiter, /Promise\.all/)

for (const table of [
  "tochukwu_affiliate_commissions",
  "tochukwu_affiliate_payout_accounts",
  "tochukwu_affiliate_payout_batches",
  "tochukwu_affiliate_payout_items",
  "tochukwu_affiliate_payout_change_otps",
  "tochukwu_affiliate_school_referrals"
]) assert.match(completeAffiliateMigration, new RegExp(table))
for (const column of ["affiliate_code", "affiliate_profile_id", "affiliate_attribution_status"]) {
  assert.match(completeAffiliateMigration, new RegExp(`school_orders[\\s\\S]*${column}`))
}

console.log("Public affiliate onboarding end-to-end smoke checks passed.")
