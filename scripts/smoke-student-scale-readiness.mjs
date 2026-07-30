import fs from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const checks = [
  {
    file: "lib/student-auth.ts",
    includes: ["SESSION_LAST_SEEN_WRITE_INTERVAL_MS", "profilePictureUrl: true"]
  },
  {
    file: "components/student-dashboard/player/CoursePlayer.tsx",
    includes: ["watchSeconds: 60", "document.visibilityState", "}, 60000)"]
  },
  {
    file: "lib/learning-player.ts",
    includes: ["export async function studentHasCourseAccess", "WHERE EXISTS (", "learningSupportTablesPromise"]
  },
  {
    file: "app/api/student/learning/progress/route.ts",
    includes: ["consumeServerRateLimit", "Math.min(120"]
  },
  {
    file: "prisma/migrations/20260730180000_student_scale_readiness/migration.sql",
    includes: [
      "idx_course_orders_student_access",
      "idx_manual_payments_student_access",
      "idx_family_child_account_status"
    ]
  },
  {
    file: "app/api/internal/system/readiness/route.ts",
    includes: ["Owner access is required", "innodbBufferPoolBytes", "requiredIndexesPresent"]
  }
]

let failed = false
for (const check of checks) {
  const contents = await fs.readFile(path.join(root, check.file), "utf8")
  for (const marker of check.includes) {
    if (!contents.includes(marker)) {
      failed = true
      console.error(`FAIL ${check.file}: missing ${marker}`)
    }
  }
}

if (failed) process.exit(1)
console.log(`PASS ${checks.length} student scale-readiness checks`)
