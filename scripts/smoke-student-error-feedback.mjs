import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

const root = process.cwd()
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8")

function filesUnder(relativeDirectory, extension) {
  const directory = path.join(root, relativeDirectory)
  return fs.readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
    .map((entry) => path.join(entry.parentPath, entry.name))
}

const { studentSafeErrorMessage } = await import(pathToFileURL(path.join(root, "lib/student-error-feedback.ts")))
const fallback = "Please try again."

assert.equal(studentSafeErrorMessage(new Error("Invalid `prisma.$executeRaw()` invocation"), fallback), fallback)
assert.equal(studentSafeErrorMessage(new Error("Transaction API error: Transaction already closed"), fallback), fallback)
assert.equal(studentSafeErrorMessage(new Error("Can't reach database server at db.internal:3306"), fallback), fallback)
assert.equal(studentSafeErrorMessage(new Error("TypeError at /Users/example/node_modules/file.ts:12"), fallback), fallback)
assert.equal(studentSafeErrorMessage(new Error("Target batch has already started."), fallback), "Target batch has already started.")
assert.equal(studentSafeErrorMessage(new Error("Current password is incorrect."), fallback), "Current password is incorrect.")

const routes = filesUnder("app/api/student", ".ts")
for (const absolutePath of routes) {
  const source = fs.readFileSync(absolutePath, "utf8")
  assert.doesNotMatch(source, /error:\s*error\s+instanceof\s+Error\s*\?\s*error\.message/, absolutePath)
  assert.doesNotMatch(source, /error:\s*(?:message|internalMessage)\b/, absolutePath)
}

const components = filesUnder("components/student-dashboard", ".tsx")
for (const absolutePath of components) {
  const source = fs.readFileSync(absolutePath, "utf8")
  assert.doesNotMatch(source, /window\.alert\(/, absolutePath)
  assert.doesNotMatch(source, /(?:error|reason|requestError|caught|err)\s+instanceof\s+Error\s*\?\s*(?:error|reason|requestError|caught|err)\.message/, absolutePath)
}

const toaster = read("components/student-dashboard/StudentActionToaster.tsx")
assert.match(toaster, /studentSafeErrorMessage/)
assert.match(read("lib/student-toast.ts"), /studentSafeErrorMessage/)
assert.match(read("lib/student-api-error.ts"), /studentSafeErrorMessage/)

console.log(`Student dashboard error feedback smoke test passed across ${routes.length} API routes and ${components.length} components.`)
