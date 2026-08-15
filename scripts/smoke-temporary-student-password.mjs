import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")

const auth = read("lib/student-auth.ts")
const actions = read("app/(student)/dashboard/actions.ts")
const resetPage = read("app/(student)/dashboard/reset-password/page.tsx")
const notifications = read("lib/enrollment-notifications.ts")
const paidProvisioning = read("lib/payments/post-payment-student.ts")
const manualReview = read("lib/payments/manual-payment-review.ts")
const manualRoute = read("app/api/checkout/manual-payment/route.ts")
const outbox = read("lib/payment-notification-outbox.ts")

assert.match(auth, /export async function createStudentTemporaryPassword/)
assert.match(auth, /mustResetPassword: true/)
assert.match(auth, /resetTokenExpiresAt: null/)
assert.match(auth, /resetRequestedAt: now/)
assert.match(auth, /passwordHash: account\.passwordHash,[\s\S]*mustResetPassword: true/)
assert.match(auth, /passwordHash: replacementHash/)
assert.match(auth, /passwordSetupToken: token/)
assert.match(actions, /dashboard\/reset-password\?token=.*first_use=1/)
assert.match(resetPage, /temporary password has been accepted and cannot be used again/)

assert.match(notifications, /Temporary password:/)
assert.match(notifications, /has no time limit/)
assert.match(notifications, /stops working immediately after your first successful use/)
assert.match(paidProvisioning, /createStudentTemporaryPassword\(email\)/)
assert.match(paidProvisioning, /existing\.mustResetPassword && !existing\.resetRequestedAt/)
assert.match(paidProvisioning, /temporaryPassword: temporary\?\.password \|\| null/)
assert.match(manualReview, /createStudentTemporaryPassword\(email\)/)
assert.match(manualRoute, /createStudentTemporaryPassword\(input\.email\)/)
assert.match(outbox, /temporaryPassword: payload\.temporaryPassword/)

console.log("Temporary student password smoke test passed.")
