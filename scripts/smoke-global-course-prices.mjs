import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")
const [formatter, display, home, catalogue, detail, checkout, checkoutForm, advanced, basic, business, schools, seo, dashboard] = await Promise.all([
  read("lib/course-price-display.ts"),
  read("components/courses/CourseFeeDisplay.tsx"),
  read("app/(public)/page.tsx"),
  read("app/(public)/courses/page.tsx"),
  read("app/(public)/courses/[slug]/page.tsx"),
  read("app/(public)/checkout/[slug]/page.tsx"),
  read("components/checkout/CourseCheckoutForm.tsx"),
  read("components/courses/PromptToProfitAdvancedCoursePage.tsx"),
  read("components/courses/PromptToProfitCoursePage.tsx"),
  read("components/courses/AiForEverydayBusinessOwnersCoursePage.tsx"),
  read("components/courses/PromptToProfitSchoolsCoursePage.tsx"),
  read("lib/site-seo.ts"),
  read("lib/student-dashboard.ts")
])

assert.match(formatter, /currency: "NGN"[\s\S]*currency: "USD"[\s\S]*currency: "GBP"[\s\S]*currency: "EUR"/)
assert.match(display, /International payments supported/)
assert.match(display, /Checkout uses your billing currency/)
assert.equal((home.match(/<CourseFeeDisplay/g) || []).length, 3)
assert.equal((catalogue.match(/<CourseFeeDisplay/g) || []).length, 4)
assert.match(detail, /courseJsonLd\(course, courseOffers\(courseSettings\)\)/)
assert.match(checkout, /coursePrices=\{coursePrices\}/)
assert.equal((checkoutForm.match(/<CourseFeeDisplay/g) || []).length, 2)
for (const source of [advanced, basic, business, schools]) assert.match(source, /<CourseFeeDisplay/)
assert.doesNotMatch(advanced, /Course Cost[^\n]*₦150,000/)
assert.doesNotMatch(basic, /For N10,000 only/)
assert.match(schools, /perLearner/)
assert.match(seo, /offers: offers\.length \? offers : undefined/)
assert.match(dashboard, /getAdminSettingValue\("SCHOOLS_PRICE_PER_STUDENT_NGN_MINOR"\)/)
assert.match(dashboard, /process\.env\.SCHOOLS_PRICE_PER_STUDENT_NGN_MINOR \|\| 1000000/)
assert.doesNotMatch(dashboard, /850000/)

console.log("Global course-price display smoke checks passed.")
