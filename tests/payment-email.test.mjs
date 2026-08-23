import assert from "node:assert/strict"
import test from "node:test"

import {
  normalizePaymentEmail,
  normalizeStudentAccountEmail,
  validatePaymentEmail
} from "../lib/payment-email.ts"

test("rejects common provider-domain typos with a useful correction", () => {
  const result = validatePaymentEmail("doocharity@gmail.con")
  assert.equal(result.valid, false)
  assert.equal(result.suggestion, "doocharity@gmail.com")
  assert.match(result.error, /Did you mean doocharity@gmail\.com/)
  assert.equal(normalizePaymentEmail("doocharity@gmail.con"), "")
})

test("accepts normalized public addresses and rejects local or malformed domains", () => {
  assert.equal(normalizePaymentEmail(" Buyer@Example.COM "), "buyer@example.com")
  assert.equal(validatePaymentEmail("learner@student-code.local").valid, false)
  assert.equal(validatePaymentEmail("buyer@example").valid, false)
  assert.equal(validatePaymentEmail("buyer@example..com").valid, false)
})

test("permits only generated family learner identities through an explicit account-only opt-in", () => {
  const internalEmail = "family-child-0e634ba2a7ea4c5889f84f3fc2ad105c@student-code.local"

  assert.equal(normalizePaymentEmail(internalEmail), "")
  assert.equal(normalizeStudentAccountEmail(internalEmail), "")
  assert.equal(
    normalizeStudentAccountEmail(internalEmail, { allowInternalFamilyLearner: true }),
    internalEmail
  )
  assert.equal(
    normalizeStudentAccountEmail("learner@student-code.local", { allowInternalFamilyLearner: true }),
    ""
  )
  assert.equal(
    normalizeStudentAccountEmail("family-child-not-a-uuid@student-code.local", { allowInternalFamilyLearner: true }),
    ""
  )
})
