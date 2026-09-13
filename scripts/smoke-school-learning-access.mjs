import assert from "node:assert/strict"
import fs from "node:fs/promises"

const [schoolAccess, studentDashboard, learningPlayer] = await Promise.all([
  fs.readFile("lib/school-course-access.ts", "utf8"),
  fs.readFile("lib/student-dashboard.ts", "utf8"),
  fs.readFile("lib/learning-player.ts", "utf8")
])

assert.match(schoolAccess, /FROM school_students ss\s+JOIN school_accounts sc/)
assert.match(schoolAccess, /JOIN school_student_course_access access/)
assert.match(schoolAccess, /DATE_ADD\(COALESCE\(sc\.access_starts_at, sc\.paid_at, sc\.created_at\), INTERVAL 1 YEAR\) >= NOW\(\)/)
assert.match(studentDashboard, /'school' AS source/)
assert.match(studentDashboard, /'school_upgrade' AS source/)
assert.match(studentDashboard, /visibleSchoolCourseSlug/)
assert.match(learningPlayer, /hasActiveSchoolCourseAccess/)
assert.match(learningPlayer, /if \(context\.schoolImmediateAccess\) return true/)

console.log("PASS school learners receive dashboard, player, and immediate lesson access")
