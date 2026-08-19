import fs from "node:fs/promises"
import path from "node:path"

const root = process.cwd()

async function read(file) {
  return fs.readFile(path.join(root, file), "utf8")
}

function functionSection(source, name) {
  const directStart = source.indexOf(`export async function ${name}`)
  const defaultStart = source.indexOf(`export default async function ${name}`)
  const start = directStart >= 0 ? directStart : defaultStart
  if (start < 0) throw new Error(`Missing function ${name}`)
  const next = source.indexOf("\nexport ", start + 1)
  return source.slice(start, next < 0 ? source.length : next)
}

const failures = []
function expect(condition, message) {
  if (!condition) failures.push(message)
}

const auth = await read("lib/auth.ts")
expect(!functionSection(auth, "getAdminSession").includes("ensureAdminSecurityTables"), "Admin session reads must not run schema DDL")
expect(auth.includes("getAdminSessionForRequest = cache"), "Repeated admin guards in one render should share one session lookup")

const picture = await read("lib/student-profile-picture.ts")
expect(!functionSection(picture, "getStudentProfilePicture").includes("ensureStudentProfilePictureColumns"), "Profile-picture reads must not run schema DDL")

const studentAuth = await read("lib/student-auth.ts")
expect(!functionSection(studentAuth, "getStudentProfile").includes("ensureStudentDemographicColumns"), "Student profile reads must not run schema DDL")
expect(studentAuth.includes("getStudentSessionForRequest = cache"), "Repeated student guards in one render should share one session lookup")

const projects = await read("lib/public-student-projects.ts")
expect(!projects.includes("addColumnIfMissing"), "Public project reads must not alter the database schema")

const publicVideoSlots = await read("lib/public-video-slots.ts")
expect(!publicVideoSlots.includes("ensureVideoLibraryTables"), "Public video reads must not create admin tables")

const financials = await read("lib/admin-financials.ts")
expect(!functionSection(financials, "listFinancialTransactions").includes("reconcileFinancialTransactions"), "Financial list views must not reconcile/write on navigation")

const paystackCron = await read("app/api/cron/paystack-reconciliation/route.ts")
expect(paystackCron.includes("reconcileFinancialTransactions"), "Financial reconciliation must remain in the scheduled reconciliation job")

const affiliate = await read("lib/student-dashboard.ts")
expect(!functionSection(affiliate, "getStudentAffiliateSummary").includes("matureAffiliateCommissions"), "Affiliate summary reads must not mature/write commissions")

const adminOverview = await read("app/(internal)/internal/(admin)/page.tsx")
expect(adminOverview.includes("const rows = await prisma.$queryRaw<OperationsOverviewRow[]>"), "Admin overview should use one aggregate query")
expect(!functionSection(adminOverview, "DashboardPage").includes("Promise.all(["), "Admin overview must not fan out database counts")

const authProvider = await read("components/student-dashboard/StudentAuthContext.tsx")
expect(authProvider.includes("loadedSessionOnce"), "Persistent student navigation should reuse the loaded session")

for (const file of [
  "app/(internal)/internal/(admin)/coupons/page.tsx",
  "app/(internal)/internal/(admin)/coupons/actions.ts",
  "app/(internal)/internal/(admin)/private-coaching/page.tsx",
  "app/(internal)/internal/(admin)/domains/page.tsx"
]) {
  const source = await read(file)
  expect(!/CREATE TABLE IF NOT EXISTS|ALTER TABLE|addColumnIfMissing/.test(source), `${file} must not run schema DDL in the dashboard runtime`)
}

for (const file of [
  "app/api/student/learning/progress/route.ts",
  "app/api/student/learning/playback/route.ts",
  "app/api/student/learning/support/route.ts",
  "app/api/checkout/config/route.ts",
  "app/api/checkout/order/route.ts"
]) {
  const source = await read(file)
  expect(source.includes("studentApiErrorResponse"), `${file} must return user-safe API errors`)
}

for (const file of [
  "app/error.tsx",
  "app/global-error.tsx",
  "app/(student)/dashboard/error.tsx",
  "app/(internal)/internal/(admin)/error.tsx"
]) {
  const source = await read(file)
  expect(!source.includes("error.message"), `${file} must never render or log raw error messages`)
  expect(source.includes("AppErrorFallback"), `${file} must render the safe retry UI`)
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`)
  process.exit(1)
}

console.log("PASS dashboard reads avoid runtime DDL/write work, database fan-out is bounded, and user-facing errors are sanitised")
