import assert from "node:assert/strict"
import fs from "node:fs"

const migration = fs.readFileSync(
  "prisma/migrations/20260904140000_update_affiliate_course_rules/migration.sql",
  "utf8"
)

assert.match(migration, /'prompt-to-profit', 1, 'fixed', 500000, 'NGN'/)
assert.match(migration, /'prompt-to-profit-holiday', 0, 'fixed', 0, 'NGN'/)
assert.match(migration, /'prompt-to-production', 1, 'fixed', 2500000, 'NGN'/)
assert.match(migration, /ON DUPLICATE KEY UPDATE/)

console.log("Affiliate course rule smoke checks passed.")
