import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8")

const actions = read("app/(internal)/internal/(admin)/manual-payments/actions.ts")
const page = read("app/(internal)/internal/(admin)/manual-payments/page.tsx")
const managedForm = read("app/(internal)/internal/(admin)/manual-payments/ManagedActionForm.tsx")
const addExternalForm = read("app/(internal)/internal/(admin)/manual-payments/AddExternalStudentForm.tsx")
const activationForm = read("app/(internal)/internal/(admin)/manual-payments/ActivationEmailForm.tsx")
const provisionForm = read("app/(internal)/internal/(admin)/manual-payments/ProvisionMissingAccountsForm.tsx")
const toaster = read("components/internal/InternalActionToaster.tsx")
const adminEnrollments = read("lib/admin-enrollments.ts")

const managedActions = [
  "reconcilePaystackPaymentsAction",
  "reviewManualPaymentAction",
  "updateManualPaymentEmailAction",
  "completeManualPaymentRecoveryAction",
  "sendManualPaymentMetaPurchaseAction",
  "resendBatchActivationEmailsAction",
  "deleteHolidayWaitlistContactAction",
  "sendWhatsAppCampaignAction"
]

assert.match(managedForm, /useActionState\(action, initialState\)/)
assert.match(managedForm, /data-toast-managed="true"/)
assert.match(managedForm, /showInternalToast\(/)
assert.match(managedForm, /activeButtonId === buttonId/)
assert.match(managedForm, /disabled=\{disabled \|\| context\.pending\}/)
assert.match(managedForm, /pendingLabel/)

for (const action of managedActions) {
  assert.match(page, new RegExp(`<ManagedActionForm action=\\{${action}\\}`))
  assert.match(
    actions,
    new RegExp(`export async function ${action}\\(\\n  _previousState: ManualPaymentActionState,`)
  )
}

assert.doesNotMatch(page, /<form action=\{\w+Action\}/)
assert.doesNotMatch(actions, /setInternalToast/)
assert.match(page, /pendingLabel="Approving\.\.\."/)
assert.match(page, /pendingLabel="Rejecting\.\.\."/)
assert.match(page, /pendingLabel="Sending test\.\.\."/)
assert.match(page, /pendingLabel="Dispatching\.\.\."/)
assert.match(actions, /title: sendTest \? "WhatsApp test sent" : "WhatsApp campaign queued"/)
assert.match(actions, /title: "Waitlist contact was not deleted"/)
assert.match(actions, /title: "Paystack reconciliation failed"/)
assert.match(actions, /title: "Batch activation emails were not sent"/)

for (const form of [addExternalForm, activationForm, provisionForm]) {
  assert.match(form, /useActionState/)
  assert.match(form, /data-toast-managed="true"/)
  assert.match(form, /showInternalToast\(/)
}

assert.match(actions, /Account created and Activation Email sent\./)
assert.match(actions, /Activation Email sent\./)
assert.match(toaster, /setTimeout\(\(\) => setToast\(null\), 5000\)/)
assert.match(toaster, /form\.getAttribute\("data-toast-managed"\) === "true"/)
assert.match(adminEnrollments, /UPDATE family_accounts[\s\S]*SET parent_email = \$\{newEmail\}[\s\S]*WHERE parent_account_id = \$\{oldAccount\.id\}/)

console.log("Manual payment toast completion smoke test passed.")
