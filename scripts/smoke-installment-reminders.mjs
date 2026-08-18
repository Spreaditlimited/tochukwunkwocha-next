import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")

const [overview, notification, outbox, reminder, route, vercel, migration] = await Promise.all([
  read("app/(internal)/internal/(admin)/page.tsx"),
  read("lib/enrollment-notifications.ts"),
  read("lib/payment-notification-outbox.ts"),
  read("lib/installment-reminders.ts"),
  read("app/api/cron/installment-reminders/route.ts"),
  read("vercel.json"),
  read("prisma/migrations/20260818120000_add_installment_reminders/migration.sql")
])

assert.match(overview, /FROM student_installment_plans\s+WHERE status <> 'merged'/)
assert.match(notification, /IMPORTANT: Your group enrollment is ready — assign your learners now/)
assert.match(notification, /IMPORTANT: Your course access is ready — keep this email/)
assert.match(notification, /Open Group Enrollment and select Assign Learners/)
assert.match(notification, /use Group Access Code, enter the code, and confirm their name/)
assert.match(outbox, /dashboardPath: payload\.dashboardPath/)
assert.match(outbox, /batchLabel: payload\.batchLabel/)

assert.match(reminder, /MAX_INSTALLMENT_REMINDERS = 4/)
assert.match(reminder, /No payment has been recorded on this plan yet/)
assert.match(reminder, /pl\.status <> 'open' OR pl\.total_paid_minor >= pl\.target_amount_minor/)
assert.match(reminder, /UNIQUE KEY uniq_tochukwu_installment_reminder_plan/)
assert.match(reminder, /next_reminder_at = DATE_ADD\(NOW\(\), INTERVAL 7 DAY\)/)
assert.match(route, /processInstallmentReminders/)
assert.match(route, /beginAutomationRun\("installment-reminders"\)/)
assert.match(vercel, /"path": "\/api\/cron\/installment-reminders"/)
assert.match(vercel, /"schedule": "0 8 \* \* \*"/)
assert.match(migration, /UNIQUE KEY `uniq_tochukwu_installment_reminder_plan`/)

console.log("Installment reminder and enrollment-email smoke checks passed.")
