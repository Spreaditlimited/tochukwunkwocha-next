import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")

const auth = read("lib/student-auth.ts")
const panel = read("components/student-dashboard/ProfileSecurityPanel.tsx")
const profileApi = read("app/api/student/profile/route.ts")

assert.match(auth, /export async function hasIssuedStudentCertificate/)
assert.match(auth, /student_certificates[\s\S]*certificate\.status = 'issued' OR certificate\.issued_at IS NOT NULL/)
assert.match(auth, /school_certificates[\s\S]*certificate\.status = 'issued' OR certificate\.issued_at IS NOT NULL/)
assert.doesNotMatch(auth, /nameChanged && existing\.certificateNameConfirmedAt/)
assert.match(auth, /nameChanged && await hasIssuedStudentCertificate\(accountId\)/)
assert.match(auth, /certificateNameConfirmedAt: nameChanged \? null/)
assert.match(auth, /UPDATE family_children SET full_name/)
assert.match(auth, /UPDATE school_students SET full_name/)
assert.match(auth, /UPDATE tochukwu_learning_assignments SET student_name/)
assert.match(auth, /UPDATE student_public_profiles SET display_name/)
assert.match(panel, /disabled=\{profile\.certificateNameLocked\}/)
assert.match(panel, /You may correct this name until a certificate is issued/)
assert.doesNotMatch(profileApi, /revalidateTag\("public-student-projects"\)/)

console.log("Student profile name-lock smoke checks passed.")
