import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")
const assert = (condition, message) => { if (!condition) throw new Error(message) }

const publicData = read("lib/public-student-projects.ts")
const service = read("lib/student-public-profile.ts")
const profileApi = read("app/api/student/public-portfolio/route.ts")
const hireApi = read("app/api/projects/[slug]/hire/route.ts")
const publicPage = read("app/(public)/projects/[slug]/page.tsx")
const studentEditor = read("components/student-dashboard/StudentPublicPortfolioPanel.tsx")
const adminPage = read("app/(internal)/internal/(admin)/learning/portfolios/page.tsx")
const migration = read("prisma/migrations/20260821120000_add_student_public_portfolios/migration.sql")

assert(migration.includes("student_public_profiles") && migration.includes("student_hire_enquiries"), "Portfolio and enquiry tables must be migrated")
assert(read("prisma/migrations/20260821123000_add_student_portfolio_guardian_consent/migration.sql").includes("guardian_consent_confirmed"), "Young learner publication must record guardian consent")
assert(publicData.includes("publishedSnapshotJson") && publicData.includes("enhancedProfilePublished"), "Public profiles must use approved snapshots")
assert(publicData.includes("requiredContentComplete") && publicData.includes("profilePictureAuthorized"), "Public profiles must require complete content and an authorised portrait")
assert(publicData.includes("profileSlug: enhancedProfilePublished ?"), "Incomplete profiles must not emit a public profile link")
assert(service.includes("isAdultPortfolioAgeBand") && service.includes("managedOrYoung"), "Hiring eligibility must protect young and managed learners")
assert(profileApi.includes("requireStudent") && profileApi.includes("revalidateTag"), "Portfolio updates must be authenticated and invalidate public cache")
assert(hireApi.includes("verifyRecaptchaToken") && hireApi.includes("consumeServerRateLimit") && hireApi.includes("studentHireEnquiry.create"), "Hiring enquiries must be protected and audited")
assert(!publicPage.includes("studentEmail") && !publicPage.includes("phoneE164"), "Public page must not expose private contact data")
assert(studentEditor.includes("publicProfileConsent") && studentEditor.includes("profilePictureConsent"), "Student editor must capture explicit publication consent")
assert(adminPage.includes("Portfolio review queue") && adminPage.includes("Hiring enquiries"), "Admin must control profile publication and enquiries")

console.log("Student portfolio smoke checks passed.")
