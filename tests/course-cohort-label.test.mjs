import assert from "node:assert/strict"
import test from "node:test"

import { cohortEnrollmentLabel } from "../lib/course-cohort-label.ts"

test("uses the earliest open batch month for the enrollment badge", () => {
  assert.equal(
    cohortEnrollmentLabel([
      { batchStartAt: "2026-10-19T18:00:00" },
      { batchStartAt: "2026-09-21T18:00:00" }
    ]),
    "September Cohort Now Enrolling"
  )
})

test("changes with future batch data and has a safe generic fallback", () => {
  assert.equal(
    cohortEnrollmentLabel([{ batchStartAt: "2027-01-18T18:00:00" }]),
    "January Cohort Now Enrolling"
  )
  assert.equal(cohortEnrollmentLabel([]), "Cohort Now Enrolling")
  assert.equal(cohortEnrollmentLabel([{ batchStartAt: "not-a-date" }]), "Cohort Now Enrolling")
})
