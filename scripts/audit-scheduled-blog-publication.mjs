import fs from "node:fs"
import { PrismaClient } from "@prisma/client"

function loadDotEnv(path = ".env") {
  if (!fs.existsSync(path)) return
  for (const rawLine of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#") || !line.includes("=")) continue
    const key = line.slice(0, line.indexOf("=")).trim()
    let value = line.slice(line.indexOf("=") + 1).trim()
    if (!key || process.env[key] != null) continue
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    process.env[key] = value
  }
}

loadDotEnv()
const prisma = new PrismaClient()

try {
  const now = new Date()
  const posts = await prisma.tochukwuBlogPost.findMany({
    select: { pidBlog: true, blogSlug: true, blogTitle: true, blogPublished: true, createdAt: true },
    orderBy: { createdAt: "asc" }
  })
  const scheduled = posts.filter((post) => post.blogPublished && post.createdAt > now)
  const live = posts.filter((post) => post.blogPublished && post.createdAt <= now)
  const futureDrafts = posts.filter((post) => !post.blogPublished && post.createdAt > now)
  const invalidScheduled = scheduled.filter((post) => !post.blogSlug || !post.blogTitle || !post.createdAt)
  const wouldNotPublishAtTimestamp = scheduled.filter((post) => !(post.blogPublished && post.createdAt <= new Date(post.createdAt.getTime())))
  const prematurelyEligible = scheduled.filter((post) => post.blogPublished && post.createdAt <= now)
  const dates = scheduled.map((post) => post.createdAt.toISOString())

  process.stdout.write(`${JSON.stringify({
    auditedAt: now.toISOString(),
    totalPosts: posts.length,
    livePublishedNow: live.length,
    scheduledPublishedFlagTrue: scheduled.length,
    futureDrafts: futureDrafts.length,
    invalidScheduled: invalidScheduled.length,
    prematurelyEligible: prematurelyEligible.length,
    wouldNotPublishAtTimestamp: wouldNotPublishAtTimestamp.length,
    schedule: scheduled.length ? {
      firstPublicationUtc: dates[0],
      lastPublicationUtc: dates.at(-1),
      uniquePublicationTimestamps: new Set(dates).size
    } : null,
    scheduledPosts: scheduled.map((post) => ({ slug: post.blogSlug, publishesAtUtc: post.createdAt.toISOString() }))
  }, null, 2)}\n`)

  if (invalidScheduled.length || prematurelyEligible.length || wouldNotPublishAtTimestamp.length) process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
