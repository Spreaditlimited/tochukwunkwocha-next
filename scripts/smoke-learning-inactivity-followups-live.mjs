import path from "node:path"
import { createJiti } from "jiti"

const root = process.cwd()
process.env.AUTH_SECRET ||= "learning-followup-live-smoke-secret"
const jiti = createJiti(path.join(root, "scripts", "smoke-learning-inactivity-followups-live.mjs"), { alias: { "@": root } })
const { processLearningInactivityFollowups, listLearningFollowupAdminData } = await jiti.import("../lib/learning-inactivity-followups.ts")
const { prisma } = await jiti.import("../lib/prisma.ts")

try {
  const result = await processLearningInactivityFollowups({ forceDryRun: true })
  const admin = await listLearningFollowupAdminData({ limit: 5 })
  if (!result.dryRun || result.sent !== 0) throw new Error("Live smoke must never send email.")
  console.log(JSON.stringify({
    enabled: result.enabled,
    dryRun: result.dryRun,
    dueRecipientsInRun: result.dueRecipients,
    sent: result.sent,
    failed: result.failed,
    globalStats: admin.stats,
    hasExactPreview: Boolean(admin.emailPreview),
    visibleRows: admin.campaigns.length
  }))
} finally {
  await prisma.$disconnect()
}
