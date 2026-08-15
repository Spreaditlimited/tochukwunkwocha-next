import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const page = await readFile(
  new URL("../app/(internal)/internal/(admin)/installments/page.tsx", import.meta.url),
  "utf8"
)

assert.match(page, /searchParams\?: Promise/)
assert.match(page, /name="search"/)
assert.match(page, /planSearchSql\(search\)/)
assert.match(page, /paymentSearchSql\(search\)/)
assert.match(page, /COALESCE\(sa\.email, ''\) LIKE/)
assert.match(page, /ip\.provider_reference, ''\) LIKE/)
assert.match(page, /ip\.payment_uuid LIKE/)
assert.match(page, /pl\.course_slug LIKE/)

console.log("Admin installments search smoke checks passed.")
