import fs from "node:fs"
import { PrismaClient } from "@prisma/client"
import { normalizeBlogContentForStorage } from "../lib/blog-content-html.ts"

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

function cleanTrackedUrl(value) {
  try {
    const url = new URL(value.replace(/&amp;/g, "&"))
    if (url.searchParams.get("utm_source")?.toLowerCase() === "openai") url.searchParams.delete("utm_source")
    return url.toString()
  } catch {
    return value
  }
}

function repairMarkdownLinks(value) {
  return value.replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/gi, (_match, label, url) => {
    const href = cleanTrackedUrl(url).replace(/&/g, "&amp;").replace(/"/g, "&quot;")
    return `<a href="${href}">${label}</a>`
  })
}

loadDotEnv()
const prisma = new PrismaClient()
const apply = process.argv.includes("--apply")

async function main() {
  const posts = await prisma.tochukwuBlogPost.findMany({
    select: { pidBlog: true, blogSlug: true, blogContent: true },
    orderBy: { createdAt: "asc" }
  })
  const updates = posts.flatMap((post) => {
    const before = String(post.blogContent || "")
    const after = repairMarkdownLinks(normalizeBlogContentForStorage(before))
    return before === after ? [] : [{ ...post, before, after }]
  })

  if (apply && updates.length) {
    await prisma.$transaction(updates.map((post) => prisma.tochukwuBlogPost.update({
      where: { pidBlog: post.pidBlog },
      data: { blogContent: post.after }
    })))
  }

  process.stdout.write(`${JSON.stringify({
    mode: apply ? "applied" : "dry-run",
    articlesScanned: posts.length,
    articlesChanged: updates.length,
    slugs: updates.map((post) => post.blogSlug)
  }, null, 2)}\n`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
