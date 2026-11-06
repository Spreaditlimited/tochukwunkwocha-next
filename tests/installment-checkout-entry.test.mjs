import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import test from "node:test"
import ts from "typescript"

const require = createRequire(import.meta.url)
const root = path.resolve(import.meta.dirname, "..")
function load(file, overrides, cache = new Map()) {
  if (Object.hasOwn(overrides, file)) return overrides[file]
  if (file === "lib/prisma") throw new Error("These tests must not connect to a database")
  if (cache.has(file)) return cache.get(file).exports
  const filename = ["tsx", "ts"].map(extension => path.join(root, `${file}.${extension}`)).find(fs.existsSync)
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true}
  }).outputText
  const mod = {exports: {}}
  cache.set(file, mod)
  new Function("require", "module", "exports", compiled)(name => name.startsWith("@/") ? load(name.slice(2), overrides, cache) : overrides[name] || require(name), mod, mod.exports)
  return mod.exports
}

class Redirect extends Error {
  constructor(url) { super(url); this.url = url }
}
const navigation = {redirect: url => {throw new Redirect(url)}, notFound: () => {throw new Error("Not found")}}
const placeholder = () => null

const checkout = load("app/(public)/checkout/[slug]/page", {
  "lucide-react": {},
  "next/navigation": navigation,
  "components/checkout/CourseCheckoutForm": {CourseCheckoutForm: placeholder},
  "components/checkout/ServiceCheckoutForm": {ServiceCheckoutForm: placeholder},
  "lib/payments/service-checkout": {isServiceCheckoutSlug: () => false},
  "lib/public-course-settings": {
    getCurrentPromptToProfitSettings: async () => ({courseSlug: "prompt-to-profit"}),
    getPublicCourseSettings: async () => ({openBatches: [{batchKey: "selected-cohort"}]})
  },
  "lib/site-seo": {buildMetadata: value => value}
}).default

test("Basic and Advanced installment links open checkout preselected without authentication", async () => {
  for (const slug of ["prompt-to-profit", "prompt-to-production"]) {
    const page = await checkout({params: Promise.resolve({slug}), searchParams: Promise.resolve({paymentMethod: "installment", batch: "selected-cohort"})})
    assert.equal(page.props.initialInstallment, true)
    assert.equal(page.props.initialBatchKey, "selected-cohort")
    assert.equal(page.props.checkoutCourseSlugOverride, slug)
    const regular = await checkout({params: Promise.resolve({slug})})
    assert.equal(regular.props.initialInstallment, false)
  }
})

test("canonical checkout redirects preserve installment choice, cohort, coupon and referral", async () => {
  const query = {paymentMethod: "installment", batch: "selected-cohort", coupon: "SAVE10", ref: "REFERRAL"}
  await assert.rejects(checkout({params: Promise.resolve({slug: "prompt-to-profit-advanced"}), searchParams: Promise.resolve(query)}), error => {
    assert.ok(error instanceof Redirect)
    const url = new URL(error.url, "https://example.com")
    assert.equal(url.pathname, "/checkout/prompt-to-production")
    assert.deepEqual(Object.fromEntries(url.searchParams), query)
    return true
  })
})

function dashboard(session) {
  return load("app/(student)/dashboard/installments/page", {
    "lucide-react": {},
    "next/navigation": navigation,
    "components/student-dashboard/InstallmentsPanel": {InstallmentsPanel: placeholder},
    "components/student-dashboard/StudentDashboardShell": {StudentDashboardShell: placeholder},
    "lib/student-auth": {
      getStudentSession: async () => session,
      requireStudent: async () => {throw new Error("Authentication required")},
      getStudentProfile: async () => {assert.ok(session); return {fullName: "Test", email: "test@example.com", phone: ""}}
    },
    "lib/student-dashboard": {listActiveLearningCourseOptions: async () => {assert.ok(session); return []}},
    "lib/student-installments": {listStudentInstallmentPlans: async () => {assert.ok(session); return []}}
  }).default
}

test("old course-specific dashboard links send anonymous visitors to checkout with their coupon", async () => {
  for (const [course, slug] of [["prompt-to-profit-holiday", "prompt-to-profit"], ["prompt-to-production", "prompt-to-production"]]) {
    await assert.rejects(dashboard(null)({searchParams: Promise.resolve({course, coupon: " save10 "})}), error => {
      assert.ok(error instanceof Redirect)
      assert.equal(error.url, `/checkout/${slug}?paymentMethod=installment&coupon=SAVE10`)
      return true
    })
  }
})

test("existing learners can still manage plans, and anonymous management access stays protected", async () => {
  const session = {account: {id: 1n}}
  const page = await dashboard(session)({searchParams: Promise.resolve({course: "prompt-to-profit"})})
  assert.equal(page.props.account, session.account)
  assert.equal(page.props.children.props.initialCourseSlug, "prompt-to-profit")
  for (const query of [{}, {course: "unknown-course"}]) {
    await assert.rejects(dashboard(null)({searchParams: Promise.resolve(query)}), /Authentication required/)
  }
})
