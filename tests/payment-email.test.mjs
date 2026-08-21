import assert from "node:assert/strict"
import test from "node:test"

import { normalizePaymentEmail, validatePaymentEmail } from "../lib/payment-email.ts"

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
