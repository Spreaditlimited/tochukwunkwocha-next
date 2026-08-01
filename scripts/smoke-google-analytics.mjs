import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const analytics = fs.readFileSync(path.join(root, "components/GoogleAnalytics.tsx"), "utf8")

assert.match(analytics, /STATIC_SITE_MEASUREMENT_ID = "G-K09N39FSXZ"/)
assert.match(analytics, /window\.dataLayer\?\.push\(arguments\)/)
assert.doesNotMatch(analytics, /window\.dataLayer\?\.push\((?:args|_args)\)/)
assert.match(analytics, /window\.gtag\("config", id\)/)
assert.match(analytics, /tochukwu-cookie-consent/)

console.log("Google Analytics initialization smoke test passed.")
