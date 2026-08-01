import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")

const family = read("lib/family-enrollment.ts")
const dashboard = read("lib/student-dashboard.ts")
const groupRoute = read("app/api/student/group-enrollment/route.ts")
const groupPanel = read("components/student-dashboard/GroupEnrollmentPanel.tsx")
const familyPage = read("app/(student)/dashboard/family/page.tsx")
const learnerPicker = read("components/student-dashboard/GroupLearnerBatchPicker.tsx")
const learnerBatchRoute = read("app/api/student/group-enrollment/learner-batch/route.ts")
const batchSwitch = read("lib/student-batch-switch.ts")
const checkout = read("lib/payments/course-checkout.ts")
const migration = read("prisma/migrations/20260801170000_add_group_learner_batch_audit/migration.sql")

assert.match(dashboard, /SUM\(seats_purchased\)/)
assert.match(dashboard, /GROUP BY course_slug/)
assert.match(family, /familyCourseSeatRows\(tx, family\.id, courseSlug, true\)/)
assert.match(family, /WHERE family_id = \$\{familyId\}[\s\S]*AND course_slug = \$\{courseSlug\}/)
assert.doesNotMatch(family, /familyCourseSeatRows[\s\S]{0,500}AND batch_key/)

assert.match(groupRoute, /prepareFamilyLearnerAssignments\(children, courseSlug\)/)
assert.match(groupRoute, /children: assignments/)
assert.match(groupPanel, /batchKey: learner\.batchKey/)
assert.match(groupPanel, /Learner Batch/)
assert.doesNotMatch(groupPanel, /Batch Allocation/)

assert.match(family, /The selected batch does not belong to this course/)
assert.match(family, /course_slug = \$\{courseSlug\}[\s\S]*batch_key = \$\{batchKey\}/)
assert.match(checkout, /COALESCE\(co\.buyer_type, 'student'\) <> 'family'/)
assert.match(checkout, /FROM family_child_enrollments fce/)

assert.match(familyPage, /Move an Entire Batch Group/)
assert.match(familyPage, /<BatchSwitchPanel/)
assert.match(familyPage, /<GroupLearnerBatchPicker/)
assert.match(learnerPicker, /group-enrollment\/learner-batch/)
assert.match(learnerBatchRoute, /parentAccountId: session\.account\.id/)
assert.match(family, /c\.parent_account_id = \$\{parentAccountId\}/)
assert.match(family, /current batch has already started/)
assert.match(family, /selected batch has already started/)
assert.match(batchSwitch, /Group learners cannot switch batches/)
assert.match(batchSwitch, /sourceType === "family_child"/)
assert.doesNotMatch(batchSwitch, /sourceType === "family" \|\| sourceType === "family_child"/)
assert.match(batchSwitch, /COUNT\(DISTINCT e\.child_id\) AS assignedLearners/)
assert.doesNotMatch(batchSwitch, /UPDATE family_seat_balances/)

assert.match(migration, /CREATE TABLE IF NOT EXISTS `tochukwu_group_learner_batch_changes`/)

console.log("Group seat and learner batch assignment smoke test passed.")
