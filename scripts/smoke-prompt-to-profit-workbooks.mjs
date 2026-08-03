import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const pagePath = path.join(root, "components/courses/PromptToProfitCoursePage.tsx")
const page = fs.readFileSync(pagePath, "utf8")

const covers = [
  "expense-tracker-cover.png",
  "customer-record-management-system-cover.png",
  "professional-quotation-generator-cover.png",
  "professional-invoice-generator-cover.png",
  "appointment-booking-system-cover.png"
]

for (const cover of covers) {
  assert.match(page, new RegExp(cover.replace(".", "\\.")))
  assert.ok(fs.existsSync(path.join(root, "public/shop/workbooks", cover)), `${cover} is missing`)
}

assert.match(page, /Included with your enrolment/)
assert.match(page, /Five Software Workbooks\. Five More Systems You Can Build\./)
assert.match(page, /softwareWorkbooks\.map\(\(workbook\) =>/)
assert.match(page, /alt={`\$\{workbook\.title\} software workbook cover`}/)
assert.match(page, /Enroll and Get the Workbooks/)
assert.equal((page.match(/min-h-\[260px\] max-w-5xl rounded-3xl/g) || []).length, 2)
assert.match(page, /mx-auto mt-20 min-h-\[260px\] max-w-5xl[^"]*lg:mt-28/)
assert.doesNotMatch(page, /href="\/projects\?from=prompt-to-profit" className="[^"]*bg-white/)
assert.ok(
  page.indexOf("Included Project Library") < page.indexOf('id="student-websites"'),
  "The workbook library must appear before student proof."
)

console.log("Prompt to Profit workbook section smoke test passed.")
