import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const source = await readFile(new URL("../lib/public-student-projects.ts", import.meta.url), "utf8")

assert.match(
  source,
  /COALESCE\(NULLIF\(sa\.full_name, ''\), NULLIF\(c\.recipient_name, ''\), NULLIF\(a\.student_name, ''\)\) AS studentName/,
  "Public projects must prefer the authoritative student account name over certificate and assignment snapshots."
)

console.log("Public student-project name precedence smoke check passed.")
