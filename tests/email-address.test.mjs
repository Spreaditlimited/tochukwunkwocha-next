import assert from "node:assert/strict"
import test from "node:test"

import { isDeliverableEmail, normalizeDeliverableEmail } from "../lib/email-address.ts"

test("synthetic child and local-only addresses can never reach an email provider", () => {
  assert.equal(normalizeDeliverableEmail("family-child-123@student-code.local"), "")
  assert.equal(normalizeDeliverableEmail("learner@account.local"), "")
  assert.equal(normalizeDeliverableEmail("learner@localhost"), "")
  assert.equal(isDeliverableEmail("school-student@example.localhost"), false)
})

test("deliverable addresses are normalized", () => {
  assert.equal(normalizeDeliverableEmail(" Parent@Example.COM "), "parent@example.com")
  assert.equal(isDeliverableEmail("parent@example.com"), true)
  assert.equal(isDeliverableEmail("not-an-email"), false)
})
