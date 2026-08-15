import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")

const outbox = read("lib/payment-notification-outbox.ts")
const paid = read("lib/payments/post-payment-student.ts")
const manual = read("lib/payments/manual-payment-review.ts")
const email = read("lib/email.ts")
const whatsapp = read("lib/transactional-whatsapp.ts")
const publicUrls = read("lib/public-site-url.ts")
const vercel = read("vercel.json")

for (const source of [paid, manual]) {
  assert.match(source, /enqueueEnrollmentConfirmationNotification/)
  assert.match(source, /processPaymentNotificationOutbox/)
}
assert.match(outbox, /event_type, source_uuid/)
assert.match(outbox, /syncEnrollmentToBrevo/)
assert.match(outbox, /sendStudentAccountReadyEmail/)
assert.match(outbox, /sendEnrollmentConfirmedWhatsApp/)
assert.match(outbox, /brevo_synced_at/)
assert.match(outbox, /email_sent_at/)
assert.match(outbox, /whatsapp_sent_at/)
assert.match(outbox, /status = 'retry'/)
assert.match(outbox, /payload_encrypted = ''/)
assert.match(email, /Outbound email contains a local URL and was blocked/)
assert.match(whatsapp, /Transactional WhatsApp message contains a local URL and was blocked/)
assert.match(publicUrls, /return PRODUCTION_SITE_URL/)
assert.match(vercel, /"path": "\/api\/cron\/payment-notifications"[\s\S]*?"schedule": "\*\/5 \* \* \* \*"/)

console.log("Enrollment notification delivery smoke test passed.")
