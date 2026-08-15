import fs from "node:fs"
import { PrismaClient } from "@prisma/client"
import { generatedBlogHtmlIssues } from "../lib/blog-content-html.ts"

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
const checkpoint = JSON.parse(fs.readFileSync("/private/tmp/tochukwu-scheduled-blog-rewrites.json", "utf8"))
const backup = JSON.parse(fs.readFileSync("/private/tmp/tochukwu-scheduled-blog-rewrites-backup.json", "utf8"))
const backupByPid = new Map(backup.map((post) => [post.pidBlog, post]))
const prisma = new PrismaClient()

try {
  const pids = Object.keys(checkpoint.rewrites)
  const posts = await prisma.tochukwuBlogPost.findMany({
    where: { pidBlog: { in: pids } },
    select: { pidBlog: true, blogSlug: true, blogContent: true, blogImage: true, createdAt: true }
  })
  const failures = []
  for (const post of posts) {
    const rewrite = checkpoint.rewrites[post.pidBlog], original = backupByPid.get(post.pidBlog)
    if (post.blogContent !== rewrite.html) failures.push(`${post.blogSlug}: stored content does not match the validated rewrite`)
    if (post.blogImage !== original.blogImage) failures.push(`${post.blogSlug}: image changed`)
    if (post.createdAt.toISOString() !== original.createdAt) failures.push(`${post.blogSlug}: publication date changed`)
    if (post.createdAt <= new Date()) failures.push(`${post.blogSlug}: is no longer scheduled`)
    const issues = generatedBlogHtmlIssues(post.blogContent)
    if (issues.length) failures.push(`${post.blogSlug}: ${issues.join(", ")}`)
  }
  if (posts.length !== pids.length) failures.push(`found ${posts.length}/${pids.length} rewritten posts`)
  process.stdout.write(`${JSON.stringify({
    expectedRewrites: pids.length,
    verifiedRewrites: posts.length,
    contentMatches: posts.filter((post) => post.blogContent === checkpoint.rewrites[post.pidBlog].html).length,
    imagesUnchanged: posts.filter((post) => post.blogImage === backupByPid.get(post.pidBlog).blogImage).length,
    datesUnchanged: posts.filter((post) => post.createdAt.toISOString() === backupByPid.get(post.pidBlog).createdAt).length,
    failures
  }, null, 2)}\n`)
  if (failures.length) process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
