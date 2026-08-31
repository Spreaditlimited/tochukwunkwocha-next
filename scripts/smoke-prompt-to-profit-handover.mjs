import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const [checkout, page, form, settings, home, courses, coursePage, promptToProfitPage] = await Promise.all([
  readFile(new URL("../lib/payments/course-checkout.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/(public)/checkout/[slug]/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/checkout/CourseCheckoutForm.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/public-course-settings.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/(public)/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/(public)/courses/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/(public)/courses/[slug]/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/courses/PromptToProfitCoursePage.tsx", import.meta.url), "utf8")
])

assert.match(checkout, /HOLIDAY_ENROLLMENT_RETIRES_AT = Date\.UTC\(2026, 7, 23, 23, 0, 0\)/)
assert.match(checkout, /courseSlug === HOLIDAY_COURSE_SLUG && isPromptToProfitHolidayEnrollmentRetired\(\)/)
assert.match(settings, /getCurrentPromptToProfitSettings/)
assert.match(settings, /holiday\?\.openBatches\.length/)
assert.match(page, /getCurrentPromptToProfitSettings\(\)/)
assert.match(home, /getCurrentPromptToProfitSettings\(\)/)
assert.match(courses, /getCurrentPromptToProfitSettings\(\)/)
assert.match(coursePage, /getCurrentPromptToProfitSettings\(\)/)
assert.match(form, /checkoutCourseSlugOverride \|\| resolveCheckoutCourseSlug\(course\)/)
assert.match(promptToProfitPage, /cohortEnrollmentLabel\(openBatches\)/)
assert.doesNotMatch(promptToProfitPage, /August Summer Cohorts Now Enrolling/)
assert.match(settings, /COUNT\(DISTINCT lesson\.id\)/)
assert.match(settings, /lesson\.video_asset_id IS NOT NULL/)
assert.match(settings, /NOT EXISTS[\s\S]*tochukwu_learning_module_batch_drips any_schedule/)
assert.match(settings, /JOIN course_batches current_batch/)
assert.match(settings, /current_batch\.is_active = 1/)
assert.match(promptToProfitPage, /courseSettings\.activeLessonCount/)
assert.doesNotMatch(promptToProfitPage, /32 Recorded Lessons/)

console.log("Prompt to Profit Holiday-to-standard handover smoke checks passed.")
